import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/user";

type FixedExpenseRow = {
    id: number;
    name: string;
    amount: number | string;
    category_id: number;
    category_name: string;
    payment_day: number;
    memo: string | null;
    sort_order: number;
};

const toNumber = (value: unknown) => {
    return Number(value ?? 0);
};

const toFixedExpense = (row: FixedExpenseRow) => {
    return {
        id: row.id,
        name: row.name,
        amount: toNumber(row.amount),
        categoryId: row.category_id,
        categoryName: row.category_name,
        paymentDay: row.payment_day,
        memo: row.memo,
        sortOrder: row.sort_order,
    };
};

async function getPlanCode(userId: string) {
    const [subscription] = await sql`
        SELECT
            p.code AS plan_code
        FROM subscriptions s
        JOIN plans p
            ON p.id = s.plan_id
        WHERE s.user_id = ${userId}
        LIMIT 1
    `;

    return subscription?.plan_code ?? "free";
}

const isPro = (planCode: string) => planCode !== "free";

export async function GET() {
    try {
        const user = await getCurrentUser();

        if (!user) {
            return NextResponse.json(
                {
                    error: "Unauthorized",
                },
                { status: 401 },
            );
        }

        const planCode = await getPlanCode(user.id);

        if (!isPro(planCode)) {
            return NextResponse.json(
                {
                    error: "고정지출은 Pro 플랜에서 사용할 수 있어요.",
                    code: "FIXED_EXPENSE_PRO_ONLY",
                },
                { status: 403 },
            );
        }

        const rows = await sql`
            SELECT
                lfe.id,
                lfe.name,
                lfe.amount,
                lfe.category_id,
                lc.name AS category_name,
                lfe.payment_day,
                lfe.memo,
                lfe.sort_order
            FROM living_fixed_expenses lfe
            INNER JOIN living_categories lc
                ON lc.id = lfe.category_id
               AND lc.user_id = ${user.id}
            WHERE lfe.user_id = ${user.id}
              AND lfe.is_active = TRUE
            ORDER BY
                lfe.sort_order,
                lfe.id
        `;

        const fixedExpenses = (rows as FixedExpenseRow[]).map(toFixedExpense);

        const [countResult] = await sql`
            SELECT COUNT(*)::int AS count
            FROM living_fixed_expenses
            WHERE user_id = ${user.id}
              AND is_active = TRUE
        `;

        return NextResponse.json({
            fixedExpenses,
            totalCount: Number(countResult?.count ?? 0),
        });
    } catch (error) {
        console.error("GET /api/living/fixed-expenses error:", error);

        return NextResponse.json(
            {
                error: "고정지출을 불러오지 못했어요.",
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
                    error: "Unauthorized",
                },
                { status: 401 },
            );
        }

        const planCode = await getPlanCode(user.id);

        if (!isPro(planCode)) {
            return NextResponse.json(
                {
                    error: "고정지출은 Pro 플랜에서 사용할 수 있어요.",
                    code: "FIXED_EXPENSE_PRO_ONLY",
                },
                { status: 403 },
            );
        }

        const body = await request.json();

        const { name, amount, categoryId, paymentDay, memo } = body as {
            name?: string;
            amount?: number | string;
            categoryId?: number;
            paymentDay?: number | string;
            memo?: string | null;
        };

        const trimmedName = name?.trim();
        const numericAmount = Number(amount);
        const numericCategoryId = Number(categoryId);
        const numericPaymentDay = Number(paymentDay);

        if (!trimmedName) {
            return NextResponse.json(
                {
                    error: "고정지출 이름을 입력해주세요.",
                },
                { status: 400 },
            );
        }

        if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
            return NextResponse.json(
                {
                    error: "금액을 확인해주세요.",
                },
                { status: 400 },
            );
        }

        if (!Number.isInteger(numericCategoryId) || numericCategoryId <= 0) {
            return NextResponse.json(
                {
                    error: "카테고리를 선택해주세요.",
                },
                { status: 400 },
            );
        }

        if (!Number.isInteger(numericPaymentDay) || numericPaymentDay < 1 || numericPaymentDay > 31) {
            return NextResponse.json(
                {
                    error: "결제일을 확인해주세요.",
                },
                { status: 400 },
            );
        }

        const category = await sql`
            SELECT id
            FROM living_categories
            WHERE id = ${numericCategoryId}
              AND user_id = ${user.id}
              AND kind = 'fixed'
              AND is_active = TRUE
            LIMIT 1
        `;

        if (category.length === 0) {
            return NextResponse.json(
                {
                    error: "고정지출 카테고리를 선택해주세요.",
                },
                { status: 400 },
            );
        }

        const sortResult = await sql`
            SELECT COALESCE(MAX(sort_order), -1) + 1 AS next_sort_order
            FROM living_fixed_expenses
            WHERE user_id = ${user.id}
              AND is_active = TRUE
        `;

        const nextSortOrder = Number(sortResult[0]?.next_sort_order ?? 0);

        const result = await sql`
            INSERT INTO living_fixed_expenses (
                user_id,
                name,
                amount,
                category_id,
                payment_day,
                is_active,
                memo,
                sort_order
            )
            VALUES (
                ${user.id},
                ${trimmedName},
                ${numericAmount},
                ${numericCategoryId},
                ${numericPaymentDay},
                TRUE,
                ${memo?.trim() || null},
                ${nextSortOrder}
            )
            RETURNING id
        `;

        const insertedId = result[0]?.id;

        const inserted = await sql`
            SELECT
                lfe.id,
                lfe.name,
                lfe.amount,
                lfe.category_id,
                lc.name AS category_name,
                lfe.payment_day,
                lfe.memo,
                lfe.sort_order
            FROM living_fixed_expenses lfe
            INNER JOIN living_categories lc
                ON lc.id = lfe.category_id
               AND lc.user_id = ${user.id}
            WHERE lfe.id = ${insertedId}
              AND lfe.user_id = ${user.id}
            LIMIT 1
        `;

        return NextResponse.json(
            {
                success: true,
                fixedExpense: inserted[0] ? toFixedExpense(inserted[0] as FixedExpenseRow) : null,
            },
            { status: 201 },
        );
    } catch (error) {
        console.error("POST /api/living/fixed-expenses error:", error);

        return NextResponse.json(
            {
                error: "고정지출을 추가하지 못했어요.",
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
                    error: "Unauthorized",
                },
                { status: 401 },
            );
        }

        const planCode = await getPlanCode(user.id);

        if (!isPro(planCode)) {
            return NextResponse.json(
                {
                    error: "고정지출은 Pro 플랜에서 사용할 수 있어요.",
                    code: "FIXED_EXPENSE_PRO_ONLY",
                },
                { status: 403 },
            );
        }

        const body = await request.json();

        const { id, name, amount, categoryId, paymentDay, memo } = body as {
            id?: number;
            name?: string;
            amount?: number | string;
            categoryId?: number;
            paymentDay?: number | string;
            memo?: string | null;
        };

        const numericId = Number(id);
        const numericAmount = Number(amount);
        const numericCategoryId = Number(categoryId);
        const numericPaymentDay = Number(paymentDay);
        const trimmedName = name?.trim();

        if (!Number.isInteger(numericId) || numericId <= 0) {
            return NextResponse.json(
                {
                    error: "수정할 고정지출을 찾을 수 없어요.",
                },
                { status: 400 },
            );
        }

        if (!trimmedName) {
            return NextResponse.json(
                {
                    error: "고정지출 이름을 입력해주세요.",
                },
                { status: 400 },
            );
        }

        if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
            return NextResponse.json(
                {
                    error: "금액을 확인해주세요.",
                },
                { status: 400 },
            );
        }

        if (!Number.isInteger(numericCategoryId) || numericCategoryId <= 0) {
            return NextResponse.json(
                {
                    error: "카테고리를 선택해주세요.",
                },
                { status: 400 },
            );
        }

        if (!Number.isInteger(numericPaymentDay) || numericPaymentDay < 1 || numericPaymentDay > 31) {
            return NextResponse.json(
                {
                    error: "결제일을 확인해주세요.",
                },
                { status: 400 },
            );
        }

        const category = await sql`
            SELECT id
            FROM living_categories
            WHERE id = ${numericCategoryId}
              AND user_id = ${user.id}
              AND kind = 'fixed'
              AND is_active = TRUE
            LIMIT 1
        `;

        if (category.length === 0) {
            return NextResponse.json(
                {
                    error: "고정지출 카테고리를 선택해주세요.",
                },
                { status: 400 },
            );
        }

        const result = await sql`
            UPDATE living_fixed_expenses
            SET
                name = ${trimmedName},
                amount = ${numericAmount},
                category_id = ${numericCategoryId},
                payment_day = ${numericPaymentDay},
                memo = ${memo?.trim() || null},
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ${numericId}
              AND user_id = ${user.id}
              AND is_active = TRUE
            RETURNING id
        `;

        if (result.length === 0) {
            return NextResponse.json(
                {
                    error: "수정할 고정지출을 찾을 수 없어요.",
                },
                { status: 404 },
            );
        }

        const updated = await sql`
            SELECT
                lfe.id,
                lfe.name,
                lfe.amount,
                lfe.category_id,
                lc.name AS category_name,
                lfe.payment_day,
                lfe.memo,
                lfe.sort_order
            FROM living_fixed_expenses lfe
            INNER JOIN living_categories lc
                ON lc.id = lfe.category_id
               AND lc.user_id = ${user.id}
            WHERE lfe.id = ${numericId}
              AND lfe.user_id = ${user.id}
            LIMIT 1
        `;

        return NextResponse.json({
            success: true,
            fixedExpense: updated[0] ? toFixedExpense(updated[0] as FixedExpenseRow) : null,
        });
    } catch (error) {
        console.error("PATCH /api/living/fixed-expenses error:", error);

        return NextResponse.json(
            {
                error: "고정지출을 수정하지 못했어요.",
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
                    error: "Unauthorized",
                },
                { status: 401 },
            );
        }

        const planCode = await getPlanCode(user.id);

        if (!isPro(planCode)) {
            return NextResponse.json(
                {
                    error: "고정지출은 Pro 플랜에서 사용할 수 있어요.",
                    code: "FIXED_EXPENSE_PRO_ONLY",
                },
                { status: 403 },
            );
        }

        const { searchParams } = new URL(request.url);
        const id = Number(searchParams.get("id"));

        if (!Number.isInteger(id) || id <= 0) {
            return NextResponse.json(
                {
                    error: "삭제할 고정지출을 찾을 수 없어요.",
                },
                { status: 400 },
            );
        }

        const result = await sql`
            UPDATE living_fixed_expenses
            SET
                is_active = FALSE,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ${id}
              AND user_id = ${user.id}
              AND is_active = TRUE
            RETURNING id
        `;

        if (result.length === 0) {
            return NextResponse.json(
                {
                    error: "삭제할 고정지출을 찾을 수 없어요.",
                },
                { status: 404 },
            );
        }

        return NextResponse.json({
            success: true,
        });
    } catch (error) {
        console.error("DELETE /api/living/fixed-expenses error:", error);

        return NextResponse.json(
            {
                error: "고정지출을 삭제하지 못했어요.",
            },
            { status: 500 },
        );
    }
}
