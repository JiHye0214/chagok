// (기존 salary/salary-settings/route.ts 자리에 그대로 교체)  URL: /api/salary/salary-settings
import { getCurrentUser } from "@/lib/auth/user";
import { sql } from "@/lib/db";
import { EMPLOYMENT_TYPES, PAY_FREQUENCIES, PAY_TYPES, SEMI_MONTHLY_TYPES, TIP_TYPES } from "@/lib/api/constants";
import { toSalarySettingsDto } from "@/lib/api/mappers";
import { badRequest, handleRouteError, readJsonBody, unauthorized } from "@/lib/api/response";
import {
    ValidationError,
    parseBoolean,
    parseEnum,
    parseInteger,
    parseOptionalAmount,
    parseOptionalDate,
    parseOptionalEnum,
} from "@/lib/api/validate";
import { getUserProfile } from "@/lib/api/profile";
import { getPayPeriodEndDate } from "@/lib/payPeriod";
import { isPayrollCountry } from "@/lib/payroll";
import type { PayrollCountry } from "@/lib/payroll";
import { parseCountryOptions } from "@/lib/payroll/countryOptions";

const getDateDifference = (fromDate: string, toDate: string) => {
    const from = new Date(`${fromDate}T00:00:00`);
    const to = new Date(`${toDate}T00:00:00`);

    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
        return null;
    }

    return Math.round((to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24));
};

// 나라별 옵션 검증에 쓰는 국가는 프로필 기준 (지원하지 않는 나라면 null)
const getProfileCountry = async (userId: string): Promise<PayrollCountry | null> => {
    const profile = await getUserProfile(userId);
    const code = profile?.countryCode?.toUpperCase();

    return isPayrollCountry(code) ? code : null;
};

export async function GET() {
    try {
        const user = await getCurrentUser();

        if (!user) {
            return unauthorized();
        }

        const result = await sql`
            SELECT
                employment_type,
                country_options,
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
            WHERE user_id = ${user.id}
            LIMIT 1
        `;

        return Response.json(result[0] ? toSalarySettingsDto(result[0]) : null);
    } catch (error) {
        return handleRouteError("Salary settings GET error:", error, "급여 설정을 불러오지 못했습니다.");
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

        const employmentType = parseOptionalEnum(body.employmentType, "소득 유형", EMPLOYMENT_TYPES);

        const payType = parseEnum(body.payType, "급여 유형", PAY_TYPES);
        const payFrequency = parseEnum(body.payFrequency, "급여 주기", PAY_FREQUENCIES);

        const hourlyWage = parseOptionalAmount(body.hourlyWage, "시급");
        const monthlySalary = parseOptionalAmount(body.monthlySalary, "월급");

        const hasTips = parseBoolean(body.hasTips, false);
        const tipType = parseOptionalEnum(body.tipType, "팁 종류", TIP_TYPES);

        const payPeriodStartDate = parseOptionalDate(body.payPeriodStartDate, "급여 기간 시작일");
        const payDate = parseOptionalDate(body.payDate, "급여일");

        const semiMonthlyType = parseOptionalEnum(body.semiMonthlyType, "반월급 유형", SEMI_MONTHLY_TYPES);

        const customPayDays =
            body.customPayDays === undefined || body.customPayDays === null || body.customPayDays === ""
                ? null
                : parseInteger(body.customPayDays, "급여 주기 일수", { min: 1, max: 366 });

        // 나라별 옵션: 보내지 않으면 기존 값 유지. 보낼 때는 그 나라가 허용하는 항목만 통과.
        let countryOptionsJson: string | null = null;

        if (body.countryOptions !== undefined && body.countryOptions !== null) {
            const optionsCountry = await getProfileCountry(user.id);

            if (!optionsCountry) {
                throw new ValidationError("프로필의 국가 설정을 먼저 확인해주세요.");
            }

            const parsed = parseCountryOptions(optionsCountry, body.countryOptions);

            if (!parsed.ok) {
                throw new ValidationError(parsed.error);
            }

            countryOptionsJson = JSON.stringify(parsed.value);
        }

        let payDateOffset: number | null = null;

        if (payPeriodStartDate && payDate) {
            const endDate = getPayPeriodEndDate(
                payPeriodStartDate,
                payFrequency,
                semiMonthlyType ?? undefined,
                customPayDays ?? undefined,
            );

            if (endDate) {
                payDateOffset = getDateDifference(endDate, payDate);
            }
        }

        // 한 번의 upsert (사용자당 1행: salary_settings_one_per_user 유니크 인덱스 사용)
        const result = await sql`
            INSERT INTO salary_settings (
                user_id,
                employment_type,
                country_options,
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
                ${employmentType},
                COALESCE(${countryOptionsJson}::jsonb, '{}'::jsonb),
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
            ON CONFLICT (user_id) DO UPDATE SET
                employment_type = COALESCE(${employmentType}::text, salary_settings.employment_type),
                country_options = COALESCE(${countryOptionsJson}::jsonb, salary_settings.country_options),
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
                updated_at = NOW()
            RETURNING
                employment_type,
                country_options,
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
        `;

        return Response.json(toSalarySettingsDto(result[0]));
    } catch (error) {
        return handleRouteError("Salary settings PUT error:", error, "급여 설정 저장에 실패했습니다.");
    }
}
