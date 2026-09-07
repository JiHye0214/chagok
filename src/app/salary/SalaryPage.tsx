"use client";

import { useEffect, useState } from "react";
import { getPayPeriodEndDate, getPeriodsPerYear, formatDate } from "@/lib/payPeriod";
import { calculateTaxes } from "@/lib/tax";
import { isHoliday } from "@/lib/holiday";

import Link from "next/link";

type PayType = "hourly" | "salary" | "commission" | "other";

type PayFrequency = "weekly" | "biweekly" | "semi-monthly" | "monthly" | "custom";

type SemiMonthlyType = "first-fifteenth" | "fifteenth-end";

type Province = "ON" | "BC" | "AB" | "SK" | "MB" | "QC" | "NS" | "NB" | "NL" | "PE" | "YT" | "NT" | "NU";

type TipType = "cash" | "paycheque" | "both";

type SalarySettings = {
    province: Province;
    payType: PayType;
    payFrequency: PayFrequency;
    hasTips: boolean;
    tipType?: TipType;
    hourlyWage?: number;
    monthlySalary?: number;
    payPeriodStartDate?: string;
    payDate?: string;
    semiMonthlyType?: SemiMonthlyType;
    customPayDays?: number;
    vacationPayRate?: number;
};

type WorkSchedule = {
    id: number;
    date: string;
    startTime: string;
    endTime: string;
    hasBreak: boolean;
    breakMinutes: number;
};

type PayPeriod = {
    startDate: string;
    endDate: string;
    payDate: string;
};

type PayPeriodTips = {
    payPeriodStart: string;
    payPeriodEnd: string;
    cashTips: number;
    paychequeTips: number;
};

type PayHistory = {
    startDate: string;
    endDate: string;
    hours?: number;
    basePay?: number;
    paychequeTips?: number;
    cashTips?: number;
    grossPay?: number;
    deductions?: number;
    cpp?: number;
    cpp2?: number;
    ei?: number;
    federalTax?: number;
    provincialTax?: number;
    netPay: number;
    totalIncome?: number;
    province?: string;
    tipType?: TipType | null;
    hasTips?: boolean;
    isConfirmed: boolean;
    vacationPay?: number;
    actualNetPay?: number | null;
};

type Holiday = {
    date: string;
    name: string;
    global: boolean;
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

    const totalMinutes = Math.max(0, end - start - breakMinutes);

    return totalMinutes / 60;
};

const formatISO = (date: Date) => {
    const year = date.getFullYear();

    const month = String(date.getMonth() + 1).padStart(2, "0");

    const day = String(date.getDate()).padStart(2, "0");

    return `${year}-${month}-${day}`;
};

const formatMoney = (value: number) => {
    return `$${value.toFixed(2)}`;
};

const formatDisplayDate = (value: string) => {
    return formatDate(new Date(`${value}T00:00:00`));
};

const getDaysDifference = (targetDate: string) => {
    const today = new Date();

    const todayOnly = new Date(today.getFullYear(), today.getMonth(), today.getDate());

    const target = new Date(`${targetDate}T00:00:00`);

    return Math.round((target.getTime() - todayOnly.getTime()) / (1000 * 60 * 60 * 24));
};

const shiftPayPeriod = (
    startDate: string,
    payDate: string,
    frequency: PayFrequency,
    semiMonthlyType?: SemiMonthlyType,
    customPayDays?: number,
): PayPeriod => {
    const currentEndDate = getPayPeriodEndDate(startDate, frequency, semiMonthlyType, customPayDays);

    const nextStart = new Date(`${currentEndDate}T00:00:00`);

    nextStart.setDate(nextStart.getDate() + 1);

    const nextStartDate = formatISO(nextStart);

    const nextPayDate = new Date(`${payDate}T00:00:00`);

    switch (frequency) {
        case "weekly":
            nextPayDate.setDate(nextPayDate.getDate() + 7);
            break;

        case "biweekly":
            nextPayDate.setDate(nextPayDate.getDate() + 14);
            break;

        case "monthly":
            nextPayDate.setMonth(nextPayDate.getMonth() + 1);
            break;

        case "semi-monthly":
            if (semiMonthlyType === "first-fifteenth") {
                if (nextPayDate.getDate() === 1) {
                    nextPayDate.setDate(16);
                } else {
                    nextPayDate.setMonth(nextPayDate.getMonth() + 1);
                    nextPayDate.setDate(1);
                }
            } else {
                if (nextPayDate.getDate() === 16) {
                    nextPayDate.setMonth(nextPayDate.getMonth() + 1);
                    nextPayDate.setDate(1);
                } else {
                    nextPayDate.setDate(16);
                }
            }
            break;

        case "custom":
            nextPayDate.setDate(nextPayDate.getDate() + (Number(customPayDays) || 14));
            break;
    }

    return {
        startDate: nextStartDate,
        endDate: getPayPeriodEndDate(nextStartDate, frequency, semiMonthlyType, customPayDays),
        payDate: formatISO(nextPayDate),
    };
};

