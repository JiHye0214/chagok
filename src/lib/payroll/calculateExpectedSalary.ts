import { getPeriodsPerYear } from "@/lib/payPeriod";
import { calculateTaxes } from "@/lib/tax";
import { isHoliday } from "@/lib/holiday";

export type ExpectedSalarySettings = {
    country?: string;
    province?: string;
    payType?: "hourly" | "salary" | "commission" | "other";
    payFrequency: "weekly" | "biweekly" | "semi-monthly" | "monthly" | "custom";
    hourlyWage?: number;
    monthlySalary?: number;
    hasTips: boolean;
    tipType?: "cash" | "paycheque" | "both";
    vacationPayRate?: number;
};

export type ExpectedSalarySchedule = {
    date: string;
    startTime: string;
    endTime: string;
    hasBreak: boolean;
    breakMinutes: number;
};

export type ExpectedSalaryHoliday = {
    date: string;
    name: string;
    global: boolean;
};

export type ExpectedSalaryResult = {
    hours: number;
    basePay: number;

    holidayHours: number;
    holidayPay: number;

    vacationPayRate: number;
    vacationPay: number;

    paychequeTips: number;
    cashTips: number;

    taxableGrossPay: number;

    periodsPerYear: number;
    annualGross: number;

    cpp: number;
    cpp2: number;
    ei: number;
    federalTax: number;
    provincialTax: number;
    provinceName: string;
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
    holidays,
    cashTips = 0,
    paychequeTips = 0,
}: {
    settings: ExpectedSalarySettings;
    schedules: ExpectedSalarySchedule[];
    holidays: ExpectedSalaryHoliday[];
    cashTips?: number;
    paychequeTips?: number;
}): ExpectedSalaryResult => {
    const safeCashTips = Math.max(0, Number(cashTips) || 0);

    const safePaychequeTips = Math.max(0, Number(paychequeTips) || 0);

    const periodHours = schedules.reduce(
        (total, schedule) =>
            total + calculateHours(schedule.startTime, schedule.endTime, schedule.hasBreak ? schedule.breakMinutes : 0),
        0,
    );

    const hourlyWage = settings.payType === "hourly" ? Number(settings.hourlyWage ?? 0) : 0;

    const estimatedBasePay =
        settings.payType === "hourly"
            ? periodHours * hourlyWage
            : settings.payType === "salary"
              ? Number(settings.monthlySalary ?? 0)
              : 0;

    const holidaySchedules = schedules.filter((schedule) => isHoliday(schedule.date.slice(0, 10), holidays));

    const holidayHours = holidaySchedules.reduce(
        (total, schedule) =>
            total + calculateHours(schedule.startTime, schedule.endTime, schedule.hasBreak ? schedule.breakMinutes : 0),
        0,
    );

    const holidayPay = settings.payType === "hourly" ? holidayHours * hourlyWage * 0.5 : 0;

    const hasPaychequeTips = settings.hasTips && (settings.tipType === "paycheque" || settings.tipType === "both");

    const hasCashTips = settings.hasTips && (settings.tipType === "cash" || settings.tipType === "both");

    const vacationPayRate = Number(settings.vacationPayRate ?? 4.15);

    const estimatedVacationPay = estimatedBasePay * (vacationPayRate / 100);

    const taxableGrossPay = estimatedBasePay + holidayPay + estimatedVacationPay + (hasPaychequeTips ? safePaychequeTips : 0);

    const periodsPerYear = getPeriodsPerYear(settings.payFrequency);

    const annualGross = taxableGrossPay * periodsPerYear;

    const taxes = calculateTaxes({
        country: settings.country ?? "CA",
        province: settings.province ?? "",
        annualGross,
    });

    const cpp = taxes.cpp / periodsPerYear;

    const cpp2 = taxes.cpp2 / periodsPerYear;

    const ei = taxes.ei / periodsPerYear;

    const federalTax = taxes.federalTax / periodsPerYear;

    const provincialTax = taxes.provincialTax / periodsPerYear;

    const totalDeductions = taxes.totalDeductions / periodsPerYear;

    const estimatedNetPay = taxableGrossPay - totalDeductions;

    const actualCashTips = hasCashTips ? safeCashTips : 0;

    const finalEstimatedIncome = estimatedNetPay + actualCashTips;

    return {
        hours: periodHours,

        basePay: estimatedBasePay,

        holidayHours,
        holidayPay,

        vacationPayRate,
        vacationPay: estimatedVacationPay,

        paychequeTips: hasPaychequeTips ? safePaychequeTips : 0,

        cashTips: actualCashTips,

        taxableGrossPay,

        periodsPerYear,
        annualGross,

        cpp,
        cpp2,
        ei,
        federalTax,
        provincialTax,

        provinceName: taxes.provinceName,

        totalDeductions,

        estimatedNetPay,

        finalEstimatedIncome,
    };
};
