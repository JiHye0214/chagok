"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { getPayPeriodEndDate, getPeriodsPerYear, formatDate } from "@/lib/payPeriod";
import { getNotificationTime, subscribeToPush } from "@/lib/notification";
import { calculateTaxes } from "@/lib/tax";
import { isHoliday, getHolidaysInPayPeriod } from "@/lib/holiday";

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
    alarmEnabled: boolean;
    alarmMinutesBefore: number;
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
    netPay: number;
};

type Holiday = {
    date: string;
    name: string;
    global: boolean;
};

const WEEK_DAYS = ["일", "월", "화", "수", "목", "금", "토"];

const formatDisplayDate = (dateString: string) => {
    if (!dateString) {
        return "";
    }

    const [year, month, day] = dateString.slice(0, 10).split("-").map(Number);

    if (!year || !month || !day) {
        return dateString;
    }

    return `${year}. ${month}. ${day}.`;
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

const shiftPayPeriod = (
    startDate: string,
    payDate: string,
    frequency: PayFrequency,
    semiMonthlyType?: SemiMonthlyType,
    customPayDays?: number,
): PayPeriod => {
    const currentEndDate = getPayPeriodEndDate(startDate, frequency, semiMonthlyType, customPayDays);

    const nextStart = new Date(`${currentEndDate}T00:00:00`);

    // 이전 급여기간 종료일의 다음 날
    nextStart.setDate(nextStart.getDate() + 1);

    const nextStartDate = formatISO(nextStart);

    // 급여일도 다음 기간으로 이동
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

export default function SchedulePage() {
    const router = useRouter();
    /*
     * --------------------------------------------------
     * Calendar
     * --------------------------------------------------
     */

    const [currentDate, setCurrentDate] = useState(() => new Date(2026, 7, 1));

    const year = currentDate.getFullYear();

    const month = currentDate.getMonth();

    /*
     * --------------------------------------------------
     * Schedules
     * --------------------------------------------------
     */

    const [schedules, setSchedules] = useState<WorkSchedule[]>([]);
    const [isSchedulesLoading, setIsSchedulesLoading] = useState(true);

    const [holidays, setHolidays] = useState<Holiday[]>([]);

    /*
     * --------------------------------------------------
     * Modal
     * --------------------------------------------------
     */

    const [isAddModalOpen, setIsAddModalOpen] = useState(false);

    const [editingSchedule, setEditingSchedule] = useState<WorkSchedule | null>(null);

    const [selectedDate, setSelectedDate] = useState<string | null>(null);

    const [startTime, setStartTime] = useState("09:00");

    const [endTime, setEndTime] = useState("17:00");

    const [hasBreak, setHasBreak] = useState(false);

    const [breakMinutes, setBreakMinutes] = useState("0");

    const [alarmEnabled, setAlarmEnabled] = useState(false);

    const [alarmMinutesBefore, setAlarmMinutesBefore] = useState(60);

    const [defaultBreak, setDefaultBreak] = useState<{
        enabled: boolean;
        minutes: number;
    }>(() => {
        if (typeof window === "undefined") {
            return {
                enabled: false,
                minutes: 0,
            };
        }

        try {
            const saved = localStorage.getItem("chagok-default-break");

            if (!saved) {
                return {
                    enabled: false,
                    minutes: 0,
                };
            }

            return JSON.parse(saved);
        } catch {
            return {
                enabled: false,
                minutes: 0,
            };
        }
    });

    const [isDefaultBreakConfirmOpen, setIsDefaultBreakConfirmOpen] = useState(false);

    const [cashTips, setCashTips] = useState("");
    const [paychequeTips, setPaychequeTips] = useState("");
    const [savedTips, setSavedTips] = useState<PayPeriodTips | null>(null);

    const [showAllSchedules, setShowAllSchedules] = useState(false);

    const [salarySettings, setSalarySettings] = useState<SalarySettings | null>(null);

    const [previousPay, setPreviousPay] = useState<number | null>(null);

    const [latestPayHistory, setLatestPayHistory] = useState<{
        startDate: string;
        endDate: string;
        totalIncome: number;
        isConfirmed: boolean;
    } | null>(null);

    const [showHolidayInfo, setShowHolidayInfo] = useState(false);

    /*
     * --------------------------------------------------
     * Salary Settings
     * --------------------------------------------------
     */

    const hourlyWage = salarySettings?.payType === "hourly" ? Number(salarySettings.hourlyWage ?? 0) : 0;

    const monthlySalary = salarySettings?.payType === "salary" ? Number(salarySettings.monthlySalary ?? 0) : 0;

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

    useEffect(() => {
        if (!salarySettings?.province) {
            return;
        }

        const loadHolidays = async () => {
            try {
                const response = await fetch(`/api/holidays?year=${year}&province=${salarySettings.province}`);

                if (!response.ok) {
                    throw new Error("공휴일 조회 실패");
                }

                const data: Holiday[] = await response.json();

                setHolidays(data);
            } catch (error) {
                console.error("공휴일 조회 실패:", error);
                setHolidays([]);
            }
        };

        loadHolidays();
    }, [year, salarySettings?.province]);

    const getCurrentPayPeriod = (): PayPeriod | null => {
        if (!salarySettings?.payPeriodStartDate || !salarySettings?.payDate) {
            return null;
        }

        let period: PayPeriod = {
            startDate: salarySettings.payPeriodStartDate,
            endDate: getPayPeriodEndDate(
                salarySettings.payPeriodStartDate,
                salarySettings.payFrequency,
                salarySettings.semiMonthlyType,
                salarySettings.customPayDays,
            ),
            payDate: salarySettings.payDate,
        };

        const today = new Date();

        const todayOnly = new Date(today.getFullYear(), today.getMonth(), today.getDate());

        let periodEnd = new Date(`${period.endDate}T00:00:00`);

        while (periodEnd < todayOnly) {
            period = shiftPayPeriod(
                period.startDate,
                period.payDate,
                salarySettings.payFrequency,
                salarySettings.semiMonthlyType,
                salarySettings.customPayDays,
            );

            periodEnd = new Date(`${period.endDate}T00:00:00`);
        }

        return period;
    };

    const currentPayPeriod = getCurrentPayPeriod();

    const holidaysInCurrentPayPeriod = currentPayPeriod
        ? getHolidaysInPayPeriod(currentPayPeriod.startDate, currentPayPeriod.endDate, holidays)
        : [];

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

    useEffect(() => {
        const loadLatestPayHistory = async () => {
            try {
                const response = await fetch("/api/pay-history");

                if (!response.ok) {
                    return;
                }

                const data = await response.json();

                if (data.length > 0) {
                    setLatestPayHistory(data[0]);
                }
            } catch (error) {
                console.error("급여 기록 조회 실패:", error);
            }
        };

        loadLatestPayHistory();
    }, []);

    /*
     * --------------------------------------------------
     * Calendar Days
     * --------------------------------------------------
     */

    const calendarDays = useMemo(() => {
        const firstDay = new Date(year, month, 1).getDay();

        const daysInMonth = new Date(year, month + 1, 0).getDate();

        const days: (number | null)[] = [];

        for (let i = 0; i < firstDay; i++) {
            days.push(null);
        }

        for (let day = 1; day <= daysInMonth; day++) {
            days.push(day);
        }

        return days;
    }, [year, month]);

    /*
     * --------------------------------------------------
     * Open Add Modal
     * --------------------------------------------------
     */

    const openAddModal = (date: string) => {
        setEditingSchedule(null);

        setSelectedDate(date);

        setStartTime("09:00");
        setEndTime("17:00");

        setHasBreak(defaultBreak.enabled);
        setBreakMinutes(defaultBreak.enabled ? String(defaultBreak.minutes) : "0");

        setAlarmEnabled(false);
        setAlarmMinutesBefore(60);

        setIsAddModalOpen(true);
    };

    /*
     * --------------------------------------------------
     * Open Edit Modal
     * --------------------------------------------------
     */

    const openEditModal = (schedule: WorkSchedule) => {
        setEditingSchedule(schedule);

        setSelectedDate(schedule.date.slice(0, 10));

        setStartTime(schedule.startTime);

        setEndTime(schedule.endTime);

        setHasBreak(schedule.hasBreak ?? false);

        setBreakMinutes(String(schedule.breakMinutes ?? 0));

        setAlarmEnabled(schedule.alarmEnabled);

        setAlarmMinutesBefore(schedule.alarmMinutesBefore);

        setIsAddModalOpen(true);
    };

    /*
     * --------------------------------------------------
     * Save Schedule
     * --------------------------------------------------
     */

    const saveSchedule = async (breakSetting: { enabled: boolean; minutes: number }) => {
        if (!selectedDate) {
            return;
        }

        const schedule = {
            date: selectedDate,
            startTime,
            endTime,
            hasBreak: breakSetting.enabled,
            breakMinutes: breakSetting.enabled ? breakSetting.minutes : 0,
            alarmEnabled,
            alarmMinutesBefore,
        };

        if (alarmEnabled) {
            const notificationTime = getNotificationTime(selectedDate, startTime, alarmMinutesBefore);

            if (notificationTime) {
                const delay = notificationTime.getTime() - Date.now();

                console.log("알림 예정 시간:", notificationTime);
                console.log("알림까지 남은 시간:", delay);

                if (delay > 0) {
                    setTimeout(() => {
                        new Notification("차곡", {
                            body: `오늘 ${startTime.slice(0, 5)}에 근무가 있어요.`,
                        });
                    }, delay);
                }
            }
        }

        try {
            const response = await fetch("/api/work-schedules", {
                method: editingSchedule ? "PUT" : "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(
                    editingSchedule
                        ? {
                              id: editingSchedule.id,
                              ...schedule,
                          }
                        : schedule,
                ),
            });

            if (!response.ok) {
                throw new Error("근무 저장 실패");
            }

            const savedSchedule: WorkSchedule = await response.json();

            setSchedules((prev) =>
                editingSchedule
                    ? prev.map((item) => (item.id === savedSchedule.id ? savedSchedule : item))
                    : [...prev, savedSchedule],
            );

            setIsAddModalOpen(false);
            setEditingSchedule(null);
        } catch (error) {
            console.error(error);
            alert("근무 저장에 실패했어요.");
        }
    };

    const handleSaveSchedule = () => {
        if (!selectedDate) {
            return;
        }

        const currentBreakMinutes = hasBreak ? Math.max(0, Number(breakMinutes) || 0) : 0;

        // 현재 근무의 휴게 설정
        const currentBreak = {
            enabled: hasBreak,
            minutes: currentBreakMinutes,
        };

        // 기본값과 이번 근무 설정이 다른지 확인
        const breakChanged =
            currentBreak.enabled !== defaultBreak.enabled ||
            (currentBreak.enabled && currentBreak.minutes !== defaultBreak.minutes);

        // 휴게 설정이 기본값과 다르면 확인 팝업
        if (breakChanged) {
            setIsDefaultBreakConfirmOpen(true);
            return;
        }

        // 변경사항이 없으면 바로 저장
        saveSchedule(currentBreak);
    };

    const saveAsDefaultBreak = () => {
        const currentBreakMinutes = hasBreak ? Math.max(0, Number(breakMinutes) || 0) : 0;

        const newDefaultBreak = {
            enabled: hasBreak,
            minutes: currentBreakMinutes,
        };

        localStorage.setItem("chagok-default-break", JSON.stringify(newDefaultBreak));

        setDefaultBreak(newDefaultBreak);

        setIsDefaultBreakConfirmOpen(false);

        saveSchedule(newDefaultBreak);
    };

    const useBreakOnce = () => {
        const currentBreakMinutes = hasBreak ? Math.max(0, Number(breakMinutes) || 0) : 0;

        setIsDefaultBreakConfirmOpen(false);

        saveSchedule({
            enabled: hasBreak,
            minutes: currentBreakMinutes,
        });
    };

    /*
     * --------------------------------------------------
     * Delete Schedule
     * --------------------------------------------------
     */

    const handleDeleteSchedule = async () => {
        if (!editingSchedule) {
            return;
        }

        try {
            const response = await fetch("/api/work-schedules", {
                method: "DELETE",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    id: editingSchedule.id,
                }),
            });

            if (!response.ok) {
                throw new Error("근무 삭제 실패");
            }

            setSchedules((prev) => prev.filter((item) => item.id !== editingSchedule.id));

            setIsAddModalOpen(false);
            setEditingSchedule(null);
        } catch (error) {
            console.error(error);
            alert("근무 삭제에 실패했어요.");
        }
    };

    /*
     * --------------------------------------------------
     * Pay Period Salary Calculation
     * --------------------------------------------------
     */

    const periodSchedules = currentPayPeriod
        ? schedules.filter((schedule) => {
              const scheduleDate = schedule.date;

              return scheduleDate >= currentPayPeriod.startDate && scheduleDate <= currentPayPeriod.endDate;
          })
        : [];

    const periodHours = periodSchedules.reduce(
        (total, schedule) =>
            total + calculateHours(schedule.startTime, schedule.endTime, schedule.hasBreak ? schedule.breakMinutes : 0),
        0,
    );

    const periodPaychequeTips = savedTips?.paychequeTips ?? 0;

    const periodCashTips = savedTips?.cashTips ?? 0;

    const estimatedBasePay =
        salarySettings?.payType === "hourly"
            ? periodHours * hourlyWage
            : salarySettings?.payType === "salary"
              ? Number(salarySettings.monthlySalary ?? 0)
              : 0;

    const periodHolidays = currentPayPeriod
        ? holidays.filter((holiday) => holiday.date >= currentPayPeriod.startDate && holiday.date <= currentPayPeriod.endDate)
        : [];

    const holidaySchedules = periodSchedules.filter((schedule) => {
        return isHoliday(schedule.date, holidays);
    });

    const holidayHours = holidaySchedules.reduce(
        (total, schedule) =>
            total + calculateHours(schedule.startTime, schedule.endTime, schedule.hasBreak ? schedule.breakMinutes : 0),
        0,
    );

    const holidayPay = salarySettings?.payType === "hourly" ? holidayHours * hourlyWage * 0.5 : 0;

    // 급여 포함 팁이 있을 때만 세전 급여에 포함
    const hasPaychequeTips =
        salarySettings?.hasTips && (salarySettings.tipType === "paycheque" || salarySettings.tipType === "both");

    const vacationPayRate = Number(salarySettings?.vacationPayRate ?? 4);

    const estimatedVacationPay = estimatedBasePay * (vacationPayRate / 100);

    const taxableGrossPay = estimatedBasePay + holidayPay + estimatedVacationPay + (hasPaychequeTips ? periodPaychequeTips : 0);

    // 세금 계산
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

    const payDifference = previousPay !== null ? estimatedNetPay - previousPay : null;

    const payChangePercent = previousPay !== null && previousPay !== 0 ? (payDifference! / previousPay) * 100 : null;

    // 현금 팁이 있을 때만 세후 금액에 추가
    const hasCashTips = salarySettings?.hasTips && (salarySettings.tipType === "cash" || salarySettings.tipType === "both");

    const actualCashTips = hasCashTips ? periodCashTips : 0;

    const finalEstimatedIncome = estimatedNetPay + actualCashTips;

    useEffect(() => {
        const loadPreviousPay = async () => {
            try {
                const response = await fetch("/api/pay-history");

                if (!response.ok) {
                    return;
                }

                const data: PayHistory[] = await response.json();

                if (data.length > 0) {
                    setPreviousPay(data[0].netPay);
                }
            } catch (error) {
                console.error(error);
            }
        };

        loadPreviousPay();
    }, []);

    /*
     * --------------------------------------------------
     * This Month Schedules
     * --------------------------------------------------
     */

    const currentMonthSchedules = schedules
        .filter((schedule) => {
            const [scheduleYear, scheduleMonth] = schedule.date.split("-").map(Number);

            return scheduleYear === year && scheduleMonth === month + 1;
        })
        .sort((a, b) => a.date.localeCompare(b.date));

    /*
     * --------------------------------------------------
     * Loading...
     * --------------------------------------------------
     */

    if (isSchedulesLoading) {
        return (
            <main className="min-h-screen bg-gray-50 px-5 py-8">
                <div className="mx-auto max-w-md">
                    <p className="text-sm text-gray-400">근무 기록을 불러오는 중...</p>
                </div>
            </main>
        );
    }

    /*
     * --------------------------------------------------
     * Render
     * --------------------------------------------------
     */

    return (
        <main className="min-h-screen bg-gray-50 px-5 py-8">
            <div className="mx-auto max-w-md pb-24">
                {/* Header */}

                <header>
                    <p className="text-sm text-gray-500">차곡</p>

                    <div className="mt-2 flex items-center justify-between">
                        <h1 className="text-3xl font-bold">근무 관리</h1>

                        <Link
                            href="/salary/settings"
                            className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-gray-500 shadow-sm"
                            aria-label="급여 설정"
                        >
                            ⚙
                        </Link>
                    </div>

                    <p className="mt-2 text-sm text-gray-500">근무 일정을 등록하고 예상 급여를 확인해보세요.</p>
                </header>

                {latestPayHistory && !latestPayHistory.isConfirmed && (
                    <button
                        type="button"
                        onClick={() => router.push("/salary/pay-history")}
                        className="mt-5 flex w-full items-center justify-between rounded-2xl bg-black px-4 py-4 text-left text-white shadow-sm transition hover:shadow-md"
                    >
                        <div>
                            <p className="text-xs text-gray-400">급여 확인</p>

                            <p className="mt-1 text-sm font-semibold">지난번에 이만큼 받으셨나요?</p>

                            <p className="mt-1 text-lg font-bold">${latestPayHistory.totalIncome.toFixed(2)}</p>
                        </div>

                        <span className="ml-4 shrink-0 text-xs text-gray-400">확인하기 →</span>
                    </button>
                )}

                {/* Pay Period Notice */}
                {currentPayPeriod && (
                    <section className="mt-5 rounded-3xl bg-white px-5 py-4 shadow-sm">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-xs text-gray-400">현재 급여 기간</p>

                                <p className="mt-1 text-sm font-semibold">
                                    {formatDisplayDate(currentPayPeriod.startDate)}
                                    {" ~ "}
                                    {formatDisplayDate(currentPayPeriod.endDate)}
                                </p>
                            </div>

                            <div className="text-right">
                                <p className="text-xs text-gray-400">급여일</p>

                                <p className="mt-1 text-sm font-semibold">{formatDisplayDate(currentPayPeriod.payDate)}</p>
                            </div>
                        </div>
                    </section>
                )}

                {/* Expected Salary */}

                <section className="mt-6 rounded-3xl bg-black p-6 text-white shadow-sm">
                    <p className="text-sm text-gray-400">예상 급여</p>

                    <div className="mt-2 flex items-start gap-2">
                        <p className="text-4xl font-bold">${estimatedNetPay.toFixed(2)}</p>

                        {payDifference !== null && payChangePercent !== null && (
                            <div className={`mb-1 text-xs font-medium ${payDifference >= 0 ? "text-green-400" : "text-red-400"}`}>
                                {payDifference >= 0 ? "↑" : "↓"} {Math.abs(payChangePercent).toFixed(1)}%
                                <span className="ml-1">
                                    {payDifference >= 0 ? "+" : "-"}${Math.abs(payDifference).toFixed(2)}
                                </span>
                            </div>
                        )}
                    </div>

                    <div className="mt-6 space-y-3 text-sm">
                        {/* 근무시간 */}
                        <div className="flex justify-between">
                            <span className="text-gray-400">근무시간</span>

                            <span>{periodHours.toFixed(2)}시간</span>
                        </div>

                        {/* 기본 급여 */}
                        <div className="flex justify-between">
                            <span className="text-gray-400">기본 급여</span>

                            <span>${estimatedBasePay.toFixed(2)}</span>
                        </div>

                        {/* 급여 포함 팁 */}
                        {salarySettings?.hasTips &&
                            (salarySettings.tipType === "paycheque" || salarySettings.tipType === "both") && (
                                <div className="flex justify-between">
                                    <span className="text-gray-400">급여 포함 팁</span>

                                    <span>${periodPaychequeTips.toFixed(2)}</span>
                                </div>
                            )}

                        {/* Holiday Pay */}
                        {holidaySchedules.length > 0 && (
                            <div className="flex justify-between">
                                <span className="text-gray-400">Holiday Pay</span>

                                <span>${holidayPay.toFixed(2)}</span>
                            </div>
                        )}

                        {/* Vacation Pay */}
                        <div className="flex justify-between">
                            <span className="text-gray-400">Vacation Pay ({vacationPayRate}%)</span>

                            <span>${estimatedVacationPay.toFixed(2)}</span>
                        </div>

                        {/* 세전 급여 */}
                        <div className="mt-4 border-t border-gray-800 pt-4">
                            <div className="flex justify-between">
                                <span className="text-gray-300">세전 급여</span>

                                <span className="font-semibold">${taxableGrossPay.toFixed(2)}</span>
                            </div>
                        </div>

                        {/* 예상 공제 */}
                        <div className="flex justify-between">
                            <span className="text-gray-400">예상 공제</span>

                            <span>-${payrollDeductions.totalDeductions.toFixed(2)}</span>
                        </div>

                        {/* 실수령 급여 */}
                        <div className="flex justify-between">
                            <span className="text-gray-300">실수령 급여</span>

                            <span className="font-semibold">${estimatedNetPay.toFixed(2)}</span>
                        </div>

                        {/* 현금 팁 */}
                        {hasCashTips && (
                            <div className="mt-4 border-t border-gray-800 pt-4">
                                <div className="flex justify-between">
                                    <span className="text-gray-400">현금 팁</span>

                                    <span>${periodCashTips.toFixed(2)}</span>
                                </div>
                            </div>
                        )}

                        {/* 최종 총액 */}
                        <div className="flex items-center justify-between rounded-2xl bg-white p-3 my-6 text-black">
                            <span className="text-sm font-medium">{hasCashTips ? "예상 총 수령액" : "예상 실수령액"}</span>

                            <span className="text-xl font-bold">
                                ${(hasCashTips ? finalEstimatedIncome : estimatedNetPay).toFixed(2)}
                            </span>
                        </div>
                    </div>

                    {/* 공제 상세 */}
                    <div className="mt-5 rounded-2xl bg-white/5 p-4">
                        <p className="text-xs font-medium text-gray-300">예상 공제 내역</p>

                        <div className="mt-3 space-y-2 text-xs">
                            <div className="flex justify-between">
                                <span className="text-gray-500">CPP</span>
                                <span className="text-gray-300">-${payrollDeductions.cpp.toFixed(2)}</span>
                            </div>

                            <div className="flex justify-between">
                                <span className="text-gray-500">CPP2</span>
                                <span className="text-gray-300">-${payrollDeductions.cpp2.toFixed(2)}</span>
                            </div>

                            <div className="flex justify-between">
                                <span className="text-gray-500">EI</span>
                                <span className="text-gray-300">-${payrollDeductions.ei.toFixed(2)}</span>
                            </div>

                            <div className="flex justify-between">
                                <span className="text-gray-500">연방 소득세</span>
                                <span className="text-gray-300">-${payrollDeductions.federalTax.toFixed(2)}</span>
                            </div>

                            <div className="flex justify-between">
                                <span className="text-gray-500">{taxes.provinceName} 소득세</span>

                                <span className="text-gray-300">-${payrollDeductions.provincialTax.toFixed(2)}</span>
                            </div>

                            <div className="mt-3 border-t border-white/10 pt-3">
                                <div className="flex justify-between">
                                    <span className="text-gray-300">총 공제</span>

                                    <span className="font-medium text-white">
                                        -${payrollDeductions.totalDeductions.toFixed(2)}
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

                    <Link
                        href="/salary/pay-history"
                        className="mt-3 block w-full text-right text-xs text-gray-400 transition hover:text-gray-600"
                    >
                        급여 기록을 확인해보세요 →
                    </Link>
                </section>

                {/* Pay Period Tips */}

                {currentPayPeriod && salarySettings?.hasTips && (
                    <section className="mt-5 rounded-3xl bg-white p-6 shadow-sm">
                        <div>
                            <h2 className="text-lg font-semibold">이번 급여 기간 팁</h2>

                            <p className="mt-1 text-sm text-gray-400">
                                {formatDisplayDate(currentPayPeriod.startDate)}
                                {" ~ "}
                                {formatDisplayDate(currentPayPeriod.endDate)}
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
                            className="mt-4 w-full rounded-2xl bg-black py-4 text-sm font-semibold text-white"
                        >
                            팁 저장
                        </button>
                    </section>
                )}

                {/* Calendar */}

                <section className="mt-5 rounded-3xl bg-white p-5 shadow-sm">
                    <div className="mb-5 flex items-center justify-between">
                        <button
                            onClick={() => setCurrentDate(new Date(year, month - 1, 1))}
                            className="flex h-9 w-9 items-center justify-center rounded-full bg-gray-100"
                        >
                            ‹
                        </button>

                        <h2 className="text-lg font-semibold">
                            {year}년 {month + 1}월
                        </h2>

                        <button
                            onClick={() => setCurrentDate(new Date(year, month + 1, 1))}
                            className="flex h-9 w-9 items-center justify-center rounded-full bg-gray-100"
                        >
                            ›
                        </button>
                    </div>

                    <div className="mb-2 grid grid-cols-7 text-center text-xs text-gray-400">
                        {WEEK_DAYS.map((day) => (
                            <div key={day}>{day}</div>
                        ))}
                    </div>

                    <div className="grid grid-cols-7 gap-y-2">
                        {calendarDays.map((day, index) => {
                            if (day === null) {
                                return <div key={index} />;
                            }

                            const date = formatDate(new Date(year, month, day));

                            const holiday = holidays.find((item) => item.date === date);

                            const daySchedules = schedules.filter((schedule) => {
                                return schedule.date.slice(0, 10) === date;
                            });

                            const hasSchedule = daySchedules.length > 0;

                            const isPayPeriodDay = currentPayPeriod
                                ? date >= currentPayPeriod.startDate && date <= currentPayPeriod.endDate
                                : false;

                            const isPayDate = currentPayPeriod ? date === currentPayPeriod.payDate : false;

                            return (
                                <div
                                    key={date}
                                    className={`relative flex h-16 flex-col items-center ${
                                        isPayPeriodDay ? "rounded-xl bg-gray-100" : ""
                                    }`}
                                >
                                    <button
                                        onClick={() => (hasSchedule ? openEditModal(daySchedules[0]) : openAddModal(date))}
                                        className="flex h-12 w-full flex-col items-center justify-center rounded-xl"
                                    >
                                        <span
                                            className={
                                                hasSchedule
                                                    ? "flex h-8 w-8 items-center justify-center rounded-full bg-black text-sm font-medium text-white"
                                                    : holiday
                                                      ? "text-sm font-semibold text-red-500"
                                                      : "text-sm"
                                            }
                                        >
                                            {day}
                                        </span>

                                        {hasSchedule && !isPayDate && !holiday && (
                                            <span className="absolute bottom-1 h-1 w-1 rounded-full bg-black" />
                                        )}

                                        {holiday && (
                                            <span className="absolute bottom-0 max-w-full truncate px-1 text-[8px] font-medium text-red-500">
                                                {holiday.name}
                                            </span>
                                        )}

                                        {isPayDate && (
                                            <span className="absolute bottom-0 text-[8px] font-medium text-gray-500">급여일</span>
                                        )}
                                    </button>
                                </div>
                            );
                        })}
                    </div>

                    <div className="mt-4 flex items-center gap-4 text-xs text-gray-400">
                        <div className="flex items-center gap-2">
                            <span className="h-3 w-3 rounded bg-gray-100" />
                            급여 기간
                        </div>

                        <div className="flex items-center gap-2">
                            <span className="h-3 w-3 rounded-full bg-black" />
                            근무 등록
                        </div>
                    </div>
                </section>

                {/* This Month Schedule List */}

                <section className="mt-5 rounded-3xl bg-white p-6 shadow-sm">
                    <div className="flex items-center justify-between">
                        <h2 className="text-lg font-semibold">이번 달 근무</h2>

                        <span className="text-sm text-gray-400">{currentMonthSchedules.length}회</span>
                    </div>

                    {currentMonthSchedules.length === 0 ? (
                        <p className="mt-5 text-sm text-gray-400">아직 등록된 근무가 없어요.</p>
                    ) : (
                        <>
                            <div className="mt-4 space-y-3">
                                {currentMonthSchedules
                                    .slice(0, showAllSchedules ? currentMonthSchedules.length : 3)
                                    .map((schedule) => {
                                        const hours = calculateHours(
                                            schedule.startTime,
                                            schedule.endTime,
                                            schedule.hasBreak ? schedule.breakMinutes : 0,
                                        );

                                        const basePay = hours * hourlyWage;

                                        const scheduleDate = schedule.date.slice(0, 10);

                                        const holiday = isHoliday(scheduleDate, holidays);

                                        const premiumPay = holiday ? basePay * 0.5 : 0;

                                        const totalPay = basePay + premiumPay;

                                        return (
                                            <button
                                                key={schedule.id}
                                                onClick={() => openEditModal(schedule)}
                                                className="w-full rounded-2xl bg-gray-50 p-4 text-left"
                                            >
                                                <div className="flex items-center justify-between">
                                                    <div>
                                                        <div className="flex items-center gap-2">
                                                            <p className={`font-semibold ${holiday ? "text-red-500" : ""}`}>
                                                                {formatDisplayDate(schedule.date)}
                                                            </p>

                                                            {holiday && (
                                                                <span className="text-[10px] font-medium text-red-400">
                                                                    {holiday.name}
                                                                </span>
                                                            )}
                                                        </div>

                                                        <p className="mt-1 text-sm text-gray-500">
                                                            {schedule.startTime.slice(0, 5)}
                                                            {" ~ "}
                                                            {schedule.endTime.slice(0, 5)}
                                                        </p>
                                                    </div>

                                                    <div className="text-right">
                                                        {salarySettings?.payType === "hourly" ? (
                                                            <>
                                                                <p className="font-semibold">${totalPay.toFixed(2)}</p>

                                                                <p className="mt-1 text-xs text-gray-400">
                                                                    {hours.toFixed(1)}
                                                                    시간
                                                                </p>
                                                            </>
                                                        ) : salarySettings?.payType === "salary" ? (
                                                            <>
                                                                <p className="font-semibold">월급</p>

                                                                <p className="mt-1 text-xs text-gray-400">
                                                                    {hours.toFixed(1)}
                                                                    시간
                                                                </p>
                                                            </>
                                                        ) : (
                                                            <>
                                                                <p className="font-semibold">-</p>

                                                                <p className="mt-1 text-xs text-gray-400">
                                                                    {hours.toFixed(1)}
                                                                    시간
                                                                </p>
                                                            </>
                                                        )}
                                                    </div>
                                                </div>

                                                <div className="mt-3 flex gap-2">
                                                    {schedule.alarmEnabled && (
                                                        <span className="rounded-full bg-white px-3 py-1 text-xs text-gray-500">
                                                            🔔 {schedule.alarmMinutesBefore}분 전
                                                        </span>
                                                    )}
                                                </div>
                                            </button>
                                        );
                                    })}
                            </div>

                            {currentMonthSchedules.length > 3 && (
                                <button
                                    type="button"
                                    onClick={() => setShowAllSchedules((prev) => !prev)}
                                    className="mt-4 w-full rounded-2xl bg-gray-100 py-3 text-sm font-medium text-gray-600"
                                >
                                    {showAllSchedules ? "접기" : `전체 ${currentMonthSchedules.length}개 보기`}
                                </button>
                            )}
                        </>
                    )}
                </section>

                {/* Add / Edit Modal */}

                {isAddModalOpen && (
                    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-5">
                        <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-3xl bg-white p-6 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
                            {/* Modal Header */}
                            <div className="flex items-start justify-between">
                                <div className="relative">
                                    <h2 className="text-xl font-bold">{editingSchedule ? "근무 수정" : "근무 추가"}</h2>

                                    <div className="mt-1 flex items-center gap-2">
                                        <p
                                            className={`text-sm ${
                                                selectedDate && isHoliday(selectedDate.slice(0, 10), holidays)
                                                    ? "text-red-500"
                                                    : "text-gray-400"
                                            }`}
                                        >
                                            {selectedDate && formatDisplayDate(selectedDate)}
                                        </p>

                                        {/* Holiday Notice */}
                                        {selectedDate && isHoliday(selectedDate.slice(0, 10), holidays) && (
                                            <div className="flex items-center gap-1 rounded-lg bg-red-50 px-2 py-0.5">
                                                <span className="text-[9px]">🇨🇦</span>

                                                <p className="max-w-[100px] truncate text-[9px] font-medium text-red-500">
                                                    {isHoliday(selectedDate.slice(0, 10), holidays)?.name}
                                                </p>

                                                <span className="rounded-full bg-red-100 px-1.5 py-0.5 text-[8px] font-semibold text-red-500">
                                                    PREMIUM
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <button
                                    onClick={() => {
                                        setIsAddModalOpen(false);
                                        setEditingSchedule(null);
                                        setShowHolidayInfo(false);
                                    }}
                                    className="text-gray-400"
                                >
                                    ✕
                                </button>
                            </div>
                            {/* Time */}
                            <div className="mt-6 grid grid-cols-2 gap-3">
                                <div>
                                    <p className="mb-2 text-sm text-gray-500">시작</p>

                                    <input
                                        type="time"
                                        value={startTime}
                                        onChange={(e) => setStartTime(e.target.value)}
                                        className="w-full rounded-2xl bg-gray-100 px-4 py-4 outline-none"
                                    />
                                </div>

                                <div>
                                    <p className="mb-2 text-sm text-gray-500">종료</p>

                                    <input
                                        type="time"
                                        value={endTime}
                                        onChange={(e) => setEndTime(e.target.value)}
                                        className="w-full rounded-2xl bg-gray-100 px-4 py-4 outline-none"
                                    />
                                </div>
                            </div>
                            {/* Break */}
                            <div className="mt-5 rounded-2xl bg-gray-50 p-4">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="font-medium">☕ 휴게시간</p>

                                        <p className="mt-1 text-xs text-gray-400">이번 근무에 휴게시간이 있었나요?</p>
                                    </div>

                                    <button
                                        type="button"
                                        onClick={() => {
                                            setHasBreak((prev) => {
                                                const next = !prev;

                                                if (!next) {
                                                    setBreakMinutes("0");
                                                }

                                                return next;
                                            });
                                        }}
                                        className={`relative h-7 w-12 rounded-full transition ${
                                            hasBreak ? "bg-black" : "bg-gray-300"
                                        }`}
                                    >
                                        <span
                                            className={`absolute top-1 h-5 w-5 rounded-full bg-white transition ${
                                                hasBreak ? "left-6" : "left-1"
                                            }`}
                                        />
                                    </button>
                                </div>

                                {hasBreak && (
                                    <div className="mt-4">
                                        <p className="mb-2 text-sm text-gray-500">휴게시간은 몇 분이었나요?</p>

                                        <div className="flex items-center rounded-2xl bg-white px-4">
                                            <input
                                                type="number"
                                                min={0}
                                                value={breakMinutes}
                                                onChange={(e) => {
                                                    const value = e.target.value;

                                                    if (value === "") {
                                                        setBreakMinutes("");
                                                        return;
                                                    }

                                                    setBreakMinutes(value.replace(/^0+(?=\d)/, ""));
                                                }}
                                                className="w-full bg-transparent px-2 py-4 outline-none"
                                                placeholder="30"
                                            />

                                            <span className="shrink-0 text-sm text-gray-400">분</span>
                                        </div>
                                    </div>
                                )}
                            </div>
                            {/* Hours Preview */}
                            <div className="mt-4 rounded-2xl bg-gray-50 p-4">
                                <div className="flex justify-between">
                                    <span className="text-sm text-gray-500">실제 근무시간</span>

                                    <span className="font-semibold">
                                        {calculateHours(startTime, endTime, hasBreak ? Number(breakMinutes) || 0 : 0).toFixed(2)}
                                        시간
                                    </span>
                                </div>
                            </div>
                            {/* Alarm */}
                            <div className="mt-5 rounded-2xl bg-gray-50 p-4">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="font-medium">🔔 근무 알림</p>

                                        <p className="mt-1 text-xs text-gray-400">근무 전에 미리 알려드려요.</p>
                                    </div>

                                    <button
                                        type="button"
                                        onClick={async () => {
                                            if (!alarmEnabled) {
                                                try {
                                                    await subscribeToPush();
                                                } catch (error) {
                                                    console.error(error);

                                                    alert(error instanceof Error ? error.message : "알림 설정에 실패했어요.");

                                                    return;
                                                }
                                            }

                                            setAlarmEnabled((prev) => !prev);
                                        }}
                                        className={`relative h-7 w-12 rounded-full transition ${
                                            alarmEnabled ? "bg-black" : "bg-gray-300"
                                        }`}
                                    >
                                        <span
                                            className={`absolute top-1 h-5 w-5 rounded-full bg-white transition ${
                                                alarmEnabled ? "left-6" : "left-1"
                                            }`}
                                        />
                                    </button>
                                </div>

                                {alarmEnabled && (
                                    <div className="mt-4">
                                        <p className="mb-2 text-sm text-gray-500">몇 분 전에 알려드릴까요?</p>

                                        <select
                                            value={alarmMinutesBefore}
                                            onChange={(e) => setAlarmMinutesBefore(Number(e.target.value))}
                                            className="w-full rounded-2xl bg-white px-4 py-4 outline-none"
                                        >
                                            <option value={15}>15분 전</option>

                                            <option value={30}>30분 전</option>

                                            <option value={60}>1시간 전</option>

                                            <option value={120}>2시간 전</option>

                                            <option value={1440}>하루 전</option>
                                        </select>
                                    </div>
                                )}
                            </div>
                            {/* Buttons */}
                            <button
                                onClick={handleSaveSchedule}
                                className="mt-5 w-full rounded-2xl bg-black py-4 font-semibold text-white"
                            >
                                {editingSchedule ? "근무 수정" : "근무 등록"}
                            </button>
                            {editingSchedule && (
                                <button
                                    onClick={handleDeleteSchedule}
                                    className="mt-3 w-full rounded-2xl bg-red-50 py-4 font-semibold text-red-500"
                                >
                                    근무 삭제
                                </button>
                            )}
                            <button
                                onClick={() => {
                                    setIsAddModalOpen(false);
                                    setEditingSchedule(null);
                                }}
                                className="mt-3 w-full py-3 text-sm text-gray-400"
                            >
                                취소
                            </button>
                        </div>
                    </div>
                )}

                {/* Handle Break Modal */}
                {isDefaultBreakConfirmOpen && (
                    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-5">
                        <div className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-xl">
                            <p className="text-lg font-bold">휴게시간 설정이 변경됐어요.</p>

                            <p className="mt-2 text-sm leading-6 text-gray-500">
                                이번 근무에만 적용할까요, 아니면 앞으로 기본값으로 사용할까요?
                            </p>

                            <div className="mt-6 grid grid-cols-2 gap-3">
                                <button
                                    type="button"
                                    onClick={useBreakOnce}
                                    className="rounded-2xl bg-gray-100 py-4 text-sm font-semibold"
                                >
                                    이번 근무만
                                </button>

                                <button
                                    type="button"
                                    onClick={saveAsDefaultBreak}
                                    className="rounded-2xl bg-black py-4 text-sm font-semibold text-white"
                                >
                                    기본값으로 변경
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </main>
    );
}