export default function SalaryPage() {
    const [schedules, setSchedules] = useState<WorkSchedule[]>([]);

    const [isSchedulesLoading, setIsSchedulesLoading] = useState(true);

    const [holidays, setHolidays] = useState<Holiday[]>([]);

    const [cashTips, setCashTips] = useState("");

    const [paychequeTips, setPaychequeTips] = useState("");

    const [savedTips, setSavedTips] = useState<PayPeriodTips | null>(null);

    const [salarySettings, setSalarySettings] = useState<SalarySettings | null>(null);

    const [previousPay, setPreviousPay] = useState<number | null>(null);

    const [latestPayHistory, setLatestPayHistory] = useState<PayHistory | null>(null);

    const [payHistory, setPayHistory] = useState<PayHistory[]>([]);

    const [isPreviousExpectedOpen, setIsPreviousExpectedOpen] = useState(false);

    const [selectedPayHistory, setSelectedPayHistory] = useState<PayHistory | null>(null);

    const hourlyWage = salarySettings?.payType === "hourly" ? Number(salarySettings.hourlyWage ?? 0) : 0;

    /*
     * --------------------------------------------------
     * Load Schedules
     * --------------------------------------------------
     */

    useEffect(() => {
        const loadSchedules = async () => {
            try {
                const response = await fetch("/api/work-schedules");

                if (!response.ok) {
                    throw new Error("근무 기록 조회 실패");
                }

                const data: WorkSchedule[] = await response.json();

                setSchedules(data);
            } catch (error) {
                console.error(error);
            } finally {
                setIsSchedulesLoading(false);
            }
        };

        loadSchedules();
    }, []);

    /*
     * --------------------------------------------------
     * Load Salary Settings
     * --------------------------------------------------
     */

    useEffect(() => {
        const loadSalarySettings = async () => {
            try {
                const response = await fetch("/api/salary-settings");

                if (!response.ok) {
                    throw new Error("급여 설정 조회 실패");
                }

                const data: SalarySettings | null = await response.json();

                setSalarySettings(data);
            } catch (error) {
                console.error(error);
            }
        };

        loadSalarySettings();
    }, []);

    /*
     * --------------------------------------------------
     * Load Holidays
     * --------------------------------------------------
     */

    useEffect(() => {
        if (!salarySettings?.province) {
            return;
        }

        const loadHolidays = async () => {
            try {
                const years = Array.from(new Set(schedules.map((schedule) => Number(schedule.date.slice(0, 4)))));

                const currentYear = new Date().getFullYear();

                if (!years.includes(currentYear)) {
                    years.push(currentYear);
                }

                const results: Holiday[] = [];

                for (const year of years) {
                    const response = await fetch(`/api/holidays?year=${year}&province=${salarySettings.province}`);

                    if (!response.ok) {
                        continue;
                    }

                    const data: Holiday[] = await response.json();

                    results.push(...data);
                }

                setHolidays(results);
            } catch (error) {
                console.error("공휴일 조회 실패:", error);

                setHolidays([]);
            }
        };

        loadHolidays();
    }, [salarySettings?.province, schedules]);

    /*
     * --------------------------------------------------
     * Current Pay Period
     * --------------------------------------------------
     */

    /*
     * --------------------------------------------------
     * Pay Period Calculation
     * --------------------------------------------------
     */

    const getPayPeriods = (): {
        previous: PayPeriod | null;
        current: PayPeriod | null;
        next: PayPeriod | null;
    } => {
        if (!salarySettings?.payPeriodStartDate || !salarySettings?.payDate) {
            return {
                previous: null,
                current: null,
                next: null,
            };
        }

        const today = new Date();
        const todayOnly = new Date(today.getFullYear(), today.getMonth(), today.getDate());

        const frequency = salarySettings.payFrequency;
        const semiMonthlyType = salarySettings.semiMonthlyType;
        const customPayDays = salarySettings.customPayDays;

        const createPeriod = (startDate: string, payDate: string): PayPeriod => {
            return {
                startDate,
                endDate: getPayPeriodEndDate(startDate, frequency, semiMonthlyType, customPayDays),
                payDate,
            };
        };

        /*
         * 월 이동을 안전하게 처리
         */
        const shiftMonth = (date: Date, amount: number) => {
            const day = date.getDate();

            const result = new Date(date);

            result.setDate(1);
            result.setMonth(result.getMonth() + amount);

            const lastDay = new Date(result.getFullYear(), result.getMonth() + 1, 0).getDate();

            result.setDate(Math.min(day, lastDay));

            return result;
        };

        /*
         * 급여 기간 시작일을 한 기간 이동
         */
        const shiftStartDate = (startDate: string, direction: 1 | -1): string => {
            const date = new Date(`${startDate}T00:00:00`);

            switch (frequency) {
                case "weekly":
                    date.setDate(date.getDate() + 7 * direction);
                    break;

                case "biweekly":
                    date.setDate(date.getDate() + 14 * direction);
                    break;

                case "monthly": {
                    const shifted = shiftMonth(date, direction);
                    return formatISO(shifted);
                }

                case "semi-monthly":
                    if (date.getDate() === 1) {
                        if (direction === 1) {
                            date.setDate(16);
                        } else {
                            date.setMonth(date.getMonth() - 1);
                            date.setDate(16);
                        }
                    } else {
                        if (direction === 1) {
                            date.setMonth(date.getMonth() + 1);
                            date.setDate(1);
                        } else {
                            date.setDate(1);
                        }
                    }
                    break;

                case "custom":
                    date.setDate(date.getDate() + (Number(customPayDays) || 14) * direction);
                    break;
            }

            return formatISO(date);
        };

        /*
         * 급여일을 한 기간 이동
         */
        const shiftPayDate = (payDate: string, direction: 1 | -1): string => {
            const date = new Date(`${payDate}T00:00:00`);

            switch (frequency) {
                case "weekly":
                    date.setDate(date.getDate() + 7 * direction);
                    break;

                case "biweekly":
                    date.setDate(date.getDate() + 14 * direction);
                    break;

                case "monthly": {
                    const shifted = shiftMonth(date, direction);
                    return formatISO(shifted);
                }

                case "semi-monthly":
                    if (semiMonthlyType === "first-fifteenth") {
                        /*
                         * 1일 ↔ 16일
                         */
                        if (date.getDate() === 1) {
                            if (direction === 1) {
                                date.setDate(16);
                            } else {
                                date.setMonth(date.getMonth() - 1);
                                date.setDate(16);
                            }
                        } else {
                            if (direction === 1) {
                                date.setMonth(date.getMonth() + 1);
                                date.setDate(1);
                            } else {
                                date.setDate(1);
                            }
                        }
                    } else {
                        /*
                         * fifteenth-end의 지급일도
                         * 설정값에 따라 1일 / 16일을 기준으로 이동
                         */
                        if (date.getDate() === 1) {
                            if (direction === 1) {
                                date.setDate(16);
                            } else {
                                date.setMonth(date.getMonth() - 1);
                                date.setDate(16);
                            }
                        } else {
                            if (direction === 1) {
                                date.setMonth(date.getMonth() + 1);
                                date.setDate(1);
                            } else {
                                date.setDate(1);
                            }
                        }
                    }
                    break;

                case "custom":
                    date.setDate(date.getDate() + (Number(customPayDays) || 14) * direction);
                    break;
            }

            return formatISO(date);
        };

        /*
         * 설정된 최초 기간
         */
        const anchorStartDate = salarySettings.payPeriodStartDate;
        const anchorPayDate = salarySettings.payDate;

        /*
         * 현재 날짜가 최초 기간보다 뒤라면
         * 현재 날짜가 포함되는 기간까지 앞으로 이동
         */
        let current = createPeriod(anchorStartDate, anchorPayDate);

        let safety = 0;

        while (new Date(`${current.endDate}T00:00:00`) < todayOnly && safety < 500) {
            const nextStartDate = shiftStartDate(current.startDate, 1);

            const nextPayDate = shiftPayDate(current.payDate, 1);

            current = createPeriod(nextStartDate, nextPayDate);

            safety++;
        }

        /*
         * 만약 설정된 시작일이 미래라면
         * 반대로 현재 날짜가 포함되는 기간까지 뒤로 이동
         */
        safety = 0;

        while (new Date(`${current.startDate}T00:00:00`) > todayOnly && safety < 500) {
            const previousStartDate = shiftStartDate(current.startDate, -1);

            const previousPayDate = shiftPayDate(current.payDate, -1);

            current = createPeriod(previousStartDate, previousPayDate);

            safety++;
        }

        /*
         * 현재 기간
         *
         * endDate가 오늘보다 같거나 미래인 기간
         */
        const currentPayPeriod = current;

        /*
         * 이전 기간
         */
        const previousStartDate = shiftStartDate(currentPayPeriod.startDate, -1);

        const previousPayDate = shiftPayDate(currentPayPeriod.payDate, -1);

        const previousPayPeriod = createPeriod(previousStartDate, previousPayDate);

        /*
         * 다음 기간
         */
        const nextStartDate = shiftStartDate(currentPayPeriod.startDate, 1);

        const nextPayDate = shiftPayDate(currentPayPeriod.payDate, 1);

        const nextPayPeriod = createPeriod(nextStartDate, nextPayDate);

        return {
            previous: previousPayPeriod,
            current: currentPayPeriod,
            next: nextPayPeriod,
        };
    };

    const { previous: previousPayPeriod, current: currentPayPeriod, next: nextPayPeriod } = getPayPeriods();

    /*
     * --------------------------------------------------
     * Load Current Period Tips
     * --------------------------------------------------
     */

    useEffect(() => {
        if (!currentPayPeriod) {
            return;
        }

        const loadTips = async () => {
            try {
                const response = await fetch(
                    `/api/pay-period-tips?startDate=${encodeURIComponent(
                        currentPayPeriod.startDate,
                    )}&endDate=${encodeURIComponent(currentPayPeriod.endDate)}`,
                );

                if (!response.ok) {
                    throw new Error("팁 조회 실패");
                }

                const data: PayPeriodTips | null = await response.json();

                setSavedTips(data);

                setCashTips(data && data.cashTips > 0 ? String(data.cashTips) : "");

                setPaychequeTips(data && data.paychequeTips > 0 ? String(data.paychequeTips) : "");
            } catch (error) {
                console.error(error);

                setSavedTips(null);
                setCashTips("");
                setPaychequeTips("");
            }
        };

        loadTips();
    }, [currentPayPeriod?.startDate, currentPayPeriod?.endDate]);

    /*
     * --------------------------------------------------
     * Load Pay History
     * --------------------------------------------------
     */

    useEffect(() => {
        const loadPayHistory = async () => {
            try {
                const response = await fetch("/api/pay-history");

                if (!response.ok) {
                    throw new Error("급여 기록 조회 실패");
                }

                const data: PayHistory[] = await response.json();

                setPayHistory(data);

                if (data.length > 0) {
                    setLatestPayHistory(data[0]);

                    setPreviousPay(data[0].actualNetPay ?? data[0].netPay);
                }
            } catch (error) {
                console.error("급여 기록 조회 실패:", error);
            }
        };

        loadPayHistory();
    }, []);

    /*
     * --------------------------------------------------
     * Current Period Salary
     * --------------------------------------------------
     */

    const periodSchedules = currentPayPeriod
        ? schedules.filter((schedule) => {
              const scheduleDate = schedule.date.slice(0, 10);

              return scheduleDate >= currentPayPeriod.startDate && scheduleDate <= currentPayPeriod.endDate;
          })
        : [];

    const periodHours = periodSchedules.reduce(
        (total, schedule) =>
            total + calculateHours(schedule.startTime, schedule.endTime, schedule.hasBreak ? schedule.breakMinutes : 0),
        0,
    );

    /*
     * --------------------------------------------------
     * Next Period Salary
     * --------------------------------------------------
     */

    const nextPeriodSchedules = nextPayPeriod
        ? schedules.filter((schedule) => {
              const scheduleDate = schedule.date.slice(0, 10);

              return scheduleDate >= nextPayPeriod.startDate && scheduleDate <= nextPayPeriod.endDate;
          })
        : [];

    const nextPeriodHours = nextPeriodSchedules.reduce(
        (total, schedule) =>
            total + calculateHours(schedule.startTime, schedule.endTime, schedule.hasBreak ? schedule.breakMinutes : 0),
        0,
    );

    const nextBasePay =
        salarySettings?.payType === "hourly"
            ? nextPeriodHours * hourlyWage
            : salarySettings?.payType === "salary"
              ? Number(salarySettings.monthlySalary ?? 0)
              : 0;

    /*
     * --------------------------------------------------
     * Current Tips
     * --------------------------------------------------
     */

    const periodPaychequeTips = savedTips?.paychequeTips ?? 0;

    const periodCashTips = savedTips?.cashTips ?? 0;

    const estimatedBasePay =
        salarySettings?.payType === "hourly"
            ? periodHours * hourlyWage
            : salarySettings?.payType === "salary"
              ? Number(salarySettings.monthlySalary ?? 0)
              : 0;

    /*
     * --------------------------------------------------
     * Holiday Pay
     * --------------------------------------------------
     */

    const holidaySchedules = periodSchedules.filter((schedule) => isHoliday(schedule.date.slice(0, 10), holidays));

    const holidayHours = holidaySchedules.reduce(
        (total, schedule) =>
            total + calculateHours(schedule.startTime, schedule.endTime, schedule.hasBreak ? schedule.breakMinutes : 0),
        0,
    );

    const holidayPay = salarySettings?.payType === "hourly" ? holidayHours * hourlyWage * 0.5 : 0;

    /*
     * --------------------------------------------------
     * Tips
     * --------------------------------------------------
     */

    const hasPaychequeTips =
        salarySettings?.hasTips && (salarySettings.tipType === "paycheque" || salarySettings.tipType === "both");

    const hasCashTips = salarySettings?.hasTips && (salarySettings.tipType === "cash" || salarySettings.tipType === "both");

    /*
     * --------------------------------------------------
     * Vacation Pay
     * --------------------------------------------------
     */

    const vacationPayRate = Number(salarySettings?.vacationPayRate ?? 4.15);

    const estimatedVacationPay = estimatedBasePay * (vacationPayRate / 100);

    /*
     * --------------------------------------------------
     * Taxable Gross
     * --------------------------------------------------
     */

    const taxableGrossPay = estimatedBasePay + holidayPay + estimatedVacationPay + (hasPaychequeTips ? periodPaychequeTips : 0);

    /*
     * --------------------------------------------------
     * Taxes
     * --------------------------------------------------
     */

    const periodsPerYear = getPeriodsPerYear(salarySettings?.payFrequency ?? "biweekly");

    const annualGross = taxableGrossPay * periodsPerYear;

    const taxes = calculateTaxes({
        country: "CA",
        province: salarySettings?.province ?? "",
        annualGross,
    });

    const payrollDeductions = {
        cpp: taxes.cpp / periodsPerYear,

        cpp2: taxes.cpp2 / periodsPerYear,

        ei: taxes.ei / periodsPerYear,

        federalTax: taxes.federalTax / periodsPerYear,

        provincialTax: taxes.provincialTax / periodsPerYear,

        provinceName: taxes.provinceName,

        totalDeductions: taxes.totalDeductions / periodsPerYear,

        netPay: taxableGrossPay - taxes.totalDeductions / periodsPerYear,
    };

    const estimatedNetPay = payrollDeductions.netPay;

    /*
     * --------------------------------------------------
     * Previous Period Salary
     * --------------------------------------------------
     */

    const previousPeriodSchedules = previousPayPeriod
        ? schedules.filter((schedule) => {
              const scheduleDate = schedule.date.slice(0, 10);

              return scheduleDate >= previousPayPeriod.startDate && scheduleDate <= previousPayPeriod.endDate;
          })
        : [];

    const previousPeriodHours = previousPeriodSchedules.reduce(
        (total, schedule) =>
            total + calculateHours(schedule.startTime, schedule.endTime, schedule.hasBreak ? schedule.breakMinutes : 0),
        0,
    );

    const previousBasePay =
        salarySettings?.payType === "hourly"
            ? previousPeriodHours * hourlyWage
            : salarySettings?.payType === "salary"
              ? Number(salarySettings.monthlySalary ?? 0)
              : 0;

    const previousHolidaySchedules = previousPeriodSchedules.filter((schedule) =>
        isHoliday(schedule.date.slice(0, 10), holidays),
    );

    const previousHolidayHours = previousHolidaySchedules.reduce(
        (total, schedule) =>
            total + calculateHours(schedule.startTime, schedule.endTime, schedule.hasBreak ? schedule.breakMinutes : 0),
        0,
    );

    const previousHolidayPay = salarySettings?.payType === "hourly" ? previousHolidayHours * hourlyWage * 0.5 : 0;

    const previousEstimatedVacationPay = previousBasePay * (vacationPayRate / 100);

    const previousEstimatedGross = previousBasePay + previousHolidayPay + previousEstimatedVacationPay;

    const previousAnnualGross = previousEstimatedGross * periodsPerYear;

    const previousTaxes = calculateTaxes({
        country: "CA",
        province: salarySettings?.province ?? "",
        annualGross: previousAnnualGross,
    });

    const previousEstimatedNetPay = previousEstimatedGross - previousTaxes.totalDeductions / periodsPerYear;

    console.log(previousEstimatedGross);
    console.log(previousTaxes.totalDeductions / periodsPerYear);
    console.log(taxableGrossPay);
    console.log(previousEstimatedGross);

    /*
     * --------------------------------------------------
     * Previous Pay History
     * --------------------------------------------------
     */

    const previousPayHistory = previousPayPeriod
        ? payHistory.find(
              (history) => history.startDate === previousPayPeriod.startDate && history.endDate === previousPayPeriod.endDate,
          )
        : null;

    console.log("+++++++++++++");
    console.log(previousPayHistory?.grossPay);
    console.log(previousPayHistory?.deductions);
    console.log(previousEstimatedNetPay);

    const gross = Number(previousPayHistory?.grossPay) || 0;
    const deductions = Number(previousPayHistory?.deductions) || 0;

    console.log('*****************')
    console.log(gross - deductions); // 제대로된 값 

    /*
     * --------------------------------------------------
     * Previous Pay Status
     * --------------------------------------------------
     */

    const today = new Date();

    const todayOnly = new Date(today.getFullYear(), today.getMonth(), today.getDate());

    const previousPeriodEndDate = previousPayPeriod ? new Date(`${previousPayPeriod.endDate}T00:00:00`) : null;

    const previousPeriodPayDate = previousPayPeriod ? new Date(`${previousPayPeriod.payDate}T00:00:00`) : null;

    /*
     * 이전 급여 기간이 이미 끝났는지
     */
    const isPreviousPeriodEnded = previousPeriodEndDate !== null && previousPeriodEndDate < todayOnly;

    /*
     * 이전 급여 기간의 지급일이 지났는지
     */
    const isPreviousPayDatePassed = previousPeriodPayDate !== null && previousPeriodPayDate <= todayOnly;

    /*
     * 상태 1
     *
     * 기간 종료 O
     * 지급일 O
     * DB 기록 X
     *
     * → 급여 기록 카드
     */
    const shouldGoToPayHistory = isPreviousPeriodEnded && isPreviousPayDatePassed && !previousPayHistory;

    /*
     * 상태 3
     *
     * 기간 종료 O
     * 지급일 X
     *
     * → 지급 예정 카드
     *
     * DB 기록 여부와 관계없이 무조건 이 상태
     */
    const shouldShowUpcomingPreviousPay = isPreviousPeriodEnded && !isPreviousPayDatePassed;
    /*
     * --------------------------------------------------
     * Expected Salary
     * --------------------------------------------------
     */

    const nextExpectedPay = nextBasePay;

    const nextDaysUntil = nextPayPeriod ? getDaysDifference(nextPayPeriod.payDate) : null;

    const salaryStatus = {
        daysUntil:
            nextDaysUntil === null
                ? "-"
                : nextDaysUntil === 0
                  ? "오늘"
                  : nextDaysUntil === 1
                    ? "내일"
                    : nextDaysUntil === 2
                      ? "모레"
                      : `${nextDaysUntil}일 뒤`,
        expectedPay: nextExpectedPay,
        payDate: nextPayPeriod?.payDate ?? "",
    };

    /*
     * --------------------------------------------------
     * Previous Pay Comparison
     * --------------------------------------------------
     */

    const payDifference = previousPay !== null ? estimatedNetPay - previousPay : null;

    const payChangePercent = previousPay !== null && previousPay !== 0 ? (payDifference! / previousPay) * 100 : null;

    /*
     * --------------------------------------------------
     * Actual Net Pay Statistics
     * --------------------------------------------------
     */

    const actualPayHistory = payHistory
        .filter((history) => history.actualNetPay != null)
        .sort((a, b) => a.endDate.localeCompare(b.endDate));

    const recentActualPayHistory = actualPayHistory.slice(-6);

    const averageActualNetPay =
        actualPayHistory.length > 0
            ? actualPayHistory.reduce((total, history) => total + Number(history.actualNetPay ?? 0), 0) / actualPayHistory.length
            : null;

    const selectedActualNetPay = selectedPayHistory?.actualNetPay != null ? Number(selectedPayHistory.actualNetPay) : null;

    const selectedPayDifference =
        selectedActualNetPay !== null && averageActualNetPay !== null ? selectedActualNetPay - averageActualNetPay : null;

    const selectedPayChangePercent =
        selectedPayDifference !== null && averageActualNetPay !== null && averageActualNetPay !== 0
            ? (selectedPayDifference / averageActualNetPay) * 100
            : null;

    /*
     * --------------------------------------------------
     * Final Income
     * --------------------------------------------------
     */

    const actualCashTips = hasCashTips ? periodCashTips : 0;

    const finalEstimatedIncome = estimatedNetPay + actualCashTips;

    /*
     * --------------------------------------------------
     * Loading
     * --------------------------------------------------
     */

    if (isSchedulesLoading) {
        return (
            <div className="flex h-[calc(100vh-152px)] items-center justify-center">
                <p className="text-sm text-gray-400">근무 기록을 불러오는 중...</p>
            </div>
        );
    }

    /*
     * --------------------------------------------------
     * Render
     * --------------------------------------------------
     */

    return (
        <div className="mx-auto max-w-md">
            <header>
                <p className="text-sm text-gray-500">차곡</p>

                <div className="mt-2 flex items-center justify-between">
                    <h1 className="text-3xl font-bold">급여</h1>

                    <Link
                        href="/salary/settings"
                        className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-gray-500 shadow-sm"
                        aria-label="급여 설정"
                    >
                        ⚙
                    </Link>
                </div>

                <p className="mt-2 text-sm text-gray-500">예상 급여와 급여 기록을 확인해보세요.</p>
            </header>

            {latestPayHistory && !latestPayHistory.isConfirmed && (
                <Link
                    href="/salary/pay-history"
                    className="mt-5 flex w-full items-center justify-between rounded-3xl bg-gray-900 p-5 text-left text-white shadow-sm transition hover:shadow-md"
                >
                    <div>
                        <p className="text-xs text-gray-400">급여 확인</p>

                        <p className="mt-1 text-sm font-semibold">지난번에 이만큼 받으셨나요?</p>

                        <p className="mt-1 text-lg font-bold">
                            ${(latestPayHistory.totalIncome ?? latestPayHistory.netPay).toFixed(2)}
                        </p>
                    </div>

                    <span className="ml-4 shrink-0 text-xs text-gray-400">확인하기 →</span>
                </Link>
            )}

            {/* Previous Pay Period */}

            {previousPayPeriod && (
                <>
                    {/* 상태 1
            기간 종료 + 지급일 지남 + DB 기록 없음
        */}
                    {shouldGoToPayHistory && (
                        <Link
                            href="/salary/pay-history"
                            className="mt-5 block w-full rounded-3xl bg-gray-900 p-5 text-left shadow-sm transition hover:shadow-md"
                        >
                            <p className="text-xs text-gray-400">급여 기록</p>

                            <p className="mt-1 text-lg font-bold text-white">지급일이 지났어요</p>

                            <p className="mt-1 text-sm text-gray-500">아직 기록되지 않은 급여가 있어요.</p>

                            <p className="mt-4 text-xs text-gray-400">
                                {formatDisplayDate(previousPayPeriod.startDate)}
                                {" ~ "}
                                {formatDisplayDate(previousPayPeriod.endDate)}
                            </p>

                            <p className="mt-3 text-xs font-medium text-gray-500">급여 기록에서 확인하기 →</p>
                        </Link>
                    )}

                    {/* 상태 3
            기간 종료 + 지급일 아직 안 됨
        */}
                    {shouldShowUpcomingPreviousPay && (
                        <button
                            type="button"
                            onClick={() => setIsPreviousExpectedOpen(true)}
                            className="mt-5 block w-full rounded-3xl bg-gray-900 p-5 text-left shadow-sm transition hover:shadow-md"
                        >
                            <p className="text-lg font-bold text-white">
                                {getDaysDifference(previousPayPeriod.payDate) === 0
                                    ? `오늘 ${formatMoney(previousEstimatedNetPay)}`
                                    : getDaysDifference(previousPayPeriod.payDate) === 1
                                      ? `내일 ${formatMoney(previousEstimatedNetPay)}`
                                      : getDaysDifference(previousPayPeriod.payDate) === 2
                                        ? `모레 ${formatMoney(previousEstimatedNetPay)}`
                                        : `${getDaysDifference(previousPayPeriod.payDate)}일 뒤 ${formatMoney(
                                              previousEstimatedNetPay,
                                          )}`}{" "}
                                를 받아요
                            </p>

                            <p className="mt-2 text-xs text-gray-400">
                                {formatDisplayDate(previousPayPeriod.startDate)}
                                {" ~ "}
                                {formatDisplayDate(previousPayPeriod.endDate)}
                            </p>

                            <p className="mt-1 text-right text-xs text-gray-400">클릭해서 상세 보기 →</p>
                        </button>
                    )}
                </>
            )}

            {currentPayPeriod && (
                <section className="mt-5 rounded-3xl bg-white p-5 shadow-sm">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-xs text-gray-400">현재 급여 기간</p>

                            <p className="mt-1 text-sm font-semibold">
                                {formatDate(new Date(currentPayPeriod.startDate))}
                                {" ~ "}
                                {formatDate(new Date(currentPayPeriod.endDate))}
                            </p>
                        </div>

                        <div className="text-right">
                            <p className="text-xs text-gray-400">급여일</p>

                            <p className="mt-1 text-sm font-semibold">{formatDate(new Date(currentPayPeriod.payDate))}</p>
                        </div>
                    </div>
                </section>
            )}

            {currentPayPeriod && salarySettings?.hasTips && (
                <section className="mt-5 rounded-3xl bg-white p-5 shadow-sm">
                    <div>
                        <h2 className="text-lg font-semibold">이번 급여 기간 팁</h2>

                        <p className="mt-1 text-sm text-gray-400">
                            {formatDate(new Date(currentPayPeriod.startDate))}
                            {" ~ "}
                            {formatDate(new Date(currentPayPeriod.endDate))}
                        </p>
                    </div>

                    {salarySettings.tipType === "cash" && (
                        <div className="mt-4">
                            <p className="mb-2 text-sm text-gray-500">현금으로 받은 팁</p>

                            <div className="flex items-center rounded-2xl bg-gray-100 px-4">
                                <span className="text-gray-500">$</span>

                                <input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    value={cashTips}
                                    onChange={(e) => {
                                        const value = e.target.value;

                                        if (value === "") {
                                            setCashTips("");
                                            return;
                                        }

                                        setCashTips(value.replace(/^0+(?=\d)/, ""));
                                    }}
                                    placeholder="0"
                                    className="w-full bg-transparent px-2 py-4 outline-none"
                                />
                            </div>
                        </div>
                    )}

                    {salarySettings.tipType === "paycheque" && (
                        <div className="mt-4">
                            <p className="mb-2 text-sm text-gray-500">급여에 포함되는 팁</p>

                            <div className="flex items-center rounded-2xl bg-gray-100 px-4">
                                <span className="text-gray-500">$</span>

                                <input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    value={paychequeTips}
                                    onChange={(e) => {
                                        const value = e.target.value;

                                        if (value === "") {
                                            setPaychequeTips("");
                                            return;
                                        }

                                        setPaychequeTips(value.replace(/^0+(?=\d)/, ""));
                                    }}
                                    placeholder="0"
                                    className="w-full bg-transparent px-2 py-4 outline-none"
                                />
                            </div>
                        </div>
                    )}

                    {salarySettings.tipType === "both" && (
                        <div className="mt-4 space-y-4">
                            <div>
                                <p className="mb-2 text-sm text-gray-500">급여에 포함되는 팁</p>

                                <div className="flex items-center rounded-2xl bg-gray-100 px-4">
                                    <span className="text-gray-500">$</span>

                                    <input
                                        type="number"
                                        min="0"
                                        step="0.01"
                                        value={paychequeTips}
                                        onChange={(e) => {
                                            const value = e.target.value;

                                            if (value === "") {
                                                setPaychequeTips("");
                                                return;
                                            }

                                            setPaychequeTips(value.replace(/^0+(?=\d)/, ""));
                                        }}
                                        placeholder="0"
                                        className="w-full bg-transparent px-2 py-4 outline-none"
                                    />
                                </div>
                            </div>

                            <div>
                                <p className="mb-2 text-sm text-gray-500">현금으로 받은 팁</p>

                                <div className="flex items-center rounded-2xl bg-gray-100 px-4">
                                    <span className="text-gray-500">$</span>

                                    <input
                                        type="number"
                                        min="0"
                                        step="0.01"
                                        value={cashTips}
                                        onChange={(e) => {
                                            const value = e.target.value;

                                            if (value === "") {
                                                setCashTips("");
                                                return;
                                            }

                                            setCashTips(value.replace(/^0+(?=\d)/, ""));
                                        }}
                                        placeholder="0"
                                        className="w-full bg-transparent px-2 py-4 outline-none"
                                    />
                                </div>
                            </div>
                        </div>
                    )}

                    <button
                        type="button"
                        onClick={async () => {
                            if (!currentPayPeriod) {
                                return;
                            }

                            const newTips: PayPeriodTips = {
                                payPeriodStart: currentPayPeriod.startDate,
                                payPeriodEnd: currentPayPeriod.endDate,
                                cashTips: Math.max(0, Number(cashTips) || 0),
                                paychequeTips: Math.max(0, Number(paychequeTips) || 0),
                            };

                            try {
                                const response = await fetch("/api/pay-period-tips", {
                                    method: "PUT",
                                    headers: {
                                        "Content-Type": "application/json",
                                    },
                                    body: JSON.stringify(newTips),
                                });

                                if (!response.ok) {
                                    throw new Error("팁 저장 실패");
                                }

                                const saved: PayPeriodTips = await response.json();

                                setSavedTips(saved);

                                setCashTips(saved.cashTips > 0 ? String(saved.cashTips) : "");

                                setPaychequeTips(saved.paychequeTips > 0 ? String(saved.paychequeTips) : "");

                                alert("팁이 저장됐어요!");
                            } catch (error) {
                                console.error(error);

                                alert("팁 저장에 실패했어요.");
                            }
                        }}
                        className="mt-4 w-full rounded-2xl bg-gray-900 py-4 text-sm font-semibold text-white"
                    >
                        팁 저장
                    </button>
                </section>
            )}

            {/* Expected Salary */}
            <section className="mt-6 rounded-3xl bg-black p-6 text-white shadow-sm">
                <p className="text-sm text-gray-400">예상 급여</p>

                <div className="mt-2 flex items-start gap-2">
                    <p className="text-4xl font-bold">${estimatedNetPay.toFixed(2)}</p>

                    {payDifference !== null && payChangePercent !== null && (
                        <div className={`mb-1 text-xs font-medium ${payDifference >= 0 ? "text-red-400" : "text-blue-400"}`}>
                            {payDifference >= 0 ? "↑" : "↓"} {Math.abs(payChangePercent).toFixed(1)}%
                            <span className="ml-1">
                                {payDifference >= 0 ? "+" : "-"}${Math.abs(payDifference).toFixed(2)}
                            </span>
                        </div>
                    )}
                </div>

                <div className="mt-6 space-y-3 text-sm">
                    <div className="flex justify-between">
                        <span className="text-gray-400">근무시간</span>

                        <span>
                            {periodHours.toFixed(1)}
                            시간
                        </span>
                    </div>

                    <div className="flex justify-between">
                        <span className="text-gray-400">기본 급여</span>

                        <span>${estimatedBasePay.toFixed(2)}</span>
                    </div>

                    {salarySettings?.hasTips && (salarySettings.tipType === "paycheque" || salarySettings.tipType === "both") && (
                        <div className="flex justify-between">
                            <span className="text-gray-400">급여 포함 팁</span>

                            <span>${periodPaychequeTips.toFixed(2)}</span>
                        </div>
                    )}

                    {holidaySchedules.length > 0 && (
                        <div className="flex justify-between">
                            <span className="text-gray-400">Holiday Pay</span>

                            <span>${holidayPay.toFixed(2)}</span>
                        </div>
                    )}

                    <div className="flex justify-between">
                        <span className="text-gray-400">
                            Vacation Pay ({vacationPayRate}
                            %)
                        </span>

                        <span>${estimatedVacationPay.toFixed(2)}</span>
                    </div>

                    <div className="mt-4 border-t border-gray-800 pt-4">
                        <div className="flex justify-between">
                            <span className="text-gray-300">세전 급여</span>

                            <span className="font-semibold">${taxableGrossPay.toFixed(2)}</span>
                        </div>
                    </div>

                    <div className="flex justify-between">
                        <span className="text-gray-400">예상 공제</span>

                        <span>- ${payrollDeductions.totalDeductions.toFixed(2)}</span>
                    </div>

                    <div className="flex justify-between">
                        <span className="text-gray-300">실수령 급여</span>

                        <span className="font-semibold">${estimatedNetPay.toFixed(2)}</span>
                    </div>

                    {hasCashTips && (
                        <div className="mt-4 border-t border-gray-800 pt-4">
                            <div className="flex justify-between">
                                <span className="text-gray-400">현금 팁</span>

                                <span>${periodCashTips.toFixed(2)}</span>
                            </div>
                        </div>
                    )}

                    <div className="my-6 flex items-center justify-between rounded-2xl bg-white p-3 text-black">
                        <span className="text-sm font-medium">{hasCashTips ? "예상 총 수령액" : "예상 실수령액"}</span>

                        <span className="text-xl font-bold">
                            ${(hasCashTips ? finalEstimatedIncome : estimatedNetPay).toFixed(2)}
                        </span>
                    </div>
                </div>

                <div className="mt-5 rounded-2xl bg-white/5 p-4">
                    <p className="text-xs font-medium text-gray-300">예상 공제 내역</p>

                    <div className="mt-3 space-y-2 text-xs">
                        <div className="flex justify-between">
                            <span className="text-gray-500">CPP</span>

                            <span className="text-gray-300">
                                -$
                                {payrollDeductions.cpp.toFixed(2)}
                            </span>
                        </div>

                        <div className="flex justify-between">
                            <span className="text-gray-500">CPP2</span>

                            <span className="text-gray-300">
                                -$
                                {payrollDeductions.cpp2.toFixed(2)}
                            </span>
                        </div>

                        <div className="flex justify-between">
                            <span className="text-gray-500">EI</span>

                            <span className="text-gray-300">
                                -$
                                {payrollDeductions.ei.toFixed(2)}
                            </span>
                        </div>

                        <div className="flex justify-between">
                            <span className="text-gray-500">연방 소득세</span>

                            <span className="text-gray-300">
                                -$
                                {payrollDeductions.federalTax.toFixed(2)}
                            </span>
                        </div>

                        <div className="flex justify-between">
                            <span className="text-gray-500">{taxes.provinceName} 소득세</span>

                            <span className="text-gray-300">
                                -$
                                {payrollDeductions.provincialTax.toFixed(2)}
                            </span>
                        </div>

                        <div className="mt-3 border-t border-white/10 pt-3">
                            <div className="flex justify-between">
                                <span className="text-gray-300">총 공제</span>

                                <span className="font-medium text-white">
                                    -$
                                    {payrollDeductions.totalDeductions.toFixed(2)}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>

                {salarySettings?.payType === "hourly" && (
                    <p className="mt-5 text-xs text-gray-400">${hourlyWage.toFixed(2)} / 시간 기준</p>
                )}

                {salarySettings?.payType === "salary" && (
                    <p className="mt-5 text-xs text-gray-400">
                        설정된 월급 ${Number(salarySettings.monthlySalary ?? 0).toFixed(2)}
                    </p>
                )}
            </section>

            {/* Actual Net Pay Statistics */}

            <section className="mt-6 rounded-3xl bg-white p-5 shadow-sm">
                <div className="flex items-start justify-between">
                    <div>
                        <p className="text-xs text-gray-400">실수령액 통계</p>

                        <h2 className="mt-1 text-lg font-bold">평균 실수령액</h2>
                    </div>

                    <Link
                        href="/salary/pay-history"
                        className="rounded-full bg-gray-100 px-3 py-2 text-xs font-medium text-gray-600"
                    >
                        기록하기 →
                    </Link>
                </div>

                <p className="mt-4 text-3xl font-bold">{averageActualNetPay !== null ? formatMoney(averageActualNetPay) : "-"}</p>

                {recentActualPayHistory.length > 0 ? (
                    <>
                        <div className="mt-8">
                            <div className="relative h-48 w-full">
                                {(() => {
                                    const values = recentActualPayHistory.map((history) => Number(history.actualNetPay ?? 0));

                                    const allValues = [...values, averageActualNetPay ?? 0];

                                    const minValue = Math.min(...allValues);
                                    const maxValue = Math.max(...allValues);

                                    const range = Math.max(maxValue - minValue, 1);

                                    const width = 320;
                                    const height = 150;
                                    const paddingX = 16;
                                    const paddingY = 16;

                                    const points = recentActualPayHistory.map((history, index) => {
                                        const value = Number(history.actualNetPay ?? 0);

                                        const x =
                                            recentActualPayHistory.length === 1
                                                ? width / 2
                                                : paddingX +
                                                  (index / (recentActualPayHistory.length - 1)) * (width - paddingX * 2);

                                        const y = height - paddingY - ((value - minValue) / range) * (height - paddingY * 2);

                                        return {
                                            history,
                                            x,
                                            y,
                                            value,
                                        };
                                    });

                                    const linePoints = points.map((point) => `${point.x},${point.y}`).join(" ");

                                    const averageY =
                                        height -
                                        paddingY -
                                        (((averageActualNetPay ?? 0) - minValue) / range) * (height - paddingY * 2);

                                    return (
                                        <svg viewBox={`0 0 ${width} ${height}`} className="h-full w-full overflow-visible">
                                            <line
                                                x1={paddingX}
                                                y1={averageY}
                                                x2={width - paddingX}
                                                y2={averageY}
                                                stroke="currentColor"
                                                strokeWidth="1"
                                                strokeDasharray="4 4"
                                                className="text-gray-300"
                                            />

                                            <polyline
                                                points={linePoints}
                                                fill="none"
                                                stroke="currentColor"
                                                strokeWidth="2"
                                                strokeLinecap="round"
                                                strokeLinejoin="round"
                                                className="text-gray-900"
                                            />

                                            {points.map((point) => (
                                                <g
                                                    key={`${point.history.startDate}-${point.history.endDate}`}
                                                    onClick={() => setSelectedPayHistory(point.history)}
                                                    className="cursor-pointer"
                                                >
                                                    <circle cx={point.x} cy={point.y} r="10" fill="transparent" />

                                                    <circle cx={point.x} cy={point.y} r="4" className="fill-gray-900" />
                                                </g>
                                            ))}
                                        </svg>
                                    );
                                })()}
                            </div>

                            <div className="mt-2 flex justify-between text-[10px] text-gray-400">
                                {recentActualPayHistory.map((history) => (
                                    <button
                                        key={`${history.startDate}-${history.endDate}`}
                                        type="button"
                                        onClick={() => setSelectedPayHistory(history)}
                                        className="text-center"
                                    >
                                        {formatDisplayDate(history.endDate)}
                                    </button>
                                ))}
                            </div>

                            <div className="mt-4 flex items-center justify-end gap-2 text-xs text-gray-400">
                                <span className="h-px w-5 border-t border-dashed border-gray-300" />
                                평균
                            </div>
                        </div>
                    </>
                ) : (
                    <div className="mt-6 rounded-2xl bg-gray-100 p-4 text-sm text-gray-500">
                        아직 기록된 실수령액이 없어요.
                        <br />
                        급여 기록에서 실수령액을 기록하면 통계가 보여요.
                    </div>
                )}

                <Link
                    href="/salary/pay-history"
                    className="mt-5 block w-full rounded-2xl bg-gray-900 py-4 text-center text-sm font-semibold text-white"
                >
                    내 실수령액 기록하기
                </Link>
            </section>

            {/* Previous Expected Salary Modal */}
            {isPreviousExpectedOpen && previousPayPeriod && (
                <div
                    className="fixed inset-0 z-[60] flex items-end justify-center bg-black/40 p-4 sm:items-center"
                    onClick={() => setIsPreviousExpectedOpen(false)}
                >
                    <div
                        className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-3xl bg-black p-6 text-white shadow-xl"
                        onClick={(event) => event.stopPropagation()}
                    >
                        <div className="flex items-start justify-between">
                            <div>
                                <p className="text-xs text-gray-500">저번 급여 기간</p>

                                <p className="mt-1 text-sm font-semibold">
                                    {formatDisplayDate(previousPayPeriod.startDate)}
                                    {" ~ "}
                                    {formatDisplayDate(previousPayPeriod.endDate)}
                                </p>
                            </div>

                            <button
                                type="button"
                                onClick={() => setIsPreviousExpectedOpen(false)}
                                className="text-xl text-gray-400"
                            >
                                ×
                            </button>
                        </div>

                        <p className="mt-6 text-4xl font-bold">{formatMoney(previousEstimatedNetPay)}</p>

                        <p className="mt-2 text-sm text-gray-400">
                            {previousPayHistory?.actualNetPay != null ? "실제 실수령액" : "예상 실수령액"}
                        </p>

                        <div className="mt-6 space-y-3 text-sm">
                            <div className="flex justify-between">
                                <span className="text-gray-400">근무시간</span>

                                <span>
                                    {(previousPayHistory?.hours ?? previousPeriodHours).toFixed(1)}
                                    시간
                                </span>
                            </div>

                            <div className="flex justify-between">
                                <span className="text-gray-400">기본 급여</span>

                                <span>{formatMoney(previousPayHistory?.basePay ?? previousBasePay)}</span>
                            </div>

                            <div className="flex justify-between">
                                <span className="text-gray-400">Holiday Pay</span>

                                <span>
                                    {formatMoney(
                                        previousPayHistory?.grossPay != null && previousPayHistory?.basePay != null
                                            ? Math.max(
                                                  0,
                                                  (previousPayHistory.grossPay ?? 0) -
                                                      (previousPayHistory.basePay ?? 0) -
                                                      (previousPayHistory.vacationPay ?? 0) -
                                                      (previousPayHistory.paychequeTips ?? 0),
                                              )
                                            : previousHolidayPay,
                                    )}
                                </span>
                            </div>

                            <div className="flex justify-between">
                                <span className="text-gray-400">Vacation Pay</span>

                                <span>{formatMoney(previousPayHistory?.vacationPay ?? previousEstimatedVacationPay)}</span>
                            </div>

                            {previousPayHistory?.paychequeTips != null && previousPayHistory.paychequeTips > 0 && (
                                <div className="flex justify-between">
                                    <span className="text-gray-400">급여 포함 팁</span>

                                    <span>{formatMoney(previousPayHistory.paychequeTips)}</span>
                                </div>
                            )}

                            <div className="mt-4 border-t border-gray-800 pt-4">
                                <div className="flex justify-between">
                                    <span className="text-gray-300">세전 급여</span>

                                    <span className="font-semibold">
                                        {formatMoney(previousPayHistory?.grossPay ?? previousEstimatedGross)}
                                    </span>
                                </div>
                            </div>

                            <div className="flex justify-between">
                                <span className="text-gray-400">공제</span>

                                <span>
                                    -{" "}
                                    {formatMoney(
                                        previousPayHistory?.deductions ?? previousTaxes.totalDeductions / periodsPerYear,
                                    )}
                                </span>
                            </div>

                            <div className="flex justify-between">
                                <span className="text-gray-300">실수령액</span>

                                <span className="font-semibold">{formatMoney(previousEstimatedNetPay)}</span>
                            </div>

                            {previousPayHistory?.cashTips != null && previousPayHistory.cashTips > 0 && (
                                <div className="mt-4 border-t border-gray-800 pt-4">
                                    <div className="flex justify-between">
                                        <span className="text-gray-400">현금 팁</span>

                                        <span>{formatMoney(previousPayHistory.cashTips)}</span>
                                    </div>

                                    <div className="mt-3 flex justify-between rounded-2xl bg-white p-3 text-black">
                                        <span className="text-sm font-medium">총 수령액</span>

                                        <span className="text-lg font-bold">
                                            {formatMoney(
                                                (previousPayHistory.actualNetPay ?? previousPayHistory.netPay) +
                                                    previousPayHistory.cashTips,
                                            )}
                                        </span>
                                    </div>
                                </div>
                            )}
                        </div>

                        <Link
                            href="/salary/pay-history"
                            className="mt-6 block w-full rounded-2xl bg-white py-4 text-center text-sm font-semibold text-black"
                        >
                            급여 기록 보기
                        </Link>
                    </div>
                </div>
            )}

            {/* Actual Net Pay Detail Modal */}

            {selectedPayHistory && (
                <div
                    className="fixed inset-0 z-[60] flex items-end justify-center bg-black/40 p-4 sm:items-center"
                    onClick={() => setSelectedPayHistory(null)}
                >
                    <div
                        className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-3xl bg-black p-6 text-white shadow-xl"
                        onClick={(event) => event.stopPropagation()}
                    >
                        <div className="flex items-start justify-between">
                            <div>
                                <p className="text-xs text-gray-500">실수령액 기록</p>

                                <p className="mt-1 text-sm font-semibold">
                                    {formatDisplayDate(selectedPayHistory.startDate)}
                                    {" ~ "}
                                    {formatDisplayDate(selectedPayHistory.endDate)}
                                </p>
                            </div>

                            <button type="button" onClick={() => setSelectedPayHistory(null)} className="text-xl text-gray-400">
                                ×
                            </button>
                        </div>

                        <p className="mt-6 text-4xl font-bold">{formatMoney(Number(selectedPayHistory.actualNetPay ?? 0))}</p>

                        <p className="mt-2 text-sm text-gray-400">실제 실수령액</p>

                        {selectedPayDifference !== null && selectedPayChangePercent !== null && (
                            <div className="mt-5 rounded-2xl bg-white/5 p-4">
                                <p className="text-xs text-gray-500">평균과 비교</p>

                                <p className="mt-2 text-sm">
                                    평균보다{" "}
                                    <span
                                        className={
                                            selectedPayDifference >= 0
                                                ? "font-semibold text-red-400"
                                                : "font-semibold text-blue-400"
                                        }
                                    >
                                        {selectedPayDifference >= 0
                                            ? `${formatMoney(Math.abs(selectedPayDifference))} 많아요`
                                            : `${formatMoney(Math.abs(selectedPayDifference))} 적어요`}
                                    </span>
                                </p>

                                <p className="mt-1 text-xs text-gray-500">
                                    평균 대비 {Math.abs(selectedPayChangePercent).toFixed(1)}%
                                    {selectedPayDifference >= 0 ? " 높아요" : " 낮아요"}
                                </p>
                            </div>
                        )}

                        <div className="mt-6 space-y-3 text-sm">
                            <div className="flex justify-between">
                                <span className="text-gray-400">근무시간</span>

                                <span>
                                    {(selectedPayHistory.hours ?? 0).toFixed(1)}
                                    시간
                                </span>
                            </div>

                            <div className="flex justify-between">
                                <span className="text-gray-400">기본 급여</span>

                                <span>{formatMoney(selectedPayHistory.basePay ?? 0)}</span>
                            </div>

                            {(selectedPayHistory.paychequeTips ?? 0) > 0 && (
                                <div className="flex justify-between">
                                    <span className="text-gray-400">급여 포함 팁</span>

                                    <span>{formatMoney(selectedPayHistory.paychequeTips ?? 0)}</span>
                                </div>
                            )}

                            {(selectedPayHistory.cashTips ?? 0) > 0 && (
                                <div className="flex justify-between">
                                    <span className="text-gray-400">현금 팁</span>

                                    <span>{formatMoney(selectedPayHistory.cashTips ?? 0)}</span>
                                </div>
                            )}

                            {(selectedPayHistory.vacationPay ?? 0) > 0 && (
                                <div className="flex justify-between">
                                    <span className="text-gray-400">Vacation Pay</span>

                                    <span>{formatMoney(selectedPayHistory.vacationPay ?? 0)}</span>
                                </div>
                            )}

                            <div className="mt-4 border-t border-gray-800 pt-4">
                                <div className="flex justify-between">
                                    <span className="text-gray-300">세전 급여</span>

                                    <span className="font-semibold">{formatMoney(selectedPayHistory.grossPay ?? 0)}</span>
                                </div>
                            </div>

                            <div className="flex justify-between">
                                <span className="text-gray-400">공제</span>

                                <span>- {formatMoney(selectedPayHistory.deductions ?? 0)}</span>
                            </div>

                            <div className="flex justify-between">
                                <span className="text-gray-300">실수령액</span>

                                <span className="font-semibold">{formatMoney(Number(selectedPayHistory.actualNetPay ?? 0))}</span>
                            </div>
                        </div>

                        <Link
                            href="/salary/pay-history"
                            className="mt-6 block w-full rounded-2xl bg-white py-4 text-center text-sm font-semibold text-black"
                        >
                            급여 기록 보기
                        </Link>
                    </div>
                </div>
            )}
        </div>
    );
}
