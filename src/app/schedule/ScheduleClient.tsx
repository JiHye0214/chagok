"use client";

import { useState } from "react";

type PayType = "hourly" | "salary" | "commission" | "other";

type PayFrequency = "weekly" | "biweekly" | "semi-monthly" | "monthly" | "custom";

type SemiMonthlyType = "first-fifteenth" | "fifteenth-end";

type Province = "ON" | "BC" | "AB" | "SK" | "MB" | "QC" | "NS" | "NB" | "NL" | "PE" | "YT" | "NT" | "NU";

type SalarySettings = {
    id: number;
    province?: Province;
    payType: PayType;
    payFrequency: PayFrequency;
    hourlyWage?: number;
    monthlySalary?: number;
    nextPayDate?: string;
    semiMonthlyType?: SemiMonthlyType;
    customPayDays?: number;
    hasTips?: boolean;
    tipType?: "cash" | "paycheque";
};

type WorkSchedule = {
    id: number;
    date: string;
    startTime: string;
    endTime: string;
    breakMinutes: number;
    alarmEnabled: boolean;
    alarmMinutesBefore: number;
    tip: number;
};

type PayPeriod = {
    startDate: string;
    endDate: string;
    payDate: string;
};

type Props = {
    initialSchedules: WorkSchedule[];
    initialSalarySettings: SalarySettings | null;
};

const WEEK_DAYS = ["일", "월", "화", "수", "목", "금", "토"];

const formatDate = (year: number, month: number, day: number) => {
    const date = new Date(year, month, day);

    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");

    return `${y}-${m}-${d}`;
};

const formatDisplayDate = (dateString: string) => {
    const [year, month, day] = dateString.split("-").map(Number);

    return `${year}. ${month}. ${day}.`;
};

