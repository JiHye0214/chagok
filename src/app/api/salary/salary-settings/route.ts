import { getPayPeriodEndDate } from "@/lib/payPeriod";
import { sql } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/user";

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
        const user = await getCurrentUser();

        if (!user) {
            return Response.json({ error: "Unauthorized" }, { status: 401 });
        }

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
                TO_CHAR(
                    pay_period_start_date,
                    'YYYY-MM-DD'
                ) AS pay_period_start_date,
                TO_CHAR(
                    pay_date,
                    'YYYY-MM-DD'
                ) AS pay_date,
                pay_date_offset,
                semi_monthly_type,
                custom_pay_days
            FROM salary_settings
            WHERE user_id = ${user.id}
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
            {
                error: "급여 설정을 불러오지 못했습니다.",
            },
            { status: 500 },
        );
    }
}

export async function PUT(request: Request) {
    try {
        const user = await getCurrentUser();

        if (!user) {
            return Response.json({ error: "Unauthorized" }, { status: 401 });
        }

        const body = await request.json();

        const province = body.province ?? null;
        const payType = body.payType ?? null;
        const payFrequency = body.payFrequency ?? null;

        const hourlyWage = body.hourlyWage === "" || body.hourlyWage == null ? null : Number(body.hourlyWage);

        const monthlySalary = body.monthlySalary === "" || body.monthlySalary == null ? null : Number(body.monthlySalary);

        const hasTips = Boolean(body.hasTips);

        const tipType = body.tipType ?? null;

        const payPeriodStartDate = body.payPeriodStartDate || null;

        const payDate = body.payDate || null;

        const semiMonthlyType = body.semiMonthlyType ?? null;

        const customPayDays = body.customPayDays ?? null;

        let payDateOffset: number | null = null;

        if (payPeriodStartDate && payDate) {
            const endDate = getPayPeriodEndDate(payPeriodStartDate, payFrequency, semiMonthlyType, customPayDays);

            if (endDate) {
                payDateOffset = getDateDifference(endDate, payDate);
            }
        }

        /*
         * 먼저 해당 user의 급여 설정이 존재하는지 확인
         */
        const existing = await sql`
            SELECT id
            FROM salary_settings
            WHERE user_id = ${user.id}
            LIMIT 1
        `;

        /*
         * 이미 있으면 UPDATE
         */
        if (existing.length > 0) {
            const result = await sql`
                UPDATE salary_settings
                SET
                    province = ${province},
                    pay_type = ${payType},
                    pay_frequency = ${payFrequency},
                    hourly_wage = ${hourlyWage},
                    monthly_salary = ${monthlySalary},
                    has_tips = ${hasTips},
                    tip_type = ${tipType},
                    pay_period_start_date = ${payPeriodStartDate},
                    pay_date = ${payDate},
                    pay_date_offset = ${payDateOffset},
                    semi_monthly_type = ${semiMonthlyType},
                    custom_pay_days = ${customPayDays},
                    updated_at = CURRENT_TIMESTAMP
                WHERE user_id = ${user.id}
                RETURNING *
            `;

            return Response.json(result[0]);
        }

        /*
         * 없으면 INSERT
         *
         * id는 직접 넣지 않음.
         * DB가 자동 생성하도록 둠.
         */
        const result = await sql`
            INSERT INTO salary_settings (
                user_id,
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
                ${user.id},
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
            RETURNING *
        `;

        return Response.json(result[0]);
    } catch (error) {
        console.error("Salary settings PUT error:", error);

        return Response.json(
            {
                error: "급여 설정 저장에 실패했습니다.",
                details: error instanceof Error ? error.message : String(error),
            },
            { status: 500 },
        );
    }
}
