import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/user";
import {
    CHANGE_SCOPES,
    DELETE_MODES,
    applyFixedExpenseChange,
    applyFixedExpenseEnd,
    getFixedExpensesForMonth,
    getFixedExpenseState,
    isMonthString,
    monthStartDate,
    nextMonthOf,
    resolveMonth,
} from "@/lib/api/fixedExpenses";
import type { FixedExpenseChangeScope, FixedExpenseDeleteMode, FixedExpenseListRow } from "@/lib/api/fixedExpenses";
import { getPlanCode } from "@/lib/api/plan";

type FixedExpenseRow = FixedExpenseListRow;

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
        // 시작 전(예정)인 항목은 "YYYY-MM" 로 언제 시작하는지 함께 보낸다
        startMonth: row.start_month ?? null,
        isUpcoming: Boolean(row.is_upcoming),
    };
};

const isPro = (planCode: string) => planCode !== "free";

export async function GET(request: Request) {
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

        const month = resolveMonth(searchParams.get("month"));

        const rows = await getFixedExpensesForMonth(user.id, month);

        const fixedExpenses = rows.map(toFixedExpense);

        return NextResponse.json({
            fixedExpenses,
            totalCount: fixedExpenses.length,
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

        const { name, amount, categoryId, paymentDay, memo, startMode, month: monthInput } = body as {
            name?: string;
            amount?: number | string;
            categoryId?: number;
            paymentDay?: number | string;
            memo?: string | null;
            // 이번 달부터(기본) / 다음 달부터 시작
            startMode?: "this-month" | "next-month";
            month?: string;
        };

        const requestMonth = resolveMonth(monthInput);
        const startMonth = startMode === "next-month" ? nextMonthOf(requestMonth) : requestMonth;

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
                sort_order,
                start_month
            )
            VALUES (
                ${user.id},
                ${trimmedName},
                ${numericAmount},
                ${numericCategoryId},
                ${numericPaymentDay},
                TRUE,
                ${memo?.trim() || null},
                ${nextSortOrder},
                ${monthStartDate(startMonth)}::date
            )
            RETURNING id
        `;

        const insertedId = Number(result[0]?.id);

        const inserted = (await getFixedExpensesForMonth(user.id, requestMonth)).find((row) => Number(row.id) === insertedId);

        return NextResponse.json(
            {
                success: true,
                fixedExpense: inserted ? toFixedExpense(inserted) : null,
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

        const { id, name, amount, categoryId, paymentDay, memo, scope, month: monthInput } = body as {
            id?: number;
            name?: string;
            amount?: number | string;
            categoryId?: number;
            paymentDay?: number | string;
            memo?: string | null;
            // 금액·결제일이 바뀔 때 언제부터 적용할지
            scope?: FixedExpenseChangeScope;
            month?: string;
        };

        const requestMonth = resolveMonth(monthInput);

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

        const state = await getFixedExpenseState(user.id, numericId, requestMonth);

        if (!state || state.isEnded) {
            return NextResponse.json(
                {
                    error: "수정할 고정지출을 찾을 수 없어요.",
                },
                { status: 404 },
            );
        }

        const valuesChanged = numericAmount !== state.amount || numericPaymentDay !== state.paymentDay;

        // 아직 시작 전인 항목이 아니면, 금액·결제일이 바뀔 때 적용 시점이 꼭 필요하다
        if (valuesChanged && !state.isUpcoming && !(scope && CHANGE_SCOPES.includes(scope))) {
            return NextResponse.json(
                {
                    error: "언제부터 적용할지 선택해주세요.",
                },
                { status: 400 },
            );
        }

        // 이름·카테고리·메모는 달과 상관없이 항상 바꾼다
        await sql`
            UPDATE living_fixed_expenses
            SET
                name = ${trimmedName},
                category_id = ${numericCategoryId},
                memo = ${memo?.trim() || null},
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ${numericId}
              AND user_id = ${user.id}
              AND is_active = TRUE
        `;

        if (valuesChanged) {
            if (state.isUpcoming) {
                // 아직 시작 전이라 이력 없이 기본 값을 직접 바꾼다
                await sql`
                    UPDATE living_fixed_expenses
                    SET
                        amount = ${numericAmount},
                        payment_day = ${numericPaymentDay}
                    WHERE id = ${numericId}
                      AND user_id = ${user.id}
                `;
            } else {
                await applyFixedExpenseChange({
                    userId: user.id,
                    id: numericId,
                    month: requestMonth,
                    scope: scope as FixedExpenseChangeScope,
                    amount: numericAmount,
                    paymentDay: numericPaymentDay,
                });
            }
        }

        const updated = (await getFixedExpensesForMonth(user.id, requestMonth)).find((row) => Number(row.id) === numericId);

        return NextResponse.json({
            success: true,
            fixedExpense: updated ? toFixedExpense(updated) : null,
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

        const modeParam = searchParams.get("mode") ?? "all";
        const mode: FixedExpenseDeleteMode = DELETE_MODES.includes(modeParam as FixedExpenseDeleteMode)
            ? (modeParam as FixedExpenseDeleteMode)
            : "all";

        const monthParam = searchParams.get("month");
        const requestMonth = isMonthString(monthParam) ? monthParam : resolveMonth(undefined);

        if (!Number.isInteger(id) || id <= 0) {
            return NextResponse.json(
                {
                    error: "삭제할 고정지출을 찾을 수 없어요.",
                },
                { status: 400 },
            );
        }

        const state = await getFixedExpenseState(user.id, id, requestMonth);

        if (!state) {
            return NextResponse.json(
                {
                    error: "삭제할 고정지출을 찾을 수 없어요.",
                },
                { status: 404 },
            );
        }

        // 전체 삭제이거나 아직 시작 전인 항목은 통째로 지운다 (지난 달 기록에서도 사라진다)
        if (mode === "all" || state.isUpcoming) {
            await sql`
                UPDATE living_fixed_expenses
                SET
                    is_active = FALSE,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = ${id}
                  AND user_id = ${user.id}
                  AND is_active = TRUE
            `;
        } else {
            await applyFixedExpenseEnd({
                userId: user.id,
                id,
                month: requestMonth,
                mode,
            });
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
