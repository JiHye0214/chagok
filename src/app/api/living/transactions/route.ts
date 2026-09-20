import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/user";

type TransactionType = "income" | "expense" | "transfer";

type TransferDirection = "living_to_savings" | "savings_to_living" | null;

type CategoryKind = "fixed" | "variable" | "income";

type TransactionRow = {
    id: number;
    transaction_date: string;
    type: TransactionType;
    amount: number | string;
    category_id: number | null;
    category_name: string | null;
    memo: string | null;
    transfer_direction: TransferDirection;
};

const FREE_LIVING_TRANSACTION_LIMIT = 300;

const toNumber = (value: unknown) => {
    return Number(value ?? 0);
};

const normalizeTransaction = (row: TransactionRow) => {
    return {
        id: row.id,
        transactionDate: row.transaction_date,
        type: row.type,
        amount: toNumber(row.amount),
        categoryId: row.category_id,
        categoryName: row.category_name,
        memo: row.memo,
        transferDirection: row.transfer_direction,
    };
};

const isTransactionType = (value: unknown): value is TransactionType => {
    return value === "income" || value === "expense" || value === "transfer";
};

const isTransferDirection = (value: unknown): value is Exclude<TransferDirection, null> => {
    return value === "living_to_savings" || value === "savings_to_living";
};

const validateCategory = async (categoryId: number | null | undefined, kind: CategoryKind, userId: string) => {
    if (!categoryId) {
        return false;
    }

    const result = await sql`
        SELECT id
        FROM living_categories
        WHERE id = ${categoryId}
          AND user_id = ${userId}
          AND kind = ${kind}
          AND is_active = TRUE
        LIMIT 1
    `;

    return result.length > 0;
};

export async function GET(request: Request) {
    try {
        const user = await getCurrentUser();

        if (!user) {
            return NextResponse.json(
                {
                    error: "로그인이 필요해요.",
                },
                { status: 401 },
            );
        }

        const { searchParams } = new URL(request.url);

        const startDate = searchParams.get("startDate");
        const endDate = searchParams.get("endDate");

        if (!startDate || !endDate) {
            return NextResponse.json(
                {
                    error: "조회 기간을 입력해주세요.",
                },
                { status: 400 },
            );
        }

        const rows = await sql`
            SELECT
                lt.id,
                TO_CHAR(lt.transaction_date, 'YYYY-MM-DD') AS transaction_date,
                lt.type,
                lt.amount,
                lt.category_id,
                lc.name AS category_name,
                lt.memo,
                lt.transfer_direction
            FROM living_transactions lt
            LEFT JOIN living_categories lc
                ON lc.id = lt.category_id
                AND lc.user_id = ${user.id}
            WHERE lt.user_id = ${user.id}
              AND lt.transaction_date::date >= ${startDate}::date
              AND lt.transaction_date::date <= ${endDate}::date
            ORDER BY
                lt.transaction_date ASC,
                lt.id ASC
        `;

        const transactions = (rows as TransactionRow[]).map(normalizeTransaction);

        const [countResult] = await sql`
            SELECT COUNT(*)::int AS count
            FROM living_transactions
            WHERE user_id = ${user.id}
        `;

        return NextResponse.json({
            transactions,
            totalCount: Number(countResult?.count ?? 0),
        });
    } catch (error) {
        console.error("GET /api/living/transactions error:", error);

        return NextResponse.json(
            {
                error: "생활 기록을 불러오지 못했어요.",
            },
            { status: 500 },
        );
    }
}

