// (기존 salary/work-schedules/route.ts 자리에 그대로 교체)  URL: /api/salary/work-schedules
import { getCurrentUser } from "@/lib/auth/user";
import { sql } from "@/lib/db";
import { toWorkScheduleDto } from "@/lib/api/mappers";
import { FREE_LIMITS, getPlanCode } from "@/lib/api/plan";
import { badRequest, forbidden, handleRouteError, notFound, readIdFromRequest, readJsonBody, unauthorized } from "@/lib/api/response";
import { parseBoolean, parseDate, parseId, parseInteger, parseOptionalDate, parseTime } from "@/lib/api/validate";

// 입력 검증: POST와 PUT이 공통으로 사용
const parseScheduleInput = (body: Record<string, unknown>) => ({
    date: parseDate(body.date, "근무 날짜"),
    startTime: parseTime(body.startTime, "시작 시간"),
    endTime: parseTime(body.endTime, "종료 시간"),
    hasBreak: parseBoolean(body.hasBreak, false),
    breakMinutes: body.breakMinutes === undefined ? 0 : parseInteger(body.breakMinutes, "휴게 시간", { min: 0, max: 720 }),
    alarmEnabled: parseBoolean(body.alarmEnabled, false),
    alarmMinutesBefore:
        body.alarmMinutesBefore === undefined ? 60 : parseInteger(body.alarmMinutesBefore, "알람 시간", { min: 0, max: 10_080 }),
});

/*
 * GET /api/salary/work-schedules?from=YYYY-MM-DD&to=YYYY-MM-DD
 * from/to는 선택. 급여 계산에는 해당 급여 기간만 필요하므로 화면에서 기간을 넘기면 응답이 작아진다.
 */
export async function GET(request: Request) {
    try {
        const user = await getCurrentUser();

        if (!user) {
            return unauthorized();
        }

        const { searchParams } = new URL(request.url);
        const from = parseOptionalDate(searchParams.get("from"), "시작일");
        const to = parseOptionalDate(searchParams.get("to"), "종료일");

        const result = await sql`
            SELECT
                id,
                TO_CHAR(work_date, 'YYYY-MM-DD') AS date_text,
                LEFT(start_time::text, 5) AS start_text,
                LEFT(end_time::text, 5) AS end_text,
                has_break,
                break_minutes,
                alarm_enabled,
                alarm_minutes_before
            FROM work_schedules
            WHERE user_id = ${user.id}
              AND (${from}::date IS NULL OR work_date >= ${from}::date)
              AND (${to}::date IS NULL OR work_date <= ${to}::date)
            ORDER BY work_date ASC, start_time ASC
        `;

        return Response.json(result.map(toWorkScheduleDto));
    } catch (error) {
        return handleRouteError("Work schedules GET error:", error, "근무 기록을 불러오지 못했습니다.");
    }
}

export async function POST(request: Request) {
    try {
        const user = await getCurrentUser();

        if (!user) {
            return unauthorized();
        }

        const body = await readJsonBody(request);

        if (!body) {
            return badRequest("요청 본문이 올바르지 않습니다.");
        }

        const input = parseScheduleInput(body);

        // Free는 근무 기록 최대 100개
        if ((await getPlanCode(user.id)) === "free") {
            const [countResult] = await sql`
                SELECT COUNT(*)::int AS count
                FROM work_schedules
                WHERE user_id = ${user.id}
            `;

            if (Number(countResult?.count ?? 0) >= FREE_LIMITS.workSchedules) {
                return forbidden(`근무 기록은 최대 ${FREE_LIMITS.workSchedules}개까지 저장할 수 있습니다.`, "WORK_SCHEDULE_LIMIT_REACHED");
            }
        }

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
                ${input.date},
                ${input.startTime},
                ${input.endTime},
                ${input.hasBreak},
                ${input.breakMinutes},
                ${input.alarmEnabled},
                ${input.alarmMinutesBefore}
            )
            RETURNING
                id,
                TO_CHAR(work_date, 'YYYY-MM-DD') AS date_text,
                LEFT(start_time::text, 5) AS start_text,
                LEFT(end_time::text, 5) AS end_text,
                has_break,
                break_minutes,
                alarm_enabled,
                alarm_minutes_before
        `;

        return Response.json(toWorkScheduleDto(result[0]));
    } catch (error) {
        return handleRouteError("Work schedules POST error:", error, "근무 기록을 저장하지 못했습니다.");
    }
}

export async function PUT(request: Request) {
    try {
        const user = await getCurrentUser();

        if (!user) {
            return unauthorized();
        }

        const body = await readJsonBody(request);

        if (!body) {
            return badRequest("요청 본문이 올바르지 않습니다.");
        }

        const id = parseId(body.id, "근무 ID");
        const input = parseScheduleInput(body);

        const result = await sql`
            UPDATE work_schedules
            SET
                work_date = ${input.date},
                start_time = ${input.startTime},
                end_time = ${input.endTime},
                has_break = ${input.hasBreak},
                break_minutes = ${input.breakMinutes},
                alarm_enabled = ${input.alarmEnabled},
                alarm_minutes_before = ${input.alarmMinutesBefore},
                updated_at = NOW()
            WHERE id = ${id}
              AND user_id = ${user.id}
            RETURNING
                id,
                TO_CHAR(work_date, 'YYYY-MM-DD') AS date_text,
                LEFT(start_time::text, 5) AS start_text,
                LEFT(end_time::text, 5) AS end_text,
                has_break,
                break_minutes,
                alarm_enabled,
                alarm_minutes_before
        `;

        if (!result[0]) {
            return notFound("근무 기록을 찾을 수 없습니다.");
        }

        return Response.json(toWorkScheduleDto(result[0]));
    } catch (error) {
        return handleRouteError("Work schedules PUT error:", error, "근무 기록을 수정하지 못했습니다.");
    }
}

// DELETE /api/salary/work-schedules?id=123  (기존처럼 본문 { id } 도 가능)
export async function DELETE(request: Request) {
    try {
        const user = await getCurrentUser();

        if (!user) {
            return unauthorized();
        }

        const id = parseId(await readIdFromRequest(request), "근무 ID");

        const result = await sql`
            DELETE FROM work_schedules
            WHERE id = ${id}
              AND user_id = ${user.id}
            RETURNING id
        `;

        if (!result[0]) {
            return notFound("근무 기록을 찾을 수 없습니다.");
        }

        return Response.json({ success: true });
    } catch (error) {
        return handleRouteError("Work schedules DELETE error:", error, "근무 기록을 삭제하지 못했습니다.");
    }
}
