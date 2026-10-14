// lib/api/downgrade.ts
// Pro 해지(무료로 전환) 처리.
//  - 미리보기: 무료 한도와 지금 사용량, 삭제될 개수를 계산한다. (읽기 전용)
//  - 정리: 결제 기간이 끝난 뒤, 무료 한도에 맞춰 오래된 기록부터 지운다. (하나의 트랜잭션)
//
// 정리 규칙
//  - 급여·근무·생활 기록: 날짜가 최근인 것부터 한도만큼 남기고 나머지 삭제
//  - 여행: 종료일이 최근인 것부터 한도만큼 남기고 나머지(경비 포함) 삭제
//  - 여행 경비: 남은 여행마다 한도를 넘는 오래된 날짜순 삭제
//  - 고정지출: 전부 삭제
//  - 카테고리: 직접 만든 것은 없애고 기본 카테고리로 되돌린다. 그 카테고리의 기록은 "기타"로 옮긴다.
import { Pool, type PoolClient } from "pg";
import { FREE_PLAN_LIMITS } from "@/lib/plans";
import { ko } from "@/lib/i18n/messages/ko";
import { en } from "@/lib/i18n/messages/en";

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
});

// 해지 확인 문구는 화면 언어에 따라 다르므로, 지원하는 모든 언어의 문구를 인정한다
export const isDowngradeConfirmPhrase = (value: unknown) =>
    value === ko["settings.downgrade.phrase"] || value === en["settings.downgrade.phrase"];

// 기본 카테고리 (api/user/profile, api/trips 의 기본 목록과 같아야 한다)
const DEFAULT_LIVING_CATEGORIES = [
    { name: "주거", kind: "variable", sortOrder: 1 },
    { name: "통신", kind: "variable", sortOrder: 2 },
    { name: "식비", kind: "variable", sortOrder: 3 },
    { name: "교통", kind: "variable", sortOrder: 4 },
    { name: "쇼핑", kind: "variable", sortOrder: 5 },
    { name: "여행", kind: "variable", sortOrder: 6 },
    { name: "생활", kind: "variable", sortOrder: 7 },
    { name: "기타", kind: "variable", sortOrder: 8 },

    { name: "급여", kind: "income", sortOrder: 1 },
    { name: "용돈", kind: "income", sortOrder: 2 },
    { name: "부수입", kind: "income", sortOrder: 3 },
    { name: "환급", kind: "income", sortOrder: 4 },
    { name: "이자/배당", kind: "income", sortOrder: 5 },
    { name: "기타", kind: "income", sortOrder: 6 },
] as const;

const DEFAULT_TRIP_EXPENSE_CATEGORIES = [
    { name: "항공", sortOrder: 1 },
    { name: "숙소", sortOrder: 2 },
    { name: "식비", sortOrder: 3 },
    { name: "교통", sortOrder: 4 },
    { name: "쇼핑", sortOrder: 5 },
    { name: "기타", sortOrder: 6 },
] as const;

// 트랜잭션 안에서 쓰는 연결(pg 의 PoolClient)에서 필요한 부분만
type DbClient = {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount?: number | null }>;
};

const IGNORABLE_ERROR_CODES = new Set(["42P01", "42703"]);

export type DowngradeItem = {
    key: string;
    label: string;
    // 무료 한도. null 이면 "사용 불가"
    limit: number | null;
    used: number;
    toDelete: number;
};

export type DowngradePreview = {
    items: DowngradeItem[];
    // 직접 만든 카테고리 수 (기본 카테고리로 되돌아감)
    customCategoryCount: number;
};

export type ProSubscription = {
    id: string;
    expiresAt: string | null;
    cancelRequestedAt: string | null;
};

const toCount = (value: unknown) => Number(value ?? 0);

