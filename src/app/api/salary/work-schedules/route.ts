import { sql } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/user";

export async function GET() {
    try {
        const user = await getCurrentUser();

        if (!user) {
            return Response.json({ error: "Unauthorized" }, { status: 401 });
        }

        const result = await sql`
            SELECT
                id,
                work_date,
                start_time,
                end_time,
                has_break,
                break_minutes,
                alarm_enabled,
                alarm_minutes_before
            FROM work_schedules
            WHERE user_id = ${user.id}
            ORDER BY work_date ASC, start_time ASC
        `;

        return Response.json(
            result.map((row) => ({
                id: Number(row.id),
                date: row.work_date,
                startTime: row.start_time,
                endTime: row.end_time,
                hasBreak: row.has_break,
                breakMinutes: row.break_minutes,
                alarmEnabled: row.alarm_enabled,
                alarmMinutesBefore: row.alarm_minutes_before,
            })),
        );
    } catch (error) {
        console.error(error);

        return Response.json({ error: "근무 기록을 불러오지 못했습니다." }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const user = await getCurrentUser();

        if (!user) {
            return Response.json({ error: "Unauthorized" }, { status: 401 });
        }

        // 현재 사용자의 요금제 확인
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

        // Free는 근무 기록 최대 100개
        if (planCode === "free") {
            const [countResult] = await sql`
                SELECT COUNT(*)::int AS count
                FROM work_schedules
                WHERE user_id = ${user.id}
            `;

            const currentCount = Number(countResult?.count ?? 0);

            if (currentCount >= 100) {
                return Response.json(
                    {
                        error: "근무 기록은 최대 100개까지 저장할 수 있습니다.",
                        code: "WORK_SCHEDULE_LIMIT_REACHED",
                    },
                    { status: 403 },
                );
            }
        }

        const body = await request.json();

        const result = await sql`
            INSERT INTO work_schedules (
                user_id,
                work_date,
                start_time,
                end_time,
                has_break,
                break_minutes,
                alarm_enabled,
                alarm_minutes_before
            )
            VALUES (
                ${user.id},
                ${body.date},
                ${body.startTime},
                ${body.endTime},
                ${body.hasBreak ?? false},
                ${body.breakMinutes ?? 0},
                ${body.alarmEnabled ?? false},
                ${body.alarmMinutesBefore ?? 60}
            )
            RETURNING
                id,
                work_date,
                start_time,
                end_time,
                has_break,
                break_minutes,
                alarm_enabled,
                alarm_minutes_before
        `;

        const row = result[0];

        return Response.json({
            id: Number(row.id),
            date: row.work_date,
            startTime: row.start_time,
            endTime: row.end_time,
            hasBreak: row.has_break,
            breakMinutes: row.break_minutes,
            alarmEnabled: row.alarm_enabled,
            alarmMinutesBefore: row.alarm_minutes_before,
        });
    } catch (error) {
        console.error(error);

        return Response.json({ error: "근무 기록을 저장하지 못했습니다." }, { status: 500 });
    }
}

export async function PUT(request: Request) {
    try {
        const user = await getCurrentUser();

        if (!user) {
            return Response.json({ error: "Unauthorized" }, { status: 401 });
        }

        const body = await request.json();

        if (!body.id) {
            return Response.json({ error: "근무 ID가 없습니다." }, { status: 400 });
        }

        const result = await sql`
            UPDATE work_schedules
            SET
                work_date = ${body.date},
                start_time = ${body.startTime},
                end_time = ${body.endTime},
                has_break = ${body.hasBreak ?? false},
                break_minutes = ${body.breakMinutes ?? 0},
                alarm_enabled = ${body.alarmEnabled ?? false},
                alarm_minutes_before = ${body.alarmMinutesBefore ?? 60},
                updated_at = NOW()
            WHERE id = ${body.id}
              AND user_id = ${user.id}
            RETURNING
                id,
                work_date,
                start_time,
                end_time,
                has_break,
                break_minutes,
                alarm_enabled,
                alarm_minutes_before
        `;

        if (!result[0]) {
            return Response.json({ error: "근무 기록을 찾을 수 없습니다." }, { status: 404 });
        }

        const row = result[0];

        return Response.json({
            id: Number(row.id),
            date: row.work_date,
            startTime: row.start_time,
            endTime: row.end_time,
            hasBreak: row.has_break,
            breakMinutes: row.break_minutes,
            alarmEnabled: row.alarm_enabled,
            alarmMinutesBefore: row.alarm_minutes_before,
        });
    } catch (error) {
        console.error(error);

        return Response.json({ error: "근무 기록을 수정하지 못했습니다." }, { status: 500 });
    }
}

export async function DELETE(request: Request) {
    try {
        const user = await getCurrentUser();

        if (!user) {
            return Response.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { id } = await request.json();

        if (!id) {
            return Response.json({ error: "근무 ID가 없습니다." }, { status: 400 });
        }

        const result = await sql`
            DELETE FROM work_schedules
            WHERE id = ${id}
              AND user_id = ${user.id}
            RETURNING id
        `;

        if (!result[0]) {
            return Response.json({ error: "근무 기록을 찾을 수 없습니다." }, { status: 404 });
        }

        return Response.json({ success: true });
    } catch (error) {
        console.error(error);

        return Response.json({ error: "근무 기록을 삭제하지 못했습니다." }, { status: 500 });
    }
}
