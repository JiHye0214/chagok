import { getPayPeriodEndDate } from "@/lib/payPeriod";
import { sql } from "@/lib/db";

const getDateDifference = (fromDate: string, toDate: string) => {
    const from = new Date(`${fromDate}T00:00:00`);
    const to = new Date(`${toDate}T00:00:00`);

    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
        return null;
    }

    return Math.round((to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24));
};

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
                pay_date_offset,
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
            payDateOffset: row.pay_date_offset,
            semiMonthlyType: row.semi_monthly_type,
            customPayDays: row.custom_pay_days,
        });
    } catch (error) {
        console.error("Salary settings GET error:", error);

        return Response.json(
            { error: "급여 설정을 불러오지 못했습니다." },
            { status: 500 },
        );
    }
}

export async function PUT(request: Request) {
    try {
        const body = await request.json();

        const province = body.province;
        const payType = body.payType;
        const payFrequency = body.payFrequency;
        const hourlyWage = body.hourlyWage ?? null;
        const monthlySalary = body.monthlySalary ?? null;
        const hasTips = body.hasTips ?? false;
        const tipType = body.tipType ?? null;
        const payPeriodStartDate = body.payPeriodStartDate || null;
        const payDate = body.payDate || null;
        const semiMonthlyType = body.semiMonthlyType ?? null;
        const customPayDays = body.customPayDays ?? null;

        let payDateOffset: number | null = null;

        if (payPeriodStartDate && payDate) {
            const endDate = getPayPeriodEndDate(
                payPeriodStartDate,
                payFrequency,
                semiMonthlyType,
                customPayDays,
            );

            payDateOffset = getDateDifference(
                endDate,
                payDate,
            );
        }

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
                pay_date_offset,
                semi_monthly_type,
                custom_pay_days
            )
            VALUES (
                1,
                ${province},
                ${payType},
                ${payFrequency},
                ${hourlyWage},
                ${monthlySalary},
                ${hasTips},
                ${tipType},
                ${payPeriodStartDate},
                ${payDate},
                ${payDateOffset},
                ${semiMonthlyType},
                ${customPayDays}
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
                pay_date_offset = EXCLUDED.pay_date_offset,
                semi_monthly_type = EXCLUDED.semi_monthly_type,
                custom_pay_days = EXCLUDED.custom_pay_days,
                updated_at = CURRENT_TIMESTAMP
            RETURNING *
        `;

        return Response.json(result[0]);
    } catch (error) {
        console.error("Salary settings PUT error:", error);

        return Response.json(
            { error: "급여 설정 저장에 실패했습니다." },
            { status: 500 },
        );
    }
}