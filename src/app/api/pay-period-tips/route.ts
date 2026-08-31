import { sql } from "@/lib/db";

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);

        const startDate = searchParams.get("startDate");
        const endDate = searchParams.get("endDate");

        if (!startDate || !endDate) {
            return Response.json(
                { error: "급여 기간이 필요합니다." },
                { status: 400 },
            );
        }

        const result = await sql`
            SELECT
                id,
                pay_period_start_date,
                pay_period_end_date,
                cash_tips,
                paycheque_tips
            FROM pay_period_tips
            WHERE pay_period_start_date = ${startDate}
              AND pay_period_end_date = ${endDate}
            LIMIT 1
        `;

        const row = result[0];

        if (!row) {
            return Response.json(null);
        }

        return Response.json({
            id: Number(row.id),
            payPeriodStart: row.pay_period_start_date,
            payPeriodEnd: row.pay_period_end_date,
            cashTips: Number(row.cash_tips),
            paychequeTips: Number(row.paycheque_tips),
        });
    } catch (error) {
        console.error(error);

        return Response.json(
            { error: "팁 정보를 불러오지 못했습니다." },
            { status: 500 },
        );
    }
}

export async function PUT(request: Request) {
    try {
        const body = await request.json();

        if (!body.payPeriodStart || !body.payPeriodEnd) {
            return Response.json(
                { error: "급여 기간이 필요합니다." },
                { status: 400 },
            );
        }

        const result = await sql`
            INSERT INTO pay_period_tips (
                pay_period_start_date,
                pay_period_end_date,
                cash_tips,
                paycheque_tips
            )
            VALUES (
                ${body.payPeriodStart},
                ${body.payPeriodEnd},
                ${Math.max(0, Number(body.cashTips) || 0)},
                ${Math.max(0, Number(body.paychequeTips) || 0)}
            )
            ON CONFLICT (
                pay_period_start_date,
                pay_period_end_date
            )
            DO UPDATE SET
                cash_tips = EXCLUDED.cash_tips,
                paycheque_tips = EXCLUDED.paycheque_tips,
                updated_at = NOW()
            RETURNING
                id,
                pay_period_start_date,
                pay_period_end_date,
                cash_tips,
                paycheque_tips
        `;

        const row = result[0];

        return Response.json({
            id: Number(row.id),
            payPeriodStart: row.pay_period_start_date,
            payPeriodEnd: row.pay_period_end_date,
            cashTips: Number(row.cash_tips),
            paychequeTips: Number(row.paycheque_tips),
        });
    } catch (error) {
        console.error(error);

        return Response.json(
            { error: "팁 정보를 저장하지 못했습니다." },
            { status: 500 },
        );
    }
}