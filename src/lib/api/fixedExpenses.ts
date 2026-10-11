// lib/api/fixedExpenses.ts
// 고정지출을 "달마다" 다르게 다루는 규칙을 한 곳에 모았다.
//
// - living_fixed_expenses 의 amount / payment_day 는 "처음부터 적용되는 값"이다.
// - living_fixed_expense_versions 에 "이 달부터 이렇게 바뀐다 / 이 달부터 종료" 를 쌓는다.
// - 어떤 달의 값 = effective_month 가 그 달 이하인 기록 중 가장 최근 것 (없으면 기존 값)
// - start_month 가 있는 항목은 그 달 전에는 없는 것으로 본다.
import { sql } from "@/lib/db";

export type FixedExpenseChangeScope = "this-month-only" | "from-this-month" | "from-next-month";
export type FixedExpenseDeleteMode = "this-month-only" | "from-this-month" | "all";

export const CHANGE_SCOPES: readonly FixedExpenseChangeScope[] = ["this-month-only", "from-this-month", "from-next-month"];
export const DELETE_MODES: readonly FixedExpenseDeleteMode[] = ["this-month-only", "from-this-month", "all"];

export const isMonthString = (value: unknown): value is string =>
    typeof value === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(value);

export const monthStartDate = (month: string) => `${month}-01`;

export const nextMonthOf = (month: string) => {
    const [year, monthNumber] = month.split("-").map(Number);

    return monthNumber === 12 ? `${year + 1}-01` : `${year}-${String(monthNumber + 1).padStart(2, "0")}`;
};

// 요청에 달이 없으면(옛 화면) 서버 기준 이번 달
export const resolveMonth = (value: unknown) => (isMonthString(value) ? value : new Date().toISOString().slice(0, 7));

const MISSING_SCHEMA_CODES = new Set(["42P01", "42703"]);

const isMissingSchemaError = (error: unknown) => {
    const code = (error as { code?: string } | null)?.code;

    return Boolean(code && MISSING_SCHEMA_CODES.has(code));
};

export type FixedExpenseListRow = {
    id: number;
    name: string;
    amount: number | string;
    category_id: number;
    category_name: string;
    payment_day: number;
    memo: string | null;
    sort_order: number;
    start_month: string | null;
    is_upcoming: boolean;
};

/*
 * 그 달에 보여줄 고정지출 목록. (아직 시작 전인 항목도 "예정"으로 함께 돌려준다)
 * 005 SQL 을 아직 실행하지 않았으면 예전 방식(월 구분 없음)으로 돌려준다.
 */