/** 지금 Pro 로 유효한 구독. 없으면 null. */
export const getActiveProSubscription = async (userId: string): Promise<ProSubscription | null> => {
    const run = async (withCancelColumn: boolean) => {
        const result = await pool.query(
            `
                SELECT
                    s.id,
                    s.expires_at,
                    ${withCancelColumn ? "s.cancel_requested_at" : "NULL::timestamptz AS cancel_requested_at"}
                FROM subscriptions s
                JOIN plans p ON p.id = s.plan_id
                WHERE s.user_id = $1
                  AND s.status = 'active'
                  AND p.code = 'pro'
                  AND (s.expires_at IS NULL OR s.expires_at > NOW())
                LIMIT 1
            `,
            [userId],
        );

        return result.rows[0] as { id: string | number; expires_at: Date | string | null; cancel_requested_at: Date | string | null } | undefined;
    };

    let row;

    try {
        row = await run(true);
    } catch (error) {
        // 006 SQL 을 아직 실행하지 않은 경우: 해지 신청 없는 것으로 본다
        if (!IGNORABLE_ERROR_CODES.has((error as { code?: string }).code ?? "")) {
            throw error;
        }

        row = await run(false);
    }

    if (!row) {
        return null;
    }

    const toIso = (value: Date | string | null) => (value ? new Date(value).toISOString() : null);

    return {
        id: String(row.id),
        expiresAt: toIso(row.expires_at),
        cancelRequestedAt: toIso(row.cancel_requested_at),
    };
};

/** 무료 한도에 맞췄을 때 무엇이 얼마나 지워지는지 계산한다. (아무것도 바꾸지 않음) */
export const getDowngradePreview = async (userId: string): Promise<DowngradePreview> => {
    const count = async (text: string) => toCount((await pool.query(text, [userId])).rows[0]?.count);

    const [payHistory, workSchedules, livingTransactions, trips, fixedExpenses] = await Promise.all([
        count("SELECT COUNT(*)::int AS count FROM pay_period_actuals WHERE user_id = $1"),
        count("SELECT COUNT(*)::int AS count FROM work_schedules WHERE user_id = $1"),
        count("SELECT COUNT(*)::int AS count FROM living_transactions WHERE user_id = $1"),
        count("SELECT COUNT(*)::int AS count FROM trips WHERE user_id = $1"),
        count("SELECT COUNT(*)::int AS count FROM living_fixed_expenses WHERE user_id = $1").catch(() => 0),
    ]);

    // 남게 되는 여행(종료일 최근순 한도만큼)의 경비 중 한도를 넘는 개수
    const tripExpenseOver = toCount(
        (
            await pool.query(
                `
                    SELECT COALESCE(SUM(GREATEST(x.cnt - $2, 0)), 0)::int AS count
                    FROM (
                        SELECT COUNT(te.id) AS cnt
                        FROM (
                            SELECT id FROM trips
                            WHERE user_id = $1
                            ORDER BY end_date DESC, id DESC
                            LIMIT $3
                        ) kept
                        LEFT JOIN trip_expenses te ON te.trip_id = kept.id
                        GROUP BY kept.id
                    ) x
                `,
                [userId, FREE_PLAN_LIMITS.tripExpensesPerTrip, FREE_PLAN_LIMITS.trips],
            )
        ).rows[0]?.count,
    );

    const tripExpenseTotal = toCount(
        (
            await pool.query(
                `
                    SELECT COUNT(te.id)::int AS count
                    FROM trips t
                    JOIN trip_expenses te ON te.trip_id = t.id
                    WHERE t.user_id = $1
                `,
                [userId],
            )
        ).rows[0]?.count,
    );

    const customCategories = await pool
        .query(
            `
                SELECT COUNT(*)::int AS count
                FROM living_categories
                WHERE user_id = $1
                  AND is_active = TRUE
                  AND (name, kind) NOT IN (SELECT * FROM unnest($2::text[], $3::text[]))
            `,
            [userId, DEFAULT_LIVING_CATEGORIES.map((c) => c.name), DEFAULT_LIVING_CATEGORIES.map((c) => c.kind)],
        )
        .then((result: { rows: { count?: unknown }[] }) => toCount(result.rows[0]?.count));

    const customTripCategories = await pool
        .query(
            `
                SELECT COUNT(*)::int AS count
                FROM trip_expense_categories c
                JOIN trips t ON t.id = c.trip_id
                WHERE t.user_id = $1
                  AND c.name <> ALL($2::text[])
            `,
            [userId, DEFAULT_TRIP_EXPENSE_CATEGORIES.map((c) => c.name)],
        )
        .then((result: { rows: { count?: unknown }[] }) => toCount(result.rows[0]?.count));

    const over = (used: number, limit: number) => Math.max(0, used - limit);

    return {
        items: [
            {
                key: "payHistory",
                label: "급여 기록",
                limit: FREE_PLAN_LIMITS.payHistory,
                used: payHistory,
                toDelete: over(payHistory, FREE_PLAN_LIMITS.payHistory),
            },
            {
                key: "workSchedules",
                label: "근무 기록",
                limit: FREE_PLAN_LIMITS.workSchedules,
                used: workSchedules,
                toDelete: over(workSchedules, FREE_PLAN_LIMITS.workSchedules),
            },
            {
                key: "livingTransactions",
                label: "생활 기록",
                limit: FREE_PLAN_LIMITS.livingTransactions,
                used: livingTransactions,
                toDelete: over(livingTransactions, FREE_PLAN_LIMITS.livingTransactions),
            },
            {
                key: "fixedExpenses",
                label: "고정지출",
                limit: null,
                used: fixedExpenses,
                toDelete: fixedExpenses,
            },
            {
                key: "trips",
                label: "여행",
                limit: FREE_PLAN_LIMITS.trips,
                used: trips,
                toDelete: over(trips, FREE_PLAN_LIMITS.trips),
            },
            {
                key: "tripExpenses",
                label: `여행 경비 (여행당 ${FREE_PLAN_LIMITS.tripExpensesPerTrip}개)`,
                limit: FREE_PLAN_LIMITS.tripExpensesPerTrip,
                used: tripExpenseTotal,
                toDelete: tripExpenseOver,
            },
        ],
        customCategoryCount: customCategories + customTripCategories,
    };
};

