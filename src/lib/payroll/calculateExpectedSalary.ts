// lib/payroll/calculateExpectedSalary.ts
import { calculatePayroll } from "@/lib/payroll/calculatePayroll";
import type { PayrollCountry } from "@/lib/payroll/calculatePayroll";
import { calculatePeriodHolidayPay } from "@/lib/holiday";
import { getDefaultHolidayPayMode } from "@/lib/labor/rules";
import type { Holiday, HolidayPayMode } from "@/lib/holiday";
import { getPayPeriodDays, getPeriodsPerYear } from "@/lib/payPeriod";
import type { PayPeriod, PayFrequency, SemiMonthlyType } from "@/lib/payPeriod";
import { calculateHourlyBasePay, getHourlyWageOn } from "@/lib/salary/wage";
import type { HourlyWageEntry } from "@/lib/salary/wage";

export type ExpectedSalarySettings = {
    country: PayrollCountry;
    regionCode?: string;

    payType: "hourly" | "salary" | "commission" | "other";

    payFrequency: PayFrequency;

    // semi-monthly일 때의 규칙 (연간 지급 횟수 계산에 사용)
    semiMonthlyType?: SemiMonthlyType;

    hourlyWage?: number;
    // 시급 변경 이력. 있으면 근무일마다 그날의 시급으로 계산하고, 없으면 hourlyWage 하나로 계산
    hourlyWageHistory?: HourlyWageEntry[];
    monthlySalary?: number;

    // CA: 매 급여에 얹어 받는 베케이션 페이 비율 (0.04 = 4%). 없거나 0이면 없음.
    vacationPayRate?: number;

    // 시급제: 공휴일 수당 지급 방식. 없으면 CA는 "full"(공휴일 수당 + 일했을 때 프리미엄), KR은 "none"
    holidayPayMode?: HolidayPayMode;

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

    // 공휴일에 일한 시간의 추가분 / 공휴일 자체 수당 / 매 급여 베케이션 페이
    premiumPay: number;
    publicHolidayPay: number;
    vacationPay: number;

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

    // 계산에서 제외했거나 추정한 항목 안내 (예: 미지원 주)
    warnings: string[];
};

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

const toSafeNumber = (value: unknown) => {
    const n = Number(value);
    return Number.isFinite(n) ? n : 0;
};

const toMinutes = (time: string) => {
    const [hour, minute] = time.split(":").map(Number);
    return hour * 60 + minute;
};

const calculateHours = (startTime: string, endTime: string, breakMinutes: number = 0) => {
    if (!startTime || !endTime) {
        return 0;
    }

    const start = toMinutes(startTime);
    let end = toMinutes(endTime);

    if (!Number.isFinite(start) || !Number.isFinite(end)) {
        return 0;
    }

    // 자정을 넘기는 근무
    if (end < start) {
        end += 24 * 60;
    }

    const totalMinutes = Math.max(0, end - start - toSafeNumber(breakMinutes));

    return totalMinutes / 60;
};

const calculateBasePay = (
    settings: ExpectedSalarySettings,
    workDays: { date: string; hours: number }[],
    payPeriod: PayPeriod,
) => {
    switch (settings.payType) {
        case "hourly":
            return calculateHourlyBasePay(workDays, settings.hourlyWageHistory, toSafeNumber(settings.hourlyWage));

        case "salary": {
            // monthlySalary를 이번 급여 주기 몫으로 환산 (biweekly면 월급*12/26)
            // custom 주기는 실제 급여 기간 일수로 연간 횟수를 계산
            const perYear = getPeriodsPerYear(
                settings.payFrequency,
                settings.payFrequency === "custom" ? getPayPeriodDays(payPeriod) : undefined,
                settings.semiMonthlyType,
            );
            return (toSafeNumber(settings.monthlySalary) * 12) / perYear;
        }

        default:
            return 0;
    }
};

