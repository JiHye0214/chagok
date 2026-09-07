import { sql } from "@/lib/db";
import { getPeriodsPerYear } from "@/lib/payPeriod";
import { calculateTaxes } from "@/lib/tax";

type PayFrequency = "weekly" | "biweekly" | "semi-monthly" | "monthly" | "custom";

export async function GET() {
    try {
        // ============================================================
        // 1. 급여 설정
        // ============================================================

        const settingsResult = await sql`
            SELECT
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

        const periodsPerYear = getPeriodsPerYear(frequency);

        const vacationPayRate = 4.15;

        // ============================================================
        // 2. 실제 저장된 급여 기록
        //
        // 중요:
        // pay_period_actuals에는 현재 is_confirmed 컬럼이 없다.
        // 따라서 여기서 조회하지 않는다.
        // ============================================================

        const actualsResult = await sql`
            SELECT
                id,

                TO_CHAR(
                    pay_period_start_date,
                    'YYYY-MM-DD'
                ) AS start_date,

                TO_CHAR(
                    pay_period_end_date,
                    'YYYY-MM-DD'
                ) AS end_date,

                TO_CHAR(
                    pay_date,
                    'YYYY-MM-DD'
                ) AS pay_date,

                actual_hours,

                actual_cash_tips,

                actual_paycheque_tips,

                actual_pay,

                actual_tips,

                actual_deductions,

                actual_net_pay,

                adjustments,

                created_at,

                updated_at

            FROM pay_period_actuals

            ORDER BY
                pay_period_start_date DESC
        `;

        // ============================================================
        // 3. 급여 기록 계산
        // ============================================================

        const histories = [];

        for (const row of actualsResult) {
            const startDate = String(row.start_date);

            const endDate = String(row.end_date);

            const payDate = row.pay_date ? String(row.pay_date) : null;

            const hours = Number(row.actual_hours) || 0;

            const actualCashTips = Number(row.actual_cash_tips) || 0;

            const actualPaychequeTips = Number(row.actual_paycheque_tips) || 0;

            // ========================================================
            // 기본 급여
            // ========================================================

            let basePay = 0;

            if (settings.pay_type === "hourly") {
                basePay = hours * Number(settings.hourly_wage || 0);
            } else if (settings.pay_type === "salary") {
                basePay = Number(settings.monthly_salary || 0);
            }

            // ========================================================
            // 팁
            // ========================================================

            const hasTips = Boolean(settings.has_tips);

            const tipType = settings.tip_type ? String(settings.tip_type) : null;

            const hasPaychequeTips = hasTips && (tipType === "paycheque" || tipType === "both");

            const hasCashTips = hasTips && (tipType === "cash" || tipType === "both");

            const paychequeTips = hasPaychequeTips ? actualPaychequeTips : 0;

            const cashTips = hasCashTips ? actualCashTips : 0;

            // ========================================================
            // Vacation Pay
            // ========================================================

            const vacationPay = basePay * (vacationPayRate / 100);

            // ========================================================
            // 세전 급여
            // ========================================================

            const taxableGrossPay = basePay + paychequeTips + vacationPay;

            // ========================================================
            // 세금 계산
            // ========================================================

            const annualGross = taxableGrossPay * periodsPerYear;

            const taxes = calculateTaxes({
                country: "CA",

                province: String(settings.province || ""),

                annualGross,
            });

            // ========================================================
            // 기간당 공제
            // ========================================================

            const cpp = taxes.cpp / periodsPerYear;

            const cpp2 = taxes.cpp2 / periodsPerYear;

            const ei = taxes.ei / periodsPerYear;

            const federalTax = taxes.federalTax / periodsPerYear;

            const provincialTax = taxes.provincialTax / periodsPerYear;

            const deductions = taxes.totalDeductions / periodsPerYear;

            // ========================================================
            // 계산된 실수령액
            // ========================================================

            const calculatedNetPay = taxableGrossPay - deductions;

            const calculatedTotalIncome = calculatedNetPay + cashTips;

            // ========================================================
            // DB에 실제 저장된 값
            //
            // 나중에 실제 급여를 직접 기록한 경우
            // DB 값을 우선적으로 사용할 수 있도록 같이 반환한다.
            // ========================================================

            const savedActualPay = row.actual_pay !== null && row.actual_pay !== undefined ? Number(row.actual_pay) : null;

            const savedActualTips = row.actual_tips !== null && row.actual_tips !== undefined ? Number(row.actual_tips) : null;

            const savedActualDeductions =
                row.actual_deductions !== null && row.actual_deductions !== undefined ? Number(row.actual_deductions) : null;

            const savedActualNetPay =
                row.actual_net_pay !== null && row.actual_net_pay !== undefined ? Number(row.actual_net_pay) : null;

            // ========================================================
            // History
            // ========================================================

            histories.push({
                id: Number(row.id),

                startDate,

                endDate,

                payDate,

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

                netPay: savedActualNetPay ?? calculatedNetPay,

                totalIncome: savedActualNetPay !== null ? savedActualNetPay + cashTips : calculatedTotalIncome,

                province: taxes.provinceName,

                tipType: hasTips ? tipType : null,

                hasTips,

                // 현재 DB에서는 is_confirmed를
                // 사용하지 않으므로 false로 유지
                isConfirmed: false,

                vacationPay,

                // 실제 저장값도 같이 전달
                actualPay: savedActualPay,

                actualTips: savedActualTips,

                actualDeductions: savedActualDeductions,

                actualNetPay: savedActualNetPay,

                adjustments: row.adjustments ?? [],

                calculatedNetPay,

                calculatedTotalIncome,
            });
        }

        // ============================================================
        // 4. 반환
        // ============================================================

        return Response.json(histories);
    } catch (error) {
        console.error("Pay history error:", error);

        return Response.json(
            {
                error: "급여 기록을 불러오지 못했습니다.",

                detail: error instanceof Error ? error.message : String(error),
            },
            {
                status: 500,
            },
        );
    }
}
