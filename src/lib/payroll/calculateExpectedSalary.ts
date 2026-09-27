import { calculatePayroll } from "@/lib/payroll/index";
import type { PayPeriod, PayFrequency } from "@/lib/payPeriod";

export type ExpectedSalarySettings = {
    country: string;
    regionCode?: string;

    payType: "hourly" | "salary" | "commission" | "other";

    payFrequency: PayFrequency;

    hourlyWage?: number;
    monthlySalary?: number;

    hasTips: boolean;
    tipType?: "cash" | "paycheque" | "both";
};

export type ExpectedSalarySchedule = {
    date: string;
    startTime: string;
    endTime: string;
    hasBreak: boolean;
    breakMinutes: number;
};

export type ExpectedSalaryResult = {
    hours: number;

    basePay: number;

    paychequeTips: number;
    cashTips: number;

    grossPay: number;

    deductions: {
        key: string;
        name: string;
        amount: number;
    }[];

    totalDeductions: number;

    estimatedNetPay: number;
    finalEstimatedIncome: number;
};

const calculateHours = (startTime: string, endTime: string, breakMinutes: number = 0) => {
    if (!startTime || !endTime) {
        return 0;
    }

    const [startHour, startMinute] = startTime.split(":").map(Number);
    const [endHour, endMinute] = endTime.split(":").map(Number);

    const start = startHour * 60 + startMinute;

    let end = endHour * 60 + endMinute;

    if (end < start) {
        end += 24 * 60;
    }

    const totalMinutes = Math.max(0, end - start - (Number(breakMinutes) || 0));

    return totalMinutes / 60;
};

export const calculateExpectedSalary = ({
    settings,
    schedules,
    cashTips = 0,
    paychequeTips = 0,
    payPeriod,
}: {
    settings: ExpectedSalarySettings;
    schedules: ExpectedSalarySchedule[];
    cashTips?: number;
    paychequeTips?: number;
    payPeriod: PayPeriod;
}): ExpectedSalaryResult => {
    /*
     * --------------------------------------------------
     * Tips
     * --------------------------------------------------
     */

    const safeCashTips = Math.max(0, Number(cashTips) || 0);

    const safePaychequeTips = Math.max(0, Number(paychequeTips) || 0);

    const hasPaychequeTips = settings.hasTips && (settings.tipType === "paycheque" || settings.tipType === "both");

    const hasCashTips = settings.hasTips && (settings.tipType === "cash" || settings.tipType === "both");

    const actualPaychequeTips = hasPaychequeTips ? safePaychequeTips : 0;

    const actualCashTips = hasCashTips ? safeCashTips : 0;

    /*
     * --------------------------------------------------
     * 근무시간
     * --------------------------------------------------
     */

    const periodHours = schedules.reduce(
        (total, schedule) =>
            total + calculateHours(schedule.startTime, schedule.endTime, schedule.hasBreak ? schedule.breakMinutes : 0),
        0,
    );

    /*
     * --------------------------------------------------
     * 기본급
     * --------------------------------------------------
     */

    const hourlyWage = settings.payType === "hourly" ? Number(settings.hourlyWage ?? 0) : 0;

    const basePay =
        settings.payType === "hourly"
            ? periodHours * hourlyWage
            : settings.payType === "salary"
              ? Number(settings.monthlySalary ?? 0)
              : 0;

    /*
     * --------------------------------------------------
     * 급여기간 Gross
     *
     * 여기까지는 모든 국가에서 공통으로 이해할 수
     * 있는 급여 계산만 한다.
     * --------------------------------------------------
     */

    const grossPay = basePay + actualPaychequeTips;

    /*
     * --------------------------------------------------
     * 국가별 Payroll
     * --------------------------------------------------
     */

    const payroll = calculatePayroll({
        country: settings.country,
        regionCode: settings.regionCode,
        grossPay,
        payFrequency: settings.payFrequency,
        payPeriod,
    });

    /*
     * --------------------------------------------------
     * 예상 실수령액
     * --------------------------------------------------
     */

    const estimatedNetPay = grossPay - payroll.totalDeductions;

    /*
     * --------------------------------------------------
     * 최종 예상 수입
     * --------------------------------------------------
     */

    const finalEstimatedIncome = estimatedNetPay + actualCashTips;

    return {
        hours: periodHours,

        basePay,

        paychequeTips: actualPaychequeTips,

        cashTips: actualCashTips,

        grossPay,

        deductions: payroll.deductions,

        totalDeductions: payroll.totalDeductions,

        estimatedNetPay,

        finalEstimatedIncome,
    };
};
