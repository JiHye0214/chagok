// (기존 salary/pay-history/route.ts 자리에 그대로 교체)  URL: /api/salary/pay-history
import { getCurrentUser } from "@/lib/auth/user";
import { sql } from "@/lib/db";
import { toPayHistoryDto } from "@/lib/api/mappers";
import { parsePayHistoryInput } from "@/lib/api/payHistoryInput";
import { getUserProfile } from "@/lib/api/profile";
import { FREE_LIMITS, getPlanCode } from "@/lib/api/plan";
import {
    badRequest,
    conflict,
    forbidden,
    handleRouteError,
    isUniqueViolation,
    notFound,
    readIdFromRequest,
    readJsonBody,
    unauthorized,
} from "@/lib/api/response";
import { parseId } from "@/lib/api/validate";

/* ============================================================
   GET: 실제 저장된 급여 기록 조회
   ============================================================ */

// 통화: 화면이 보낸 값 → 없으면 프로필의 현재 통화. (이미 저장된 기록의 통화는 바꾸지 않는다)
const resolveCurrency = async (userId: string, requested: string | null) => {
    if (requested) {
        return requested;
    }

    const currency = (await getUserProfile(userId))?.currency ?? null;

    return currency && /^[A-Z]{3}$/.test(currency) ? currency : null;
};

export async function GET() {
    try {
        const user = await getCurrentUser();

        if (!user) {
            return unauthorized();
        }

        const result = await sql`
            SELECT
                id,
                TO_CHAR(pay_period_start_date, 'YYYY-MM-DD') AS start_date,
                TO_CHAR(pay_period_end_date, 'YYYY-MM-DD') AS end_date,
                TO_CHAR(pay_date, 'YYYY-MM-DD') AS pay_date,
                actual_hours,
                actual_cash_tips,
                actual_paycheque_tips,
                actual_pay,
                actual_tips,
                actual_deductions,
                adjustments,
                actual_net_pay,
                currency_code,
                earning_lines,
                deduction_lines,
                estimate_snapshot,
                created_at,
                updated_at
            FROM pay_period_actuals
            WHERE user_id = ${user.id}
            ORDER BY pay_period_start_date DESC
        `;

        return Response.json(result.map(toPayHistoryDto));
    } catch (error) {
        return handleRouteError("Pay history GET error:", error, "급여 기록을 불러오지 못했습니다.");
    }
}

/* ============================================================
   POST: 새로운 실제 급여 기록 저장 (같은 기간이 이미 있으면 수정)
   ============================================================ */

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

        const input = parsePayHistoryInput(body);

        // Free 급여 기록 최대 5개. 이미 존재하는 같은 기간의 기록은 UPDATE이므로 제한을 적용하지 않는다.
        if ((await getPlanCode(user.id)) === "free") {
            const [existingPeriod] = await sql`
                SELECT id
                FROM pay_period_actuals
                WHERE user_id = ${user.id}
                  AND pay_period_start_date = ${input.payPeriodStart}
                  AND pay_period_end_date = ${input.payPeriodEnd}
                LIMIT 1
            `;

            if (!existingPeriod) {
                const [countResult] = await sql`
                    SELECT COUNT(*)::int AS count
                    FROM pay_period_actuals
                    WHERE user_id = ${user.id}
                `;

                if (Number(countResult?.count ?? 0) >= FREE_LIMITS.payHistory) {
                    return forbidden(`급여 기록은 최대 ${FREE_LIMITS.payHistory}개까지 저장할 수 있습니다.`, "PAY_HISTORY_LIMIT_REACHED");
                }
            }
        }

        const currencyCode = await resolveCurrency(user.id, input.currencyCode);

        // 새 필드는 보내지 않으면(null) 기존 값을 유지한다: COALESCE(새 값, 기존 값)
        const earningLinesJson = input.earningLines ? JSON.stringify(input.earningLines) : null;
        const deductionLinesJson = input.deductionLines ? JSON.stringify(input.deductionLines) : null;
        const estimateSnapshotJson = input.estimateSnapshot ? JSON.stringify(input.estimateSnapshot) : null;

        const result = await sql`
            INSERT INTO pay_period_actuals (
                user_id,
                pay_period_start_date,
                pay_period_end_date,
                pay_date,
                actual_hours,
                actual_cash_tips,
                actual_paycheque_tips,
                actual_pay,
                actual_tips,
                actual_deductions,
                adjustments,
                actual_net_pay,
                currency_code,
                earning_lines,
                deduction_lines,
                estimate_snapshot,
                updated_at
            )
            VALUES (
                ${user.id},
                ${input.payPeriodStart},
                ${input.payPeriodEnd},
                ${input.payDate},
                ${input.hours},
                ${input.cashTips ?? 0},
                ${input.paychequeTips ?? 0},
                ${input.pay},
                ${input.tips},
                ${input.deductions},
                ${JSON.stringify(input.adjustments)},
                ${input.netPay},
                ${currencyCode},
                COALESCE(${earningLinesJson}::jsonb, '[]'::jsonb),
                COALESCE(${deductionLinesJson}::jsonb, '[]'::jsonb),
                ${estimateSnapshotJson}::jsonb,
                CURRENT_TIMESTAMP
            )
            ON CONFLICT ON CONSTRAINT pay_period_actuals_user_period_unique
            DO UPDATE SET
                pay_date = EXCLUDED.pay_date,
                actual_hours = EXCLUDED.actual_hours,
                actual_cash_tips = COALESCE(${input.cashTips}::numeric, pay_period_actuals.actual_cash_tips),
                actual_paycheque_tips = COALESCE(${input.paychequeTips}::numeric, pay_period_actuals.actual_paycheque_tips),
                actual_pay = EXCLUDED.actual_pay,
                actual_tips = EXCLUDED.actual_tips,
                actual_deductions = EXCLUDED.actual_deductions,
                adjustments = EXCLUDED.adjustments,
                actual_net_pay = EXCLUDED.actual_net_pay,
                currency_code = COALESCE(pay_period_actuals.currency_code, EXCLUDED.currency_code),
                earning_lines = COALESCE(${earningLinesJson}::jsonb, pay_period_actuals.earning_lines),
                deduction_lines = COALESCE(${deductionLinesJson}::jsonb, pay_period_actuals.deduction_lines),
                estimate_snapshot = COALESCE(${estimateSnapshotJson}::jsonb, pay_period_actuals.estimate_snapshot),
                updated_at = CURRENT_TIMESTAMP
            RETURNING
                id,
                TO_CHAR(pay_period_start_date, 'YYYY-MM-DD') AS start_date,
                TO_CHAR(pay_period_end_date, 'YYYY-MM-DD') AS end_date,
                TO_CHAR(pay_date, 'YYYY-MM-DD') AS pay_date,
                actual_hours,
                actual_cash_tips,
                actual_paycheque_tips,
                actual_pay,
                actual_tips,
                actual_deductions,
                adjustments,
                actual_net_pay,
                currency_code,
                earning_lines,
                deduction_lines,
                estimate_snapshot,
                created_at,
                updated_at
        `;

        return Response.json({ success: true, data: toPayHistoryDto(result[0]) }, { status: 201 });
    } catch (error) {
        return handleRouteError("Pay history POST error:", error, "급여 기록을 저장하지 못했습니다.");
    }
}

