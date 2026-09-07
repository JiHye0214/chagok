"use client";

import { useEffect, useRef, useState } from "react";
import { getPeriodsPerYear, formatDate } from "@/lib/payPeriod";
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

type Adjustment = {
    type: "add" | "subtract";
    name: string;
    amount: number;
};

type PayHistory = {
    id: number;

    startDate: string;
    endDate: string;
    payDate: string | null;

    hours: number;

    pay: number;
    actualPay: number;

    tips: number;
    actualTips: number;

    cashTips: number;
    paychequeTips: number;

    deductions: number;
    actualDeductions: number;

    adjustments: Adjustment[];

    netPay: number;
    actualNetPay: number;

    totalIncome: number;

    calculatedNetPay?: number;

    createdAt?: string;
    updatedAt?: string;
};

type Holiday = {
    date: string;
    name: string;
    global: boolean;
};

type PeriodEstimate = {
    hours: number;
    basePay: number;
    holidayPay: number;
    vacationPay: number;
    paychequeTips: number;
    cashTips: number;
    grossPay: number;
    deductions: number;
    cpp: number;
    cpp2: number;
    ei: number;
    federalTax: number;
    provincialTax: number;
    provinceName: string;
    netPay: number;
    totalIncome: number;
};

type GraphPoint = {
    startDate: string;
    endDate: string;
    payDate: string | null;
    value: number;
    isEstimate: boolean;
    history?: PayHistory;
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

/*
 * 지급일까지 남은 날짜 표시
 *
 * 0  → 오늘
 * 1  → 내일
 * 2  → 모레
 * 3+ → 3일 뒤, 4일 뒤...
 */
const getDdayLabel = (targetDate: string) => {
    const days = getDaysDifference(targetDate);

    if (days === 0) {
        return "오늘";
    }

    if (days === 1) {
        return "내일";
    }

    if (days === 2) {
        return "모레";
    }

    if (days > 2) {
        return `${days}일 뒤`;
    }

    if (days === -1) {
        return "어제";
    }

    return `${Math.abs(days)}일 전`;
};

export default function SalaryPage() {
    const [schedules, setSchedules] = useState<WorkSchedule[]>([]);
    const [isSchedulesLoading, setIsSchedulesLoading] = useState(true);

    const [holidays, setHolidays] = useState<Holiday[]>([]);

    const [, setCashTips] = useState("");
    const [, setPaychequeTips] = useState("");

    const [savedTips, setSavedTips] = useState<PayPeriodTips | null>(null);

    const [pendingSavedTips, setPendingSavedTips] = useState<PayPeriodTips | null>(null);

    const [salarySettings, setSalarySettings] = useState<SalarySettings | null>(null);

    const [latestActualPay, setLatestActualPay] = useState<number | null>(null);

    const [payHistory, setPayHistory] = useState<PayHistory[]>([]);

    const [isPendingExpectedOpen, setIsPendingExpectedOpen] = useState(false);

    const [selectedPayHistory, setSelectedPayHistory] = useState<PayHistory | null>(null);

    const [hoveredGraphPoint, setHoveredGraphPoint] = useState<GraphPoint | null>(null);

    const hourlyWage = salarySettings?.payType === "hourly" ? Number(salarySettings.hourlyWage ?? 0) : 0;

    const [, setAnimatedNetPay] = useState(0);

    const [animatedPendingNetPay, setAnimatedPendingNetPay] = useState(0);

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
     * Pay Date Helpers
     * --------------------------------------------------
     */

    const getRegularPayDate = (periodStart: Date, anchorStart: Date, anchorPayDate: Date | null, periodLength: number) => {
        if (!anchorPayDate) {
            const payDate = new Date(periodStart);

            payDate.setDate(payDate.getDate() + periodLength - 1);

            return formatISO(payDate);
        }

        const daysDifference = Math.round((periodStart.getTime() - anchorStart.getTime()) / (1000 * 60 * 60 * 24));

        const periodIndex = Math.round(daysDifference / periodLength);

        const payDate = new Date(anchorPayDate);

        payDate.setDate(payDate.getDate() + periodIndex * periodLength);

        return formatISO(payDate);
    };

    const getMonthlyPayDate = (periodStart: Date, anchorPayDate: Date | null) => {
        if (!anchorPayDate) {
            return formatISO(new Date(periodStart.getFullYear(), periodStart.getMonth() + 1, 0));
        }

        const anchorMonth = new Date(anchorPayDate.getFullYear(), anchorPayDate.getMonth(), 1);

        const periodMonth = new Date(periodStart.getFullYear(), periodStart.getMonth(), 1);

        const monthDifference =
            (periodMonth.getFullYear() - anchorMonth.getFullYear()) * 12 + (periodMonth.getMonth() - anchorMonth.getMonth());

        const payDate = new Date(anchorPayDate);

        payDate.setMonth(payDate.getMonth() + monthDifference);

        return formatISO(payDate);
    };

    const getSemiMonthlyPayDate = (periodStart: Date, anchorPayDate: Date | null) => {
        if (!anchorPayDate) {
            const payDate = new Date(periodStart);

            payDate.setDate(payDate.getDate() + 14);

            return formatISO(payDate);
        }

        const anchorMonth = new Date(anchorPayDate.getFullYear(), anchorPayDate.getMonth(), 1);

        const periodMonth = new Date(periodStart.getFullYear(), periodStart.getMonth(), 1);

        const monthDifference =
            (periodMonth.getFullYear() - anchorMonth.getFullYear()) * 12 + (periodMonth.getMonth() - anchorMonth.getMonth());

        const payDate = new Date(anchorPayDate);

        payDate.setMonth(payDate.getMonth() + monthDifference);

        return formatISO(payDate);
    };

    /*
     * --------------------------------------------------
     * Pay Period Calculation
     * --------------------------------------------------
     *
     * Biweekly:
     *
     * 8/22 ~ 9/4
     * 9/5  ~ 9/18
     * 9/19 ~ 10/2
     *
     * 즉, 14일 단위로 정확히 연결한다.
     * --------------------------------------------------
     */

    const getPayPeriods = () => {
        if (!salarySettings) {
            return {
                previous: null,
                current: null,
                next: null,
            };
        }

        const today = new Date();

        const todayOnly = new Date(today.getFullYear(), today.getMonth(), today.getDate());

        const configuredAnchorStart = salarySettings.payPeriodStartDate
            ? new Date(`${salarySettings.payPeriodStartDate}T00:00:00`)
            : null;

        /*
         * 현재 설정값이 4일로 저장되어 있는 경우
         * 급여기간 기준을 5일부터 시작하도록 보정한다.
         *
         * 예:
         * 8/4 → 8/5
         *
         * 이후에는 14일씩
         * 8/5 ~ 8/18
         * 8/19 ~ 9/1
         * 9/2 ~ 9/15
         * ...
         */
        const anchorStartDate = configuredAnchorStart ?? new Date(todayOnly.getFullYear(), todayOnly.getMonth(), 5);

        if (salarySettings.payFrequency === "biweekly" && salarySettings.payPeriodStartDate && anchorStartDate.getDate() === 4) {
            anchorStartDate.setDate(anchorStartDate.getDate() + 1);
        }

        const anchorPayDate = salarySettings.payDate ? new Date(`${salarySettings.payDate}T00:00:00`) : null;

        /*
         * --------------------------------------------------
         * Semi-monthly
         * --------------------------------------------------
         */

        if (salarySettings.payFrequency === "semi-monthly") {
            const makeSemiMonthlyPeriod = (date: Date): PayPeriod => {
                const year = date.getFullYear();
                const month = date.getMonth();

                let startDay: number;
                let endDay: number;

                if (salarySettings.semiMonthlyType === "fifteenth-end") {
                    if (date.getDate() <= 15) {
                        startDay = 15;

                        const previousMonthEnd = new Date(year, month, 0).getDate();

                        endDay = previousMonthEnd;
                    } else {
                        startDay = 16;

                        endDay = new Date(year, month + 1, 0).getDate();
                    }
                } else {
                    if (date.getDate() <= 15) {
                        startDay = 1;
                        endDay = 15;
                    } else {
                        startDay = 16;

                        endDay = new Date(year, month + 1, 0).getDate();
                    }
                }

                const start = new Date(year, month, startDay);

                const end = new Date(year, month, endDay);

                return {
                    startDate: formatISO(start),
                    endDate: formatISO(end),
                    payDate: getSemiMonthlyPayDate(start, anchorPayDate),
                };
            };

            const current = makeSemiMonthlyPeriod(todayOnly);

            const previousDate = new Date(todayOnly);

            if (todayOnly.getDate() <= 15) {
                previousDate.setMonth(previousDate.getMonth() - 1);
                previousDate.setDate(16);
            } else {
                previousDate.setDate(1);
            }

            const nextDate = new Date(todayOnly);

            if (todayOnly.getDate() <= 15) {
                nextDate.setDate(16);
            } else {
                nextDate.setMonth(nextDate.getMonth() + 1);
                nextDate.setDate(1);
            }

            return {
                previous: makeSemiMonthlyPeriod(previousDate),
                current,
                next: makeSemiMonthlyPeriod(nextDate),
            };
        }

        /*
         * --------------------------------------------------
         * Monthly
         * --------------------------------------------------
         */

        if (salarySettings.payFrequency === "monthly") {
            const currentStart = new Date(todayOnly.getFullYear(), todayOnly.getMonth(), 1);

            const currentEnd = new Date(todayOnly.getFullYear(), todayOnly.getMonth() + 1, 0);

            const previousStart = new Date(todayOnly.getFullYear(), todayOnly.getMonth() - 1, 1);

            const previousEnd = new Date(todayOnly.getFullYear(), todayOnly.getMonth(), 0);

            const nextStart = new Date(todayOnly.getFullYear(), todayOnly.getMonth() + 1, 1);

            const nextEnd = new Date(todayOnly.getFullYear(), todayOnly.getMonth() + 2, 0);

            return {
                previous: {
                    startDate: formatISO(previousStart),
                    endDate: formatISO(previousEnd),
                    payDate: getMonthlyPayDate(previousStart, anchorPayDate),
                },

                current: {
                    startDate: formatISO(currentStart),
                    endDate: formatISO(currentEnd),
                    payDate: getMonthlyPayDate(currentStart, anchorPayDate),
                },

                next: {
                    startDate: formatISO(nextStart),
                    endDate: formatISO(nextEnd),
                    payDate: getMonthlyPayDate(nextStart, anchorPayDate),
                },
            };
        }

        /*
         * --------------------------------------------------
         * Weekly / Biweekly / Custom
         * --------------------------------------------------
         */

        const getPeriodLength = () => {
            switch (salarySettings.payFrequency) {
                case "weekly":
                    return 7;

                case "biweekly":
                    return 14;

                case "custom":
                    return salarySettings.customPayDays ? Number(salarySettings.customPayDays) : 14;

                default:
                    return 14;
            }
        };

        const periodLength = getPeriodLength();

        let currentStart = new Date(anchorStartDate);

        /*
         * 현재 날짜가 포함되는 급여기간을 찾는다.
         *
         * 이전 기간으로 이동할 때도 정확히 14일,
         * 다음 기간으로 이동할 때도 정확히 14일이다.
         */
        while (true) {
            const currentEnd = new Date(currentStart);

            currentEnd.setDate(currentEnd.getDate() + periodLength - 1);

            if (todayOnly >= currentStart && todayOnly <= currentEnd) {
                break;
            }

            if (todayOnly > currentEnd) {
                currentStart = new Date(currentStart);

                currentStart.setDate(currentStart.getDate() + periodLength);
            } else {
                currentStart = new Date(currentStart);

                currentStart.setDate(currentStart.getDate() - periodLength);
            }
        }

        const currentEnd = new Date(currentStart);

        currentEnd.setDate(currentEnd.getDate() + periodLength - 1);

        const previousStart = new Date(currentStart);

        previousStart.setDate(previousStart.getDate() - periodLength);

        const previousEnd = new Date(currentStart);

        previousEnd.setDate(previousEnd.getDate() - 1);

        const nextStart = new Date(currentEnd);

        nextStart.setDate(nextStart.getDate() + 1);

        const nextEnd = new Date(nextStart);

        nextEnd.setDate(nextEnd.getDate() + periodLength - 1);

        return {
            previous: {
                startDate: formatISO(previousStart),
                endDate: formatISO(previousEnd),
                payDate: getRegularPayDate(previousStart, anchorStartDate, anchorPayDate, periodLength),
            },

            current: {
                startDate: formatISO(currentStart),
                endDate: formatISO(currentEnd),
                payDate: getRegularPayDate(currentStart, anchorStartDate, anchorPayDate, periodLength),
            },

            next: {
                startDate: formatISO(nextStart),
                endDate: formatISO(nextEnd),
                payDate: getRegularPayDate(nextStart, anchorStartDate, anchorPayDate, periodLength),
            },
        };
    };

    const { previous: pendingPayPeriod, current: currentPayPeriod, next: nextPayPeriod } = getPayPeriods();

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
     * Load Pending Period Tips
     * --------------------------------------------------
     */

    useEffect(() => {
        if (!pendingPayPeriod) {
            setPendingSavedTips(null);
            return;
        }

        const loadPendingTips = async () => {
            try {
                const response = await fetch(
                    `/api/pay-period-tips?startDate=${encodeURIComponent(
                        pendingPayPeriod.startDate,
                    )}&endDate=${encodeURIComponent(pendingPayPeriod.endDate)}`,
                );

                if (!response.ok) {
                    throw new Error("이전 급여 기간 팁 조회 실패");
                }

                const data: PayPeriodTips | null = await response.json();

                setPendingSavedTips(data);
            } catch (error) {
                console.error(error);
                setPendingSavedTips(null);
            }
        };

        loadPendingTips();
    }, [pendingPayPeriod?.startDate, pendingPayPeriod?.endDate]);

    /*
     * --------------------------------------------------
     * Load Actual Pay History
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

                const actualPayPeriods = data
                    .filter((item) => item.actualNetPay !== null)
                    .sort((a, b) => a.endDate.localeCompare(b.endDate));

                const latestActual = actualPayPeriods.at(-1);

                setLatestActualPay(latestActual ? Number(latestActual.actualNetPay) : null);
            } catch (error) {
                console.error("급여 기록 조회 실패:", error);
            }
        };

        loadPayHistory();
    }, []);

    /*
     * --------------------------------------------------
     * Current Period Schedules
     * --------------------------------------------------
     */

    const currentPeriodSchedules = currentPayPeriod
        ? schedules.filter((schedule) => {
              const scheduleDate = schedule.date.slice(0, 10);

              return scheduleDate >= currentPayPeriod.startDate && scheduleDate <= currentPayPeriod.endDate;
          })
        : [];

    const currentPeriodHours = currentPeriodSchedules.reduce(
        (total, schedule) =>
            total + calculateHours(schedule.startTime, schedule.endTime, schedule.hasBreak ? schedule.breakMinutes : 0),
        0,
    );

    /*
     * --------------------------------------------------
     * Current Tips
     * --------------------------------------------------
     */

    const currentPeriodPaychequeTips = savedTips?.paychequeTips ?? 0;

    const currentPeriodCashTips = savedTips?.cashTips ?? 0;

    const hasPaychequeTips = Boolean(
        salarySettings?.hasTips && (salarySettings.tipType === "paycheque" || salarySettings.tipType === "both"),
    );

    const hasCashTips = Boolean(
        salarySettings?.hasTips && (salarySettings.tipType === "cash" || salarySettings.tipType === "both"),
    );

    /*
     * --------------------------------------------------
     * Current Period Estimate
     * --------------------------------------------------
     */

    const currentBasePay =
        salarySettings?.payType === "hourly"
            ? currentPeriodHours * hourlyWage
            : salarySettings?.payType === "salary"
              ? Number(salarySettings.monthlySalary ?? 0)
              : 0;

    const currentHolidaySchedules = currentPeriodSchedules.filter((schedule) => isHoliday(schedule.date.slice(0, 10), holidays));

    const currentHolidayHours = currentHolidaySchedules.reduce(
        (total, schedule) =>
            total + calculateHours(schedule.startTime, schedule.endTime, schedule.hasBreak ? schedule.breakMinutes : 0),
        0,
    );

    const currentHolidayPay = salarySettings?.payType === "hourly" ? currentHolidayHours * hourlyWage * 0.5 : 0;

    const vacationPayRate = Number(salarySettings?.vacationPayRate ?? 4.15);

    const currentVacationPay = currentBasePay * (vacationPayRate / 100);

    const currentPaychequeTips = hasPaychequeTips ? currentPeriodPaychequeTips : 0;

    const currentCashTips = hasCashTips ? currentPeriodCashTips : 0;

    const currentTaxableGrossPay = currentBasePay + currentHolidayPay + currentVacationPay + currentPaychequeTips;

    const periodsPerYear = getPeriodsPerYear(salarySettings?.payFrequency ?? "biweekly");

    const currentAnnualGross = currentTaxableGrossPay * periodsPerYear;

    const currentTaxes = calculateTaxes({
        country: "CA",
        province: salarySettings?.province ?? "",
        annualGross: currentAnnualGross,
    });

    const currentPeriodEstimate: PeriodEstimate = {
        hours: currentPeriodHours,

        basePay: currentBasePay,

        holidayPay: currentHolidayPay,

        vacationPay: currentVacationPay,

        paychequeTips: currentPaychequeTips,

        cashTips: currentCashTips,

        grossPay: currentTaxableGrossPay,

        deductions: currentTaxes.totalDeductions / periodsPerYear,

        cpp: currentTaxes.cpp / periodsPerYear,

        cpp2: currentTaxes.cpp2 / periodsPerYear,

        ei: currentTaxes.ei / periodsPerYear,

        federalTax: currentTaxes.federalTax / periodsPerYear,

        provincialTax: currentTaxes.provincialTax / periodsPerYear,

        provinceName: currentTaxes.provinceName,

        netPay: currentTaxableGrossPay - currentTaxes.totalDeductions / periodsPerYear,

        totalIncome: currentTaxableGrossPay - currentTaxes.totalDeductions / periodsPerYear + currentCashTips,
    };

    useEffect(() => {
        const target = currentPeriodEstimate.netPay;

        let startTime: number | null = null;
        let animationFrame: number;

        const duration = 1000;

        const animate = (timestamp: number) => {
            if (startTime === null) {
                startTime = timestamp;
            }

            const elapsed = timestamp - startTime;
            const progress = Math.min(elapsed / duration, 1);

            // 처음 빠르고 끝에서 부드럽게 멈춤
            const eased = 1 - Math.pow(1 - progress, 3);

            setAnimatedNetPay(target * eased);

            if (progress < 1) {
                animationFrame = requestAnimationFrame(animate);
            } else {
                setAnimatedNetPay(target);
            }
        };

        animationFrame = requestAnimationFrame(animate);

        return () => {
            cancelAnimationFrame(animationFrame);
        };
    }, [currentPeriodEstimate.netPay]);

    /*
     * --------------------------------------------------
     * Pending Period Estimate
     * --------------------------------------------------
     */

    const pendingPeriodSchedules = pendingPayPeriod
        ? schedules.filter((schedule) => {
              const scheduleDate = schedule.date.slice(0, 10);

              return scheduleDate >= pendingPayPeriod.startDate && scheduleDate <= pendingPayPeriod.endDate;
          })
        : [];

    const pendingPeriodHours = pendingPeriodSchedules.reduce(
        (total, schedule) =>
            total + calculateHours(schedule.startTime, schedule.endTime, schedule.hasBreak ? schedule.breakMinutes : 0),
        0,
    );

    const pendingBasePay =
        salarySettings?.payType === "hourly"
            ? pendingPeriodHours * hourlyWage
            : salarySettings?.payType === "salary"
              ? Number(salarySettings.monthlySalary ?? 0)
              : 0;

    const pendingHolidaySchedules = pendingPeriodSchedules.filter((schedule) => isHoliday(schedule.date.slice(0, 10), holidays));

    const pendingHolidayHours = pendingHolidaySchedules.reduce(
        (total, schedule) =>
            total + calculateHours(schedule.startTime, schedule.endTime, schedule.hasBreak ? schedule.breakMinutes : 0),
        0,
    );

    const pendingHolidayPay = salarySettings?.payType === "hourly" ? pendingHolidayHours * hourlyWage * 0.5 : 0;

    const pendingVacationPay = pendingBasePay * (vacationPayRate / 100);

    const pendingPaychequeTips = hasPaychequeTips ? (pendingSavedTips?.paychequeTips ?? 0) : 0;

    const pendingCashTips = hasCashTips ? (pendingSavedTips?.cashTips ?? 0) : 0;

    const pendingTaxableGrossPay = pendingBasePay + pendingHolidayPay + pendingVacationPay + pendingPaychequeTips;

    const pendingAnnualGross = pendingTaxableGrossPay * periodsPerYear;

    const pendingTaxes = calculateTaxes({
        country: "CA",
        province: salarySettings?.province ?? "",
        annualGross: pendingAnnualGross,
    });

    const pendingPeriodEstimate: PeriodEstimate = {
        hours: pendingPeriodHours,

        basePay: pendingBasePay,

        holidayPay: pendingHolidayPay,

        vacationPay: pendingVacationPay,

        paychequeTips: pendingPaychequeTips,

        cashTips: pendingCashTips,

        grossPay: pendingTaxableGrossPay,

        deductions: pendingTaxes.totalDeductions / periodsPerYear,

        cpp: pendingTaxes.cpp / periodsPerYear,

        cpp2: pendingTaxes.cpp2 / periodsPerYear,

        ei: pendingTaxes.ei / periodsPerYear,

        federalTax: pendingTaxes.federalTax / periodsPerYear,

        provincialTax: pendingTaxes.provincialTax / periodsPerYear,

        provinceName: pendingTaxes.provinceName,

        netPay: pendingTaxableGrossPay - pendingTaxes.totalDeductions / periodsPerYear,

        totalIncome: pendingTaxableGrossPay - pendingTaxes.totalDeductions / periodsPerYear + pendingCashTips,
    };

    /*
     * --------------------------------------------------
     * Pending Actual Record
     * --------------------------------------------------
     */

    const pendingActualPay = pendingPayPeriod
        ? (payHistory.find(
              (history) =>
                  history.startDate === pendingPayPeriod.startDate &&
                  history.endDate === pendingPayPeriod.endDate &&
                  history.actualNetPay !== null,
          ) ?? null)
        : null;

    /*
     * --------------------------------------------------
     * Pending Status
     * --------------------------------------------------
     */

    const today = new Date();

    const todayOnly = new Date(today.getFullYear(), today.getMonth(), today.getDate());

    const pendingEndDate = pendingPayPeriod ? new Date(`${pendingPayPeriod.endDate}T00:00:00`) : null;

    const pendingPayDate = pendingPayPeriod ? new Date(`${pendingPayPeriod.payDate}T00:00:00`) : null;

    const isPendingPeriodEnded = pendingEndDate !== null && pendingEndDate < todayOnly;

    const isPendingPayDatePassed = pendingPayDate !== null && pendingPayDate < todayOnly;

    /*
     * 지급일 전 + 실제 기록 없음
     *
     * → 예상 지급 카드
     */
    const shouldShowPendingPay = Boolean(pendingPayPeriod) && isPendingPeriodEnded && !isPendingPayDatePassed;

    /*
     * 지급일 당일은 아직 "지급일이 지났다"가 아니다.
     *
     * 따라서 오늘은 D-day "오늘"로 보여준다.
     *
     * 지급일 다음날부터 기록하기 화면으로 이동.
     */
    const shouldGoToPayHistory = Boolean(pendingPayPeriod) && isPendingPeriodEnded && isPendingPayDatePassed && !pendingActualPay;

    useEffect(() => {
        if (!shouldShowPendingPay) {
            setAnimatedPendingNetPay(0);
            return;
        }

        const target = pendingPeriodEstimate.netPay;

        let startTime: number | null = null;
        let animationFrame: number;

        const duration = 1000;

        const animate = (timestamp: number) => {
            if (startTime === null) {
                startTime = timestamp;
            }

            const elapsed = timestamp - startTime;
            const progress = Math.min(elapsed / duration, 1);

            // 처음 빠르고 끝에서 부드럽게 멈춤
            const eased = 1 - Math.pow(1 - progress, 3);

            setAnimatedPendingNetPay(target * eased);

            if (progress < 1) {
                animationFrame = requestAnimationFrame(animate);
            } else {
                setAnimatedPendingNetPay(target);
            }
        };

        animationFrame = requestAnimationFrame(animate);

        return () => {
            cancelAnimationFrame(animationFrame);
        };
    }, [pendingPeriodEstimate.netPay, shouldShowPendingPay]);

    /*
     * --------------------------------------------------
     * Actual Net Pay Statistics
     * --------------------------------------------------
     */

    const actualPayPeriods = payHistory
        .filter((history) => history.actualNetPay !== null)
        .sort((a, b) => a.endDate.localeCompare(b.endDate));

    const recentActualPayHistory = actualPayPeriods.slice(-6);

    const averageActualNetPay =
        actualPayPeriods.length > 0
            ? actualPayPeriods.reduce((total, history) => total + Number(history.actualNetPay ?? 0), 0) / actualPayPeriods.length
            : null;

    /*
     * --------------------------------------------------
     * Graph Data
     * --------------------------------------------------
     *
     * 실제 기록:
     * actualNetPay 그대로 사용
     *
     * 지급 전 pending:
     * 예상값 하나 추가
     *
     * 예상값은 평균 계산에서 제외.
     * --------------------------------------------------
     */

    const actualGraphPoints: GraphPoint[] = recentActualPayHistory.map((history) => ({
        startDate: history.startDate,
        endDate: history.endDate,
        payDate: history.payDate,
        value: Number(history.actualNetPay ?? 0),
        isEstimate: false,
        history,
    }));

    const pendingGraphPoint: GraphPoint | null =
        shouldShowPendingPay && pendingPayPeriod
            ? {
                  startDate: pendingPayPeriod.startDate,
                  endDate: pendingPayPeriod.endDate,
                  payDate: pendingPayPeriod.payDate,
                  value: pendingPeriodEstimate.netPay,
                  isEstimate: true,
              }
            : null;

    const graphPayHistory: GraphPoint[] = [
        ...actualGraphPoints.filter(
            (point) =>
                !pendingGraphPoint ||
                point.startDate !== pendingGraphPoint.startDate ||
                point.endDate !== pendingGraphPoint.endDate,
        ),
        ...(pendingGraphPoint ? [pendingGraphPoint] : []),
    ];

    const selectedActualNetPay =
        selectedPayHistory?.actualNetPay !== null && selectedPayHistory?.actualNetPay !== undefined
            ? Number(selectedPayHistory.actualNetPay)
            : null;

    const selectedPayDifference =
        selectedActualNetPay !== null && averageActualNetPay !== null ? selectedActualNetPay - averageActualNetPay : null;

    const selectedPayChangePercent =
        selectedPayDifference !== null && averageActualNetPay !== null && averageActualNetPay !== 0
            ? (selectedPayDifference / averageActualNetPay) * 100
            : null;

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
            <header className="mt-5 mb-10">
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

                <p className="mt-2 text-sm text-gray-500">이번 급여는 얼마나 받을까요?</p>
            </header>

            {/* --------------------------------------------------
                Pending Pay Status
            -------------------------------------------------- */}

            {pendingPayPeriod && (
                <>
                    {shouldGoToPayHistory && (
                        <Link
                            href="/salary/pay-history"
                            className="block w-full rounded-3xl bg-gray-900 p-5 text-left shadow-sm transition hover:shadow-md"
                        >
                            <p className="text-xs text-gray-400">급여 기록</p>

                            <p className="mt-1 text-lg font-bold text-white">지급일이 지났어요</p>

                            <p className="mt-1 text-sm text-gray-500">아직 기록되지 않은 급여가 있어요.</p>

                            <p className="mt-4 text-xs text-gray-400">
                                {formatDisplayDate(pendingPayPeriod.startDate)}
                                {" ~ "}
                                {formatDisplayDate(pendingPayPeriod.endDate)}
                            </p>

                            <p className="mt-3 text-xs font-medium text-gray-500">급여 기록에서 확인하기 →</p>
                        </Link>
                    )}

                    {shouldShowPendingPay && pendingPayPeriod && (
                        <button
                            type="button"
                            onClick={() => setIsPendingExpectedOpen(true)}
                            className="block w-full rounded-3xl border border-blue-100 bg-blue-50 p-5 text-left shadow-sm transition hover:bg-blue-100/70"
                        >
                            <div className="flex items-start justify-between gap-4">
                                <div>
                                    <p className="text-xs text-blue-500">급여 예정</p>

                                    <p className="mt-2 text-lg font-semibold text-gray-900">
                                        <span className="text-blue-600">{getDdayLabel(pendingPayPeriod.payDate)}</span>{" "}
                                        {formatMoney(animatedPendingNetPay)}를 받아요
                                    </p>

                                    <p className="mt-1 text-sm text-gray-500">지급일이 다가오고 있어요. 지출을 계획해 볼까요?</p>
                                </div>

                                <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-blue-600 shadow-sm">
                                    예상
                                </span>
                            </div>
                        </button>
                    )}
                </>
            )}

            {currentPayPeriod && (
                <div className="mt-5 rounded-3xl border border-gray-200 bg-white p-5 shadow-sm">
                    <p className="text-xs font-medium text-blue-500">현재 급여 기간</p>

                    <p className="mt-1 text-sm font-semibold text-gray-900">
                        {formatDisplayDate(currentPayPeriod.startDate)}
                        {" ~ "}
                        {formatDisplayDate(currentPayPeriod.endDate)}
                    </p>

                    {currentPeriodSchedules.length === 0 ? (
                        <div>
                            <p className="mt-5 text-lg font-bold text-gray-900">근무 기록을 입력해주세요</p>

                            <p className="mt-1 text-sm text-gray-500">근무 기록이 있어야 예상 급여를 계산할 수 있어요.</p>
                        </div>
                    ) : (
                        <>
                            <p className="mt-5 text-xs text-gray-400">예상 급여</p>

                            <p className="mt-1 text-2xl font-bold text-gray-900">{formatMoney(currentPeriodEstimate.netPay)}</p>

                            <div className="mt-3 flex items-center gap-3 text-sm text-gray-500">
                                <span>{currentPeriodEstimate.hours.toFixed(1)}시간</span>
                                <span>·</span>
                                <span>
                                    팁 {formatMoney(currentPeriodEstimate.cashTips + currentPeriodEstimate.paychequeTips)}
                                </span>
                            </div>
                        </>
                    )}

                    <Link
                        href="/salary/schedule"
                        className="mt-5 block w-full rounded-2xl bg-gray-900 px-4 py-3 text-center text-sm font-semibold text-white transition hover:bg-gray-800"
                    >
                        {currentPeriodSchedules.length === 0 ? "근무 기록 입력하기" : "근무 기록 추가하기"}
                    </Link>
                </div>
            )}

            {/* --------------------------------------------------
                Actual Net Pay Statistics
            -------------------------------------------------- */}

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

                <p className="mt-2 text-3xl font-bold">{averageActualNetPay !== null ? formatMoney(averageActualNetPay) : "-"}</p>

                {graphPayHistory.length > 0 ? (
                    <div className="mt-8">
                        <div className="relative h-48 w-full">
                            {(() => {
                                const values = graphPayHistory.map((point) => point.value);

                                const allValues = [...values, ...(averageActualNetPay !== null ? [averageActualNetPay] : [])];

                                const minValue = Math.min(...allValues);

                                const maxValue = Math.max(...allValues);

                                const range = Math.max(maxValue - minValue, 1);

                                const width = 320;
                                const height = 150;
                                const paddingX = 16;
                                const paddingY = 16;

                                const points = graphPayHistory.map((point, index) => {
                                    const x =
                                        graphPayHistory.length === 1
                                            ? width / 2
                                            : paddingX + (index / (graphPayHistory.length - 1)) * (width - paddingX * 2);

                                    const y = height - paddingY - ((point.value - minValue) / range) * (height - paddingY * 2);

                                    return {
                                        ...point,
                                        x,
                                        y,
                                    };
                                });

                                const linePoints = points.map((point) => `${point.x},${point.y}`).join(" ");

                                const averageY =
                                    averageActualNetPay !== null
                                        ? height - paddingY - ((averageActualNetPay - minValue) / range) * (height - paddingY * 2)
                                        : null;

                                return (
                                    <svg viewBox={`0 0 ${width} ${height}`} className="h-full w-full overflow-visible">
                                        {averageY !== null && (
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
                                        )}

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
                                                key={`${point.startDate}-${point.endDate}`}
                                                className={point.isEstimate ? "" : "cursor-pointer"}
                                                onMouseEnter={() => {
                                                    if (point.isEstimate) {
                                                        setHoveredGraphPoint(point);
                                                    }
                                                }}
                                                onMouseLeave={() => {
                                                    if (point.isEstimate) {
                                                        setHoveredGraphPoint(null);
                                                    }
                                                }}
                                                onClick={() => {
                                                    if (point.isEstimate) {
                                                        return;
                                                    }

                                                    if (point.history) {
                                                        setSelectedPayHistory(point.history);
                                                    }
                                                }}
                                            >
                                                {/*
                                                 * 클릭/hover 영역
                                                 *
                                                 * 예상점도 hover는 가능하지만
                                                 * 클릭은 아래 onClick에서 차단.
                                                 */}
                                                <circle cx={point.x} cy={point.y} r="12" fill="transparent" />

                                                {/*
                                                 * 실제값:
                                                 * 검은색
                                                 *
                                                 * 예상값:
                                                 * 파란색
                                                 */}
                                                <circle
                                                    cx={point.x}
                                                    cy={point.y}
                                                    r="4"
                                                    className={point.isEstimate ? "fill-blue-500" : "fill-gray-900"}
                                                />

                                                {/*
                                                 * 예상값 hover
                                                 *
                                                 * "예상 $XXX.XX"
                                                 */}
                                                {point.isEstimate &&
                                                    hoveredGraphPoint?.startDate === point.startDate &&
                                                    hoveredGraphPoint?.endDate === point.endDate && (
                                                        <foreignObject
                                                            x={point.x - 60}
                                                            y={point.y - 48}
                                                            width="120"
                                                            height="42"
                                                            pointerEvents="none"
                                                        >
                                                            <div className="flex justify-center">
                                                                <div className="rounded-lg bg-gray-900 px-2.5 py-1.5 text-center text-[10px] text-white shadow-md">
                                                                    <div className="font-semibold">
                                                                        예상 {formatMoney(point.value)}
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </foreignObject>
                                                    )}
                                            </g>
                                        ))}
                                    </svg>
                                );
                            })()}
                        </div>

                        <div className="mt-2 flex justify-between text-[10px] text-gray-400">
                            {graphPayHistory.map((point) => (
                                <span
                                    key={`${point.startDate}-${point.endDate}`}
                                    className={point.isEstimate ? "font-medium text-blue-500" : ""}
                                >
                                    {point.payDate ? formatDisplayDate(point.payDate) : "예정"}
                                </span>
                            ))}
                        </div>

                        <div className="mt-4 flex items-center justify-end gap-2 text-xs text-gray-400">
                            <span className="h-px w-5 border-t border-dashed border-gray-300" />
                            평균
                        </div>
                    </div>
                ) : (
                    <div className="mt-6 rounded-2xl bg-gray-100 p-4 text-sm text-gray-500">
                        아직 기록된 실수령액이 없어요.
                        <br />
                        급여 기록에서 실수령액을 기록하면 통계가 보여요.
                    </div>
                )}
            </section>

            {/* --------------------------------------------------
                Pending Expected Salary Modal
            -------------------------------------------------- */}

            {isPendingExpectedOpen && pendingPayPeriod && (
                <div
                    className="fixed inset-0 z-[60] flex items-end justify-center bg-gray-900/30 p-3 backdrop-blur-sm sm:items-center"
                    onClick={() => setIsPendingExpectedOpen(false)}
                >
                    <div
                        className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-[2rem] bg-white p-6 shadow-2xl"
                        onClick={(event) => event.stopPropagation()}
                    >
                        {/* Header */}
                        <div className="flex items-start justify-between">
                            <div>
                                <div className="flex items-center gap-2">
                                    <span className="rounded-full bg-blue-50 px-2.5 py-1 text-[11px] font-semibold text-blue-600">
                                        예상
                                    </span>

                                    <span className="text-xs text-gray-400">{getDdayLabel(pendingPayPeriod.payDate)}</span>
                                </div>

                                <p className="mt-3 text-lg font-bold text-gray-900">지급 예정 급여</p>

                                <p className="mt-1 text-sm text-gray-500">
                                    {formatDisplayDate(pendingPayPeriod.startDate)}
                                    {" ~ "}
                                    {formatDisplayDate(pendingPayPeriod.endDate)}
                                </p>
                            </div>

                            <button
                                type="button"
                                onClick={() => setIsPendingExpectedOpen(false)}
                                className="flex h-9 w-9 items-center justify-center rounded-full bg-gray-100 text-lg text-gray-500 transition hover:bg-gray-200"
                                aria-label="닫기"
                            >
                                ×
                            </button>
                        </div>

                        {/* Main Amount */}
                        <div className="mt-6 rounded-3xl bg-blue-50 p-5">
                            <p className="text-xs font-medium text-blue-500">예상 실수령액</p>

                            <p className="mt-2 text-4xl font-bold tracking-tight text-gray-900">
                                {formatMoney(pendingPeriodEstimate.netPay)}
                            </p>

                            <div className="mt-4 flex items-center justify-between">
                                <span className="text-sm text-gray-500">지급일</span>

                                <span className="text-sm font-semibold text-gray-900">
                                    {formatDisplayDate(pendingPayPeriod.payDate)}
                                </span>
                            </div>
                        </div>

                        {/* Breakdown */}
                        <div className="mt-6">
                            <p className="mb-3 text-xs font-semibold text-gray-400">예상 급여 내역</p>

                            <div className="rounded-3xl bg-gray-50 p-5">
                                <div className="space-y-4 text-sm">
                                    <div className="flex justify-between">
                                        <span className="text-gray-500">근무시간</span>

                                        <span className="font-medium text-gray-900">
                                            {pendingPeriodEstimate.hours.toFixed(2)}시간
                                        </span>
                                    </div>

                                    <div className="flex justify-between">
                                        <span className="text-gray-500">기본 급여</span>

                                        <span className="font-medium text-gray-900">
                                            {formatMoney(pendingPeriodEstimate.basePay)}
                                        </span>
                                    </div>

                                    {pendingPeriodEstimate.paychequeTips > 0 && (
                                        <div className="flex justify-between">
                                            <span className="text-gray-500">급여 포함 팁</span>

                                            <span className="font-medium text-gray-900">
                                                {formatMoney(pendingPeriodEstimate.paychequeTips)}
                                            </span>
                                        </div>
                                    )}

                                    {pendingPeriodEstimate.holidayPay > 0 && (
                                        <div className="flex justify-between">
                                            <span className="text-gray-500">Holiday Pay</span>

                                            <span className="font-medium text-gray-900">
                                                {formatMoney(pendingPeriodEstimate.holidayPay)}
                                            </span>
                                        </div>
                                    )}

                                    <div className="flex justify-between">
                                        <span className="text-gray-500">Vacation Pay</span>

                                        <span className="font-medium text-gray-900">
                                            {formatMoney(pendingPeriodEstimate.vacationPay)}
                                        </span>
                                    </div>

                                    <div className="my-1 border-t border-gray-200" />

                                    <div className="flex justify-between">
                                        <span className="font-medium text-gray-600">세전 급여</span>

                                        <span className="font-semibold text-gray-900">
                                            {formatMoney(pendingPeriodEstimate.grossPay)}
                                        </span>
                                    </div>

                                    <div className="flex justify-between">
                                        <span className="text-gray-500">예상 공제</span>

                                        <span className="text-gray-600">- {formatMoney(pendingPeriodEstimate.deductions)}</span>
                                    </div>

                                    <div className="my-1 border-t border-gray-200" />

                                    <div className="flex justify-between">
                                        <span className="font-semibold text-gray-900">실수령액</span>

                                        <span className="font-bold text-gray-900">
                                            {formatMoney(pendingPeriodEstimate.netPay)}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Cash Tips */}
                        {pendingPeriodEstimate.cashTips > 0 && (
                            <div className="mt-4 rounded-3xl bg-gray-50 p-5">
                                <div className="flex justify-between">
                                    <span className="text-sm text-gray-500">현금 팁</span>

                                    <span className="text-sm font-semibold text-gray-900">
                                        {formatMoney(pendingPeriodEstimate.cashTips)}
                                    </span>
                                </div>

                                <div className="mt-4 flex items-center justify-between rounded-2xl bg-white p-4 shadow-sm">
                                    <span className="text-sm font-semibold text-gray-700">예상 총 수령액</span>

                                    <span className="text-xl font-bold text-gray-900">
                                        {formatMoney(pendingPeriodEstimate.totalIncome)}
                                    </span>
                                </div>
                            </div>
                        )}

                        {/* Notice */}
                        <div className="mt-5 rounded-2xl bg-amber-50 px-4 py-3">
                            <p className="text-xs leading-5 text-amber-700">
                                실제 급여가 아직 기록되지 않아 이전 근무 기록과 팁을 기준으로 계산한 예상 금액이에요.
                            </p>
                        </div>

                        {/* Button */}
                        <Link
                            href="/salary/schedule"
                            className="mt-5 block w-full rounded-2xl bg-gray-900 py-4 text-center text-sm font-semibold text-white transition hover:bg-gray-800"
                        >
                            근무 기록 보기
                        </Link>
                    </div>
                </div>
            )}

            {/* --------------------------------------------------
                Actual Net Pay Detail Modal
            -------------------------------------------------- */}

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

                                {selectedPayHistory.payDate && (
                                    <p className="mt-1 text-xs text-gray-500">
                                        지급일 {formatDisplayDate(selectedPayHistory.payDate)}
                                    </p>
                                )}
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
                                    {Number(selectedPayHistory.hours ?? 0).toFixed(2)}
                                    시간
                                </span>
                            </div>

                            <div className="flex justify-between">
                                <span className="text-gray-400">실제 급여</span>

                                <span>{formatMoney(Number(selectedPayHistory.actualPay ?? selectedPayHistory.pay ?? 0))}</span>
                            </div>

                            {selectedPayHistory.actualTips > 0 && (
                                <div className="flex justify-between">
                                    <span className="text-gray-400">실제 팁</span>

                                    <span>{formatMoney(Number(selectedPayHistory.actualTips ?? 0))}</span>
                                </div>
                            )}

                            {selectedPayHistory.paychequeTips > 0 && (
                                <div className="flex justify-between">
                                    <span className="text-gray-400">급여 포함 팁</span>

                                    <span>{formatMoney(Number(selectedPayHistory.paychequeTips ?? 0))}</span>
                                </div>
                            )}

                            {selectedPayHistory.cashTips > 0 && (
                                <div className="flex justify-between">
                                    <span className="text-gray-400">현금 팁</span>

                                    <span>{formatMoney(Number(selectedPayHistory.cashTips ?? 0))}</span>
                                </div>
                            )}

                            {Number(selectedPayHistory.actualPay ?? 0) + Number(selectedPayHistory.actualTips ?? 0) > 0 && (
                                <div className="mt-4 border-t border-gray-800 pt-4">
                                    <div className="flex justify-between">
                                        <span className="text-gray-300">실제 세전 금액</span>

                                        <span className="font-semibold">
                                            {formatMoney(
                                                Number(selectedPayHistory.actualPay ?? 0) +
                                                    Number(selectedPayHistory.actualTips ?? 0),
                                            )}
                                        </span>
                                    </div>
                                </div>
                            )}

                            {selectedPayHistory.actualDeductions > 0 && (
                                <div className="flex justify-between">
                                    <span className="text-gray-400">실제 공제</span>

                                    <span>- {formatMoney(Number(selectedPayHistory.actualDeductions ?? 0))}</span>
                                </div>
                            )}

                            {selectedPayHistory.adjustments.length > 0 && (
                                <div className="mt-4 border-t border-gray-800 pt-4">
                                    <p className="mb-3 text-xs text-gray-500">조정 내역</p>

                                    <div className="space-y-2">
                                        {selectedPayHistory.adjustments.map((adjustment, index) => (
                                            <div key={`${adjustment.name}-${index}`} className="flex justify-between">
                                                <span className="text-gray-400">{adjustment.name}</span>

                                                <span className={adjustment.type === "add" ? "text-green-400" : "text-red-400"}>
                                                    {adjustment.type === "add" ? "+" : "-"}
                                                    {formatMoney(Number(adjustment.amount ?? 0))}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            <div className="mt-4 border-t border-gray-800 pt-4">
                                <div className="flex justify-between">
                                    <span className="text-gray-300">실제 실수령액</span>

                                    <span className="font-semibold">
                                        {formatMoney(Number(selectedPayHistory.actualNetPay ?? 0))}
                                    </span>
                                </div>
                            </div>

                            {selectedPayHistory.cashTips > 0 && (
                                <div className="mt-4">
                                    <div className="flex justify-between rounded-2xl bg-white p-3 text-black">
                                        <span className="text-sm font-medium">총 수령액</span>

                                        <span className="text-lg font-bold">
                                            {formatMoney(
                                                Number(selectedPayHistory.actualNetPay ?? 0) +
                                                    Number(selectedPayHistory.cashTips ?? 0),
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
        </div>
    );
}