export const getFixedExpensesForMonth = async (userId: string, month: string): Promise<FixedExpenseListRow[]> => {
    const start = monthStartDate(month);

    try {
        const rows = await sql`
            SELECT
                lfe.id,
                lfe.name,
                COALESCE(v.amount, lfe.amount) AS amount,
                lfe.category_id,
                lc.name AS category_name,
                COALESCE(v.payment_day, lfe.payment_day) AS payment_day,
                lfe.memo,
                lfe.sort_order,
                to_char(lfe.start_month, 'YYYY-MM') AS start_month,
                (lfe.start_month IS NOT NULL AND lfe.start_month > ${start}::date) AS is_upcoming
            FROM living_fixed_expenses lfe
            INNER JOIN living_categories lc
                ON lc.id = lfe.category_id
               AND lc.user_id = ${userId}
            LEFT JOIN LATERAL (
                SELECT x.amount, x.payment_day, x.is_ended
                FROM living_fixed_expense_versions x
                WHERE x.fixed_expense_id = lfe.id
                  AND x.effective_month <= GREATEST(${start}::date, COALESCE(lfe.start_month, ${start}::date))
                ORDER BY x.effective_month DESC
                LIMIT 1
            ) v ON TRUE
            WHERE lfe.user_id = ${userId}
              AND lfe.is_active = TRUE
              AND COALESCE(v.is_ended, FALSE) = FALSE
            ORDER BY lfe.sort_order, lfe.id
        `;

        return rows as FixedExpenseListRow[];
    } catch (error) {
        if (!isMissingSchemaError(error)) {
            throw error;
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
                lfe.sort_order,
                NULL::text AS start_month,
                FALSE AS is_upcoming
            FROM living_fixed_expenses lfe
            INNER JOIN living_categories lc
                ON lc.id = lfe.category_id
               AND lc.user_id = ${userId}
            WHERE lfe.user_id = ${userId}
              AND lfe.is_active = TRUE
            ORDER BY lfe.sort_order, lfe.id
        `;

        return rows as FixedExpenseListRow[];
    }
};

/* 그 달에 실제로 나가는 고정지출 합계 (시작 전·종료된 항목은 제외) */
export const getFixedExpenseTotalForMonth = async (userId: string, month: string): Promise<{ total: number }[]> => {
    const rows = await getFixedExpensesForMonth(userId, month);

    return [
        {
            total: rows.filter((row) => !row.is_upcoming).reduce((sum, row) => sum + Number(row.amount ?? 0), 0),
        },
    ];
};

export type FixedExpenseState = {
    amount: number;
    paymentDay: number;
    isEnded: boolean;
    // 아직 시작 전이면 true (이 경우에는 이력을 쓰지 않고 기본 값을 직접 바꾼다)
    isUpcoming: boolean;
};

/* 한 항목의 그 달 상태. 없는(삭제된) 항목이면 null */
export const getFixedExpenseState = async (userId: string, id: number, month: string): Promise<FixedExpenseState | null> => {
    const start = monthStartDate(month);

    const [row] = await sql`
        SELECT
            COALESCE(v.amount, lfe.amount) AS amount,
            COALESCE(v.payment_day, lfe.payment_day) AS payment_day,
            COALESCE(v.is_ended, FALSE) AS is_ended,
            (lfe.start_month IS NOT NULL AND lfe.start_month > ${start}::date) AS is_upcoming
        FROM living_fixed_expenses lfe
        LEFT JOIN LATERAL (
            SELECT x.amount, x.payment_day, x.is_ended
            FROM living_fixed_expense_versions x
            WHERE x.fixed_expense_id = lfe.id
              AND x.effective_month <= ${start}::date
            ORDER BY x.effective_month DESC
            LIMIT 1
        ) v ON TRUE
        WHERE lfe.id = ${id}
          AND lfe.user_id = ${userId}
          AND lfe.is_active = TRUE
        LIMIT 1
    `;

    if (!row) {
        return null;
    }

    return {
        amount: Number(row.amount),
        paymentDay: Number(row.payment_day),
        isEnded: Boolean(row.is_ended),
        isUpcoming: Boolean(row.is_upcoming),
    };
};

const upsertVersion = async (id: number, month: string, state: { amount: number; paymentDay: number; isEnded: boolean }) => {
    await sql`
        INSERT INTO living_fixed_expense_versions (fixed_expense_id, effective_month, amount, payment_day, is_ended)
        VALUES (${id}, ${monthStartDate(month)}::date, ${state.amount}, ${state.paymentDay}, ${state.isEnded})
        ON CONFLICT (fixed_expense_id, effective_month)
        DO UPDATE SET
            amount = EXCLUDED.amount,
            payment_day = EXCLUDED.payment_day,
            is_ended = EXCLUDED.is_ended
    `;
};

const deleteVersionsAfter = async (id: number, month: string) => {
    await sql`
        DELETE FROM living_fixed_expense_versions
        WHERE fixed_expense_id = ${id}
          AND effective_month > ${monthStartDate(month)}::date
    `;
};

const hasVersionAt = async (id: number, month: string) => {
    const [row] = await sql`
        SELECT 1 AS found
        FROM living_fixed_expense_versions
        WHERE fixed_expense_id = ${id}
          AND effective_month = ${monthStartDate(month)}::date
        LIMIT 1
    `;

    return Boolean(row);
};

/*
 * 금액·결제일을 바꾼다.
 *  - this-month-only : 이번 달만 바꾸고 다음 달부터는 원래 값으로 돌아간다
 *  - from-this-month : 이번 달부터 계속 (이미 잡아둔 이후 변경은 이 값으로 대체)
 *  - from-next-month : 이번 달은 그대로, 다음 달부터 계속
 */
export const applyFixedExpenseChange = async ({
    userId,
    id,
    month,
    scope,
    amount,
    paymentDay,
}: {
    userId: string;
    id: number;
    month: string;
    scope: FixedExpenseChangeScope;
    amount: number;
    paymentDay: number;
}) => {
    const next = nextMonthOf(month);
    const changed = { amount, paymentDay, isEnded: false };

    if (scope === "from-this-month") {
        await upsertVersion(id, month, changed);
        await deleteVersionsAfter(id, month);
        return;
    }

    if (scope === "from-next-month") {
        await upsertVersion(id, next, changed);
        await deleteVersionsAfter(id, next);
        return;
    }

    // this-month-only: 다음 달에 적용될 값을 먼저 읽어 둔 뒤, 이번 달만 바꾸고 다음 달에 되돌린다
    const stateNextMonth = await getFixedExpenseState(userId, id, next);

    await upsertVersion(id, month, changed);

    if (stateNextMonth && !(await hasVersionAt(id, next))) {
        await upsertVersion(id, next, stateNextMonth);
    }
};

/*
 * 종료한다. (전체 삭제는 호출하는 쪽에서 is_active = FALSE 로 처리)
 *  - this-month-only : 이번 달만 건너뛰고 다음 달부터 다시 나간다
 *  - from-this-month : 이번 달부터 종료 (지난 달 기록은 유지)
 */
export const applyFixedExpenseEnd = async ({
    userId,
    id,
    month,
    mode,
}: {
    userId: string;
    id: number;
    month: string;
    mode: "this-month-only" | "from-this-month";
}) => {
    const current = await getFixedExpenseState(userId, id, month);

    if (!current) {
        return false;
    }

    const next = nextMonthOf(month);

    if (mode === "from-this-month") {
        await upsertVersion(id, month, { amount: current.amount, paymentDay: current.paymentDay, isEnded: true });
        await deleteVersionsAfter(id, month);
        return true;
    }

    const stateNextMonth = await getFixedExpenseState(userId, id, next);

    await upsertVersion(id, month, { amount: current.amount, paymentDay: current.paymentDay, isEnded: true });

    if (stateNextMonth && !(await hasVersionAt(id, next))) {
        await upsertVersion(id, next, stateNextMonth);
    }

    return true;
};
