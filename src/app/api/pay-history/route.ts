import { sql } from "@/lib/db";
import { getPeriodsPerYear } from "@/lib/payPeriod";
import { calculateTaxes } from "@/lib/tax";

type PayFrequency = "weekly" | "biweekly" | "semi-monthly" | "monthly" | "custom";

export async function GET() {
    try {
        // --------------------------------
        // 1. 급여 설정
        // --------------------------------

        const settingsResult = await sql`
            SELECT
                country,
                province,
                pay_type,
                pay_frequency,
                hourly_wage,
                monthly_salary,
                has_tips,
                tip_type
            FROM salary_settings
            WHERE id = 1
            LIMIT 1
        `;

        const settings = settingsResult[0];

        if (!settings) {
            return Response.json([]);
        }

        const frequency = settings.pay_frequency as PayFrequency;

        // --------------------------------
        // 2. 실제 급여 데이터
        // --------------------------------

        const actualsResult = await sql`
    SELECT
        TO_CHAR(pay_period_start_date, 'YYYY-MM-DD') AS pay_period_start_date,
        TO_CHAR(pay_period_end_date, 'YYYY-MM-DD') AS pay_period_end_date,
        actual_hours,
        actual_cash_tips,
        actual_paycheque_tips,
        is_confirmed
    FROM pay_period_actuals
    ORDER BY pay_period_start_date DESC
`;

        // --------------------------------
        // 3. 실제 급여 내역 생성
        // --------------------------------

        const histories = [];

        const periodsPerYear = getPeriodsPerYear(frequency);

        for (const row of actualsResult) {
            const periodStart = String(row.pay_period_start_date);
            const periodEnd = String(row.pay_period_end_date);

            const hours = Number(row.actual_hours) || 0;

            const actualCashTips = Number(row.actual_cash_tips) || 0;

            const actualPaychequeTips = Number(row.actual_paycheque_tips) || 0;

            // --------------------------------
            // 기본 급여
            // --------------------------------

            const basePay =
                settings.pay_type === "hourly"
                    ? hours * Number(settings.hourly_wage || 0)
                    : settings.pay_type === "salary"
                      ? Number(settings.monthly_salary || 0)
                      : 0;

            // --------------------------------
            // 실제 팁
            // --------------------------------

            const hasPaychequeTips =
                Boolean(settings.has_tips) && (settings.tip_type === "paycheque" || settings.tip_type === "both");

            const hasCashTips = Boolean(settings.has_tips) && (settings.tip_type === "cash" || settings.tip_type === "both");

            const paychequeTips = hasPaychequeTips ? actualPaychequeTips : 0;

            const cashTips = hasCashTips ? actualCashTips : 0;

            // --------------------------------
            // 세금 계산 대상 급여
            // --------------------------------

            const vacationPay = basePay * 0.04;

            const taxableGrossPay = basePay + paychequeTips + vacationPay;

            // --------------------------------
            // 기존 세금 계산 로직 사용
            // 스케줄 페이지와 동일한 방식
            // --------------------------------

            const annualGross = taxableGrossPay * periodsPerYear;

            const taxes = calculateTaxes({
                country: String(settings.country || "CA"),
                province: String(settings.province || ""),
                annualGross,
            });

            // --------------------------------
            // 해당 급여기간의 공제액
            // --------------------------------

            const province = taxes.provinceName;

            const cpp = taxes.cpp / periodsPerYear;

            const cpp2 = taxes.cpp2 / periodsPerYear;

            const ei = taxes.ei / periodsPerYear;

            const federalTax = taxes.federalTax / periodsPerYear;

            const provincialTax = taxes.provincialTax / periodsPerYear;

            const deductions = taxes.totalDeductions / periodsPerYear;

            // --------------------------------
            // 실수령 급여
            // --------------------------------

            const netPay = taxableGrossPay - deductions;

            // --------------------------------
            // 현금 팁 포함 최종 수령액
            // --------------------------------

            const totalIncome = netPay + cashTips;

            // --------------------------------
            // 기록
            // --------------------------------

            histories.push({
                startDate: periodStart,
                endDate: periodEnd,

                hours,

                basePay,

                paychequeTips,

                cashTips,

                grossPay: taxableGrossPay,

                deductions,

                cpp,
                cpp2,
                ei,

                federalTax,
                provincialTax,

                netPay,
                totalIncome,

                province: String(province || ""),

                tipType: settings.has_tips ? settings.tip_type : null,

                hasTips: Boolean(settings.has_tips),

                isConfirmed: Boolean(row.is_confirmed),

                vacationPay,
            });
        }

        return Response.json(histories);
    } catch (error) {
        console.error("Pay history error:", error);

        return Response.json(
            {
                error: "급여 기록을 불러오지 못했습니다.",
            },
            {
                status: 500,
            },
        );
    }
}
