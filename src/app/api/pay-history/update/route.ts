import { sql } from "@/lib/db";

type TipType = "cash" | "paycheque" | "both" | null;

export async function POST(request: Request) {
    try {
        const body = await request.json();

        const {
            payPeriodStart,
            payPeriodEnd,
            actualHours,
            actualCashTips,
            actualPaychequeTips,
        } = body;

        if (!payPeriodStart || !payPeriodEnd) {
            return Response.json(
                {
                    error: "급여 기간이 없습니다.",
                },
                { status: 400 },
            );
        }

        // --------------------------------
        // 1. 급여 설정
        // --------------------------------

        const settingsResult = await sql`
            SELECT
                has_tips,
                tip_type
            FROM salary_settings
            WHERE id = 1
            LIMIT 1
        `;

        const settings = settingsResult[0];

        const hasTips = Boolean(settings?.has_tips);

        const tipType: TipType = hasTips
            ? (settings?.tip_type as TipType)
            : null;

        // --------------------------------
        // 2. 실제 근무시간
        // --------------------------------

        const hours = Number(actualHours);

        if (!Number.isFinite(hours) || hours < 0) {
            return Response.json(
                {
                    error: "근무시간이 올바르지 않습니다.",
                },
                { status: 400 },
            );
        }

        // --------------------------------
        // 3. 실제 팁
        // --------------------------------

        let cashTips = 0;
        let paychequeTips = 0;

        if (tipType === "cash" || tipType === "both") {
            cashTips = Number(actualCashTips);

            if (!Number.isFinite(cashTips) || cashTips < 0) {
                return Response.json(
                    {
                        error: "현금 팁이 올바르지 않습니다.",
                    },
                    { status: 400 },
                );
            }
        }

        if (tipType === "paycheque" || tipType === "both") {
            paychequeTips = Number(actualPaychequeTips);

            if (!Number.isFinite(paychequeTips) || paychequeTips < 0) {
                return Response.json(
                    {
                        error: "급여 포함 팁이 올바르지 않습니다.",
                    },
                    { status: 400 },
                );
            }
        }

        // --------------------------------
        // 4. 실제 급여 저장
        // --------------------------------

        const result = await sql`
            INSERT INTO pay_period_actuals (
                pay_period_start_date,
                pay_period_end_date,
                actual_hours,
                actual_cash_tips,
                actual_paycheque_tips
            )
            VALUES (
                ${payPeriodStart},
                ${payPeriodEnd},
                ${hours},
                ${cashTips},
                ${paychequeTips}
            )
            ON CONFLICT (
                pay_period_start_date,
                pay_period_end_date
            )
            DO UPDATE SET
                actual_hours = EXCLUDED.actual_hours,
                actual_cash_tips = EXCLUDED.actual_cash_tips,
                actual_paycheque_tips = EXCLUDED.actual_paycheque_tips
            RETURNING
                id,
                pay_period_start_date,
                pay_period_end_date,
                actual_hours,
                actual_cash_tips,
                actual_paycheque_tips
        `;

        const row = result[0];

        return Response.json({
            success: true,
            data: {
                id: Number(row.id),
                payPeriodStart: String(row.pay_period_start_date),
                payPeriodEnd: String(row.pay_period_end_date),
                actualHours: Number(row.actual_hours),
                actualCashTips: Number(row.actual_cash_tips),
                actualPaychequeTips: Number(
                    row.actual_paycheque_tips,
                ),
            },
        });
    } catch (error) {
        console.error(
            "Pay history update error:",
            error,
        );

        return Response.json(
            {
                error: "급여 기록을 수정하지 못했습니다.",
            },
            { status: 500 },
        );
    }
}