const calculateHours = (startTime: string, endTime: string, breakMinutes: number) => {
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

const addDays = (date: Date, days: number) => {
    const result = new Date(date);

    result.setDate(result.getDate() + days);

    return result;
};

const formatISO = (date: Date) => {
    const y = date.getFullYear();

    const m = String(date.getMonth() + 1).padStart(2, "0");

    const d = String(date.getDate()).padStart(2, "0");

    return `${y}-${m}-${d}`;
};

/*
 * 급여일을 기준으로
 * 해당 급여에 포함되는 기간을 계산
 */
const getPayPeriod = (
    payDate: Date,
    frequency: PayFrequency,
    semiMonthlyType?: SemiMonthlyType,
    customPayDays?: number,
): PayPeriod => {
    const end = new Date(payDate);

    let start = new Date(payDate);

    switch (frequency) {
        case "weekly":
            start = addDays(end, -7);
            break;

        case "biweekly":
            start = addDays(end, -14);
            break;

        case "monthly":
            start = new Date(end.getFullYear(), end.getMonth() - 1, end.getDate());
            break;

        case "semi-monthly":
            if (semiMonthlyType === "fifteenth-end") {
                if (end.getDate() === 15) {
                    start = new Date(end.getFullYear(), end.getMonth(), 1);
                } else {
                    start = new Date(end.getFullYear(), end.getMonth(), 15);
                }
            } else {
                if (end.getDate() === 1) {
                    start = new Date(end.getFullYear(), end.getMonth() - 1, 15);
                } else {
                    start = new Date(end.getFullYear(), end.getMonth(), 1);
                }
            }
            break;

        case "custom":
            start = addDays(end, -(customPayDays || 14));
            break;
    }

    return {
        startDate: formatISO(start),
        endDate: formatISO(end),
        payDate: formatISO(end),
    };
};

/*
 * 저장된 급여일이 과거라면
 * 오늘 이후의 가장 가까운 급여일을 찾음
 */
const getNextPayDate = (
    savedDate: string,
    frequency: PayFrequency,
    today: Date,
    semiMonthlyType?: SemiMonthlyType,
    customPayDays?: number,
) => {
    let date = new Date(`${savedDate}T00:00:00`);

    const todayOnly = new Date(today.getFullYear(), today.getMonth(), today.getDate());

    while (date < todayOnly) {
        switch (frequency) {
            case "weekly":
                date = addDays(date, 7);
                break;

            case "biweekly":
                date = addDays(date, 14);
                break;

            case "monthly":
                date = new Date(date.getFullYear(), date.getMonth() + 1, date.getDate());
                break;

            case "semi-monthly":
                if (semiMonthlyType === "fifteenth-end") {
                    if (date.getDate() === 15) {
                        date = new Date(date.getFullYear(), date.getMonth() + 1, 1);
                    } else {
                        date = new Date(date.getFullYear(), date.getMonth(), 15);
                    }
                } else {
                    if (date.getDate() === 1) {
                        date = new Date(date.getFullYear(), date.getMonth(), 15);
                    } else {
                        date = new Date(date.getFullYear(), date.getMonth() + 1, 1);
                    }
                }
                break;

            case "custom":
                date = addDays(date, customPayDays || 14);
                break;
        }
    }

    return date;
};

const getFrequencyLabel = (settings: SalarySettings) => {
    switch (settings.payFrequency) {
        case "weekly":
            return "매주";

        case "biweekly":
            return "격주";

        case "semi-monthly":
            return settings.semiMonthlyType === "fifteenth-end" ? "월 2회 · 15일 / 말일" : "월 2회 · 1일 / 15일";

        case "monthly":
            return "매월";

        case "custom":
            return `${settings.customPayDays || 14}일마다`;

        default:
            return "";
    }
};

const requestNotificationPermission = async () => {
    if (!("Notification" in window)) {
        alert("이 브라우저에서는 알림을 지원하지 않아요.");

        return false;
    }

    if (Notification.permission === "granted") {
        return true;
    }

    if (Notification.permission === "denied") {
        alert("알림이 차단되어 있어요. 브라우저 설정에서 알림을 허용해주세요.");

        return false;
    }

    const permission = await Notification.requestPermission();

    return permission === "granted";
};

export default function ScheduleClient({ initialSchedules, initialSalarySettings }: Props) {
    /*
     * --------------------------------
     * Calendar
     * --------------------------------
     */

    const [currentDate, setCurrentDate] = useState(() => new Date(2026, 7, 1));

    /*
     * --------------------------------
     * Data
     * --------------------------------
     */

    const [schedules, setSchedules] = useState<WorkSchedule[]>(initialSchedules);

    const [salarySettings] = useState<SalarySettings | null>(initialSalarySettings);

    /*
     * --------------------------------
     * Modal
     * --------------------------------
     */

    const [isAddModalOpen, setIsAddModalOpen] = useState(false);

    const [editingSchedule, setEditingSchedule] = useState<WorkSchedule | null>(null);

    const [selectedDate, setSelectedDate] = useState<string | null>(null);

    const [startTime, setStartTime] = useState("09:00");

    const [endTime, setEndTime] = useState("17:00");

    const [breakMinutes, setBreakMinutes] = useState("30");

    const [tip, setTip] = useState("0");

    const [alarmEnabled, setAlarmEnabled] = useState(false);

    const [alarmMinutesBefore, setAlarmMinutesBefore] = useState(60);

    /*
     * --------------------------------
     * Calendar values
     * --------------------------------
     */

    const year = currentDate.getFullYear();

    const month = currentDate.getMonth();

    const calendarDays = (() => {
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
    })();

    /*
     * --------------------------------
     * Today
     * --------------------------------
     */

    const today = new Date();

    /*
     * --------------------------------
     * Next Pay Date
     * --------------------------------
     */

    const actualNextPayDate = salarySettings?.nextPayDate
        ? getNextPayDate(
              salarySettings.nextPayDate,
              salarySettings.payFrequency,
              today,
              salarySettings.semiMonthlyType,
              salarySettings.customPayDays,
          )
        : null;

    /*
     * --------------------------------
     * 이번 급여 기간
     * --------------------------------
     */

    const currentPayPeriod =
        actualNextPayDate && salarySettings
            ? getPayPeriod(
                  actualNextPayDate,
                  salarySettings.payFrequency,
                  salarySettings.semiMonthlyType,
                  salarySettings.customPayDays,
              )
            : null;

    /*
     * --------------------------------
     * 이번 급여 기간 근무
     * --------------------------------
     */

    const periodSchedules = currentPayPeriod
        ? schedules.filter((schedule) => schedule.date >= currentPayPeriod.startDate && schedule.date <= currentPayPeriod.endDate)
        : [];

    /*
     * --------------------------------
     * 이번 급여 기간 계산
     * --------------------------------
     */

    const periodHours = periodSchedules.reduce(
        (total, schedule) => total + calculateHours(schedule.startTime, schedule.endTime, schedule.breakMinutes),
        0,
    );

    const periodTips = periodSchedules.reduce((total, schedule) => total + schedule.tip, 0);

    const hourlyPay = salarySettings?.payType === "hourly" ? periodHours * Number(salarySettings.hourlyWage ?? 0) : 0;

    const salaryPay = salarySettings?.payType === "salary" ? Number(salarySettings.monthlySalary ?? 0) : 0;

    const estimatedPay = salarySettings?.payType === "salary" ? salaryPay + periodTips : hourlyPay + periodTips;

    /*
     * --------------------------------
     * 급여 기간 비교
     *
     * useMemo 사용하지 않음.
     * React Compiler 관련 에러 방지.
     * --------------------------------
     */

    const payPeriods: {
        period: PayPeriod;
        schedules: WorkSchedule[];
        hours: number;
        tips: number;
        estimated: number;
    }[] = [];

    if (salarySettings && actualNextPayDate) {
        let payDate = new Date(actualNextPayDate);

        for (let i = 0; i < 3; i++) {
            const period = getPayPeriod(
                payDate,
                salarySettings.payFrequency,
                salarySettings.semiMonthlyType,
                salarySettings.customPayDays,
            );

            const periodItems = schedules.filter(
                (schedule) => schedule.date >= period.startDate && schedule.date <= period.endDate,
            );

            const hours = periodItems.reduce(
                (total, schedule) => total + calculateHours(schedule.startTime, schedule.endTime, schedule.breakMinutes),
                0,
            );

            const tips = periodItems.reduce((total, schedule) => total + schedule.tip, 0);

            let estimated = 0;

            if (salarySettings.payType === "salary") {
                estimated = Number(salarySettings.monthlySalary ?? 0) + tips;
            } else if (salarySettings.payType === "hourly") {
                estimated = hours * Number(salarySettings.hourlyWage ?? 0) + tips;
            }

            payPeriods.push({
                period,
                schedules: periodItems,
                hours,
                tips,
                estimated,
            });

            /*
             * 다음 급여일 계산
             */

            switch (salarySettings.payFrequency) {
                case "weekly":
                    payDate = addDays(payDate, 7);
                    break;

                case "biweekly":
                    payDate = addDays(payDate, 14);
                    break;

                case "monthly":
                    payDate = new Date(payDate.getFullYear(), payDate.getMonth() + 1, payDate.getDate());
                    break;

                case "semi-monthly":
                    if (salarySettings.semiMonthlyType === "fifteenth-end") {
                        if (payDate.getDate() === 15) {
                            payDate = new Date(payDate.getFullYear(), payDate.getMonth() + 1, 1);
                        } else {
                            payDate = new Date(payDate.getFullYear(), payDate.getMonth(), 15);
                        }
                    } else {
                        if (payDate.getDate() === 1) {
                            payDate = new Date(payDate.getFullYear(), payDate.getMonth(), 15);
                        } else {
                            payDate = new Date(payDate.getFullYear(), payDate.getMonth() + 1, 1);
                        }
                    }

                    break;

                case "custom":
                    payDate = addDays(payDate, salarySettings.customPayDays ?? 14);
                    break;
            }
        }
    }

    /*
     * --------------------------------
     * Days Until Pay
     * --------------------------------
     */

    const daysUntilPay = actualNextPayDate
        ? Math.ceil(
              (new Date(actualNextPayDate.getFullYear(), actualNextPayDate.getMonth(), actualNextPayDate.getDate()).getTime() -
                  new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime()) /
                  (1000 * 60 * 60 * 24),
          )
        : null;

    /*
     * --------------------------------
     * Modal Open
     * --------------------------------
     */

    const openAddModal = (date: string) => {
        setEditingSchedule(null);

        setSelectedDate(date);

        setStartTime("09:00");

        setEndTime("17:00");

        setBreakMinutes("30");

        setTip("0");

        setAlarmEnabled(false);

        setAlarmMinutesBefore(60);

        setIsAddModalOpen(true);
    };

    const openEditModal = (schedule: WorkSchedule) => {
        setEditingSchedule(schedule);

        setSelectedDate(schedule.date);

        setStartTime(schedule.startTime);

        setEndTime(schedule.endTime);

        setBreakMinutes(String(schedule.breakMinutes));

        setTip(String(schedule.tip));

        setAlarmEnabled(schedule.alarmEnabled);

        setAlarmMinutesBefore(schedule.alarmMinutesBefore);

        setIsAddModalOpen(true);
    };

    /*
     * --------------------------------
     * Close Modal
     * --------------------------------
     */

    const closeModal = () => {
        setIsAddModalOpen(false);

        setEditingSchedule(null);
    };

    /*
     * --------------------------------
     * Save Schedule
     * --------------------------------
     */

    const handleSaveSchedule = async () => {
        if (!selectedDate) {
            return;
        }

        const payload = {
            date: selectedDate,

            startTime,

            endTime,

            breakMinutes: Math.max(0, Number(breakMinutes) || 0),

            alarmEnabled,

            alarmMinutesBefore,

            tip: Math.max(0, Number(tip) || 0),
        };

        try {
            const response = await fetch(editingSchedule ? `/api/schedules/${editingSchedule.id}` : "/api/schedules", {
                method: editingSchedule ? "PUT" : "POST",

                headers: {
                    "Content-Type": "application/json",
                },

                body: JSON.stringify(payload),
            });

            if (!response.ok) {
                alert("근무 저장에 실패했어요.");

                return;
            }

            const saved = await response.json();

            setSchedules((prev) =>
                editingSchedule ? prev.map((item) => (item.id === saved.id ? saved : item)) : [...prev, saved],
            );

            closeModal();
        } catch {
            alert("서버와 통신하는 중 문제가 발생했어요.");
        }
    };

    /*
     * --------------------------------
     * Delete Schedule
     * --------------------------------
     */

    const handleDeleteSchedule = async () => {
        if (!editingSchedule) {
            return;
        }

        try {
            const response = await fetch(`/api/schedules/${editingSchedule.id}`, {
                method: "DELETE",
            });

            if (!response.ok) {
                alert("근무 삭제에 실패했어요.");

                return;
            }

            setSchedules((prev) => prev.filter((item) => item.id !== editingSchedule.id));

            closeModal();
        } catch {
            alert("서버와 통신하는 중 문제가 발생했어요.");
        }
    };

    /*
     * --------------------------------
     * 이번 달 근무
     * --------------------------------
     */

    const monthSchedules = schedules
        .filter((schedule) => {
            const [scheduleYear, scheduleMonth] = schedule.date.split("-").map(Number);

            return scheduleYear === year && scheduleMonth === month + 1;
        })
        .sort((a, b) => a.date.localeCompare(b.date));

    /*
     * --------------------------------
     * Modal 예상 급여
     * --------------------------------
     */

    const modalHours = calculateHours(startTime, endTime, Number(breakMinutes) || 0);

    const modalTip = Number(tip) || 0;

    const modalHourlyPay = salarySettings?.payType === "hourly" ? modalHours * Number(salarySettings.hourlyWage ?? 0) : 0;

    /*
     * 월급은 근무 1회에
     * 임의로 나누지 않는다.
     */

    const modalEstimatedPay = salarySettings?.payType === "hourly" ? modalHourlyPay + modalTip : modalTip;

    /*
     * --------------------------------
     * Render
     * --------------------------------
     */

    return (
        <main className="min-h-screen bg-gray-50 px-5 py-8">
            <div className="mx-auto max-w-md pb-24">
                {/* Header */}

                <header>
                    <p className="text-sm text-gray-500">차곡</p>

                    <h1 className="mt-2 text-3xl font-bold">근무 관리</h1>

                    <p className="mt-2 text-sm text-gray-500">이번 급여 기간과 근무를 한눈에 확인하세요.</p>
                </header>

                {/* Salary Summary */}

                <section className="mt-6 rounded-3xl bg-black p-6 text-white shadow-sm">
                    {!salarySettings ? (
                        <>
                            <p className="text-sm text-gray-300">급여 설정이 필요해요</p>

                            <p className="mt-2 text-sm text-gray-400">급여 관리에서 급여 정보를 먼저 설정해주세요.</p>
                        </>
                    ) : (
                        <>
                            <div className="flex items-start justify-between">
                                <div>
                                    <p className="text-sm text-gray-300">이번에 받을 예상 급여</p>

                                    <p className="mt-2 text-4xl font-bold">${estimatedPay.toFixed(2)}</p>
                                </div>

                                {daysUntilPay !== null && (
                                    <div className="rounded-full bg-white/10 px-3 py-1 text-xs text-gray-300">
                                        {daysUntilPay === 0 ? "오늘 지급" : `${daysUntilPay}일 후`}
                                    </div>
                                )}
                            </div>

                            {currentPayPeriod && (
                                <div className="mt-5 border-t border-white/10 pt-4">
                                    <p className="text-xs text-gray-400">이번 급여 기간</p>

                                    <p className="mt-1 text-sm">
                                        {formatDisplayDate(currentPayPeriod.startDate)}
                                        {" ~ "}
                                        {formatDisplayDate(currentPayPeriod.endDate)}
                                    </p>

                                    <p className="mt-1 text-xs text-gray-400">
                                        급여일 · {formatDisplayDate(currentPayPeriod.payDate)}
                                    </p>
                                </div>
                            )}

                            <div className="mt-5 grid grid-cols-3 gap-2">
                                <div className="rounded-2xl bg-white/10 p-3">
                                    <p className="text-xs text-gray-400">근무</p>

                                    <p className="mt-1 font-semibold">{periodSchedules.length}회</p>
                                </div>

                                <div className="rounded-2xl bg-white/10 p-3">
                                    <p className="text-xs text-gray-400">시간</p>

                                    <p className="mt-1 font-semibold">{periodHours.toFixed(1)}h</p>
                                </div>

                                <div className="rounded-2xl bg-white/10 p-3">
                                    <p className="text-xs text-gray-400">팁</p>

                                    <p className="mt-1 font-semibold">${periodTips.toFixed(2)}</p>
                                </div>
                            </div>

                            <p className="mt-4 text-xs text-gray-400">
                                {salarySettings.payType === "hourly"
                                    ? `시급 $${Number(salarySettings.hourlyWage ?? 0).toFixed(2)}`
                                    : salarySettings.payType === "salary"
                                      ? `월급 $${Number(salarySettings.monthlySalary ?? 0).toFixed(2)}`
                                      : "급여 설정 기준"}

                                {" · "}

                                {getFrequencyLabel(salarySettings)}
                            </p>
                        </>
                    )}
                </section>

                {/* Pay Period Comparison */}

                {salarySettings && payPeriods.length > 0 && (
                    <section className="mt-5 rounded-3xl bg-white p-6 shadow-sm">
                        <div>
                            <h2 className="text-lg font-semibold">급여 기간 비교</h2>

                            <p className="mt-1 text-xs text-gray-400">각 급여 기간별 예상 금액을 비교해보세요.</p>
                        </div>

                        <div className="mt-4 space-y-3">
                            {payPeriods.map((item, index) => (
                                <div
                                    key={item.period.payDate}
                                    className={`rounded-2xl p-4 ${index === 0 ? "bg-gray-100" : "bg-gray-50"}`}
                                >
                                    <div className="flex items-start justify-between gap-3">
                                        <div>
                                            <p className="text-xs text-gray-400">
                                                {index === 0 ? "이번에 받을 급여" : `${index}번째 다음 급여`}
                                            </p>

                                            <p className="mt-1 text-sm font-semibold">
                                                {formatDisplayDate(item.period.startDate)}
                                                {" ~ "}
                                                {formatDisplayDate(item.period.endDate)}
                                            </p>

                                            <p className="mt-1 text-xs text-gray-400">
                                                급여일 {formatDisplayDate(item.period.payDate)}
                                            </p>
                                        </div>

                                        <div className="shrink-0 text-right">
                                            <p className="text-lg font-bold">${item.estimated.toFixed(2)}</p>

                                            <p className="mt-1 text-xs text-gray-400">
                                                {item.hours}
                                                시간
                                                {" · "}팁 ${item.tips.toFixed(2)}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
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

                            const date = formatDate(year, month, day);

                            const daySchedules = schedules.filter((schedule) => schedule.date === date);

                            const hasSchedule = daySchedules.length > 0;

                            return (
                                <div key={date} className="relative flex h-16 flex-col items-center">
                                    <button
                                        onClick={() => (hasSchedule ? openEditModal(daySchedules[0]) : openAddModal(date))}
                                        className="flex h-12 w-full flex-col items-center justify-center rounded-xl"
                                    >
                                        <span
                                            className={
                                                hasSchedule
                                                    ? "flex h-8 w-8 items-center justify-center rounded-full bg-black text-sm font-medium text-white"
                                                    : "text-sm"
                                            }
                                        >
                                            {day}
                                        </span>

                                        {hasSchedule && <span className="absolute bottom-0 h-1 w-1 rounded-full bg-black" />}
                                    </button>
                                </div>
                            );
                        })}
                    </div>
                </section>

                {/* Month Schedule */}

                <section className="mt-5 rounded-3xl bg-white p-6 shadow-sm">
                    <div className="flex items-center justify-between">
                        <h2 className="text-lg font-semibold">이번 달 근무</h2>

                        <span className="text-sm text-gray-400">{monthSchedules.length}회</span>
                    </div>

                    {monthSchedules.length === 0 ? (
                        <p className="mt-5 text-sm text-gray-400">아직 등록된 근무가 없어요.</p>
                    ) : (
                        <div className="mt-4 space-y-3">
                            {monthSchedules.map((schedule) => {
                                const hours = calculateHours(schedule.startTime, schedule.endTime, schedule.breakMinutes);

                                const basePay =
                                    salarySettings?.payType === "hourly" ? hours * Number(salarySettings.hourlyWage ?? 0) : 0;

                                const totalPay = basePay + schedule.tip;

                                return (
                                    <button
                                        key={schedule.id}
                                        onClick={() => openEditModal(schedule)}
                                        className="w-full rounded-2xl bg-gray-50 p-4 text-left"
                                    >
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <p className="font-semibold">{formatDisplayDate(schedule.date)}</p>

                                                <p className="mt-1 text-sm text-gray-500">
                                                    {schedule.startTime}
                                                    {" ~ "}
                                                    {schedule.endTime}
                                                </p>
                                            </div>

                                            <div className="text-right">
                                                {salarySettings?.payType === "hourly" ? (
                                                    <>
                                                        <p className="font-semibold">${totalPay.toFixed(2)}</p>

                                                        <p className="mt-1 text-xs text-gray-400">{hours.toFixed(1)}시간</p>
                                                    </>
                                                ) : salarySettings?.payType === "salary" ? (
                                                    <>
                                                        <p className="font-semibold">월급</p>

                                                        <p className="mt-1 text-xs text-gray-400">{hours.toFixed(1)}시간</p>
                                                    </>
                                                ) : (
                                                    <p className="font-semibold">-</p>
                                                )}
                                            </div>
                                        </div>

                                        <div className="mt-3 flex gap-2">
                                            {schedule.tip > 0 && (
                                                <span className="rounded-full bg-white px-3 py-1 text-xs text-gray-500">
                                                    💰 팁 ${schedule.tip.toFixed(2)}
                                                </span>
                                            )}

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
                    )}
                </section>

                {/* Modal */}

                {isAddModalOpen && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-5">
                        <div className="w-full max-w-md rounded-3xl bg-white p-6">
                            {/* Header */}

                            <div className="flex items-center justify-between">
                                <div>
                                    <h2 className="text-xl font-bold">{editingSchedule ? "근무 수정" : "근무 추가"}</h2>

                                    <p className="mt-1 text-sm text-gray-400">{selectedDate}</p>
                                </div>

                                <button onClick={closeModal} className="text-gray-400">
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

                            {/* Hours */}

                            <div className="mt-4 rounded-2xl bg-gray-50 p-4">
                                <div className="flex justify-between">
                                    <span className="text-sm text-gray-500">실제 근무시간</span>

                                    <span className="font-semibold">
                                        {modalHours.toFixed(1)}
                                        시간
                                    </span>
                                </div>
                            </div>

                            {/* Break */}

                            <div className="mt-4">
                                <p className="mb-2 text-sm text-gray-500">휴게시간</p>

                                <div className="flex items-center gap-3">
                                    <input
                                        type="number"
                                        min="0"
                                        value={breakMinutes}
                                        onChange={(e) => setBreakMinutes(e.target.value)}
                                        className="w-full rounded-2xl bg-gray-100 px-4 py-4 outline-none"
                                    />

                                    <span className="shrink-0 text-sm text-gray-500">분</span>
                                </div>
                            </div>

                            {/* Tip */}

                            <div className="mt-4">
                                <p className="mb-2 text-sm text-gray-500">팁</p>

                                <div className="flex items-center rounded-2xl bg-gray-100 px-4">
                                    <span className="text-gray-500">$</span>

                                    <input
                                        type="number"
                                        min="0"
                                        step="0.01"
                                        value={tip}
                                        onChange={(e) => setTip(e.target.value)}
                                        className="w-full bg-transparent px-2 py-4 outline-none"
                                    />
                                </div>
                            </div>

                            {/* Estimated Pay */}

                            <div className="mt-4 rounded-2xl bg-gray-50 p-4">
                                <p className="text-sm text-gray-500">이 근무 정보</p>

                                {salarySettings?.payType === "hourly" ? (
                                    <>
                                        <p className="mt-1 text-2xl font-bold">${modalEstimatedPay.toFixed(2)}</p>

                                        <div className="mt-3 space-y-1 text-xs text-gray-400">
                                            <div className="flex justify-between">
                                                <span>기본 급여</span>

                                                <span>${modalHourlyPay.toFixed(2)}</span>
                                            </div>

                                            <div className="flex justify-between">
                                                <span>팁</span>

                                                <span>${modalTip.toFixed(2)}</span>
                                            </div>
                                        </div>
                                    </>
                                ) : salarySettings?.payType === "salary" ? (
                                    <>
                                        <p className="mt-1 text-2xl font-bold">월급 기준</p>

                                        <p className="mt-2 text-xs text-gray-400">
                                            월급은 급여 기간 전체에 적용되며, 근무 1회 금액으로 나누지 않아요.
                                        </p>

                                        {modalTip > 0 && (
                                            <p className="mt-2 text-xs text-gray-500">이번 근무 팁 ${modalTip.toFixed(2)}</p>
                                        )}
                                    </>
                                ) : (
                                    <p className="mt-1 text-sm text-gray-400">
                                        현재 급여 방식에서는 근무별 예상 급여를 계산하지 않아요.
                                    </p>
                                )}
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
                                                const allowed = await requestNotificationPermission();

                                                if (!allowed) {
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

                            {/* Save */}

                            <button
                                onClick={handleSaveSchedule}
                                className="mt-5 w-full rounded-2xl bg-black py-4 font-semibold text-white"
                            >
                                {editingSchedule ? "근무 수정" : "근무 등록"}
                            </button>

                            {/* Delete */}

                            {editingSchedule && (
                                <button
                                    onClick={handleDeleteSchedule}
                                    className="mt-3 w-full rounded-2xl bg-red-50 py-4 font-semibold text-red-500"
                                >
                                    근무 삭제
                                </button>
                            )}

                            {/* Cancel */}

                            <button onClick={closeModal} className="mt-3 w-full py-3 text-sm text-gray-400">
                                취소
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </main>
    );
}
