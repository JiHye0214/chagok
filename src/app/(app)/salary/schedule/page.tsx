"use client";

import LoadingScreen from "@/components/LoadingScreen";
import { useEffect, useMemo, useState } from "react";
import { formatDate, getSurroundingPayPeriods } from "@/lib/payPeriod";
import { getNotificationTime, subscribeToPush } from "@/lib/notification";
import { isHoliday } from "@/lib/holiday";
import BackButtonHeader from "@/components/BackButtonHeader";
import { useUpgrade } from "@/components/UpgradeProvider";
import { Lock } from "lucide-react";
import { useCountUp, usePeriodEstimate, useSalaryData } from "@/lib/salary/hooks";
import { buildPeriodEstimate, summarizeEstimate } from "@/lib/salary/estimate";
import { fetchHolidays } from "@/lib/salary/loaders";
import { estimateDayPay, hasHolidayPremium } from "@/lib/salary/dayPay";
import { formatCurrency, getCurrencySymbol } from "@/lib/salary/format";
import type { HolidayData, PeriodTipsData, WorkScheduleData } from "@/lib/salary/types";
import { parseDateOnly } from "@/lib/dateOnly";
import BottomSheet from "@/components/BottomSheet";
import { useDialog } from "@/components/DialogProvider";
import { useI18n } from "@/components/I18nProvider";
import { translateWarning } from "@/lib/i18n/warnings";
import UsageMeter from "@/components/UsageMeter";
import { FREE_PLAN_LIMITS } from "@/lib/plans";
import { getHourlyWageOn } from "@/lib/salary/wage";

type WorkSchedule = WorkScheduleData;

