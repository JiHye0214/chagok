import { sql } from "@/lib/db";

export async function GET() {
    try {
        const result = await sql`
    SELECT
        id,
        province,
        pay_type,
        pay_frequency,
        hourly_wage,
        monthly_salary,
        has_tips,
        tip_type,
        TO_CHAR(pay_period_start_date, 'YYYY-MM-DD') AS pay_period_start_date,
        TO_CHAR(pay_date, 'YYYY-MM-DD') AS pay_date,
        semi_monthly_type,
        custom_pay_days
    FROM salary_settings
    WHERE id = 1
    LIMIT 1
`;

        const row = result[0];

        if (!row) {
            return Response.json(null);
        }

        return Response.json({
            province: row.province,
            payType: row.pay_type,
            payFrequency: row.pay_frequency,
            hourlyWage: row.hourly_wage,
            monthlySalary: row.monthly_salary,
            hasTips: row.has_tips,
            tipType: row.tip_type,
            payPeriodStartDate: row.pay_period_start_date,
            payDate: row.pay_date,
            semiMonthlyType: row.semi_monthly_type,
            customPayDays: row.custom_pay_days,
        });
    } catch (error) {
        console.error(error);

        return Response.json({ error: "급여 설정을 불러오지 못했습니다." }, { status: 500 });
    }
}

export async function PUT(request: Request) {
    try {
        const body = await request.json();

        const result = await sql`
            INSERT INTO salary_settings (
                id,
                province,
                pay_type,
                pay_frequency,
                hourly_wage,
                monthly_salary,
                has_tips,
                tip_type,
                pay_period_start_date,
                pay_date,
                semi_monthly_type,
                custom_pay_days
            )
            VALUES (
                1,
                ${body.province},
                ${body.payType},
                ${body.payFrequency},
                ${body.hourlyWage ?? null},
                ${body.monthlySalary ?? null},
                ${body.hasTips},
                ${body.tipType ?? null},
                ${body.payPeriodStartDate || null},
                ${body.payDate || null},
                ${body.semiMonthlyType ?? null},
                ${body.customPayDays ?? null}
            )
            ON CONFLICT (id)
            DO UPDATE SET
                province = EXCLUDED.province,
                pay_type = EXCLUDED.pay_type,
                pay_frequency = EXCLUDED.pay_frequency,
                hourly_wage = EXCLUDED.hourly_wage,
                monthly_salary = EXCLUDED.monthly_salary,
                has_tips = EXCLUDED.has_tips,
                tip_type = EXCLUDED.tip_type,
                pay_period_start_date = EXCLUDED.pay_period_start_date,
                pay_date = EXCLUDED.pay_date,
                semi_monthly_type = EXCLUDED.semi_monthly_type,
                custom_pay_days = EXCLUDED.custom_pay_days,
                updated_at = NOW()
            RETURNING *
        `;

        return Response.json(result[0]);
    } catch (error) {
        console.error(error);

        return Response.json({ error: "급여 설정을 저장하지 못했습니다." }, { status: 500 });
    }
}