/*
 * 한 줄이 실패해도(없는 테이블·컬럼) 전체 트랜잭션이 멈추지 않도록 SAVEPOINT 를 건다.
 * 그 외의 오류는 그대로 던져서 전체를 되돌린다.
 */
const runIgnoringMissing = async (client: DbClient, text: string, params: unknown[]) => {
    await client.query("SAVEPOINT downgrade_step");

    try {
        await client.query(text, params);
        await client.query("RELEASE SAVEPOINT downgrade_step");
    } catch (error) {
        await client.query("ROLLBACK TO SAVEPOINT downgrade_step");

        const code = (error as { code?: string }).code;

        if (!code || !IGNORABLE_ERROR_CODES.has(code)) {
            throw error;
        }
    }
};

/** 무료 한도에 맞춰 데이터를 정리한다. 반드시 BEGIN 이후의 client 로 호출한다. */
export const trimUserDataToFreePlan = async (client: DbClient, userId: string) => {
    // 1) 급여·근무·생활 기록: 최근 것부터 한도만큼 남긴다
    await client.query(
        `
            DELETE FROM pay_period_actuals
            WHERE id IN (
                SELECT id FROM pay_period_actuals
                WHERE user_id = $1
                ORDER BY pay_period_end_date DESC, id DESC
                OFFSET $2
            )
        `,
        [userId, FREE_PLAN_LIMITS.payHistory],
    );

    await client.query(
        `
            DELETE FROM work_schedules
            WHERE id IN (
                SELECT id FROM work_schedules
                WHERE user_id = $1
                ORDER BY work_date DESC, id DESC
                OFFSET $2
            )
        `,
        [userId, FREE_PLAN_LIMITS.workSchedules],
    );

    await client.query(
        `
            DELETE FROM living_transactions
            WHERE id IN (
                SELECT id FROM living_transactions
                WHERE user_id = $1
                ORDER BY transaction_date DESC, id DESC
                OFFSET $2
            )
        `,
        [userId, FREE_PLAN_LIMITS.livingTransactions],
    );

    // 2) 고정지출은 전부 삭제 (월별 변경 이력은 ON DELETE CASCADE 로 함께 삭제)
    await client.query("DELETE FROM living_fixed_expenses WHERE user_id = $1", [userId]);

    // 3) 여행: 종료일이 최근인 것부터 한도만큼 남기고, 나머지는 경비·카테고리·목적지와 함께 삭제
    const overflowTrips = await client.query(
        `
            SELECT id FROM trips
            WHERE user_id = $1
            ORDER BY end_date DESC, id DESC
            OFFSET $2
        `,
        [userId, FREE_PLAN_LIMITS.trips],
    );

    const overflowTripIds = overflowTrips.rows.map((row: { id: number | string }) => row.id);

    if (overflowTripIds.length > 0) {
        await runIgnoringMissing(client, "DELETE FROM trip_expenses WHERE trip_id = ANY($1)", [overflowTripIds]);
        await runIgnoringMissing(client, "DELETE FROM trip_expense_categories WHERE trip_id = ANY($1)", [overflowTripIds]);
        await runIgnoringMissing(client, "DELETE FROM trip_destinations WHERE trip_id = ANY($1)", [overflowTripIds]);

        // 위 목록에 없지만 trips 를 직접 참조하는 테이블도 지운다
        const references = await client.query(
            `
                SELECT c.conrelid::regclass::text AS table_name, a.attname AS column_name
                FROM pg_constraint c
                JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = c.conkey[1]
                WHERE c.contype = 'f'
                  AND c.confrelid = 'trips'::regclass
                  AND array_length(c.conkey, 1) = 1
                  AND c.conrelid <> 'trips'::regclass
            `,
        );

        for (const row of references.rows as { table_name: string; column_name: string }[]) {
            const column = `"${row.column_name.replace(/"/g, '""')}"`;

            await runIgnoringMissing(client, `DELETE FROM ${row.table_name} WHERE ${column} = ANY($1)`, [overflowTripIds]);
        }

        await client.query("DELETE FROM trips WHERE id = ANY($1)", [overflowTripIds]);
    }

    // 4) 남은 여행의 경비 카테고리를 기본으로 되돌린다 (직접 만든 카테고리의 경비는 "기타"로 합친다)
    const defaultTripNames = DEFAULT_TRIP_EXPENSE_CATEGORIES.map((c) => c.name);

    await client.query(
        `
            INSERT INTO trip_expense_categories (trip_id, name, sort_order)
            SELECT t.id, d.name, d.sort_order
            FROM trips t
            CROSS JOIN unnest($2::text[], $3::int[]) AS d(name, sort_order)
            WHERE t.user_id = $1
              AND NOT EXISTS (
                  SELECT 1 FROM trip_expense_categories c
                  WHERE c.trip_id = t.id AND c.name = d.name
              )
        `,
        [userId, defaultTripNames, DEFAULT_TRIP_EXPENSE_CATEGORIES.map((c) => c.sortOrder)],
    );

    await client.query(
        `
            WITH other AS (
                SELECT c.trip_id, MIN(c.id) AS id
                FROM trip_expense_categories c
                JOIN trips t ON t.id = c.trip_id AND t.user_id = $1
                WHERE c.name = '기타'
                GROUP BY c.trip_id
            ),
            moved AS (
                SELECT
                    te.trip_id,
                    te.expense_date,
                    o.id AS other_id,
                    SUM(te.amount) AS amount,
                    string_agg('(' || COALESCE(te.expression, te.amount::text) || ')', '+' ORDER BY te.id) AS expression
                FROM trip_expenses te
                JOIN trips t ON t.id = te.trip_id AND t.user_id = $1
                JOIN trip_expense_categories c ON c.id = te.category_id
                JOIN other o ON o.trip_id = te.trip_id
                WHERE c.name <> ALL($2::text[])
                GROUP BY te.trip_id, te.expense_date, o.id
            )
            INSERT INTO trip_expenses (trip_id, expense_date, category_id, expression, amount)
            SELECT trip_id, expense_date, other_id, expression, amount FROM moved
            ON CONFLICT (trip_id, expense_date, category_id)
            DO UPDATE SET
                amount = trip_expenses.amount + EXCLUDED.amount,
                expression = '(' || COALESCE(trip_expenses.expression, trip_expenses.amount::text) || ')+' || EXCLUDED.expression
        `,
        [userId, defaultTripNames],
    );

    await client.query(
        `
            DELETE FROM trip_expenses te
            USING trip_expense_categories c, trips t
            WHERE c.id = te.category_id
              AND t.id = te.trip_id
              AND t.user_id = $1
              AND c.name <> ALL($2::text[])
        `,
        [userId, defaultTripNames],
    );

    await client.query(
        `
            DELETE FROM trip_expense_categories c
            USING trips t
            WHERE t.id = c.trip_id
              AND t.user_id = $1
              AND c.name <> ALL($2::text[])
        `,
        [userId, defaultTripNames],
    );

    // 5) 남은 여행의 경비: 여행마다 한도를 넘는 오래된 것부터 삭제 (카테고리를 합친 뒤에 센다)
    await client.query(
        `
            DELETE FROM trip_expenses
            WHERE id IN (
                SELECT id FROM (
                    SELECT
                        te.id,
                        ROW_NUMBER() OVER (
                            PARTITION BY te.trip_id
                            ORDER BY te.expense_date DESC, te.id DESC
                        ) AS rn
                    FROM trip_expenses te
                    JOIN trips t ON t.id = te.trip_id
                    WHERE t.user_id = $1
                ) ranked
                WHERE rn > $2
            )
        `,
        [userId, FREE_PLAN_LIMITS.tripExpensesPerTrip],
    );

    // 6) 생활 카테고리를 기본으로 되돌린다
    const defaultNames = DEFAULT_LIVING_CATEGORIES.map((c) => c.name);
    const defaultKinds = DEFAULT_LIVING_CATEGORIES.map((c) => c.kind);

    for (const category of DEFAULT_LIVING_CATEGORIES) {
        // 지워졌던 기본 카테고리는 되살리고, 이미 있으면 순서만 기본으로
        await client.query(
            `
                UPDATE living_categories
                SET is_active = TRUE, sort_order = $4
                WHERE id = (
                    SELECT id FROM living_categories
                    WHERE user_id = $1 AND name = $2 AND kind = $3
                    ORDER BY is_active DESC, id
                    LIMIT 1
                )
            `,
            [userId, category.name, category.kind, category.sortOrder],
        );

        // 같은 파라미터를 비교와 INSERT 값에 함께 쓰면 컬럼 타입(varchar/text)이 달라 오류가 나므로
        // 있는지 먼저 확인하고, 없을 때만 일반 INSERT ... VALUES 로 넣는다.
        const existing = await client.query(
            `
                SELECT 1 AS found FROM living_categories
                WHERE user_id = $1 AND name = $2 AND kind = $3 AND is_active = TRUE
                LIMIT 1
            `,
            [userId, category.name, category.kind],
        );

        if (existing.rows.length === 0) {
            await client.query(
                `
                    INSERT INTO living_categories (name, kind, sort_order, is_active, created_at, user_id)
                    VALUES ($1, $2, $3, TRUE, NOW(), $4)
                `,
                [category.name, category.kind, category.sortOrder, userId],
            );
        }
    }

    // 직접 만든 카테고리의 기록은 같은 종류의 "기타"로 옮긴다 (수입은 수입 기타, 나머지는 지출 기타)
    await client.query(
        `
            UPDATE living_transactions lt
            SET category_id = tgt.id
            FROM living_categories c
            JOIN (
                SELECT kind, MIN(id) AS id
                FROM living_categories
                WHERE user_id = $1 AND name = '기타' AND is_active = TRUE AND kind IN ('variable', 'income')
                GROUP BY kind
            ) tgt ON tgt.kind = CASE WHEN c.kind = 'income' THEN 'income' ELSE 'variable' END
            WHERE lt.category_id = c.id
              AND lt.user_id = $1
              AND c.user_id = $1
              AND c.is_active = TRUE
              AND (c.name, c.kind) NOT IN (SELECT * FROM unnest($2::text[], $3::text[]))
        `,
        [userId, defaultNames, defaultKinds],
    );

    await client.query(
        `
            UPDATE living_categories
            SET is_active = FALSE
            WHERE user_id = $1
              AND is_active = TRUE
              AND (name, kind) NOT IN (SELECT * FROM unnest($2::text[], $3::text[]))
        `,
        [userId, defaultNames, defaultKinds],
    );
};