export async function POST(request: Request) {
    try {
        const user = await getCurrentUser();

        if (!user) {
            return NextResponse.json(
                {
                    error: "로그인이 필요해요.",
                },
                { status: 401 },
            );
        }

        // Free 플랜의 생활 기록 300개 제한
        const [subscription] = await sql`
            SELECT
                p.code AS plan_code
            FROM subscriptions s
            JOIN plans p
                ON p.id = s.plan_id
            WHERE s.user_id = ${user.id}
            LIMIT 1
        `;

        const planCode = subscription?.plan_code ?? "free";

        if (planCode === "free") {
            const [countResult] = await sql`
                SELECT COUNT(*)::int AS count
                FROM living_transactions
                WHERE user_id = ${user.id}
            `;

            const transactionCount = Number(countResult?.count ?? 0);

            if (transactionCount >= FREE_LIVING_TRANSACTION_LIMIT) {
                return NextResponse.json(
                    {
                        error: "무료 플랜에서는 생활 기록을 최대 300개까지 저장할 수 있어요.",
                        code: "LIVING_TRANSACTION_LIMIT_REACHED",
                    },
                    { status: 403 },
                );
            }
        }

        const body = await request.json();

        const { transactionDate, type, amount, categoryId, memo, transferDirection } = body as {
            transactionDate?: string;
            type?: TransactionType;
            amount?: number | string;
            categoryId?: number | null;
            memo?: string | null;
            transferDirection?: TransferDirection;
        };

        if (!transactionDate) {
            return NextResponse.json(
                {
                    error: "날짜를 선택해주세요.",
                },
                { status: 400 },
            );
        }

        if (!isTransactionType(type)) {
            return NextResponse.json(
                {
                    error: "잘못된 거래 유형이에요.",
                },
                { status: 400 },
            );
        }

        const numericAmount = Number(amount);

        if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
            return NextResponse.json(
                {
                    error: "금액을 확인해주세요.",
                },
                { status: 400 },
            );
        }

        if (type === "expense") {
            const isValidCategory = await validateCategory(categoryId, "variable", user.id);

            if (!isValidCategory) {
                return NextResponse.json(
                    {
                        error: "지출 카테고리를 선택해주세요.",
                    },
                    { status: 400 },
                );
            }
        }

        if (type === "income") {
            const isValidCategory = await validateCategory(categoryId, "income", user.id);

            if (!isValidCategory) {
                return NextResponse.json(
                    {
                        error: "수입 카테고리를 선택해주세요.",
                    },
                    { status: 400 },
                );
            }
        }

        if (type === "transfer") {
            if (!isTransferDirection(transferDirection)) {
                return NextResponse.json(
                    {
                        error: "저축 이동 방향을 선택해주세요.",
                    },
                    { status: 400 },
                );
            }

            if (transferDirection === "savings_to_living") {
                const savingsResult = await sql`
                    SELECT
                        COALESCE(
                            SUM(
                                CASE
                                    WHEN type = 'transfer'
                                        AND transfer_direction = 'living_to_savings'
                                    THEN amount

                                    WHEN type = 'transfer'
                                        AND transfer_direction = 'savings_to_living'
                                    THEN -amount

                                    ELSE 0
                                END
                            ),
                            0
                        ) AS current_amount
                    FROM living_transactions
                    WHERE user_id = ${user.id}
                `;

                const currentSavings = toNumber(savingsResult[0]?.current_amount);

                if (numericAmount > currentSavings) {
                    return NextResponse.json(
                        {
                            error: "현재 저축액보다 많이 옮길 수 없어요.",
                        },
                        { status: 400 },
                    );
                }
            }
        }

        const result = await sql`
            INSERT INTO living_transactions (
                user_id,
                transaction_date,
                type,
                amount,
                category_id,
                memo,
                transfer_direction
            )
            VALUES (
                ${user.id},
                ${transactionDate},
                ${type},
                ${numericAmount},
                ${type === "transfer" ? null : categoryId},
                ${memo?.trim() || null},
                ${type === "transfer" ? transferDirection : null}
            )
            RETURNING id
        `;

        const insertedId = result[0]?.id;

        const inserted = await sql`
            SELECT
                lt.id,
                TO_CHAR(lt.transaction_date, 'YYYY-MM-DD') AS transaction_date,
                lt.type,
                lt.amount,
                lt.category_id,
                lc.name AS category_name,
                lt.memo,
                lt.transfer_direction
            FROM living_transactions lt
            LEFT JOIN living_categories lc
                ON lc.id = lt.category_id
                AND lc.user_id = ${user.id}
            WHERE lt.id = ${insertedId}
              AND lt.user_id = ${user.id}
            LIMIT 1
        `;

        return NextResponse.json(
            {
                success: true,
                transaction: inserted[0] ? normalizeTransaction(inserted[0] as TransactionRow) : null,
            },
            { status: 201 },
        );
    } catch (error) {
        console.error("POST /api/living/transactions error:", error);

        return NextResponse.json(
            {
                error: "생활 기록을 저장하지 못했어요.",
            },
            { status: 500 },
        );
    }
}

