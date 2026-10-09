// lib/salary/estimate.ts
// 한 급여 기간의 예상 급여를 계산하는 순수 함수. 화면이 몇 개든 계산은 여기 한 곳에서만 한다.
import { calculateExpectedSalary } from "@/lib/payroll/calculateExpectedSalary";
import type { ExpectedSalaryResult } from "@/lib/payroll/calculateExpectedSalary";
import { isPayrollCountry } from "@/lib/payroll";
import type {
    HolidayData,
    PayPeriodData,
    PeriodEstimateOutcome,
    PeriodTipsData,
    SalaryProfile,
    SalarySettingsData,
    WorkScheduleData,
} from "@/lib/salary/types";

export const getSchedulesInPeriod = (schedules: WorkScheduleData[], period: PayPeriodData) =>
    schedules.filter((schedule) => {
        const date = schedule.date.slice(0, 10);

        return date >= period.startDate && date <= period.endDate;
    });

// 급여 기간이 걸쳐 있는 연도 범위 (연말·연초에 걸치면 두 해의 공휴일이 필요)
export const getHolidayYearRange = (period: Pick<PayPeriodData, "startDate" | "endDate">) => ({
    year: Number(period.startDate.slice(0, 4)),
    endYear: Number(period.endDate.slice(0, 4)),
});

export const buildPeriodEstimate = ({
    profile,
    settings,
    schedules,
    holidays,
    tips,
    period,
}: {
    profile: SalaryProfile | null;
    settings: SalarySettingsData | null;
    schedules: WorkScheduleData[];
    holidays: HolidayData[];
    tips: PeriodTipsData | null;
    period: PayPeriodData;
}): PeriodEstimateOutcome => {
    if (!profile?.countryCode) {
        return { status: "no-profile" };
    }

    if (!settings) {
        return { status: "no-settings" };
    }

    const country = profile.countryCode.toUpperCase();

    // 계산 규칙이 없는 나라는 엉뚱한 금액을 내는 대신 "지원하지 않음"으로 알려준다.
    if (!isPayrollCountry(country)) {
        return { status: "unsupported-country" };
    }

    const countryOptions = settings.countryOptions ?? {};

    const estimate = calculateExpectedSalary({
        settings: {
            country,
            regionCode: profile.provinceCode ?? undefined,
            payType: settings.payType,
            payFrequency: settings.payFrequency,
            semiMonthlyType: settings.semiMonthlyType ?? undefined,
            hourlyWage: settings.hourlyWage,
            hourlyWageHistory: settings.hourlyWageHistory,
            monthlySalary: settings.monthlySalary,
            hasTips: settings.hasTips,
            tipType: settings.tipType ?? undefined,
            vacationPayRate: countryOptions.vacationPayRate,
            holidayPayMode: countryOptions.holidayPayMode,
        },
        schedules: getSchedulesInPeriod(schedules, period),
        cashTips: tips?.cashTips ?? 0,
        paychequeTips: tips?.paychequeTips ?? 0,
        payPeriod: period,
        holidays,
    });

    return { status: "ok", estimate, currency: profile.currency, countryOptions };
};

// 화면 카드·모달에서 쓰는 요약 (계산 결과에서 필요한 값만 골라 이름을 화면 용어에 맞춤)
export const summarizeEstimate = (estimate: ExpectedSalaryResult) => ({
    hours: estimate.hours,
    basePay: estimate.basePay,
    premiumPay: estimate.premiumPay,
    publicHolidayPay: estimate.publicHolidayPay,
    vacationPay: estimate.vacationPay,
    paychequeTips: estimate.paychequeTips,
    cashTips: estimate.cashTips,
    grossPay: estimate.grossPay,
    deductions: estimate.totalDeductions,
    netPay: estimate.estimatedNetPay,
    totalIncome: estimate.finalEstimatedIncome,
    warnings: estimate.warnings,
});

export type EstimateSummary = ReturnType<typeof summarizeEstimate>;
