import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { Pool } from "pg";

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
});

/*
 * 사용자 데이터를 지우는 순서. 자식 테이블이 먼저, 부모 테이블이 나중이다.
 * 어떤 테이블이 아직 없거나 컬럼 이름이 다르면 그 줄만 건너뛰고 계속 진행한다.
 */
const USER_DATA_DELETES = [
    "DELETE FROM living_pending_imports WHERE user_id = $1",
    "DELETE FROM living_transactions WHERE user_id = $1",
    "DELETE FROM living_fixed_expenses WHERE user_id = $1",
    "DELETE FROM living_categories WHERE user_id = $1",
    "DELETE FROM savings_goals WHERE user_id = $1",
    "DELETE FROM living_settings WHERE user_id = $1",
    "DELETE FROM pay_period_tips WHERE user_id = $1",
    "DELETE FROM pay_period_actuals WHERE user_id = $1",
    "DELETE FROM work_schedules WHERE user_id = $1",
    "DELETE FROM hourly_wage_history WHERE user_id = $1",
    "DELETE FROM salary_settings WHERE user_id = $1",
    "DELETE FROM trip_expenses WHERE trip_id IN (SELECT id FROM trips WHERE user_id = $1)",
    "DELETE FROM trip_expense_categories WHERE trip_id IN (SELECT id FROM trips WHERE user_id = $1)",
    "DELETE FROM trip_destinations WHERE trip_id IN (SELECT id FROM trips WHERE user_id = $1)",
    "DELETE FROM trips WHERE user_id = $1",
    "DELETE FROM push_schedules WHERE user_id = $1",
    "DELETE FROM subscriptions WHERE user_id = $1",
    "DELETE FROM user_profiles WHERE user_id = $1",
];

// 없는 테이블(42P01), 없는 컬럼(42703)은 무시한다
const IGNORABLE_ERROR_CODES = new Set(["42P01", "42703"]);

const quoteIdentifier = (value: string) => `"${value.replace(/"/g, '""')}"`;

export async function DELETE(request: Request) {
    const client = await pool.connect();

    try {
        const session = await auth.api.getSession({
            headers: request.headers,
        });

        if (!session?.user?.id) {
            return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
        }

        const userId = session.user.id;

        await client.query("BEGIN");

        // 한 줄이 실패해도 전체 트랜잭션이 멈추지 않도록 줄마다 SAVEPOINT를 건다
        const runIgnoringMissing = async (text: string, params: unknown[]) => {
            await client.query("SAVEPOINT delete_step");

            try {
                await client.query(text, params);
                await client.query("RELEASE SAVEPOINT delete_step");
            } catch (error) {
                await client.query("ROLLBACK TO SAVEPOINT delete_step");

                const code = (error as { code?: string }).code;

                if (!code || !IGNORABLE_ERROR_CODES.has(code)) {
                    throw error;
                }
            }
        };

        for (const statement of USER_DATA_DELETES) {
            await runIgnoringMissing(statement, [userId]);
        }

        // 위 목록에 없지만 users 를 직접 참조하는 테이블(로그인 계정·세션 등)도 지운다
        const references = await client.query(
            `
                SELECT c.conrelid::regclass::text AS table_name, a.attname AS column_name
                FROM pg_constraint c
                JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = c.conkey[1]
                WHERE c.contype = 'f'
                  AND c.confrelid = 'users'::regclass
                  AND array_length(c.conkey, 1) = 1
                  AND c.conrelid <> 'users'::regclass
            `,
        );

        for (const row of references.rows as { table_name: string; column_name: string }[]) {
            await runIgnoringMissing(`DELETE FROM ${row.table_name} WHERE ${quoteIdentifier(row.column_name)} = $1`, [userId]);
        }

        await client.query("DELETE FROM users WHERE id = $1", [userId]);

        await client.query("COMMIT");

        return NextResponse.json({ success: true });
    } catch (error) {
        try {
            await client.query("ROLLBACK");
        } catch {
            // 이미 롤백된 경우
        }

        console.error("회원탈퇴 오류:", error);

        return NextResponse.json({ error: "회원탈퇴에 실패했어요." }, { status: 500 });
    } finally {
        client.release();
    }
}