export async function PATCH(request: Request) {
    try {
        const user = await getCurrentUser();

        if (!user) {
            return NextResponse.json(
                {
                    error: "로그인이 필요해요.",
                },
                { status: 401 },
            );
        }

        const body = await request.json();

        const { id, transactionDate, type, amount, categoryId, memo, transferDirection } = body as {
            id?: number;
            transactionDate?: string;
            type?: TransactionType;
            amount?: number | string;
            categoryId?: number | null;
            memo?: string | null;
            transferDirection?: TransferDirection;
        };

        if (!id) {
            return NextResponse.json(
                {
                    error: "수정할 기록을 찾을 수 없어요.",
                },
                { status: 400 },
            );
        }

        if (!transactionDate) {
            return NextResponse.json(
                {
                    error: "날짜를 선택해주세요.",
                },
                { status: 400 },
            );
        }

        if (!isTransactionType(type)) {
            return NextResponse.json(
                {
                    error: "잘못된 거래 유형이에요.",
                },
                { status: 400 },
            );
        }

        const numericAmount = Number(amount);

        if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
            return NextResponse.json(
                {
                    error: "금액을 확인해주세요.",
                },
                { status: 400 },
            );
        }

        if (type === "expense") {
            const isValidCategory = await validateCategory(categoryId, "variable", user.id);

            if (!isValidCategory) {
                return NextResponse.json(
                    {
                        error: "지출 카테고리를 선택해주세요.",
                    },
                    { status: 400 },
                );
            }
        }

        if (type === "income") {
            const isValidCategory = await validateCategory(categoryId, "income", user.id);

            if (!isValidCategory) {
                return NextResponse.json(
                    {
                        error: "수입 카테고리를 선택해주세요.",
                    },
                    { status: 400 },
                );
            }
        }

        if (type === "transfer") {
            if (!isTransferDirection(transferDirection)) {
                return NextResponse.json(
                    {
                        error: "저축 이동 방향을 선택해주세요.",
                    },
                    { status: 400 },
                );
            }

            if (transferDirection === "savings_to_living") {
                const savingsResult = await sql`
                    SELECT
                        COALESCE(
                            SUM(
                                CASE
                                    WHEN type = 'transfer'
                                        AND transfer_direction = 'living_to_savings'
                                    THEN amount

                                    WHEN type = 'transfer'
                                        AND transfer_direction = 'savings_to_living'
                                    THEN -amount

                                    ELSE 0
                                END
                            ),
                            0
                        ) AS current_amount
                    FROM living_transactions
                    WHERE user_id = ${user.id}
                      AND id <> ${id}
                `;

                const currentSavings = toNumber(savingsResult[0]?.current_amount);

                if (numericAmount > currentSavings) {
                    return NextResponse.json(
                        {
                            error: "현재 저축액보다 많이 옮길 수 없어요.",
                        },
                        { status: 400 },
                    );
                }
            }
        }

        const result = await sql`
            UPDATE living_transactions
            SET
                transaction_date = ${transactionDate},
                type = ${type},
                amount = ${numericAmount},
                category_id = ${type === "transfer" ? null : categoryId},
                memo = ${memo?.trim() || null},
                transfer_direction = ${type === "transfer" ? transferDirection : null},
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ${id}
              AND user_id = ${user.id}
            RETURNING id
        `;

        if (result.length === 0) {
            return NextResponse.json(
                {
                    error: "수정할 기록을 찾을 수 없어요.",
                },
                { status: 404 },
            );
        }

        const updated = await sql`
            SELECT
                lt.id,
                TO_CHAR(lt.transaction_date, 'YYYY-MM-DD') AS transaction_date,
                lt.type,
                lt.amount,
                lt.category_id,
                lc.name AS category_name,
                lt.memo,
                lt.transfer_direction
            FROM living_transactions lt
            LEFT JOIN living_categories lc
                ON lc.id = lt.category_id
                AND lc.user_id = ${user.id}
            WHERE lt.id = ${id}
              AND lt.user_id = ${user.id}
            LIMIT 1
        `;

        return NextResponse.json({
            success: true,
            transaction: updated[0] ? normalizeTransaction(updated[0] as TransactionRow) : null,
        });
    } catch (error) {
        console.error("PATCH /api/living/transactions error:", error);

        return NextResponse.json(
            {
                error: "생활 기록을 수정하지 못했어요.",
            },
            { status: 500 },
        );
    }
}

export async function DELETE(request: Request) {
    try {
        const user = await getCurrentUser();

        if (!user) {
            return NextResponse.json(
                {
                    error: "로그인이 필요해요.",
                },
                { status: 401 },
            );
        }

        const { searchParams } = new URL(request.url);

        const id = Number(searchParams.get("id"));

        if (!Number.isInteger(id) || id <= 0) {
            return NextResponse.json(
                {
                    error: "삭제할 기록을 찾을 수 없어요.",
                },
                { status: 400 },
            );
        }

        const result = await sql`
            DELETE FROM living_transactions
            WHERE id = ${id}
              AND user_id = ${user.id}
            RETURNING id
        `;

        if (result.length === 0) {
            return NextResponse.json(
                {
                    error: "삭제할 기록을 찾을 수 없어요.",
                },
                { status: 404 },
            );
        }

        return NextResponse.json({
            success: true,
        });
    } catch (error) {
        console.error("DELETE /api/living/transactions error:", error);

        return NextResponse.json(
            {
                error: "생활 기록을 삭제하지 못했어요.",
            },
            { status: 500 },
        );
    }
}