/*
 * 해지 신청을 받아 둔다.
 *  - 결제 기간이 남아 있으면: 기간이 끝날 때 정리하도록 예약만 한다.
 *  - 기간 정보가 없으면(수동으로 Pro 를 준 계정): 지금 바로 정리하고 Pro 를 끝낸다.
 * 반환값: "scheduled" | "done"
 */
export const requestDowngrade = async (userId: string): Promise<"scheduled" | "done" | "not-pro"> => {
    const client = await pool.connect();

    try {
        await client.query("BEGIN");

        const result = await client.query(
            `
                SELECT s.id, s.expires_at
                FROM subscriptions s
                JOIN plans p ON p.id = s.plan_id
                WHERE s.user_id = $1
                  AND s.status = 'active'
                  AND p.code = 'pro'
                  AND (s.expires_at IS NULL OR s.expires_at > NOW())
                LIMIT 1
                FOR UPDATE OF s
            `,
            [userId],
        );

        const subscription = result.rows[0] as { id: string | number; expires_at: Date | null } | undefined;

        if (!subscription) {
            await client.query("ROLLBACK");
            return "not-pro";
        }

        if (subscription.expires_at === null) {
            await trimUserDataToFreePlan(client, userId);

            await client.query(
                "UPDATE subscriptions SET expires_at = NOW(), cancel_requested_at = NOW(), downgrade_done_at = NOW() WHERE id = $1",
                [subscription.id],
            );

            await client.query("COMMIT");
            return "done";
        }

        await client.query("UPDATE subscriptions SET cancel_requested_at = NOW() WHERE id = $1", [subscription.id]);

        await client.query("COMMIT");
        return "scheduled";
    } catch (error) {
        try {
            await client.query("ROLLBACK");
        } catch {
            // 이미 되돌려진 경우
        }

        throw error;
    } finally {
        client.release();
    }
};