// "HH:MM" 두 시간이 분 단위 구간으로 겹치는지 (종료가 시작보다 이르면 자정을 넘기는 근무)
const toMinuteRange = (startTime: string, endTime: string): [number, number] => {
    const [startHour, startMinute] = startTime.split(":").map(Number);
    const [endHour, endMinute] = endTime.split(":").map(Number);
    const start = startHour * 60 + startMinute;
    let end = endHour * 60 + endMinute;

    if (end <= start) {
        end += 24 * 60;
    }

    return [start, end];
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

const formatDisplayDate = (value: string) => {
    return formatDate(new Date(`${value}T00:00:00`));
};

export default function SchedulePage() {
    const { t, locale } = useI18n();
    const weekDays = Array.from({ length: 7 }, (_, index) =>
        new Date(2023, 0, 1 + index).toLocaleDateString(locale, { weekday: "short" }),
    );
    const { alert: showAlert } = useDialog();
    const { openUpgrade, planCode, isPlanLoaded } = useUpgrade();

    /*
     * --------------------------------------------------
     * Calendar
     * --------------------------------------------------
     */

    const [currentDate, setCurrentDate] = useState(() => new Date());

    const year = currentDate.getFullYear();

    const month = currentDate.getMonth();

    /*
     * --------------------------------------------------
     * Schedules
     * --------------------------------------------------
     */

    // 프로필·급여 설정·근무 일정은 세 급여 화면이 같은 훅으로 불러온다
    const salaryData = useSalaryData();

    const { profile, settings: salarySettings, schedules, isLoading, setSchedules } = salaryData;

    const countryCode = profile?.countryCode ?? null;
    const provinceCode = profile?.provinceCode ?? null;
    const currency = profile?.currency ?? null;

    const formatMoney = (value: number) => formatCurrency(value, currency);

    // 달력에 보이는 달의 공휴일
    const [holidays, setHolidays] = useState<HolidayData[]>([]);

    /*
     * --------------------------------------------------
     * Modal
     * --------------------------------------------------
     */

    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [isMounted, setIsMounted] = useState(false);
    const [isAnimating, setIsAnimating] = useState(false);

    const [editingSchedule, setEditingSchedule] = useState<WorkSchedule | null>(null);

    const [selectedDate, setSelectedDate] = useState<string | null>(null);

    // 달력에서 눌러 아래 내역을 보고 있는 날짜
    const [viewDate, setViewDate] = useState<string | null>(null);

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

    // 같은 날 다른 근무와 시간이 겹칠 때 보여주는 확인창 (겹친 근무의 시간 문구를 담는다)
    const [overlapLabel, setOverlapLabel] = useState<string | null>(null);

    /*
     * --------------------------------------------------
     * Tips
     * --------------------------------------------------
     */

    const [cashTips, setCashTips] = useState("");

    const [paychequeTips, setPaychequeTips] = useState("");

    /*
     * --------------------------------------------------
     * Salary
     * --------------------------------------------------
     */

    const hourlyWage = salarySettings?.payType === "hourly" ? Number(salarySettings.hourlyWage ?? 0) : 0;

    // 날짜별 시급: 시급이 중간에 바뀌었으면 그 날짜 기준의 시급을 쓴다
    const getWageOn = (date: string) =>
        salarySettings?.payType === "hourly" ? getHourlyWageOn(date, salarySettings.hourlyWageHistory, hourlyWage) : 0;

    /*
     * --------------------------------------------------
     * Load Plan
     * --------------------------------------------------
     */


    /*
     * --------------------------------------------------
     * Current Pay Period
     * --------------------------------------------------
     */

    const today = formatDate(new Date());

    const currentPayPeriod = useMemo(
        () => (salarySettings ? (getSurroundingPayPeriods(salarySettings, today)?.current ?? null) : null),
        [salarySettings, today],
    );

    // 이번 급여 기간의 저장된 팁과 공휴일
    const periodData = usePeriodEstimate(salaryData, currentPayPeriod);

    const savedTips = periodData.tips;

    useEffect(() => {
        setCashTips(savedTips && savedTips.cashTips > 0 ? String(savedTips.cashTips) : "");

        setPaychequeTips(savedTips && savedTips.paychequeTips > 0 ? String(savedTips.paychequeTips) : "");
    }, [savedTips]);

    /*
     * --------------------------------------------------
     * Load Holidays (달력에 보이는 달)
     * --------------------------------------------------
     */

    const monthStart = formatDate(new Date(year, month, 1));
    const monthEnd = formatDate(new Date(year, month + 1, 0));

    useEffect(() => {
        if (!countryCode) {
            setHolidays([]);
            return;
        }

        let cancelled = false;

        fetchHolidays({ country: countryCode, province: provinceCode, period: { startDate: monthStart, endDate: monthEnd } })
            .then((result) => {
                if (!cancelled) {
                    setHolidays(result.holidays);
                }
            })
            .catch((error) => {
                console.error("공휴일 조회 실패:", error);

                if (!cancelled) {
                    setHolidays([]);
                }
            });

        return () => {
            cancelled = true;
        };
    }, [countryCode, provinceCode, monthStart, monthEnd]);

    /*
     * --------------------------------------------------
     * Schedule Modal
     * --------------------------------------------------
     */
    useEffect(() => {
        if (isAddModalOpen) {
            setIsMounted(true);

            document.body.style.overflow = "hidden";

            const frame = window.requestAnimationFrame(() => {
                window.requestAnimationFrame(() => {
                    setIsAnimating(true);
                });
            });

            return () => {
                window.cancelAnimationFrame(frame);
                document.body.style.overflow = "";
            };
        }

        setIsAnimating(false);

        const timer = window.setTimeout(() => {
            setIsMounted(false);
        }, 350);

        document.body.style.overflow = "";

        return () => {
            clearTimeout(timer);
            document.body.style.overflow = "";
        };
    }, [isAddModalOpen]);

    /*
     * --------------------------------------------------
     * Current Period Estimate
     *
     * 입력 중인(아직 저장하지 않은) 팁도 바로 예상 급여에 반영한다.
     * 계산 자체는 급여 화면·급여 기록 화면과 같은 lib/salary/estimate를 쓴다.
     * --------------------------------------------------
     */

    const hasPaychequeTips = Boolean(
        salarySettings?.hasTips && (salarySettings.tipType === "paycheque" || salarySettings.tipType === "both"),
    );

    const hasCashTips = Boolean(
        salarySettings?.hasTips && (salarySettings.tipType === "cash" || salarySettings.tipType === "both"),
    );

    const estimateOutcome = useMemo(
        () =>
            currentPayPeriod
                ? buildPeriodEstimate({
                      profile,
                      settings: salarySettings,
                      schedules,
                      holidays: periodData.holidays,
                      tips: {
                          payPeriodStart: currentPayPeriod.startDate,
                          payPeriodEnd: currentPayPeriod.endDate,
                          cashTips: Math.max(0, Number(cashTips) || 0),
                          paychequeTips: Math.max(0, Number(paychequeTips) || 0),
                      },
                      period: currentPayPeriod,
                  })
                : null,
        [currentPayPeriod, profile, salarySettings, schedules, periodData.holidays, cashTips, paychequeTips],
    );

    const currentPeriodEstimate = useMemo(
        () => (estimateOutcome?.status === "ok" ? summarizeEstimate(estimateOutcome.estimate) : null),
        [estimateOutcome],
    );

    const currentPeriodHolidayPay = currentPeriodEstimate
        ? currentPeriodEstimate.publicHolidayPay + currentPeriodEstimate.premiumPay
        : 0;

    const vacationPayRate = salarySettings?.countryOptions?.vacationPayRate;
    const holidayPayMode = salarySettings?.countryOptions?.holidayPayMode ?? null;

    const premiumContext = { country: countryCode, region: provinceCode, mode: holidayPayMode };

    const animatedNetPay = useCountUp(currentPeriodEstimate?.totalIncome ?? 0, Boolean(currentPeriodEstimate));

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
        if (planCode === "free" && schedules.length >= 100) {
            openUpgrade("schedule-limit");

            return;
        }

        // 하루에 근무 둘 이상은 Pro 기능
        if (planCode === "free" && schedules.some((item) => item.date.slice(0, 10) === date)) {
            openUpgrade("multi-shift");

            return;
        }

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
                        new Notification(t("common.appName"), {
                            body: t("sched.notifyBody", { time: startTime.slice(0, 5) }),
                        });
                    }, delay);
                }
            }
        }

        try {
            const response = await fetch("/api/salary/work-schedules", {
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
                const errorData = await response.json().catch(() => null);

                if (errorData?.code === "MULTI_SHIFT_PRO_ONLY") {
                    setIsAddModalOpen(false);
                    setEditingSchedule(null);
                    openUpgrade("multi-shift");

                    return;
                }

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

            showAlert(t("sched.err.save"));
        }
    };

    const findOverlap = () => {
        if (!selectedDate || !startTime || !endTime) {
            return null;
        }

        const [newStart, newEnd] = toMinuteRange(startTime, endTime);

        return (
            schedules.find((item) => {
                if (item.date.slice(0, 10) !== selectedDate || item.id === editingSchedule?.id) {
                    return false;
                }

                const [otherStart, otherEnd] = toMinuteRange(item.startTime, item.endTime);

                return newStart < otherEnd && otherStart < newEnd;
            }) ?? null
        );
    };

    const handleSaveSchedule = (skipOverlapCheck = false) => {
        if (!selectedDate) {
            return;
        }

        if (skipOverlapCheck !== true) {
            const overlap = findOverlap();

            if (overlap) {
                setOverlapLabel(`${overlap.startTime.slice(0, 5)} - ${overlap.endTime.slice(0, 5)}`);

                return;
            }
        }

        const currentBreakMinutes = hasBreak ? Math.max(0, Number(breakMinutes) || 0) : 0;

        const currentBreak = {
            enabled: hasBreak,
            minutes: currentBreakMinutes,
        };

        const breakChanged =
            currentBreak.enabled !== defaultBreak.enabled ||
            (currentBreak.enabled && currentBreak.minutes !== defaultBreak.minutes);

        if (breakChanged) {
            setIsDefaultBreakConfirmOpen(true);

            return;
        }

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
            const response = await fetch("/api/salary/work-schedules", {
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

            showAlert(t("sched.err.delete"));
        }
    };

    /*
     * --------------------------------------------------
     * Save Tips
     * --------------------------------------------------
     */

    const handleSaveTips = async () => {
        if (!currentPayPeriod) {
            return;
        }

        const newTips: PeriodTipsData = {
            payPeriodStart: currentPayPeriod.startDate,

            payPeriodEnd: currentPayPeriod.endDate,

            cashTips: Math.max(0, Number(cashTips) || 0),

            paychequeTips: Math.max(0, Number(paychequeTips) || 0),
        };

        try {
            const response = await fetch("/api/salary/pay-period-tips", {
                method: "PUT",

                headers: {
                    "Content-Type": "application/json",
                },

                body: JSON.stringify(newTips),
            });

            if (!response.ok) {
                throw new Error("팁 저장 실패");
            }

            const saved = (await response.json()) as PeriodTipsData;

            periodData.setTips(saved);

            setCashTips(saved.cashTips > 0 ? String(saved.cashTips) : "");

            setPaychequeTips(saved.paychequeTips > 0 ? String(saved.paychequeTips) : "");

            showAlert(t("sched.tipsSaved"));
        } catch (error) {
            console.error(error);

            showAlert(t("sched.err.tips"));
        }
    };

    /*
     * --------------------------------------------------
     * This Month Schedules
     * --------------------------------------------------
     */

    const currentMonthSchedules = schedules
        .filter((schedule) => {
            const [scheduleYear, scheduleMonth] = schedule.date.slice(0, 10).split("-").map(Number);

            return scheduleYear === year && scheduleMonth === month + 1;
        })
        .sort((a, b) => a.date.localeCompare(b.date));

    /*
     * --------------------------------------------------
     * Loading...
     * --------------------------------------------------
     */

    if (isLoading || !isPlanLoaded) {
        return <LoadingScreen />;
    }

    /*
     * --------------------------------------------------
     * Render
     * --------------------------------------------------
     */

    return (
        <div className="mx-auto max-w-md">
            {/* Header */}
            <header className="flex items-center justify-between">
                <BackButtonHeader href="/salary" title={t("sched.k001")} description={t("sched.k002")} />
            </header>

            <UsageMeter
                label={t("sched.k003")}
                used={schedules.length}
                limit={FREE_PLAN_LIMITS.workSchedules}
                reason="schedule-limit"
                className="mt-6"
            />

            {/* Pay Period Notice */}
            {currentPayPeriod && (
                <section className="mt-5 rounded-3xl bg-white p-5 shadow-sm">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-xs text-gray-400">{t("sched.k004")}</p>

                            <p className="mt-1 text-sm font-semibold">
                                {formatDisplayDate(currentPayPeriod.startDate)}
                                {" ~ "}
                                {formatDisplayDate(currentPayPeriod.endDate)}
                            </p>
                        </div>

                        <div className="text-right">
                            <p className="text-xs text-gray-400">{t("sched.k005")}</p>

                            <p className="mt-1 text-sm font-semibold">{formatDisplayDate(currentPayPeriod.payDate)}</p>
                        </div>
                    </div>
                </section>
            )}
            {planCode === "free" && schedules.length >= 100 && (
                <div className="my-4 flex items-center gap-3 rounded-2xl bg-gray-50 p-4">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gray-100">
                        <Lock size={16} className="text-gray-500" />
                    </div>

                    <div>
                        <p className="text-sm font-semibold text-gray-900">{t("sched.k006")}</p>

                        <p className="mt-1 text-xs text-gray-500">{t("sched.k007")}</p>
                    </div>

                    <button
                        type="button"
                        onClick={() => openUpgrade("schedule-limit")}
                        className="ml-auto shrink-0 rounded-full bg-gray-900 px-3 py-2 text-xs font-medium text-white"
                    >
                        {t("sched.k008")}
                    </button>
                </div>
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
                        {new Date(year, month, 1).toLocaleDateString(locale, { year: "numeric", month: "long" })}
                    </h2>

                    <button
                        onClick={() => setCurrentDate(new Date(year, month + 1, 1))}
                        className="flex h-9 w-9 items-center justify-center rounded-full bg-gray-100"
                    >
                        ›
                    </button>
                </div>

                <div className="mb-2 grid grid-cols-7 text-center text-xs text-gray-400">
                    {weekDays.map((day) => (
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

                        const isToday = date === formatDate(new Date());

                        const daySchedules = schedules.filter((schedule) => schedule.date.slice(0, 10) === date);

                        const hasSchedule = daySchedules.length > 0;

                        const dayHours = daySchedules.reduce(
                            (total, schedule) =>
                                total +
                                calculateHours(
                                    schedule.startTime,
                                    schedule.endTime,
                                    schedule.hasBreak ? schedule.breakMinutes : 0,
                                ),
                            0,
                        );

                        const dayPay = daySchedules.reduce((total, schedule) => {
                            const hours = calculateHours(
                                schedule.startTime,
                                schedule.endTime,
                                schedule.hasBreak ? schedule.breakMinutes : 0,
                            );

                            return (
                                total + estimateDayPay({ hours, hourlyWage: getWageOn(date), isHoliday: Boolean(holiday), ...premiumContext })
                            );
                        }, 0);

                        const isPayPeriodDay = currentPayPeriod
                            ? date >= currentPayPeriod.startDate && date <= currentPayPeriod.endDate
                            : false;

                        const isPayDate = currentPayPeriod ? date === currentPayPeriod.payDate : false;

                        return (
                            <div
                                key={date}
                                className={`relative flex h-16 flex-col items-center rounded-xl ${
                                    isPayPeriodDay ? "bg-gray-100" : ""
                                }`}
                            >
                                <button
                                    onClick={() => {
                                        if (hasSchedule) {
                                            setViewDate(date);
                                        } else {
                                            setViewDate(null);
                                            openAddModal(date);
                                        }
                                    }}
                                    className="flex h-full w-full flex-col items-center justify-start rounded-xl pt-1"
                                >
                                    <span
                                        className={
                                            hasSchedule
                                                ? `flex h-8 w-8 items-center justify-center rounded-full bg-black text-sm font-medium ${
                                                      holiday ? "text-red-500" : "text-white"
                                                  } ${
                                                      viewDate === date
                                                          ? "ring-2 ring-gray-900 ring-offset-2"
                                                          : isToday
                                                            ? "ring-2 ring-[#7FA58D] ring-offset-2"
                                                            : ""
                                                  }`
                                                : isToday
                                                  ? `flex h-8 w-8 items-center justify-center rounded-full bg-[#EEF4F0] text-sm font-bold ring-1 ring-[#7FA58D] ${
                                                        holiday ? "text-red-500" : "text-[#3F6B4F]"
                                                    }`
                                                  : holiday
                                                    ? "flex h-8 w-8 items-center justify-center text-sm font-medium text-red-500"
                                                    : "flex h-8 w-8 items-center justify-center text-sm text-gray-900"
                                        }
                                    >
                                        {day}
                                    </span>

                                    {hasSchedule ? (
                                        <>
                                            <span className="mt-1.5 text-[8px] font-medium leading-none text-gray-500">
                                                {dayHours.toFixed(2)}h
                                            </span>

                                            {salarySettings?.payType === "hourly" ? (
                                                <span className="mt-1 text-[8px] font-semibold leading-none text-gray-700">
                                                    {formatMoney(dayPay)}
                                                </span>
                                            ) : salarySettings?.payType === "salary" ? (
                                                <span className="mt-1 text-[10px] font-medium leading-none text-gray-500">
                                                    {t("sched.k009")}
                                                </span>
                                            ) : null}
                                        </>
                                    ) : (
                                        holiday && (
                                            <span className="mt-1 max-w-full truncate px-1 text-[9px] font-medium leading-none text-red-400">
                                                {holiday.name}
                                            </span>
                                        )
                                    )}

                                    {isPayDate && (
                                        <span className="absolute bottom-0 text-[8px] font-medium leading-none text-gray-400">
                                            {t("sched.k005")}
                                        </span>
                                    )}
                                </button>
                            </div>
                        );
                    })}
                </div>

                <div className="mt-5 flex items-center justify-between border-t border-gray-100 pt-5">
                    <div className="flex items-center gap-4 text-xs text-gray-400">
                        <div className="flex items-center gap-2">
                            <span className="h-3 w-3 rounded bg-gray-100" />
                            {t("sched.k010")}
                        </div>

                        <div className="flex items-center gap-2">
                            <span className="h-3 w-3 rounded-full bg-black" />
                            {t("sched.k011")}
                        </div>
                    </div>

                    <span className="text-xs font-medium text-gray-400">
                        {t("sched.monthCount", { count: currentMonthSchedules.length })} /{" "}
                        {currentMonthSchedules
                            .reduce(
                                (total, schedule) =>
                                    total +
                                    calculateHours(
                                        schedule.startTime,
                                        schedule.endTime,
                                        schedule.hasBreak ? schedule.breakMinutes : 0,
                                    ),
                                0,
                            )
                            .toFixed(2)}
                        {t("sched.k012")}
                    </span>
                </div>
            </section>


            {/* 선택한 날짜의 근무 내역 */}
            {viewDate && (() => {
                const dayList = schedules
                    .filter((item) => item.date.slice(0, 10) === viewDate)
                    .sort((a, b) => a.startTime.localeCompare(b.startTime));
                const dayHoliday = holidays.find((item) => item.date === viewDate);
                const hoursOf = (item: WorkScheduleData) =>
                    calculateHours(item.startTime, item.endTime, item.hasBreak ? item.breakMinutes : 0);
                const payOf = (item: WorkScheduleData) =>
                    estimateDayPay({ hours: hoursOf(item), hourlyWage: getWageOn(viewDate), isHoliday: Boolean(dayHoliday), ...premiumContext });
                const totalHours = dayList.reduce((sum, item) => sum + hoursOf(item), 0);
                const totalPay = dayList.reduce((sum, item) => sum + payOf(item), 0);

                return (
                    <section className="mt-5 rounded-3xl bg-white p-5 shadow-sm">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className={`text-sm font-semibold ${dayHoliday ? "text-red-500" : "text-gray-900"}`}>
                                    {formatDate(parseDateOnly(viewDate))}
                                </p>
                                {dayHoliday && <p className="mt-0.5 text-xs text-red-400">{dayHoliday.name}</p>}
                            </div>

                            <button
                                type="button"
                                onClick={() => openAddModal(viewDate)}
                                className="rounded-full bg-gray-900 px-3 py-2 text-xs font-medium text-white"
                            >
                                + {t("sched.day.addShift")}
                            </button>
                        </div>

                        {dayList.length === 0 ? (
                            <p className="mt-4 text-sm text-gray-400">{t("sched.day.empty")}</p>
                        ) : (
                            <div className="mt-4 divide-y divide-gray-100">
                                {dayList.map((item) => (
                                    <button
                                        key={item.id}
                                        type="button"
                                        onClick={() => openEditModal(item)}
                                        className="flex w-full items-center justify-between py-3 text-left"
                                    >
                                        <div>
                                            <p className="text-sm font-medium text-gray-900">
                                                {item.startTime.slice(0, 5)} - {item.endTime.slice(0, 5)}
                                            </p>
                                            <p className="mt-0.5 text-xs text-gray-400">
                                                {hoursOf(item).toFixed(2)}
                                                {t("sched.k012")}
                                            </p>
                                        </div>

                                        {salarySettings?.payType === "hourly" && (
                                            <span className="text-sm font-semibold text-gray-700">{formatMoney(payOf(item))}</span>
                                        )}
                                    </button>
                                ))}
                            </div>
                        )}

                        {dayList.length > 1 && (
                            <div className="mt-2 flex items-center justify-between border-t border-gray-100 pt-3 text-xs text-gray-500">
                                <span>
                                    {t("sched.day.total")} · {t("sched.day.count", { count: dayList.length })}
                                </span>
                                <span className="font-semibold text-gray-700">
                                    {totalHours.toFixed(2)}
                                    {t("sched.k012")}
                                    {salarySettings?.payType === "hourly" ? ` · ${formatMoney(totalPay)}` : ""}
                                </span>
                            </div>
                        )}
                    </section>
                );
            })()}

            {/* Add / Edit Modal */}
            {isMounted && (
                <div className="fixed inset-0 z-[10000]">
                    {/* Backdrop */}

                    <button
                        type="button"
                        aria-label={t("sched.k013")}
                        onClick={() => {
                            setIsAddModalOpen(false);
                            setEditingSchedule(null);
                        }}
                        className={`absolute inset-0 bg-black/30 transition-opacity duration-300 ease-out ${
                            isAnimating ? "opacity-100" : "opacity-0"
                        }`}
                    />

                    {/* Bottom Sheet */}

                    <div
                        className={`absolute inset-x-0 bottom-0 mx-auto flex max-h-[95dvh] w-full max-w-md flex-col rounded-t-[2rem] bg-gray-50 shadow-2xl transform-gpu transition-transform duration-[350ms] ease-[cubic-bezier(0.22,1,0.36,1)] ${
                            isAnimating ? "translate-y-0" : "translate-y-full"
                        }`}
                    >
                        {/* Handle */}

                        <div className="flex shrink-0 items-center justify-center px-6 pb-4 pt-3">
                            <div className="h-1.5 w-10 rounded-full bg-gray-300" />
                        </div>

                        {/* Content */}

                        <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-8 pt-2 scrollbar-hide">
                            {/* Modal Header */}

                            <div>
                                <h2 className="text-xl font-bold">{editingSchedule ? t("sched.edit") : t("sched.add")}</h2>

                                <div className="mt-1 flex items-center gap-2">
                                    <p
                                        className={`text-sm ${
                                            selectedDate && isHoliday(selectedDate.slice(0, 10), holidays)
                                                ? "text-red-500"
                                                : "text-gray-400"
                                        }`}
                                    >
                                        {selectedDate && formatDate(parseDateOnly(selectedDate))}
                                    </p>

                                    {selectedDate && isHoliday(selectedDate.slice(0, 10), holidays) && (
                                        <div className="flex items-center gap-1 rounded-lg bg-red-50 px-2 py-0.5">
                                            <span className="text-[9px]">{countryCode === "KR" ? "🇰🇷" : "🇨🇦"}</span>

                                            <p className="max-w-[100px] truncate text-[9px] font-medium text-red-500">
                                                {isHoliday(selectedDate.slice(0, 10), holidays)?.name}
                                            </p>

                                            {hasHolidayPremium(premiumContext) && (
                                                <span className="rounded-full bg-red-100 px-1.5 py-0.5 text-[8px] font-semibold text-red-500">
                                                    PREMIUM
                                                </span>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Time */}

                            <div className="mt-6 grid grid-cols-2 gap-3">
                                <div>
                                    <p className="mb-2 text-sm text-gray-500">{t("sched.k014")}</p>

                                    <input
                                        type="time"
                                        value={startTime}
                                        onChange={(e) => setStartTime(e.target.value)}
                                        className="w-full rounded-2xl bg-gray-100 px-4 py-4 outline-none"
                                    />
                                </div>

                                <div>
                                    <p className="mb-2 text-sm text-gray-500">{t("sched.k015")}</p>

                                    <input
                                        type="time"
                                        value={endTime}
                                        onChange={(e) => setEndTime(e.target.value)}
                                        className="w-full rounded-2xl bg-gray-100 px-4 py-4 outline-none"
                                    />
                                </div>
                            </div>

                            {/* Break */}

                            <div className="mt-5 rounded-2xl bg-white p-4">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="font-medium">{t("sched.k016")}</p>

                                        <p className="mt-1 text-xs text-gray-400">{t("sched.k017")}</p>
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
                                        <p className="mb-2 text-sm text-gray-500">{t("sched.k018")}</p>

                                        <div className="flex items-center rounded-2xl bg-gray-50 px-4">
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

                                            <span className="shrink-0 text-sm text-gray-400">{t("sched.k019")}</span>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Hours Preview */}

                            <div className="mt-4 rounded-2xl bg-white p-4">
                                <div className="flex items-center justify-between">
                                    <span className="text-sm text-gray-500">{t("sched.k020")}</span>

                                    <span className="font-semibold">
                                        {calculateHours(startTime, endTime, hasBreak ? Number(breakMinutes) || 0 : 0).toFixed(2)}
                                        {t("sched.k012")}
                                    </span>
                                </div>
                            </div>

                            {/* Expected Pay Preview */}

                            {salarySettings?.payType === "hourly" && (
                                <div className="mt-3 rounded-2xl bg-white p-4">
                                    <div className="flex items-center justify-between">
                                        <span className="text-sm text-gray-500">{t("sched.k021")}</span>

                                        <span className="font-semibold">
                                            {formatMoney(
                                                estimateDayPay({
                                                    hours: calculateHours(
                                                        startTime,
                                                        endTime,
                                                        hasBreak ? Number(breakMinutes) || 0 : 0,
                                                    ),
                                                    hourlyWage: getWageOn(selectedDate ?? ""),
                                                    isHoliday: Boolean(
                                                        selectedDate && isHoliday(selectedDate.slice(0, 10), holidays),
                                                    ),
                                                    ...premiumContext,
                                                }),
                                            )}
                                        </span>
                                    </div>
                                </div>
                            )}

                            {/* Alarm */}

                            <div className="mt-5 rounded-2xl bg-white p-4">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="font-medium">{t("sched.k022")}</p>

                                        <p className="mt-1 text-xs text-gray-400">{t("sched.k023")}</p>
                                    </div>

                                    <button
                                        type="button"
                                        onClick={async () => {
                                            if (!alarmEnabled) {
                                                try {
                                                    await subscribeToPush();
                                                } catch (error) {
                                                    console.error(error);

                                                    showAlert(error instanceof Error ? error.message : t("sched.err.notify"));

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
                                        <p className="mb-2 text-sm text-gray-500">{t("sched.k024")}</p>

                                        <select
                                            value={alarmMinutesBefore}
                                            onChange={(e) => setAlarmMinutesBefore(Number(e.target.value))}
                                            className="w-full rounded-2xl bg-gray-50 px-4 py-4 outline-none"
                                        >
                                            <option value={15}>{t("sched.k025")}</option>
                                            <option value={30}>{t("sched.k026")}</option>
                                            <option value={60}>{t("sched.k027")}</option>
                                            <option value={120}>{t("sched.k028")}</option>
                                            <option value={1440}>{t("sched.k029")}</option>
                                        </select>
                                    </div>
                                )}
                            </div>

                            {/* Buttons */}

                            <div className="mt-5 flex gap-3">
                                <button
                                    onClick={() => handleSaveSchedule()}
                                    className="flex-1 rounded-2xl bg-black py-4 font-semibold text-white"
                                >
                                    {editingSchedule ? t("sched.edit") : t("sched.register")}
                                </button>

                                {editingSchedule && (
                                    <button
                                        onClick={handleDeleteSchedule}
                                        className="flex-1 rounded-2xl bg-red-50 py-4 font-semibold text-red-500"
                                    >
                                        {t("sched.k030")}
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* 겹치는 근무 확인 */}
            <BottomSheet isOpen={overlapLabel !== null} onClose={() => setOverlapLabel(null)}>
                {overlapLabel !== null && (
                    <>
                        <p className="text-lg font-bold">{t("sched.overlap.title")}</p>

                        <p className="mt-2 text-sm leading-6 text-gray-500">
                            {t(editingSchedule ? "sched.overlap.descEdit" : "sched.overlap.desc", { time: overlapLabel })}
                        </p>

                        <div className="mt-6 grid grid-cols-2 gap-3">
                            <button
                                type="button"
                                onClick={() => setOverlapLabel(null)}
                                className="rounded-2xl bg-gray-100 py-4 text-sm font-semibold"
                            >
                                {t("sched.overlap.cancel")}
                            </button>

                            <button
                                type="button"
                                onClick={() => {
                                    setOverlapLabel(null);
                                    handleSaveSchedule(true);
                                }}
                                className="rounded-2xl bg-black py-4 text-sm font-semibold text-white"
                            >
                                {t("sched.overlap.confirm")}
                            </button>
                        </div>
                    </>
                )}
            </BottomSheet>

            {/* Handle Break Modal */}
            <BottomSheet isOpen={Boolean(isDefaultBreakConfirmOpen)} onClose={() => setIsDefaultBreakConfirmOpen(false)}>
                {isDefaultBreakConfirmOpen && (
                    <>
                            <p className="text-lg font-bold">{t("sched.k031")}</p>

                            <p className="mt-2 text-sm leading-6 text-gray-500">
                                {t("sched.k032")}
                            </p>

                            <div className="mt-6 grid grid-cols-2 gap-3">
                                <button
                                    type="button"
                                    onClick={useBreakOnce}
                                    className="rounded-2xl bg-gray-100 py-4 text-sm font-semibold"
                                >
                                    {t("sched.k033")}
                                </button>

                                <button
                                    type="button"
                                    onClick={saveAsDefaultBreak}
                                    className="rounded-2xl bg-black py-4 text-sm font-semibold text-white"
                                >
                                    {t("sched.k034")}
                                </button>
                            </div>
                
                
                    </>
                )}
            </BottomSheet>
            {/* --------------------------------------------------
            Current Period Tips
        -------------------------------------------------- */}
            {currentPayPeriod && salarySettings?.hasTips && (
                <section className="mt-5 rounded-3xl bg-white p-5 shadow-sm">
                    <div>
                        <h2 className="text-lg font-semibold">{t("sched.k035")}</h2>

                        <p className="mt-1 text-sm text-gray-400">
                            {formatDisplayDate(currentPayPeriod.startDate)}
                            {" ~ "}
                            {formatDisplayDate(currentPayPeriod.endDate)}
                        </p>
                    </div>

                    {salarySettings.tipType === "cash" && (
                        <div className="mt-4">
                            <p className="mb-2 text-sm text-gray-500">{t("sched.k036")}</p>

                            <div className="flex items-center rounded-2xl bg-gray-100 px-4">
                                <span className="text-gray-500">{getCurrencySymbol(currency)}</span>

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
                            <p className="mb-2 text-sm text-gray-500">{t("sched.k037")}</p>

                            <div className="flex items-center rounded-2xl bg-gray-100 px-4">
                                <span className="text-gray-500">{getCurrencySymbol(currency)}</span>

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
                                <p className="mb-2 text-sm text-gray-500">{t("sched.k037")}</p>

                                <div className="flex items-center rounded-2xl bg-gray-100 px-4">
                                    <span className="text-gray-500">{getCurrencySymbol(currency)}</span>

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
                                <p className="mb-2 text-sm text-gray-500">{t("sched.k036")}</p>

                                <div className="flex items-center rounded-2xl bg-gray-100 px-4">
                                    <span className="text-gray-500">{getCurrencySymbol(currency)}</span>

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
                        onClick={handleSaveTips}
                        className="mt-4 w-full rounded-2xl bg-gray-900 py-4 text-sm font-semibold text-white"
                    >
                        {t("sched.k038")}
                    </button>
                </section>
            )}
            {/* --------------------------------------------------
            Current Expected Salary
        -------------------------------------------------- */}
            {currentPayPeriod && !currentPeriodEstimate && (
                <section className="mt-6 rounded-3xl bg-black p-6 text-white shadow-sm">
                    <p className="text-sm text-gray-400">{t("sched.k039")}</p>

                    <p className="mt-3 text-sm text-gray-300">
                        {estimateOutcome?.status === "unsupported-country"
                            ? t("sal.problem.unsupported")
                            : estimateOutcome?.status === "no-profile"
                              ? t("sal.problem.noProfile")
                              : t("sal.problem.noSettings")}
                    </p>
                </section>
            )}

            {currentPayPeriod && !salarySettings?.payPeriodStartDate && salarySettings && (
                <p className="mt-3 text-xs text-gray-400">{t("sched.k040")}</p>
            )}

            {currentPayPeriod && currentPeriodEstimate && (
                <section className="mt-6 rounded-3xl bg-black p-6 text-white shadow-sm">
                    <p className="text-sm text-gray-400">{t("sched.k039")}</p>

                    <div className="mt-2 flex items-start gap-2">
                        <p className="text-4xl font-bold tabular-nums">{formatMoney(animatedNetPay)}</p>
                    </div>

                    {/* 세부 계산 */}

                    {planCode === "pro" ? (
                        <div className="mt-6 space-y-3 text-sm">
                            <div className="flex justify-between">
                                <span className="text-gray-400">{t("sched.k041")}</span>

                                <span>
                                    {currentPeriodEstimate.hours.toFixed(2)}
                                    {t("sched.k012")}
                                </span>
                            </div>

                            <div className="flex justify-between">
                                <span className="text-gray-400">{t("sched.k042")}</span>

                                <span>{formatMoney(currentPeriodEstimate.basePay)}</span>
                            </div>

                            {hasPaychequeTips && (
                                <div className="flex justify-between">
                                    <span className="text-gray-400">{t("sched.k043")}</span>

                                    <span>{formatMoney(currentPeriodEstimate.paychequeTips)}</span>
                                </div>
                            )}

                            {currentPeriodHolidayPay > 0 && (
                                <div className="flex justify-between">
                                    <span className="text-gray-400">{t("sched.k044")}</span>

                                    <span>{formatMoney(currentPeriodHolidayPay)}</span>
                                </div>
                            )}

                            {currentPeriodEstimate.vacationPay > 0 && (
                                <div className="flex justify-between">
                                    <span className="text-gray-400">
                                        {t("sched.k045")}
                                        {vacationPayRate !== undefined
                                            ? ` (${Math.round(vacationPayRate * 10000) / 100}%)`
                                            : ""}
                                    </span>

                                    <span>{formatMoney(currentPeriodEstimate.vacationPay)}</span>
                                </div>
                            )}

                            <div className="mt-4 border-t border-gray-800 pt-4">
                                <div className="flex justify-between">
                                    <span className="text-gray-300">{t("sched.k046")}</span>

                                    <span className="font-semibold">{formatMoney(currentPeriodEstimate.grossPay)}</span>
                                </div>
                            </div>

                            <div className="flex justify-between">
                                <span className="text-gray-400">{t("sched.k047")}</span>

                                <span>- {formatMoney(currentPeriodEstimate.deductions)}</span>
                            </div>

                            <div className="flex justify-between">
                                <span className="text-gray-300">{t("sched.k048")}</span>

                                <span className="font-semibold">{formatMoney(currentPeriodEstimate.netPay)}</span>
                            </div>

                            {currentPeriodEstimate.warnings.map((warning) => (
                                <p key={warning} className="pt-2 text-xs leading-5 text-amber-300">
                                    {translateWarning(warning, t)}
                                </p>
                            ))}

                            {hasCashTips && (
                                <div className="mt-4 border-t border-gray-800 pt-4">
                                    <div className="flex justify-between">
                                        <span className="text-gray-400">{t("sched.k049")}</span>

                                        <span>{formatMoney(currentPeriodEstimate.cashTips)}</span>
                                    </div>
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="relative mt-6 overflow-hidden rounded-2xl">
                            {/* 잠긴 세부사항 미리보기 */}

                            <div className="pointer-events-none select-none blur-[3px] opacity-40">
                                <div className="space-y-3 text-sm">
                                    <div className="flex justify-between">
                                        <span className="text-gray-400">{t("sched.k041")}</span>
                                        <span>{t("sched.k050")}</span>
                                    </div>

                                    <div className="flex justify-between">
                                        <span className="text-gray-400">{t("sched.k042")}</span>
                                        <span>{formatMoney(currency === "KRW" ? Math.round(570.03 * 1000) : 570.03)}</span>
                                    </div>

                                    <div className="flex justify-between">
                                        <span className="text-gray-400">Holiday Pay</span>
                                        <span>{formatMoney(currency === "KRW" ? Math.round(28.5 * 1000) : 28.5)}</span>
                                    </div>

                                    <div className="flex justify-between">
                                        <span className="text-gray-400">Vacation Pay</span>
                                        <span>{formatMoney(currency === "KRW" ? Math.round(24.85 * 1000) : 24.85)}</span>
                                    </div>

                                    <div className="border-t border-gray-800 pt-4">
                                        <div className="flex justify-between">
                                            <span className="text-gray-300">{t("sched.k046")}</span>
                                            <span>{formatMoney(currency === "KRW" ? Math.round(623.38 * 1000) : 623.38)}</span>
                                        </div>
                                    </div>

                                    <div className="flex justify-between">
                                        <span className="text-gray-400">{t("sched.k047")}</span>
                                        <span>- {formatMoney(currency === "KRW" ? Math.round(123.42 * 1000) : 123.42)}</span>
                                    </div>

                                    <div className="flex justify-between">
                                        <span className="text-gray-300">{t("sched.k048")}</span>
                                        <span>{formatMoney(currency === "KRW" ? Math.round(499.96 * 1000) : 499.96)}</span>
                                    </div>
                                </div>
                            </div>

                            {/* Lock */}

                            <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/50">
                                <div className="flex h-11 w-11 items-center justify-center rounded-full bg-white/10">
                                    <Lock size={19} strokeWidth={2} className="text-gray-300" />
                                </div>

                                <p className="mt-3 text-sm font-semibold text-white">{t("sched.k051")}</p>

                                <p className="mt-1 text-xs text-gray-400">{t("sched.k052")}</p>

                                <button
                                    type="button"
                                    onClick={() => openUpgrade("general")}
                                    className="mt-4 rounded-full bg-white px-4 py-2 text-xs font-medium text-gray-900"
                                >
                                    {t("sched.k008")}
                                </button>
                            </div>
                        </div>
                    )}

                    {salarySettings?.payType === "hourly" && (
                        <p className="mt-5 text-xs text-gray-400">{t("sched.perHour", { amount: formatMoney(hourlyWage) })}</p>
                    )}

                    {salarySettings?.payType === "salary" && (
                        <p className="mt-5 text-xs text-gray-400">
                            {t("sched.monthlySet", { amount: formatMoney(Number(salarySettings.monthlySalary ?? 0)) })}
                        </p>
                    )}
                </section>
            )}
        </div>
    );
}
