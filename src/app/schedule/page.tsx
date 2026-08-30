"use client";

import { useMemo, useState } from "react";

type PayType = "hourly" | "salary" | "commission" | "other";

type PayFrequency = "weekly" | "biweekly" | "semi-monthly" | "monthly" | "custom";

type SemiMonthlyType = "first-fifteenth" | "fifteenth-end";

type Province = "ON" | "BC" | "AB" | "SK" | "MB" | "QC" | "NS" | "NB" | "NL" | "PE" | "YT" | "NT" | "NU";

type TipType = "cash" | "paycheque" | "both";

type SalarySettings = {
    province?: Province;
    payType: PayType;
    payFrequency: PayFrequency;
    hourlyWage?: number;
    monthlySalary?: number;
    nextPayDate?: string;
    semiMonthlyType?: SemiMonthlyType;
    customPayDays?: number;
    hasTips?: boolean;
    tipType?: TipType;
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

type PayrollDeductions = {
    grossPay: number;
    cpp: number;
    cpp2: number;
    ei: number;
    federalTax: number;
    provincialTax: number;
    totalDeductions: number;
    netPay: number;
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

const addDays = (date: Date, days: number) => {
    const result = new Date(date);

    result.setDate(result.getDate() + days);

    return result;
};

const formatISO = (date: Date) => {
    const year = date.getFullYear();

    const month = String(date.getMonth() + 1).padStart(2, "0");

    const day = String(date.getDate()).padStart(2, "0");

    return `${year}-${month}-${day}`;
};

const getPayPeriod = (
    payDate: Date,
    frequency: PayFrequency,
    semiMonthlyType?: SemiMonthlyType,
    customPayDays?: number,
): PayPeriod => {
    const end = new Date(payDate);
    let start = new Date(payDate);

    switch (frequency) {
        case "weekly": {
            // 월~일 또는 급여일 기준 7일
            start = addDays(end, -6);
            break;
        }

        case "biweekly": {
            // 급여일 포함 14일
            start = addDays(end, -13);
            break;
        }

        case "monthly": {
            // 직전 월의 같은 날짜 다음 날 ~ 급여일
            start = new Date(end.getFullYear(), end.getMonth() - 1, end.getDate() + 1);
            break;
        }

        case "semi-monthly": {
            if (semiMonthlyType === "first-fifteenth") {
                if (end.getDate() <= 15) {
                    // 1일 ~ 15일
                    start = new Date(end.getFullYear(), end.getMonth(), 1);
                } else {
                    // 16일 ~ 말일
                    start = new Date(end.getFullYear(), end.getMonth(), 16);
                }
            } else if (semiMonthlyType === "fifteenth-end") {
                if (end.getDate() <= 15) {
                    // 16일 ~ 전월 말일
                    start = new Date(end.getFullYear(), end.getMonth() - 1, 16);
                } else {
                    // 당월 1일 ~ 15일
                    start = new Date(end.getFullYear(), end.getMonth(), 1);
                }
            } else {
                // 설정값이 없으면 기본적으로 1~15 / 16~말일
                if (end.getDate() <= 15) {
                    start = new Date(end.getFullYear(), end.getMonth(), 1);
                } else {
                    start = new Date(end.getFullYear(), end.getMonth(), 16);
                }
            }

            break;
        }

        case "custom": {
            const days = Math.max(1, Number(customPayDays) || 14);

            start = addDays(end, -(days - 1));
            break;
        }

        default: {
            // 혹시 저장된 급여 설정의 payFrequency가
            // 예상한 값이 아니더라도 기간이 하루로 고정되지 않게 함
            start = addDays(end, -13);
            break;
        }
    }

    return {
        startDate: formatISO(start),
        endDate: formatISO(end),
        payDate: formatISO(end),
    };
};

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

const calculateProgressiveTax = (income: number, brackets: { limit: number; rate: number }[]) => {
    let tax = 0;
    let previousLimit = 0;

    for (const bracket of brackets) {
        const taxable = Math.min(income, bracket.limit) - previousLimit;

        if (taxable > 0) {
            tax += taxable * bracket.rate;
        }

        if (income <= bracket.limit) {
            break;
        }

        previousLimit = bracket.limit;
    }

    return tax;
};

const calculatePayrollDeductions = (grossPay: number, payFrequency: PayFrequency, province: Province = "ON") => {
    if (grossPay <= 0) {
        return {
            cpp: 0,
            cpp2: 0,
            ei: 0,
            federalTax: 0,
            provincialTax: 0,
            totalDeductions: 0,
            netPay: 0,
        };
    }

    const periodsPerYear =
        payFrequency === "weekly"
            ? 52
            : payFrequency === "biweekly"
              ? 26
              : payFrequency === "semi-monthly"
                ? 24
                : payFrequency === "monthly"
                  ? 12
                  : 26;

    const annualGross = grossPay * periodsPerYear;

    // 2026 CPP
    const cppAnnual = Math.min(Math.max(0, annualGross - 3500) * 0.0595, 4230.45);

    // 2026 CPP2
    const cpp2Annual = Math.min(Math.max(0, annualGross - 74600) * 0.04, 416);

    // 2026 EI
    const eiAnnual = Math.min(annualGross * 0.0163, 1123.07);

    /*
     * 연간 소득을 기준으로 세금을 계산한 뒤
     * 현재 급여 주기로 나눈다.
     *
     * 기본적인 개인 공제만 반영한다.
     */
    const federalTaxableIncome = Math.max(0, annualGross - 16452);

    const federalTaxAnnual = calculateProgressiveTax(federalTaxableIncome, [
        { limit: 58523, rate: 0.14 },
        { limit: 117045, rate: 0.205 },
        { limit: 181440, rate: 0.26 },
        { limit: 258482, rate: 0.29 },
        { limit: Infinity, rate: 0.33 },
    ]);

    let provincialTaxAnnual = 0;

    if (province === "ON") {
        const ontarioTaxableIncome = Math.max(0, annualGross - 12989);

        provincialTaxAnnual = calculateProgressiveTax(ontarioTaxableIncome, [
            { limit: 53891, rate: 0.0505 },
            { limit: 107785, rate: 0.0915 },
            { limit: 150000, rate: 0.1116 },
            { limit: 220000, rate: 0.1216 },
            { limit: Infinity, rate: 0.1316 },
        ]);
    }

    const cpp = cppAnnual / periodsPerYear;
    const cpp2 = cpp2Annual / periodsPerYear;
    const ei = eiAnnual / periodsPerYear;

    const federalTax = federalTaxAnnual / periodsPerYear;
    const provincialTax = provincialTaxAnnual / periodsPerYear;

    const totalDeductions = cpp + cpp2 + ei + federalTax + provincialTax;

    return {
        cpp,
        cpp2,
        ei,
        federalTax,
        provincialTax,
        totalDeductions,
        netPay: Math.max(0, grossPay - totalDeductions),
    };
};

const getInitialSchedules = (): WorkSchedule[] => {
    if (typeof window === "undefined") {
        return [];
    }

    try {
        const saved = localStorage.getItem("chagok-schedules");

        if (!saved) {
            return [];
        }

        const parsed = JSON.parse(saved);

        if (!Array.isArray(parsed)) {
            return [];
        }

        return parsed;
    } catch {
        return [];
    }
};

const getInitialSalarySettings = (): SalarySettings | null => {
    if (typeof window === "undefined") {
        return null;
    }

    try {
        const saved = localStorage.getItem("chagok-salary-settings");

        if (!saved) {
            return null;
        }

        return JSON.parse(saved);
    } catch {
        return null;
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

export default function SchedulePage() {
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

    const [schedules, setSchedules] = useState<WorkSchedule[]>(getInitialSchedules);

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

    /*
     * --------------------------------------------------
     * Salary Settings
     * --------------------------------------------------
     */

    const salarySettings = getInitialSalarySettings();

    const hourlyWage = salarySettings?.payType === "hourly" ? Number(salarySettings.hourlyWage ?? 0) : 0;

    const monthlySalary = salarySettings?.payType === "salary" ? Number(salarySettings.monthlySalary ?? 0) : 0;

    /*
     * --------------------------------------------------
     * Current Pay Period
     * --------------------------------------------------
     */

    const today = new Date();

    const actualNextPayDate = salarySettings?.nextPayDate
        ? getNextPayDate(
              salarySettings.nextPayDate,
              salarySettings.payFrequency,
              today,
              salarySettings.semiMonthlyType,
              salarySettings.customPayDays,
          )
        : null;

    const currentPayPeriod =
        salarySettings && actualNextPayDate
            ? getPayPeriod(
                  actualNextPayDate,
                  salarySettings.payFrequency,
                  salarySettings.semiMonthlyType,
                  salarySettings.customPayDays,
              )
            : null;

    const currentPeriodTips: PayPeriodTips | null = (() => {
        if (typeof window === "undefined" || !currentPayPeriod) {
            return null;
        }

        const saved = localStorage.getItem("chagok-pay-period-tips");

        if (!saved) {
            return null;
        }

        try {
            const parsed: PayPeriodTips[] = JSON.parse(saved);

            if (!Array.isArray(parsed)) {
                return null;
            }

            return (
                parsed.find(
                    (item) =>
                        item.payPeriodStart === currentPayPeriod.startDate && item.payPeriodEnd === currentPayPeriod.endDate,
                ) ?? null
            );
        } catch {
            return null;
        }
    })();

    const loadPayPeriodTips = (period: PayPeriod | null) => {
        if (!period) {
            setCashTips("");
            setPaychequeTips("");
            return;
        }

        const saved = localStorage.getItem("chagok-pay-period-tips");

        if (!saved) {
            setCashTips("");
            setPaychequeTips("");
            return;
        }

        try {
            const tips: PayPeriodTips[] = JSON.parse(saved);

            const found = tips.find((item) => item.payPeriodStart === period.startDate && item.payPeriodEnd === period.endDate);

            if (!found) {
                setCashTips("");
                setPaychequeTips("");
                return;
            }

            setCashTips(found.cashTips > 0 ? String(found.cashTips) : "");
            setPaychequeTips(found.paychequeTips > 0 ? String(found.paychequeTips) : "");
        } catch {
            setCashTips("");
            setPaychequeTips("");
        }
    };

    const savedCashTips = currentPeriodTips?.cashTips ?? 0;
    const savedPaychequeTips = currentPeriodTips?.paychequeTips ?? 0;

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

        setSelectedDate(schedule.date);

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

    const saveSchedule = (breakSetting: { enabled: boolean; minutes: number }) => {
        if (!selectedDate) {
            return;
        }

        const schedule: WorkSchedule = {
            id: editingSchedule?.id ?? Date.now(),

            date: selectedDate,

            startTime,

            endTime,

            hasBreak: breakSetting.enabled,

            breakMinutes: breakSetting.enabled ? breakSetting.minutes : 0,

            alarmEnabled,

            alarmMinutesBefore,
        };

        setSchedules((prev) => {
            const updated = editingSchedule
                ? prev.map((item) => (item.id === editingSchedule.id ? schedule : item))
                : [...prev, schedule];

            localStorage.setItem("chagok-schedules", JSON.stringify(updated));

            return updated;
        });

        setIsAddModalOpen(false);
        setEditingSchedule(null);
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

    const handleDeleteSchedule = () => {
        if (!editingSchedule) {
            return;
        }

        setSchedules((prev) => {
            const updated = prev.filter((item) => item.id !== editingSchedule.id);

            localStorage.setItem("chagok-schedules", JSON.stringify(updated));

            return updated;
        });

        setIsAddModalOpen(false);
        setEditingSchedule(null);
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

    const periodPaychequeTips = savedTips?.paychequeTips ?? currentPeriodTips?.paychequeTips ?? 0;

    const periodCashTips = savedTips?.cashTips ?? currentPeriodTips?.cashTips ?? 0;

    const estimatedBasePay =
        salarySettings?.payType === "hourly"
            ? periodHours * hourlyWage
            : salarySettings?.payType === "salary"
              ? Number(salarySettings.monthlySalary ?? 0)
              : 0;

    // 급여 포함 팁이 있을 때만 세전 급여에 포함
    const hasPaychequeTips =
        salarySettings?.hasTips && (salarySettings.tipType === "paycheque" || salarySettings.tipType === "both");

    const taxableGrossPay = estimatedBasePay + (hasPaychequeTips ? periodPaychequeTips : 0);

    // 세금 계산
    const payrollDeductions = calculatePayrollDeductions(
        taxableGrossPay,
        salarySettings?.payFrequency ?? "biweekly",
        salarySettings?.province ?? "ON",
    );

    const estimatedNetPay = payrollDeductions.netPay;

    // 현금 팁이 있을 때만 세후 금액에 추가
    const hasCashTips = salarySettings?.hasTips && (salarySettings.tipType === "cash" || salarySettings.tipType === "both");

    const actualCashTips = hasCashTips ? periodCashTips : 0;

    const finalEstimatedIncome = estimatedNetPay + actualCashTips;

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
     * Render
     * --------------------------------------------------
     */

    return (
        <main className="min-h-screen bg-gray-50 px-5 py-8">
            <div className="mx-auto max-w-md pb-24">
                {/* Header */}

                <header>
                    <p className="text-sm text-gray-500">차곡</p>

                    <h1 className="mt-2 text-3xl font-bold">근무 관리</h1>

                    <p className="mt-2 text-sm text-gray-500">근무 일정을 등록하고 예상 급여를 확인해보세요.</p>
                </header>

                {/* Expected Salary */}

                <section className="mt-6 rounded-3xl bg-black p-6 text-white shadow-sm">
                    <p className="text-sm text-gray-300">예상 급여</p>

                    <p className="mt-3 text-4xl font-bold">${estimatedNetPay.toFixed(2)}</p>

                    <div className="mt-6 space-y-3 text-sm">
                        {/* 근무시간 */}
                        <div className="flex justify-between">
                            <span className="text-gray-400">근무시간</span>

                            <span>{periodHours.toFixed(1)}시간</span>
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
                                <span className="text-gray-300">${payrollDeductions.cpp.toFixed(2)}</span>
                            </div>

                            <div className="flex justify-between">
                                <span className="text-gray-500">CPP2</span>
                                <span className="text-gray-300">${payrollDeductions.cpp2.toFixed(2)}</span>
                            </div>

                            <div className="flex justify-between">
                                <span className="text-gray-500">EI</span>
                                <span className="text-gray-300">${payrollDeductions.ei.toFixed(2)}</span>
                            </div>

                            <div className="flex justify-between">
                                <span className="text-gray-500">연방 소득세</span>
                                <span className="text-gray-300">${payrollDeductions.federalTax.toFixed(2)}</span>
                            </div>

                            <div className="flex justify-between">
                                <span className="text-gray-500">주 소득세</span>
                                <span className="text-gray-300">${payrollDeductions.provincialTax.toFixed(2)}</span>
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
                                        value={
                                            cashTips !== ""
                                                ? cashTips
                                                : currentPeriodTips?.cashTips
                                                  ? String(currentPeriodTips.cashTips)
                                                  : ""
                                        }
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
                                        value={
                                            paychequeTips !== ""
                                                ? paychequeTips
                                                : currentPeriodTips?.paychequeTips
                                                  ? String(currentPeriodTips.paychequeTips)
                                                  : ""
                                        }
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
                            onClick={() => {
                                if (!currentPayPeriod) {
                                    return;
                                }

                                const newTips: PayPeriodTips = {
                                    payPeriodStart: currentPayPeriod.startDate,
                                    payPeriodEnd: currentPayPeriod.endDate,
                                    cashTips: Math.max(0, Number(cashTips || 0)),
                                    paychequeTips: Math.max(0, Number(paychequeTips || 0)),
                                };

                                const saved = localStorage.getItem("chagok-pay-period-tips");

                                let tips: PayPeriodTips[] = [];

                                try {
                                    tips = saved ? JSON.parse(saved) : [];
                                } catch {
                                    tips = [];
                                }

                                const updated = [
                                    ...tips.filter(
                                        (item) =>
                                            item.payPeriodStart !== currentPayPeriod.startDate ||
                                            item.payPeriodEnd !== currentPayPeriod.endDate,
                                    ),
                                    newTips,
                                ];

                                localStorage.setItem("chagok-pay-period-tips", JSON.stringify(updated));

                                setSavedTips(newTips);

                                alert("팁이 저장됐어요!");
                            }}
                            className="mt-4 w-full rounded-2xl bg-black py-4 text-sm font-semibold text-white"
                        >
                            팁 저장
                        </button>
                    </section>
                )}

                {/* Pay Period Notice */}

                {currentPayPeriod && (
                    <section className="mt-5 rounded-3xl bg-white p-5 shadow-sm">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm font-semibold">현재 급여 기간</p>

                                <p className="mt-1 text-xs text-gray-400">
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

                        <p className="mt-4 text-xs text-gray-400">달력의 회색 영역이 현재 급여 기간입니다.</p>
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
                                                    : "text-sm"
                                            }
                                        >
                                            {day}
                                        </span>

                                        {hasSchedule && !isPayDate && (
                                            <span className="absolute bottom-1 h-1 w-1 rounded-full bg-black" />
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
                        <div className="mt-4 space-y-3">
                            {currentMonthSchedules.map((schedule) => {
                                const hours = calculateHours(
                                    schedule.startTime,
                                    schedule.endTime,
                                    schedule.hasBreak ? schedule.breakMinutes : 0,
                                );

                                const basePay = hours * hourlyWage;

                                const totalPay = basePay;

                                const isInPayPeriod = currentPayPeriod
                                    ? schedule.date >= currentPayPeriod.startDate && schedule.date <= currentPayPeriod.endDate
                                    : false;

                                return (
                                    <button
                                        key={schedule.id}
                                        onClick={() => openEditModal(schedule)}
                                        className="w-full rounded-2xl bg-gray-50 p-4 text-left"
                                    >
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <div className="flex items-center gap-2">
                                                    <p className="font-semibold">{formatDisplayDate(schedule.date)}</p>
                                                </div>

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
                    )}
                </section>

                {/* Add / Edit Modal */}

                {isAddModalOpen && (
                    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-5">
                        <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-3xl bg-white p-6 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
                            {/* Modal Header */}

                            <div className="flex items-center justify-between">
                                <div>
                                    <h2 className="text-xl font-bold">{editingSchedule ? "근무 수정" : "근무 추가"}</h2>

                                    <p className="mt-1 text-sm text-gray-400">{selectedDate}</p>
                                </div>

                                <button
                                    onClick={() => {
                                        setIsAddModalOpen(false);
                                        setEditingSchedule(null);
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
                                                onChange={(e) => setBreakMinutes(e.target.value)}
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
                                        {calculateHours(startTime, endTime, hasBreak ? Number(breakMinutes) || 0 : 0).toFixed(1)}
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
