// (기존 salary/pay-period-tips/route.ts 자리에 그대로 교체)  URL: /api/salary/pay-period-tips
import { getCurrentUser } from "@/lib/auth/user";
import { sql } from "@/lib/db";
import { toPayPeriodTipsDto } from "@/lib/api/mappers";
import { MAX_TIP_PERIODS_PER_USER } from "@/lib/api/plan";
import { badRequest, forbidden, handleRouteError, readJsonBody, unauthorized } from "@/lib/api/response";
import { ValidationError, parseAmount, parseDate } from "@/lib/api/validate";

const MAX_TIP_AMOUNT = 10_000_000;

const parsePeriod = (startValue: unknown, endValue: unknown) => {
    const start = parseDate(startValue, "급여 기간 시작일");
    const end = parseDate(endValue, "급여 기간 종료일");

    if (start > end) {
        throw new ValidationError("급여 기간의 시작일이 종료일보다 늦습니다.");
    }

    return { start, end };
};

export async function GET(request: Request) {
    try {
        const user = await getCurrentUser();

        if (!user) {
            return unauthorized();
        }

        const { searchParams } = new URL(request.url);
        const { start, end } = parsePeriod(searchParams.get("startDate"), searchParams.get("endDate"));

        const result = await sql`
            SELECT
                id,
                TO_CHAR(pay_period_start_date, 'YYYY-MM-DD') AS start_text,
                TO_CHAR(pay_period_end_date, 'YYYY-MM-DD') AS end_text,
                cash_tips,
                paycheque_tips
            FROM pay_period_tips
            WHERE user_id = ${user.id}
              AND pay_period_start_date = ${start}
              AND pay_period_end_date = ${end}
            LIMIT 1
        `;

        return Response.json(result[0] ? toPayPeriodTipsDto(result[0]) : null);
    } catch (error) {
        return handleRouteError("Pay period tips GET error:", error, "팁 정보를 불러오지 못했습니다.");
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

        const { start, end } = parsePeriod(body.payPeriodStart, body.payPeriodEnd);

        const optionalTip = (value: unknown, label: string) =>
            value === undefined || value === null || value === "" ? 0 : parseAmount(value, label, { max: MAX_TIP_AMOUNT });

        const cashTips = optionalTip(body.cashTips, "현금 팁");
        const paychequeTips = optionalTip(body.paychequeTips, "페이첵 팁");

        // 서로 다른 기간으로 계속 저장해서 행이 무한히 쌓이는 것을 방지 (이미 있는 기간의 수정은 항상 허용)
        const [countResult] = await sql`
            SELECT COUNT(*)::int AS count
            FROM pay_period_tips
            WHERE user_id = ${user.id}
        `;

        if (Number(countResult?.count ?? 0) >= MAX_TIP_PERIODS_PER_USER) {
            const [existing] = await sql`
                SELECT id
                FROM pay_period_tips
                WHERE user_id = ${user.id}
                  AND pay_period_start_date = ${start}
                  AND pay_period_end_date = ${end}
                LIMIT 1
            `;

            if (!existing) {
                return forbidden("저장할 수 있는 팁 기록 수를 넘었습니다.", "TIPS_LIMIT_REACHED");
            }
        }

        const result = await sql`
            INSERT INTO pay_period_tips (
                user_id,
                pay_period_start_date,
                pay_period_end_date,
                cash_tips,
                paycheque_tips
            )
            VALUES (
                ${user.id},
                ${start},
                ${end},
                ${cashTips},
                ${paychequeTips}
            )
            ON CONFLICT (
                user_id,
                pay_period_start_date,
                pay_period_end_date
            )
            DO UPDATE SET
                cash_tips = EXCLUDED.cash_tips,
                paycheque_tips = EXCLUDED.paycheque_tips,
                updated_at = NOW()
            RETURNING
                id,
                TO_CHAR(pay_period_start_date, 'YYYY-MM-DD') AS start_text,
                TO_CHAR(pay_period_end_date, 'YYYY-MM-DD') AS end_text,
                cash_tips,
                paycheque_tips
        `;

        return Response.json(toPayPeriodTipsDto(result[0]));
    } catch (error) {
        return handleRouteError("Pay period tips PUT error:", error, "팁 정보를 저장하지 못했습니다.");
    }
}