export const calculateExpectedSalary = ({
    settings,
    schedules,
    cashTips = 0,
    paychequeTips = 0,
    payPeriod,
    holidays = [],
}: {
    settings: ExpectedSalarySettings;
    schedules: ExpectedSalarySchedule[];
    cashTips?: number;
    paychequeTips?: number;
    payPeriod: PayPeriod;
    // 공휴일 목록 (CA 시급제일 때 공휴일 수당 계산에 사용)
    holidays?: Holiday[];
}): ExpectedSalaryResult => {
    const warnings: string[] = [];
    const isCanada = settings.country === "CA";

    // 팁: 설정에서 허용한 종류만 반영
    const hasPaychequeTips = settings.hasTips && (settings.tipType === "paycheque" || settings.tipType === "both");
    const hasCashTips = settings.hasTips && (settings.tipType === "cash" || settings.tipType === "both");

    const actualPaychequeTips = hasPaychequeTips ? Math.max(0, toSafeNumber(paychequeTips)) : 0;
    const actualCashTips = hasCashTips ? Math.max(0, toSafeNumber(cashTips)) : 0;

    // 근무시간 (일정별로 계산해 두고 합계와 날짜별 시간에 모두 사용)
    const scheduleHours = schedules.map((schedule) =>
        calculateHours(schedule.startTime, schedule.endTime, schedule.hasBreak ? schedule.breakMinutes : 0),
    );

    const periodHours = scheduleHours.reduce((total, hours) => total + hours, 0);

    // 기본급
    const workDays = schedules.map((schedule, index) => ({
        date: schedule.date.slice(0, 10),
        hours: scheduleHours[index],
    }));

    const basePay = round2(calculateBasePay(settings, workDays, payPeriod));

    // 베케이션 페이 비율 (CA만)
    const vacationPayRate = isCanada ? Math.max(0, toSafeNumber(settings.vacationPayRate)) : 0;

    // 공휴일 수당 (시급제만. 월급제는 공휴일에도 월급이 그대로 나오므로 따로 더하지 않음)
    let premiumPay = 0;
    let publicHolidayPay = 0;

    if (settings.payType === "hourly" && holidays.length > 0) {
        const holidayDates = new Set(holidays.map((holiday) => holiday.date));
        const hoursByDate: Record<string, number> = {};
        let regularDayHours = 0;
        let regularDayCount = 0;

        schedules.forEach((schedule, index) => {
            const hours = scheduleHours[index];

            // 화면이 날짜를 '2026-09-07T00:00:00.000Z' 같은 긴 형식으로 줄 수 있어 앞 10자리(YYYY-MM-DD)만 사용
            const dateKey = schedule.date.slice(0, 10);

            hoursByDate[dateKey] = (hoursByDate[dateKey] ?? 0) + hours;

            if (hours > 0 && !holidayDates.has(dateKey)) {
                regularDayHours += hours;
                regularDayCount += 1;
            }
        });

        // [CA] 직전 4주 급여 기록이 없으므로, 이번 급여 기간의 하루 평균 임금 × 28일로 추정
        const periodDays = getPayPeriodDays(payPeriod);
        const estimatedRegularWagesBeforeHoliday = periodDays > 0 ? (basePay / periodDays) * 28 : 0;

        // [KR] 하루 소정근로시간 추정: 공휴일이 아닌 근무일의 평균 (최대 8시간, 근무 기록이 없으면 8시간)
        const scheduledHoursPerDay = regularDayCount > 0 ? Math.min(8, regularDayHours / regularDayCount) : 8;

        const holidayPay = calculatePeriodHolidayPay({
            country: settings.country,
            province: settings.regionCode ?? "",
            hourlyWage: toSafeNumber(settings.hourlyWage),
            hourlyWageOn: (date) => getHourlyWageOn(date, settings.hourlyWageHistory, toSafeNumber(settings.hourlyWage)),
            startDate: payPeriod.startDate,
            endDate: payPeriod.endDate,
            hoursByDate,
            holidays,
            regularWagesBeforeHoliday: estimatedRegularWagesBeforeHoliday,
            vacationPayRate,
            scheduledHoursPerDay,
            mode: settings.holidayPayMode ?? getDefaultHolidayPayMode(settings.country),
        });

        premiumPay = holidayPay.premiumPay;
        publicHolidayPay = holidayPay.publicHolidayPay;

        if (publicHolidayPay > 0) {
            warnings.push(
                isCanada
                    ? "공휴일 수당은 직전 4주 급여를 이번 급여 기간 기준으로 추정해서 계산했어요."
                    : "유급휴일 수당은 공휴일이 원래 근무하는 날일 때만 해당돼요. 하루 근무시간은 이번 기간 평균(최대 8시간)으로 추정했어요.",
            );
        }

        warnings.push(...holidayPay.warnings);
    }

    // 베케이션 페이: 임금(기본급 + 공휴일 수당)에 비율 적용. 팁은 임금이 아니므로 제외.
    const wages = basePay + premiumPay + publicHolidayPay;
    const vacationPay = round2(wages * vacationPayRate);

    // 세전 금액 (페이첵에 찍히는 금액)
    const grossPay = round2(wages + vacationPay + actualPaychequeTips);

    // 국가별 세금/공제
    const payroll = calculatePayroll({
        country: settings.country,
        regionCode: settings.regionCode,
        grossPay,
        payFrequency: settings.payFrequency,
        semiMonthlyType: settings.semiMonthlyType,
        payPeriod,
    });

    warnings.push(...(payroll.warnings ?? []));

    const totalDeductions = round2(payroll.totalDeductions);
    const estimatedNetPay = round2(grossPay - totalDeductions);

    return {
        hours: periodHours,
        basePay,
        premiumPay,
        publicHolidayPay,
        vacationPay,
        paychequeTips: actualPaychequeTips,
        cashTips: actualCashTips,
        grossPay,
        deductions: payroll.deductions,
        totalDeductions,
        estimatedNetPay,
        finalEstimatedIncome: round2(estimatedNetPay + actualCashTips),
        warnings,
    };
};