/** 아직 기간이 끝나지 않았다면 해지 신청을 취소한다. */
export const cancelDowngradeRequest = async (userId: string): Promise<boolean> => {
    const result = await pool.query(
        `
            UPDATE subscriptions s
            SET cancel_requested_at = NULL
            FROM plans p
            WHERE p.id = s.plan_id
              AND s.user_id = $1
              AND s.status = 'active'
              AND p.code = 'pro'
              AND s.cancel_requested_at IS NOT NULL
              AND s.downgrade_done_at IS NULL
              AND (s.expires_at IS NULL OR s.expires_at > NOW())
        `,
        [userId],
    );

    return (result.rowCount ?? 0) > 0;
};

/*
 * 해지를 신청했고 결제 기간이 끝났다면, 지금 한 번만 정리를 실행한다.
 * 앱을 열 때(/api/auth/me) 불리므로 어떤 경우에도 예외를 던지지 않는다.
 */
export const processPendingDowngrade = async (userId: string): Promise<void> => {
    let client: PoolClient | null = null;

    try {
        client = await pool.connect();

        await client.query("BEGIN");

        const result = await client.query(
            `
                SELECT id
                FROM subscriptions
                WHERE user_id = $1
                  AND status = 'active'
                  AND cancel_requested_at IS NOT NULL
                  AND downgrade_done_at IS NULL
                  AND expires_at IS NOT NULL
                  AND expires_at <= NOW()
                LIMIT 1
                FOR UPDATE
            `,
            [userId],
        );

        const subscription = result.rows[0] as { id: string | number } | undefined;

        if (!subscription) {
            await client.query("ROLLBACK");
            return;
        }

        await trimUserDataToFreePlan(client, userId);

        await client.query("UPDATE subscriptions SET downgrade_done_at = NOW() WHERE id = $1", [subscription.id]);

        await client.query("COMMIT");
    } catch (error) {
        if (client) {
            try {
                await client.query("ROLLBACK");
            } catch {
                // 이미 되돌려진 경우
            }
        }

        // 006 SQL 전이라면 조용히 넘어간다. 그 외 오류는 기록만 하고 다음에 다시 시도한다.
        if (!IGNORABLE_ERROR_CODES.has((error as { code?: string }).code ?? "")) {
            console.error("Pro 해지 정리 실패:", error);
        }
    } finally {
        client?.release();
    }
};
