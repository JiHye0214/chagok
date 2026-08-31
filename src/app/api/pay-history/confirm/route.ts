import { sql } from "@/lib/db";

export async function POST(request: Request) {
    try {
        const body = await request.json();

        const payPeriodStart = String(body.payPeriodStart || "");
        const payPeriodEnd = String(body.payPeriodEnd || "");

        if (!payPeriodStart || !payPeriodEnd) {
            return Response.json(
                {
                    error: "급여기간이 필요합니다.",
                },
                {
                    status: 400,
                },
            );
        }

        await sql`
            UPDATE pay_period_actuals
            SET is_confirmed = true
            WHERE pay_period_start_date = ${payPeriodStart}
              AND pay_period_end_date = ${payPeriodEnd}
        `;

        return Response.json({
            success: true,
        });
    } catch (error) {
        console.error("Pay history confirm error:", error);

        return Response.json(
            {
                error: "급여를 확정하지 못했습니다.",
            },
            {
                status: 500,
            },
        );
    }
}