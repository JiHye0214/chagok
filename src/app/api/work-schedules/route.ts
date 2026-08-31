import { sql } from "@/lib/db";

export async function GET() {
    try {
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

        return Response.json(
            { error: "근무 기록을 불러오지 못했습니다." },
            { status: 500 },
        );
    }
}

export async function POST(request: Request) {
    try {
        const body = await request.json();

        const result = await sql`
            INSERT INTO work_schedules (
                work_date,
                start_time,
                end_time,
                has_break,
                break_minutes,
                alarm_enabled,
                alarm_minutes_before
            )
            VALUES (
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

        return Response.json(
            { error: "근무 기록을 저장하지 못했습니다." },
            { status: 500 },
        );
    }
}

export async function PUT(request: Request) {
    try {
        const body = await request.json();

        if (!body.id) {
            return Response.json(
                { error: "근무 ID가 없습니다." },
                { status: 400 },
            );
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
            return Response.json(
                { error: "근무 기록을 찾을 수 없습니다." },
                { status: 404 },
            );
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

        return Response.json(
            { error: "근무 기록을 수정하지 못했습니다." },
            { status: 500 },
        );
    }
}

export async function DELETE(request: Request) {
    try {
        const { id } = await request.json();

        if (!id) {
            return Response.json(
                { error: "근무 ID가 없습니다." },
                { status: 400 },
            );
        }

        await sql`
            DELETE FROM work_schedules
            WHERE id = ${id}
        `;

        return Response.json({ success: true });
    } catch (error) {
        console.error(error);

        return Response.json(
            { error: "근무 기록을 삭제하지 못했습니다." },
            { status: 500 },
        );
    }
}