/* ============================================================
   PUT: 기존 실제 급여 기록 수정
   ============================================================ */

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

        const id = parseId(body.id, "급여 기록 ID");
        const input = parsePayHistoryInput(body);
        const currencyCode = await resolveCurrency(user.id, input.currencyCode);

        const earningLinesJson = input.earningLines ? JSON.stringify(input.earningLines) : null;
        const deductionLinesJson = input.deductionLines ? JSON.stringify(input.deductionLines) : null;
        const estimateSnapshotJson = input.estimateSnapshot ? JSON.stringify(input.estimateSnapshot) : null;

        const result = await sql`
            UPDATE pay_period_actuals
            SET
                pay_period_start_date = ${input.payPeriodStart},
                pay_period_end_date = ${input.payPeriodEnd},
                pay_date = ${input.payDate},
                actual_hours = ${input.hours},
                actual_cash_tips = COALESCE(${input.cashTips}::numeric, actual_cash_tips),
                actual_paycheque_tips = COALESCE(${input.paychequeTips}::numeric, actual_paycheque_tips),
                actual_pay = ${input.pay},
                actual_tips = ${input.tips},
                actual_deductions = ${input.deductions},
                adjustments = ${JSON.stringify(input.adjustments)},
                actual_net_pay = ${input.netPay},
                currency_code = COALESCE(currency_code, ${currencyCode}::text),
                earning_lines = COALESCE(${earningLinesJson}::jsonb, earning_lines),
                deduction_lines = COALESCE(${deductionLinesJson}::jsonb, deduction_lines),
                estimate_snapshot = COALESCE(${estimateSnapshotJson}::jsonb, estimate_snapshot),
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ${id}
              AND user_id = ${user.id}
            RETURNING
                id,
                TO_CHAR(pay_period_start_date, 'YYYY-MM-DD') AS start_date,
                TO_CHAR(pay_period_end_date, 'YYYY-MM-DD') AS end_date,
                TO_CHAR(pay_date, 'YYYY-MM-DD') AS pay_date,
                actual_hours,
                actual_cash_tips,
                actual_paycheque_tips,
                actual_pay,
                actual_tips,
                actual_deductions,
                adjustments,
                actual_net_pay,
                currency_code,
                earning_lines,
                deduction_lines,
                estimate_snapshot,
                created_at,
                updated_at
        `;

        if (result.length === 0) {
            return notFound("해당 급여 기록을 찾을 수 없습니다.");
        }

        return Response.json({ success: true, data: toPayHistoryDto(result[0]) });
    } catch (error) {
        // 기간을 바꿨는데 같은 기간의 기록이 이미 있는 경우
        if (isUniqueViolation(error)) {
            return conflict("같은 급여 기간의 기록이 이미 있습니다.", "PAY_PERIOD_EXISTS");
        }

        return handleRouteError("Pay history PUT error:", error, "급여 기록을 수정하지 못했습니다.");
    }
}

/* ============================================================
   DELETE: 실제 급여 기록 삭제   DELETE /api/salary/pay-history?id=123
   (기존처럼 본문 { id } 도 가능)
   ============================================================ */

export async function DELETE(request: Request) {
    try {
        const user = await getCurrentUser();

        if (!user) {
            return unauthorized();
        }

        const id = parseId(await readIdFromRequest(request), "급여 기록 ID");

        const result = await sql`
            DELETE FROM pay_period_actuals
            WHERE id = ${id}
              AND user_id = ${user.id}
            RETURNING id
        `;

        if (result.length === 0) {
            return notFound("해당 급여 기록을 찾을 수 없습니다.");
        }

        return Response.json({ success: true, id: Number(result[0].id) });
    } catch (error) {
        return handleRouteError("Pay history DELETE error:", error, "급여 기록을 삭제하지 못했습니다.");
    }
}
