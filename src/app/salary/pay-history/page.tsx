"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import BackButtonHeader from "@/components/BackButtonHeader";
import { getPayPeriodEndDate, formatDate } from "@/lib/payPeriod";
import { calculateTaxes } from "@/lib/tax";
import { isHoliday } from "@/lib/holiday";
import { calculateExpectedSalary } from "@/lib/payroll/calculateExpectedSalary";
import { Lock } from "lucide-react";

type AdjustmentType = "add" | "subtract";

type Adjustment = {
    type: AdjustmentType;
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
    tips: number;
    deductions: number;

    adjustments: Adjustment[];
    hourlyWage: number | null;

    calculatedNetPay: number;
    netPay: number;
    totalIncome: number;
};

type PayPeriodTips = {
    payPeriodStart: string;
    payPeriodEnd: string;
    cashTips: number;
    paychequeTips: number;
};

type SalarySettings = {
    country?: string;
    province?: string;

    payType?: "hourly" | "salary" | "commission" | "other";

    payFrequency: "weekly" | "biweekly" | "semi-monthly" | "monthly" | "custom";

    hourlyWage: number | null;
    monthlySalary?: number | null;

    hasTips?: boolean;
    tipType?: "cash" | "paycheque" | "both" | null;

    payPeriodStartDate: string | null;
    payDate: string | null;
    payDateOffset: number | null;

    semiMonthlyType?: "first-fifteenth" | "fifteenth-end";
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

type Holiday = {
    date: string;
    name: string;
    global: boolean;
};

type FormState = {
    startDate: string;
    endDate: string;
    payDate: string;

    hours: string;
    pay: string;
    tips: string;
    deductions: string;

    adjustments: Adjustment[];

    netPay: string;
};

type HistoryFilter = "all" | "this-month" | "3-months" | "6-months" | "1-year" | "custom";

const emptyForm: FormState = {
    startDate: "",
    endDate: "",
    payDate: "",

    hours: "",
    pay: "",
    tips: "",
    deductions: "",

    adjustments: [],

    netPay: "",
};

const formatDisplayDate = (value: string) => {
    return formatDate(new Date(`${value}T00:00:00`));
};

const formatMoney = (value: number | null | undefined) => {
    const amount = Number(value);

    if (!Number.isFinite(amount)) {
        return "$0.00";
    }

    return `$${amount.toFixed(2)}`;
};

const normalizeNumberInput = (value: string) => {
    if (value === "") {
        return "";
    }

    return value.replace(/^0+(?=\d)/, "");
};

/*
 * 오늘 날짜를 YYYY-MM-DD로 반환
 */
const getTodayString = () => {
    const today = new Date();

    return [today.getFullYear(), String(today.getMonth() + 1).padStart(2, "0"), String(today.getDate()).padStart(2, "0")].join(
        "-",
    );
};

const getDaysDifference = (targetDate: string) => {
    const today = new Date();

    const todayOnly = new Date(today.getFullYear(), today.getMonth(), today.getDate());

    const target = new Date(`${targetDate}T00:00:00`);

    return Math.round((target.getTime() - todayOnly.getTime()) / (1000 * 60 * 60 * 24));
};

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

    const totalMinutes = Math.max(0, end - start - Math.max(0, breakMinutes));

    return totalMinutes / 60;
};

/*
 * 날짜를 YYYY-MM-DD로 반환
 */
const formatDateString = (date: Date) => {
    return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, "0"), String(date.getDate()).padStart(2, "0")].join("-");
};

/*
 * 현재 달의 시작일
 */
const getCurrentMonthStart = () => {
    const today = new Date();

    return formatDateString(new Date(today.getFullYear(), today.getMonth(), 1));
};

/*
 * 현재 달의 마지막 날
 */
const getCurrentMonthEnd = () => {
    const today = new Date();

    return formatDateString(new Date(today.getFullYear(), today.getMonth() + 1, 0));
};

/*
 * 급여 기록 필터의 기본 기간 계산
 *
 * 이번 달:
 * 현재 달 1일 ~ 현재 달 말일
 *
 * 3개월:
 * 현재 달 포함 최근 3개 달
 *
 * 6개월:
 * 현재 달 포함 최근 6개 달
 *
 * 1년:
 * 현재 달 포함 최근 12개 달
 */
const getPresetDateRange = (filter: Exclude<HistoryFilter, "custom">) => {
    const today = new Date();

    const endDate = getCurrentMonthEnd();

    if (filter === "month") {
        return {
            startDate: getCurrentMonthStart(),
            endDate,
        };
    }

    const monthCount = filter === "3months" ? 3 : filter === "6months" ? 6 : 12;

    const start = new Date(today.getFullYear(), today.getMonth() - (monthCount - 1), 1);

    return {
        startDate: formatDateString(start),
        endDate,
    };
};

export default function PayHistoryPage() {
    const [planCode, setPlanCode] = useState<"free" | "pro">("free");

    const [payHistory, setPayHistory] = useState<PayHistory[]>([]);

    const [isLoading, setIsLoading] = useState(true);

    const [selectedHistory, setSelectedHistory] = useState<PayHistory | null>(null);

    const [isFormOpen, setIsFormOpen] = useState(false);

    const [isSaving, setIsSaving] = useState(false);

    const [hourlyWage, setHourlyWage] = useState<number | null>(null);

    const [form, setForm] = useState<FormState>(emptyForm);

    const [salarySettings, setSalarySettings] = useState<SalarySettings | null>(null);

    const [schedules, setSchedules] = useState<WorkSchedule[]>([]);

    const [holidays, setHolidays] = useState<Holiday[]>([]);

    const [isPendingExpectedOpen, setIsPendingExpectedOpen] = useState(false);

    const [animatedPendingNetPay, setAnimatedPendingNetPay] = useState(0);

    const [pendingSavedTips, setPendingSavedTips] = useState<PayPeriodTips | null>(null);

    const [pendingPeriod, setPendingPeriod] = useState<{
        startDate: string;
        endDate: string;
        payDate: string | null;
    } | null>(null);

    const [isPendingPeriod, setIsPendingPeriod] = useState(false);

    /*
     * 급여 기록 필터
     */
    const [historyFilter, setHistoryFilter] = useState<HistoryFilter>("all");

    const [customStartDate, setCustomStartDate] = useState("");
    const [customEndDate, setCustomEndDate] = useState("");

    const [isHistoryFilterOpen, setIsHistoryFilterOpen] = useState(false);

    const [showAllHistory, setShowAllHistory] = useState(false);

    /*
     * 급여 기록이 많을 때
     * 처음에는 6개만 표시
     */
    const [isHistoryExpanded, setIsHistoryExpanded] = useState(false);

    const loadPayHistory = async () => {
        try {
            const response = await fetch("/api/pay-history");

            if (!response.ok) {
                throw new Error("급여 기록 조회 실패");
            }

            const data = (await response.json()) as Array<{
                id: number;

                startDate: string;
                endDate: string;
                payDate: string | null;

                hours?: number;
                basePay?: number;
                pay?: number;

                cashTips?: number;
                paychequeTips?: number;
                tips?: number;

                deductions?: number;

                actualPay?: number;
                actualTips?: number;
                actualDeductions?: number;
                actualNetPay?: number | null;

                netPay?: number;
                totalIncome?: number;

                calculatedNetPay?: number;

                adjustments?: Adjustment[];

                hourlyWage?: number | null;
            }>;

            const normalizedData: PayHistory[] = data.map((item) => {
                const basePay = Number(item.basePay ?? item.pay ?? 0);

                const cashTips = Number(item.cashTips ?? 0);

                const paychequeTips = Number(item.paychequeTips ?? 0);

                const calculatedTips = Number(item.tips ?? cashTips + paychequeTips);

                const actualPay = Number(item.actualPay ?? 0);

                const actualTips = Number(item.actualTips ?? calculatedTips);

                const calculatedDeductions = Number(item.deductions ?? 0);

                const actualDeductions = Number(item.actualDeductions ?? calculatedDeductions);

                const calculatedNetPay = Number(
                    item.netPay ?? item.calculatedNetPay ?? basePay + calculatedTips - calculatedDeductions,
                );

                const actualNetPay =
                    item.actualNetPay !== null && item.actualNetPay !== undefined ? Number(item.actualNetPay) : calculatedNetPay;

                return {
                    id: Number(item.id),

                    startDate: String(item.startDate),

                    endDate: String(item.endDate),

                    payDate: item.payDate ? String(item.payDate) : null,

                    hours: Number(item.hours ?? 0),

                    pay: actualPay > 0 ? actualPay : basePay,

                    tips: actualTips,

                    deductions: actualDeductions,

                    adjustments: Array.isArray(item.adjustments) ? item.adjustments : [],

                    hourlyWage: item.hourlyWage !== null && item.hourlyWage !== undefined ? Number(item.hourlyWage) : null,

                    calculatedNetPay,

                    netPay: actualNetPay,

                    totalIncome: Number(item.totalIncome ?? actualNetPay + actualTips),
                };
            });

            setPayHistory(normalizedData);

            return normalizedData;
        } catch (error) {
            console.error(error);

            return [];
        } finally {
            setIsLoading(false);
        }
    };

    const loadSalarySettings = async () => {
        try {
            const response = await fetch("/api/salary-settings");

            if (!response.ok) {
                throw new Error("급여 설정 조회 실패");
            }

            const settings = (await response.json()) as SalarySettings | null;

            setSalarySettings(settings);

            setHourlyWage(settings?.hourlyWage ?? null);

            return settings;
        } catch (error) {
            console.error(error);

            return null;
        }
    };

    const loadSchedules = async () => {
        try {
            const response = await fetch("/api/work-schedules");

            if (!response.ok) {
                throw new Error("근무 일정 조회 실패");
            }

            const data = (await response.json()) as WorkSchedule[];

            setSchedules(data);

            return data;
        } catch (error) {
            console.error(error);

            return [];
        }
    };

    const loadHolidays = async (year: number, province?: string) => {
        try {
            const params = new URLSearchParams({
                year: String(year),
            });

            if (province) {
                params.set("province", province);
            }

            const response = await fetch(`/api/holidays?${params.toString()}`);

            if (!response.ok) {
                throw new Error("공휴일 조회 실패");
            }

            const data = (await response.json()) as Holiday[];

            setHolidays(data);

            return data;
        } catch (error) {
            console.error(error);

            setHolidays([]);

            return [];
        }
    };

    /*
     * 프리미엄 유저
     * 플랜
     */
    useEffect(() => {
        const loadPlan = async () => {
            try {
                const response = await fetch("/api/auth/me");

                if (!response.ok) {
                    return;
                }

                const data = await response.json();

                setPlanCode(data.planCode === "pro" ? "pro" : "free");
            } catch (error) {
                console.error("요금제 조회 실패:", error);
            }
        };

        void loadPlan();
    }, []);

    useEffect(() => {
        const load = async () => {
            const [, salarySettingsData] = await Promise.all([loadPayHistory(), loadSalarySettings(), loadSchedules()]);

            if (salarySettingsData) {
                await loadHolidays(new Date().getFullYear(), salarySettingsData.province);
            }
        };

        void load();
    }, []);

    /*
     * salary 페이지에서 전달한
     * 미기록 급여기간
     */
    useEffect(() => {
        const params = new URLSearchParams(window.location.search);

        const startDate = params.get("startDate");
        const endDate = params.get("endDate");
        const payDate = params.get("payDate");

        if (!startDate || !endDate) {
            return;
        }

        setPendingPeriod({
            startDate,
            endDate,
            payDate,
        });
    }, []);

    /*
     * 실제 데이터가 로드된 뒤
     * pending 기간이 아직 없는지 확인
     */
    useEffect(() => {
        if (!pendingPeriod) {
            setIsPendingPeriod(false);
            return;
        }

        const exists = payHistory.some(
            (history) => history.startDate === pendingPeriod.startDate && history.endDate === pendingPeriod.endDate,
        );

        setIsPendingPeriod(!exists);
    }, [payHistory, pendingPeriod]);

    /*
     * 지급일이 오늘 이후인 급여는
     * 아직 실제 지급된 급여가 아니므로 리스트에서 숨김
     *
     * 지급일이 없는 수동 기록은 그대로 표시
     */
    const formatDateValue = (date: Date) => {
        return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, "0"), String(date.getDate()).padStart(2, "0")].join(
            "-",
        );
    };

    const visiblePayHistory = useMemo(() => {
        const today = getTodayString();

        return payHistory.filter((history) => {
            if (!history.payDate) return true;
            return history.payDate <= today;
        });
    }, [payHistory]);

    const sortedPayHistory = useMemo(() => {
        return [...visiblePayHistory].sort((a, b) => {
            const aDate = a.payDate ?? a.endDate;
            const bDate = b.payDate ?? b.endDate;

            return bDate.localeCompare(aDate);
        });
    }, [visiblePayHistory]);

    const isCustomRangeValid =
        historyFilter !== "custom" || (!!customStartDate && !!customEndDate && customStartDate <= customEndDate);

    const historyRange = useMemo(() => {
        if (historyFilter === "all" || !isCustomRangeValid) {
            return null;
        }

        if (historyFilter === "custom") {
            return {
                startDate: customStartDate,
                endDate: customEndDate,
            };
        }

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const start = new Date(today);

        if (historyFilter === "this-month") {
            start.setDate(1);
        }

        if (historyFilter === "3-months") {
            start.setDate(1);
            start.setMonth(start.getMonth() - 2);
        }

        if (historyFilter === "6-months") {
            start.setDate(1);
            start.setMonth(start.getMonth() - 5);
        }

        if (historyFilter === "1-year") {
            start.setDate(1);
            start.setMonth(start.getMonth() - 11);
        }

        return {
            startDate: formatDateValue(start),
            endDate: formatDateValue(today),
        };
    }, [historyFilter, customStartDate, customEndDate, isCustomRangeValid]);

    // 급여 기간 필터
    useEffect(() => {
        setShowAllHistory(false);
    }, [historyFilter, customStartDate, customEndDate]);

    /*
     * ---------------------------------------------------------
     * 급여 기록 기간 필터
     *
     * 지급일이 아니라
     * 급여 기간(startDate ~ endDate)을 기준으로 판단
     *
     * 선택한 범위 안에 급여 기간 전체가 들어와야 표시
     * ---------------------------------------------------------
     */
    const historyDateRange = useMemo(() => {
        if (historyFilter === "custom") {
            return {
                startDate: customStartDate,
                endDate: customEndDate,
            };
        }

        return getPresetDateRange(historyFilter);
    }, [historyFilter, customStartDate, customEndDate]);

    const filteredPayHistory = useMemo(() => {
        const { startDate, endDate } = historyDateRange;

        /*
         * 사용자화에서 날짜가 아직 완성되지 않았으면
         * 필터 결과를 표시하지 않음
         */
        if (!startDate || !endDate) {
            return [];
        }

        /*
         * 시작일이 종료일보다 뒤라면
         * 잘못된 사용자화 기간
         */
        if (startDate > endDate) {
            return [];
        }

        return visiblePayHistory.filter((history) => {
            /*
             * 핵심:
             *
             * 급여 기간 전체가
             * 선택한 조회 기간 안에 들어와야 함
             *
             * 예:
             * 조회기간 9/1 ~ 9/30
             *
             * 9/1 ~ 9/14  → 표시
             * 9/15 ~ 9/28 → 표시
             * 8/31 ~ 9/13 → 제외
             * 9/29 ~ 10/12 → 제외
             */
            return history.startDate >= startDate && history.endDate <= endDate;
        });
    }, [visiblePayHistory, historyDateRange]);

    /*
     * 표시 개수 제한
     *
     * 최근 6개만 먼저 표시
     */
    const displayedPayHistory = useMemo(() => {
        if (isHistoryExpanded) {
            return filteredPayHistory;
        }

        return filteredPayHistory.slice(0, 6);
    }, [filteredPayHistory, isHistoryExpanded]);

    /*
     * 필터가 변경되면
     * 다시 접힌 상태로 시작
     */
    useEffect(() => {
        setIsHistoryExpanded(false);
    }, [historyFilter, customStartDate, customEndDate]);

    /*
     * 급여 기간을 다음 기간으로 이동
     */
    const shiftPayPeriod = (
        startDate: string,
        payDate: string,
        frequency: SalarySettings["payFrequency"],
        semiMonthlyType?: SalarySettings["semiMonthlyType"],
        customPayDays?: number,
    ) => {
        const start = new Date(`${startDate}T00:00:00`);

        const payment = new Date(`${payDate}T00:00:00`);

        const shiftDate = (date: Date) => {
            switch (frequency) {
                case "weekly":
                    date.setDate(date.getDate() + 7);
                    break;

                case "biweekly":
                    date.setDate(date.getDate() + 14);
                    break;

                case "monthly":
                    date.setMonth(date.getMonth() + 1);
                    break;

                case "semi-monthly":
                    if (semiMonthlyType === "first-fifteenth") {
                        if (date.getDate() === 1) {
                            date.setDate(16);
                        } else {
                            date.setMonth(date.getMonth() + 1);
                            date.setDate(1);
                        }
                    } else {
                        if (date.getDate() === 16) {
                            date.setDate(1);
                            date.setMonth(date.getMonth() + 1);
                        } else {
                            date.setDate(16);
                        }
                    }
                    break;

                case "custom":
                    date.setDate(date.getDate() + (customPayDays || 14));
                    break;
            }
        };

        shiftDate(start);
        shiftDate(payment);

        const nextStartDate = [
            start.getFullYear(),
            String(start.getMonth() + 1).padStart(2, "0"),
            String(start.getDate()).padStart(2, "0"),
        ].join("-");

        const nextPayDate = [
            payment.getFullYear(),
            String(payment.getMonth() + 1).padStart(2, "0"),
            String(payment.getDate()).padStart(2, "0"),
        ].join("-");

        return {
            startDate: nextStartDate,
            endDate: getPayPeriodEndDate(nextStartDate, frequency, semiMonthlyType, customPayDays),
            payDate: nextPayDate,
        };
    };

    /*
     * 현재 날짜 기준으로 현재/다음 급여기간 찾기
     */
    const salaryStatus = useMemo(() => {
        if (!salarySettings || !salarySettings.payPeriodStartDate) {
            return null;
        }

        const today = new Date();

        today.setHours(0, 0, 0, 0);

        const DAY = 1000 * 60 * 60 * 24;

        const parseDate = (value: string) => {
            const date = new Date(`${value}T00:00:00`);

            date.setHours(0, 0, 0, 0);

            return date;
        };

        const formatDateString = (date: Date) => {
            return [
                date.getFullYear(),
                String(date.getMonth() + 1).padStart(2, "0"),
                String(date.getDate()).padStart(2, "0"),
            ].join("-");
        };

        const getDaysDifference = (from: Date, to: Date) => {
            return Math.round((to.getTime() - from.getTime()) / DAY);
        };

        /*
         * ---------------------------------------------------------
         * 지급일 offset 계산
         * ---------------------------------------------------------
         */
        const anchorStartDate = salarySettings.payPeriodStartDate;

        const anchorEndDateString = getPayPeriodEndDate(
            anchorStartDate,
            salarySettings.payFrequency,
            salarySettings.semiMonthlyType,
            salarySettings.customPayDays,
        );

        const anchorEndDate = parseDate(anchorEndDateString);

        let paymentOffset: number | null = null;

        if (salarySettings.payDateOffset !== null && salarySettings.payDateOffset !== undefined) {
            paymentOffset = Number(salarySettings.payDateOffset);
        } else if (salarySettings.payDate) {
            const configuredPayDate = parseDate(salarySettings.payDate);

            paymentOffset = Math.round((configuredPayDate.getTime() - anchorEndDate.getTime()) / DAY);
        }

        if (paymentOffset === null || !Number.isFinite(paymentOffset)) {
            return null;
        }

        /*
         * ---------------------------------------------------------
         * 급여기간 이동
         * ---------------------------------------------------------
         */
        const shiftPeriodStart = (date: Date, direction: 1 | -1) => {
            const next = new Date(date);

            switch (salarySettings.payFrequency) {
                case "weekly":
                    next.setDate(next.getDate() + direction * 7);
                    break;

                case "biweekly":
                    next.setDate(next.getDate() + direction * 14);
                    break;

                case "monthly":
                    next.setMonth(next.getMonth() + direction);
                    break;

                case "custom":
                    next.setDate(next.getDate() + direction * (Number(salarySettings.customPayDays) || 14));
                    break;

                case "semi-monthly":
                    if (next.getDate() <= 15) {
                        if (direction === 1) {
                            next.setDate(16);
                        } else {
                            next.setMonth(next.getMonth() - 1);
                            next.setDate(16);
                        }
                    } else {
                        if (direction === 1) {
                            next.setMonth(next.getMonth() + 1);
                            next.setDate(1);
                        } else {
                            next.setDate(1);
                        }
                    }
                    break;
            }

            return next;
        };

        /*
         * ---------------------------------------------------------
         * 모든 급여기간 생성
         * ---------------------------------------------------------
         */
        const periods: {
            startDate: string;
            endDate: string;
            payDate: string;
        }[] = [];

        const addPeriod = (startDate: Date) => {
            const startString = formatDate(startDate);

            const endString = getPayPeriodEndDate(
                startString,
                salarySettings.payFrequency,
                salarySettings.semiMonthlyType,
                salarySettings.customPayDays,
            );

            if (!endString) {
                return;
            }

            const endDate = parseDate(endString);

            const payDate = new Date(endDate);

            payDate.setDate(payDate.getDate() + paymentOffset!);

            periods.push({
                startDate: startString,
                endDate: endString,
                payDate: formatDate(payDate),
            });
        };

        /*
         * 과거 기간
         */
        let startDate = new Date(`${anchorStartDate}T00:00:00`);

        for (let i = 0; i < 52; i++) {
            addPeriod(startDate);

            startDate = shiftPeriodStart(startDate, -1);
        }

        /*
         * 미래 기간
         */
        startDate = new Date(`${anchorStartDate}T00:00:00`);

        for (let i = 0; i < 52; i++) {
            startDate = shiftPeriodStart(startDate, 1);

            addPeriod(startDate);
        }

        /*
         * 중복 기간 제거
         */
        const uniquePeriods = Array.from(
            new Map(periods.map((period) => [`${period.startDate}-${period.endDate}`, period])).values(),
        );

        /*
         * 지급일은 아직 지나지 않은 급여
         *
         * 급여기간은 이미 끝났지만
         * 지급일은 아직 오지 않은 가장 가까운 급여기간
         */
        const upcomingPeriod = uniquePeriods
            .filter((period) => {
                const endDate = parseDate(period.endDate);
                const payDate = parseDate(period.payDate);

                return endDate.getTime() <= today.getTime() && payDate.getTime() > today.getTime();
            })
            .sort((a, b) => {
                return parseDate(a.payDate).getTime() - parseDate(b.payDate).getTime();
            })[0];

        if (upcomingPeriod) {
            const payDate = parseDate(upcomingPeriod.payDate);

            const periodSchedules = schedules.filter(
                (schedule) =>
                    schedule.date.slice(0, 10) >= upcomingPeriod.startDate &&
                    schedule.date.slice(0, 10) <= upcomingPeriod.endDate,
            );

            const expectedSalary = calculateExpectedSalary({
                settings: {
                    country: salarySettings.country ?? "CA",
                    province: salarySettings.province ?? "",
                    payType: salarySettings.payType ?? "hourly",
                    payFrequency: salarySettings.payFrequency,
                    hourlyWage: salarySettings.hourlyWage ?? undefined,
                    monthlySalary: salarySettings.monthlySalary ?? undefined,
                    hasTips: salarySettings.hasTips ?? false,
                    tipType: salarySettings.tipType ?? undefined,
                    vacationPayRate: salarySettings.vacationPayRate,
                },
                schedules: periodSchedules,
                holidays,
                cashTips: 0,
                paychequeTips: 0,
            });

            return {
                type: "upcoming" as const,

                daysUntil: getDaysDifference(today, payDate),

                payDate: upcomingPeriod.payDate,

                startDate: upcomingPeriod.startDate,

                endDate: upcomingPeriod.endDate,

                expectedPay: expectedSalary.finalEstimatedIncome,

                expectedBasePay: expectedSalary.basePay,

                expectedDeductions: expectedSalary.totalDeductions,

                expectedNetPay: expectedSalary.estimatedNetPay,
            };
        }

        /*
         * ---------------------------------------------------------
         * 지급일도 지난 가장 최근 급여기간
         * ---------------------------------------------------------
         */
        const latestPastPeriod = uniquePeriods
            .filter((period) => {
                const endDate = parseDate(period.endDate);

                const payDate = parseDate(period.payDate);

                return endDate <= today && payDate <= today;
            })
            .sort((a, b) => parseDate(b.endDate).getTime() - parseDate(a.endDate).getTime())[0];

        if (!latestPastPeriod) {
            return null;
        }

        /*
         * 여기서만 DB 기록 여부 확인
         */
        const recorded = payHistory.some(
            (history) => history.startDate === latestPastPeriod.startDate && history.endDate === latestPastPeriod.endDate,
        );

        if (recorded) {
            return null;
        }

        return {
            type: "overdue" as const,

            payDate: latestPastPeriod.payDate,

            startDate: latestPastPeriod.startDate,

            endDate: latestPastPeriod.endDate,
        };
    }, [salarySettings, payHistory, schedules, holidays]);

    /*
     * ---------------------------------------------------------
     * 급여 상태 카드용 데이터
     * ---------------------------------------------------------
     */
    const pendingPayPeriod = useMemo(() => {
        if (!salaryStatus) {
            return null;
        }

        return {
            startDate: salaryStatus.startDate,
            endDate: salaryStatus.endDate,
            payDate: salaryStatus.payDate,
        };
    }, [salaryStatus]);

    const shouldShowPendingPay = salaryStatus?.type === "upcoming";

    const shouldGoToPayHistory = salaryStatus?.type === "overdue";

    /*
     * ---------------------------------------------------------
     * pending 기간 팁 조회
     * ---------------------------------------------------------
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

                const data = (await response.json()) as PayPeriodTips | null;

                setPendingSavedTips(data);
            } catch (error) {
                console.error(error);

                setPendingSavedTips(null);
            }
        };

        void loadPendingTips();
    }, [pendingPayPeriod?.startDate, pendingPayPeriod?.endDate]);

    /*
     * ---------------------------------------------------------
     * pending 급여 계산
     * ---------------------------------------------------------
     */
    const pendingPeriodSchedules = useMemo(() => {
        if (!pendingPayPeriod) {
            return [];
        }

        return schedules.filter((schedule) => {
            const scheduleDate = schedule.date.slice(0, 10);

            return scheduleDate >= pendingPayPeriod.startDate && scheduleDate <= pendingPayPeriod.endDate;
        });
    }, [schedules, pendingPayPeriod]);

    const pendingPeriodHours = useMemo(() => {
        return pendingPeriodSchedules.reduce(
            (total, schedule) =>
                total + calculateHours(schedule.startTime, schedule.endTime, schedule.hasBreak ? schedule.breakMinutes : 0),
            0,
        );
    }, [pendingPeriodSchedules]);

    const pendingBasePay = useMemo(() => {
        if (!salarySettings) {
            return 0;
        }

        if (salarySettings.payType === "hourly") {
            return pendingPeriodHours * (hourlyWage ?? 0);
        }

        if (salarySettings.payType === "salary") {
            return Number(salarySettings.monthlySalary ?? 0);
        }

        return 0;
    }, [salarySettings, pendingPeriodHours, hourlyWage]);

    const pendingHolidaySchedules = useMemo(() => {
        return pendingPeriodSchedules.filter((schedule) => isHoliday(schedule.date.slice(0, 10), holidays));
    }, [pendingPeriodSchedules, holidays]);

    const pendingHolidayHours = useMemo(() => {
        return pendingHolidaySchedules.reduce(
            (total, schedule) =>
                total + calculateHours(schedule.startTime, schedule.endTime, schedule.hasBreak ? schedule.breakMinutes : 0),
            0,
        );
    }, [pendingHolidaySchedules]);

    const pendingHolidayPay = salarySettings?.payType === "hourly" ? pendingHolidayHours * (hourlyWage ?? 0) * 0.5 : 0;

    const vacationPayRate = Number(salarySettings?.vacationPayRate ?? 4.15);

    const pendingVacationPay = pendingBasePay * (vacationPayRate / 100);

    const hasPaychequeTips = Boolean(
        salarySettings?.hasTips && (salarySettings.tipType === "paycheque" || salarySettings.tipType === "both"),
    );

    const hasCashTips = Boolean(
        salarySettings?.hasTips && (salarySettings.tipType === "cash" || salarySettings.tipType === "both"),
    );

    const pendingPaychequeTips = hasPaychequeTips ? (pendingSavedTips?.paychequeTips ?? 0) : 0;

    const pendingCashTips = hasCashTips ? (pendingSavedTips?.cashTips ?? 0) : 0;

    const periodsPerYear = useMemo(() => {
        if (!salarySettings) {
            return 26;
        }

        switch (salarySettings.payFrequency) {
            case "weekly":
                return 52;

            case "biweekly":
                return 26;

            case "semi-monthly":
                return 24;

            case "monthly":
                return 12;

            default:
                return 26;
        }
    }, [salarySettings]);

    const pendingTaxableGrossPay = pendingBasePay + pendingHolidayPay + pendingVacationPay + pendingPaychequeTips;

    const pendingAnnualGross = pendingTaxableGrossPay * periodsPerYear;

    const pendingTaxes = useMemo(() => {
        return calculateTaxes({
            country: "CA",
            province: salarySettings?.province ?? "",
            annualGross: pendingAnnualGross,
        });
    }, [salarySettings?.province, pendingAnnualGross]);

    const pendingPeriodEstimate = useMemo(() => {
        const deductions = pendingTaxes.totalDeductions / periodsPerYear;

        return {
            hours: pendingPeriodHours,

            basePay: pendingBasePay,

            holidayPay: pendingHolidayPay,

            vacationPay: pendingVacationPay,

            paychequeTips: pendingPaychequeTips,

            cashTips: pendingCashTips,

            grossPay: pendingTaxableGrossPay,

            deductions,

            cpp: pendingTaxes.cpp / periodsPerYear,

            cpp2: pendingTaxes.cpp2 / periodsPerYear,

            ei: pendingTaxes.ei / periodsPerYear,

            federalTax: pendingTaxes.federalTax / periodsPerYear,

            provincialTax: pendingTaxes.provincialTax / periodsPerYear,

            provinceName: pendingTaxes.provinceName,

            netPay: pendingTaxableGrossPay - deductions,

            totalIncome: pendingTaxableGrossPay - deductions + pendingCashTips,
        };
    }, [
        pendingPeriodHours,
        pendingBasePay,
        pendingHolidayPay,
        pendingVacationPay,
        pendingPaychequeTips,
        pendingCashTips,
        pendingTaxableGrossPay,
        pendingTaxes,
        periodsPerYear,
    ]);

    /*
     * 카드 숫자 애니메이션
     */
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
     * URL에서 넘어온 미기록 급여 입력
     */
    const openPendingForm = () => {
        if (!pendingPeriod) {
            return;
        }

        setSelectedHistory(null);

        setForm({
            ...emptyForm,

            startDate: pendingPeriod.startDate,

            endDate: pendingPeriod.endDate,

            payDate: pendingPeriod.payDate ?? "",
        });

        setIsFormOpen(true);
    };

    /*
     * 새 급여 기록
     */
    const openCreateForm = () => {
        if (planCode === "free" && payHistory.length >= 5) {
            alert("무료 이용자는 급여 기록을 최대 5개까지 저장할 수 있어요.");
            return;
        }

        setSelectedHistory(null);

        setForm({
            ...emptyForm,
            startDate: "",
            endDate: "",
            payDate: "",
            pay: hourlyWage !== null ? "0.00" : "",
        });

        setIsFormOpen(true);
    };

    /*
     * 기존 급여 수정
     */
    const openEditForm = (history: PayHistory) => {
        setSelectedHistory(history);

        setForm({
            startDate: history.startDate,

            endDate: history.endDate,

            payDate: history.payDate ?? "",

            hours: history.hours.toString(),

            pay: history.pay.toString(),

            tips: history.tips.toString(),

            deductions: history.deductions.toString(),

            adjustments: history.adjustments.map((adjustment) => ({
                type: adjustment.type,

                name: adjustment.name,

                amount: adjustment.amount,
            })),

            netPay: history.netPay.toString(),
        });

        setIsFormOpen(true);
    };

    const closeForm = () => {
        if (isSaving) {
            return;
        }

        setIsFormOpen(false);

        setSelectedHistory(null);

        setForm(emptyForm);
    };

    /*
     * 폼 값 변경
     */
    const updateForm = <K extends keyof FormState>(key: K, value: FormState[K]) => {
        setForm((current) => ({
            ...current,
            [key]: value,
        }));
    };

    /*
     * 추가/차감 항목 변경
     */
    const updateAdjustment = (index: number, field: "type" | "name" | "amount", value: AdjustmentType | string) => {
        setForm((current) => {
            const adjustments = [...current.adjustments];

            const currentItem = adjustments[index];

            if (!currentItem) {
                return current;
            }

            adjustments[index] = {
                ...currentItem,

                [field]: field === "amount" ? Number(value) : value,
            };

            return {
                ...current,
                adjustments,
            };
        });
    };

    const addAdjustment = (type: AdjustmentType) => {
        setForm((current) => ({
            ...current,

            adjustments: [
                ...current.adjustments,
                {
                    type,
                    name: "",
                    amount: 0,
                },
            ],
        }));
    };

    const removeAdjustment = (index: number) => {
        setForm((current) => ({
            ...current,

            adjustments: current.adjustments.filter((_, itemIndex) => itemIndex !== index),
        }));
    };

    /*
     * 현재 입력값으로 계산되는 실수령액
     */
    const calculatedNetPay = useMemo(() => {
        const pay = Number(form.pay) || 0;

        const tips = Number(form.tips) || 0;

        const deductions = Number(form.deductions) || 0;

        const adjustmentTotal = form.adjustments.reduce((total, adjustment) => {
            const amount = Number(adjustment.amount) || 0;

            if (adjustment.type === "add") {
                return total + amount;
            }

            return total - amount;
        }, 0);

        return pay + tips - deductions + adjustmentTotal;
    }, [form.pay, form.tips, form.deductions, form.adjustments]);

    /*
     * 계산된 금액을 실제 실수령액 입력값에 적용
     */
    const useCalculatedNetPay = () => {
        setForm((current) => ({
            ...current,

            netPay: calculatedNetPay.toFixed(2),
        }));
    };

    /*
     * 저장
     */
    const savePayHistory = async () => {
        const hours = Number(form.hours);

        const pay = Number(form.pay);

        const tips = Number(form.tips || 0);

        const deductions = Number(form.deductions || 0);

        const netPay = Number(form.netPay);

        if (!form.startDate || !form.endDate) {
            alert("급여 기간을 입력해주세요.");

            return;
        }

        if (!Number.isFinite(hours) || hours < 0) {
            alert("근무시간을 확인해주세요.");

            return;
        }

        if (!Number.isFinite(pay) || pay < 0) {
            alert("급여를 확인해주세요.");

            return;
        }

        if (!Number.isFinite(tips) || tips < 0) {
            alert("팁을 확인해주세요.");

            return;
        }

        if (!Number.isFinite(deductions) || deductions < 0) {
            alert("공제액을 확인해주세요.");

            return;
        }

        if (!Number.isFinite(netPay) || netPay < 0) {
            alert("실수령액을 확인해주세요.");

            return;
        }

        const validAdjustments = form.adjustments.filter(
            (adjustment) => adjustment.name.trim() !== "" && Number.isFinite(adjustment.amount) && adjustment.amount > 0,
        );

        try {
            setIsSaving(true);

            const payload = {
                payPeriodStart: form.startDate,

                payPeriodEnd: form.endDate,

                payDate: form.payDate || null,

                actualHours: hours,

                actualPay: pay,

                actualTips: tips,

                actualDeductions: deductions,

                adjustments: validAdjustments,

                actualNetPay: netPay,
            };

            const response = await fetch("/api/pay-history", {
                method: selectedHistory ? "PUT" : "POST",

                headers: {
                    "Content-Type": "application/json",
                },

                body: JSON.stringify({
                    ...payload,

                    ...(selectedHistory
                        ? {
                              id: selectedHistory.id,
                          }
                        : {}),
                }),
            });

            const result = (await response.json()) as {
                error?: string;
            };

            if (!response.ok) {
                throw new Error(result.error || "급여 기록 저장 실패");
            }

            await loadPayHistory();

            if (pendingPeriod && pendingPeriod.startDate === form.startDate && pendingPeriod.endDate === form.endDate) {
                setPendingPeriod(null);

                setIsPendingPeriod(false);

                window.history.replaceState({}, "", "/salary/pay-history");
            }

            closeForm();
        } catch (error) {
            console.error(error);

            alert("급여 기록을 저장하지 못했습니다.");
        } finally {
            setIsSaving(false);
        }
    };

    /*
     * 삭제
     */
    const deletePayHistory = async (history: PayHistory) => {
        const confirmed = window.confirm(
            `${formatDisplayDate(history.startDate)} ~ ${formatDisplayDate(history.endDate)} 급여 기록을 삭제할까요?`,
        );

        if (!confirmed) {
            return;
        }

        try {
            const response = await fetch("/api/pay-history", {
                method: "DELETE",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    id: history.id,
                }),
            });

            const result = (await response.json()) as {
                error?: string;
            };

            if (!response.ok) {
                throw new Error(result.error || "급여 기록 삭제 실패");
            }

            setSelectedHistory(null);

            await loadPayHistory();
        } catch (error) {
            console.error(error);

            alert("급여 기록을 삭제하지 못했습니다.");
        }
    };

    if (isLoading) {
        return (
            <div className="mx-auto max-w-md">
                <BackButtonHeader
                    href="/salary"
                    title="급여 기록"
                    description="지난 급여 기간과 실제 수령 금액을 확인해보세요."
                />

                <p className="mt-6 text-sm text-gray-400">급여 기록을 불러오는 중...</p>
            </div>
        );
    }

    return (
        <>
            <div className="mx-auto max-w-md">
                <BackButtonHeader
                    href="/salary"
                    title="급여 기록"
                    description="지난 급여 기간과 실제 수령 금액을 확인해보세요."
                />

                {/* 급여 상태 */}
                {pendingPayPeriod && (
                    <>
                        {/* 지급일이 지난 급여 기록 */}
                        {shouldGoToPayHistory && (
                            <>
                                {planCode === "free" && payHistory.length >= 5 ? (
                                    <div className="mt-5 flex items-center gap-3 rounded-2xl bg-gray-50 p-4">
                                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gray-100">
                                            <Lock size={16} className="text-gray-500" />
                                        </div>

                                        <div>
                                            <p className="text-sm font-semibold text-gray-900">
                                                급여 기록 5개를 모두 사용했어요.
                                            </p>

                                            <p className="mt-1 text-xs text-gray-500">
                                                기존 기록을 삭제하면 새로운 급여를 등록할 수 있어요.
                                            </p>
                                        </div>
                                    </div>
                                ) : (
                                    <Link
                                        href="/salary/pay-history"
                                        className="mt-5 block w-full rounded-3xl bg-gray-900 p-5 text-left shadow-sm transition hover:shadow-md"
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
                            </>
                        )}

                        {/* 급여 예정 */}
                        {shouldShowPendingPay && pendingPayPeriod && (
                            <button
                                type="button"
                                onClick={() => setIsPendingExpectedOpen(true)}
                                className="mt-10 block w-full rounded-3xl border border-blue-100 bg-blue-50 p-5 text-left shadow-sm transition hover:bg-blue-100/70"
                            >
                                <div className="flex items-start justify-between gap-4">
                                    <div>
                                        <p className="text-xs text-blue-500">급여 예정</p>

                                        <p className="mt-1 text-sm font-semibold text-gray-700">
                                            {formatDisplayDate(pendingPayPeriod.startDate)}
                                            {" ~ "}
                                            {formatDisplayDate(pendingPayPeriod.endDate)}
                                        </p>

                                        <p className="mt-3 text-lg font-semibold text-gray-900">
                                            <span className="text-blue-600">{getDdayLabel(pendingPayPeriod.payDate)}</span>{" "}
                                            {formatMoney(animatedPendingNetPay)}를 받아요
                                        </p>

                                        <p className="mt-1 text-sm text-gray-500">
                                            지급일 {formatDisplayDate(pendingPayPeriod.payDate)}
                                        </p>
                                    </div>

                                    <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-blue-600 shadow-sm">
                                        예상
                                    </span>
                                </div>
                            </button>
                        )}
                    </>
                )}

                {/* 기록 추가 */}
                {planCode === "free" && payHistory.length >= 5 ? (
                    // 위에서 이미 제한 안내가 표시된 경우 중복 표시하지 않음
                    !shouldGoToPayHistory && (
                        <div className="mt-4 flex items-center gap-3 rounded-2xl bg-gray-50 p-4">
                            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gray-100">
                                <Lock size={16} className="text-gray-500" />
                            </div>

                            <div>
                                <p className="text-sm font-semibold text-gray-900">급여 기록 5개를 모두 사용했어요.</p>

                                <p className="mt-1 text-xs text-gray-500">기존 기록을 삭제하면 새로운 급여를 등록할 수 있어요.</p>
                            </div>
                        </div>
                    )
                ) : (
                    <button
                        type="button"
                        onClick={openCreateForm}
                        className="mt-6 flex w-full items-center justify-between rounded-3xl bg-white p-5 text-left shadow-sm transition hover:shadow-md"
                    >
                        <div>
                            <p className="font-semibold">급여 기록 추가</p>

                            <p className="mt-1 text-sm text-gray-400">지난 급여를 직접 기록할 수 있어요.</p>
                        </div>

                        <span className="text-xl">+</span>
                    </button>
                )}

                {/* --------------------------------------------------
                    급여 기록 기간 필터
                -------------------------------------------------- */}
                <section className="mt-10">
                    <div className="flex items-center justify-end gap-2">
                        {/* 필터 옵션 */}
                        <div
                            className={`min-w-0 overflow-hidden transition-[max-width,opacity] duration-300 ease-out ${
                                isHistoryFilterOpen ? "max-w-full opacity-100" : "max-w-0 opacity-0"
                            }`}
                        >
                            <div className="flex items-center justify-end gap-1.5 overflow-x-auto scrollbar-hide whitespace-nowrap">
                                {[
                                    { value: "month" as const, label: "이번 달" },
                                    { value: "3months" as const, label: "3개월" },
                                    { value: "6months" as const, label: "6개월" },
                                    { value: "year" as const, label: "1년" },
                                    { value: "custom" as const, label: "사용자화" },
                                ].map((option) => {
                                    const isActive = historyFilter === option.value;

                                    return (
                                        <button
                                            key={option.value}
                                            type="button"
                                            onClick={() => {
                                                setHistoryFilter(option.value);
                                                setIsHistoryExpanded(false);
                                            }}
                                            className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition ${
                                                isActive
                                                    ? "bg-gray-900 text-white"
                                                    : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                                            }`}
                                        >
                                            {option.label}
                                        </button>
                                    );
                                })}

                                {/* 전체 */}
                                <button
                                    type="button"
                                    onClick={() => {
                                        setHistoryFilter("all");
                                        setCustomStartDate("");
                                        setCustomEndDate("");
                                        setIsHistoryExpanded(false);
                                    }}
                                    className="shrink-0 rounded-full bg-gray-100 px-3 py-1.5 text-xs font-medium text-gray-500 transition hover:bg-gray-200"
                                >
                                    전체
                                </button>
                            </div>
                        </div>

                        {/* 필터 버튼 / 닫기 버튼 */}
                        <button
                            type="button"
                            aria-label={isHistoryFilterOpen ? "필터 닫기" : "급여 기록 필터 열기"}
                            onClick={() => setIsHistoryFilterOpen((current) => !current)}
                            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white text-gray-500 shadow-sm transition-all duration-300 hover:bg-gray-50"
                        >
                            {isHistoryFilterOpen ? (
                                /* X */
                                <svg
                                    viewBox="0 0 24 24"
                                    className="h-4 w-4"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2"
                                    strokeLinecap="round"
                                >
                                    <path d="M6 6l12 12" />
                                    <path d="M18 6L6 18" />
                                </svg>
                            ) : (
                                /* 필터 / 슬라이더 아이콘 */
                                <svg
                                    viewBox="0 0 24 24"
                                    className="h-4 w-4"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="1.8"
                                    strokeLinecap="round"
                                >
                                    <path d="M4 7h16" />
                                    <path d="M7 12h10" />
                                    <path d="M10 17h4" />
                                </svg>
                            )}
                        </button>
                    </div>

                    {/* 사용자화 날짜 선택 */}
                    {isHistoryFilterOpen && historyFilter === "custom" && (
                        <div className="mt-3 rounded-3xl bg-white p-4 shadow-sm">
                            <div className="grid grid-cols-2 gap-2">
                                <div>
                                    <p className="mb-2 text-xs text-gray-400">시작일</p>

                                    <input
                                        type="date"
                                        value={customStartDate}
                                        onChange={(event) => {
                                            setCustomStartDate(event.target.value);
                                            setIsHistoryExpanded(false);
                                        }}
                                        className="w-full rounded-2xl border border-gray-200 px-3 py-3 text-sm outline-none"
                                    />
                                </div>

                                <div>
                                    <p className="mb-2 text-xs text-gray-400">종료일</p>

                                    <input
                                        type="date"
                                        value={customEndDate}
                                        onChange={(event) => {
                                            setCustomEndDate(event.target.value);
                                            setIsHistoryExpanded(false);
                                        }}
                                        className="w-full rounded-2xl border border-gray-200 px-3 py-3 text-sm outline-none"
                                    />
                                </div>
                            </div>

                            {customStartDate && customEndDate && customStartDate > customEndDate && (
                                <p className="mt-3 text-xs text-red-500">시작일은 종료일보다 빠르거나 같아야 해요.</p>
                            )}
                        </div>
                    )}
                </section>

                {historyFilter === "custom" && (!customStartDate || !customEndDate || customStartDate > customEndDate) ? (
                    <section className="mt-3 rounded-3xl bg-white p-6 shadow-sm">
                        <p className="text-sm text-gray-400">
                            {customStartDate && customEndDate && customStartDate > customEndDate
                                ? "조회 기간을 다시 선택해주세요."
                                : "조회할 기간을 선택해주세요."}
                        </p>
                    </section>
                ) : filteredPayHistory.length === 0 ? (
                    <section className="mt-3 rounded-3xl bg-white p-6 shadow-sm">
                        <p className="text-sm text-gray-400">해당 기간에 급여 기록이 없어요.</p>
                    </section>
                ) : (
                    <>
                        <div className="mt-3 space-y-3">
                            {displayedPayHistory.map((history, index) => (
                                <button
                                    type="button"
                                    key={history.id}
                                    onClick={() => setSelectedHistory(history)}
                                    className="w-full rounded-3xl bg-white p-5 text-left shadow-sm transition hover:shadow-md"
                                >
                                    <div className="flex items-start justify-between">
                                        <div>
                                            {index === 0 && <p className="text-xs text-gray-400">최근 급여</p>}

                                            <p className="mt-1 font-semibold">
                                                {formatDisplayDate(history.startDate)}
                                                {" ~ "}
                                                {formatDisplayDate(history.endDate)}
                                            </p>

                                            {history.payDate && (
                                                <p className="mt-1 text-xs text-gray-400">
                                                    지급일 {formatDisplayDate(history.payDate)}
                                                </p>
                                            )}
                                        </div>

                                        <span className="text-gray-300">→</span>
                                    </div>

                                    <div className="mt-5 grid grid-cols-2 gap-y-4 text-sm">
                                        <div>
                                            <p className="text-xs text-gray-400">일한 시간</p>

                                            <p className="mt-1 font-medium">
                                                {history.hours.toFixed(2)}
                                                시간
                                            </p>
                                        </div>

                                        <div>
                                            <p className="text-xs text-gray-400">급여</p>

                                            <p className="mt-1 font-medium">{formatMoney(history.pay)}</p>
                                        </div>

                                        <div>
                                            <p className="text-xs text-gray-400">팁</p>

                                            <p className="mt-1 font-medium">{formatMoney(history.tips)}</p>
                                        </div>

                                        <div>
                                            <p className="text-xs text-gray-400">실수령액</p>

                                            <p className="mt-1 text-lg font-bold">{formatMoney(history.netPay)}</p>
                                        </div>
                                    </div>
                                </button>
                            ))}
                        </div>

                        {filteredPayHistory.length > 6 && (
                            <button
                                type="button"
                                onClick={() => setIsHistoryExpanded((current) => !current)}
                                className="mt-3 w-full rounded-2xl bg-white py-3 text-sm font-medium text-gray-500 shadow-sm transition hover:bg-gray-50"
                            >
                                {isHistoryExpanded
                                    ? "접기"
                                    : `더 보기 · ${filteredPayHistory.length - displayedPayHistory.length}개`}
                            </button>
                        )}
                    </>
                )}
            </div>

            {/* 상세 모달 */}
            {selectedHistory && !isFormOpen && (
                <div
                    className="fixed inset-0 z-80 flex items-end justify-center bg-black/40 p-4 sm:items-center"
                    onClick={() => setSelectedHistory(null)}
                >
                    <div
                        className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-3xl"
                        onClick={(event) => event.stopPropagation()}
                    >
                        <section className="rounded-3xl bg-black p-6 text-white shadow-sm">
                            <div className="flex items-start justify-between">
                                <div>
                                    <p className="text-xs text-gray-500">
                                        {formatDisplayDate(selectedHistory.startDate)}
                                        {" ~ "}
                                        {formatDisplayDate(selectedHistory.endDate)}
                                    </p>

                                    {selectedHistory.payDate && (
                                        <p className="mt-1 text-xs text-gray-500">
                                            지급일 {formatDisplayDate(selectedHistory.payDate)}
                                        </p>
                                    )}
                                </div>

                                <button type="button" onClick={() => setSelectedHistory(null)} className="text-xl text-gray-400">
                                    ×
                                </button>
                            </div>

                            <p className="mt-5 text-4xl font-bold">{formatMoney(selectedHistory.netPay)}</p>

                            <div className="mt-6 space-y-3 text-sm">
                                <div className="flex justify-between">
                                    <span className="text-gray-400">근무시간</span>

                                    <span>
                                        {selectedHistory.hours.toFixed(2)}
                                        시간
                                    </span>
                                </div>

                                <div className="flex justify-between">
                                    <span className="text-gray-400">급여</span>

                                    <span>{formatMoney(selectedHistory.pay)}</span>
                                </div>

                                <div className="flex justify-between">
                                    <span className="text-gray-400">팁</span>

                                    <span>{formatMoney(selectedHistory.tips)}</span>
                                </div>

                                {selectedHistory.deductions > 0 && (
                                    <div className="flex justify-between">
                                        <span className="text-gray-400">공제</span>

                                        <span>-{formatMoney(selectedHistory.deductions)}</span>
                                    </div>
                                )}

                                {selectedHistory.adjustments.length > 0 && (
                                    <div className="border-t border-gray-800 pt-4">
                                        <p className="mb-3 text-xs text-gray-500">추가 / 차감</p>

                                        <div className="space-y-2">
                                            {selectedHistory.adjustments.map((adjustment, index) => (
                                                <div key={`${adjustment.name}-${index}`} className="flex justify-between">
                                                    <span className="text-gray-400">{adjustment.name}</span>

                                                    <span className={adjustment.type === "add" ? "text-white" : "text-gray-400"}>
                                                        {adjustment.type === "add" ? "+" : "-"}
                                                        {formatMoney(adjustment.amount)}
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>

                            <div className="mt-6 rounded-2xl bg-white p-4 text-black">
                                <div className="flex items-center justify-between">
                                    <span className="text-sm font-medium">실제 수령액</span>

                                    <span className="text-xl font-bold">{formatMoney(selectedHistory.netPay)}</span>
                                </div>
                            </div>

                            <div className="mt-5 flex gap-3">
                                <button
                                    type="button"
                                    onClick={() => openEditForm(selectedHistory)}
                                    className="flex-1 rounded-2xl border border-white/10 py-3 text-sm font-medium transition hover:bg-white/10"
                                >
                                    수정
                                </button>

                                <button
                                    type="button"
                                    onClick={() => void deletePayHistory(selectedHistory)}
                                    className="flex-1 rounded-2xl border border-red-500/30 py-3 text-sm font-medium text-red-400 transition hover:bg-red-500/10"
                                >
                                    삭제
                                </button>
                            </div>
                        </section>
                    </div>
                </div>
            )}

            {/* Pending Expected Salary Modal */}
            {isPendingExpectedOpen && pendingPayPeriod && (
                <div
                    className="fixed inset-0 z-[60] flex items-end justify-center bg-gray-900/30 p-3 backdrop-blur-sm sm:items-center"
                    onClick={() => setIsPendingExpectedOpen(false)}
                >
                    <div
                        className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-[2rem] bg-white p-6 shadow-2xl"
                        onClick={(event) => event.stopPropagation()}
                    >
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

                        <div className="mt-6">
                            <p className="mb-3 text-xs font-semibold text-gray-400">예상 급여 내역</p>

                            <div className="rounded-3xl bg-gray-50 p-5">
                                <div className="space-y-4 text-sm">
                                    <div className="flex justify-between">
                                        <span className="text-gray-500">근무시간</span>

                                        <span className="font-medium text-gray-900">
                                            {pendingPeriodEstimate.hours.toFixed(2)}
                                            시간
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

                        <div className="mt-5 rounded-2xl bg-amber-50 px-4 py-3">
                            <p className="text-xs leading-5 text-amber-700">
                                실제 급여가 아직 기록되지 않아 이전 근무 기록과 팁을 기준으로 계산한 예상 금액이에요.
                            </p>
                        </div>

                        <Link
                            href="/salary/schedule"
                            onClick={() => setIsPendingExpectedOpen(false)}
                            className="mt-5 block w-full rounded-2xl bg-gray-900 py-4 text-center text-sm font-semibold text-white transition hover:bg-gray-800"
                        >
                            근무 기록 보기
                        </Link>
                    </div>
                </div>
            )}

            {/* 입력 / 수정 모달 */}
            {isFormOpen && (
                <div
                    className="fixed inset-0 z-[60] flex items-end justify-center bg-gray-900/40 p-4 sm:items-center"
                    onClick={closeForm}
                >
                    <div
                        className="max-h-[92vh] w-full max-w-md scrollbar-hide overflow-y-auto rounded-3xl bg-white p-6 shadow-xl"
                        onClick={(event) => event.stopPropagation()}
                    >
                        <div className="flex items-start justify-between">
                            <div>
                                <h2 className="text-xl font-bold">{selectedHistory ? "급여 기록 수정" : "실제 급여 기록"}</h2>

                                <p className="mt-1 text-sm text-gray-400">실제로 받은 급여를 기록해주세요.</p>
                            </div>

                            <button type="button" onClick={closeForm} className="text-xl text-gray-400">
                                ×
                            </button>
                        </div>

                        <div className="mt-6 space-y-5">
                            {/* 급여 기간 */}
                            <div>
                                <label className="text-sm font-medium">급여 기간</label>

                                <div className="mt-2 grid grid-cols-2 gap-2">
                                    <input
                                        type="date"
                                        value={form.startDate}
                                        onChange={(event) => updateForm("startDate", event.target.value)}
                                        className="rounded-2xl border border-gray-200 px-3 py-3 text-sm outline-none"
                                    />

                                    <input
                                        type="date"
                                        value={form.endDate}
                                        onChange={(event) => updateForm("endDate", event.target.value)}
                                        className="rounded-2xl border border-gray-200 px-3 py-3 text-sm outline-none"
                                    />
                                </div>
                            </div>

                            {/* 지급일 */}
                            <div>
                                <label className="text-sm font-medium">지급일</label>

                                <input
                                    type="date"
                                    value={form.payDate}
                                    onChange={(event) => updateForm("payDate", event.target.value)}
                                    className="mt-2 w-full rounded-2xl border border-gray-200 px-4 py-3 outline-none"
                                />
                            </div>

                            {/* 근무시간 */}
                            <div>
                                <label className="text-sm font-medium">총 근무시간</label>

                                <div className="mt-2 flex items-center gap-2">
                                    <input
                                        type="number"
                                        min="0"
                                        step="0.1"
                                        value={form.hours}
                                        onChange={(event) => {
                                            const hours = normalizeNumberInput(event.target.value);

                                            setForm((current) => ({
                                                ...current,

                                                hours,

                                                ...(selectedHistory
                                                    ? {}
                                                    : {
                                                          pay:
                                                              hourlyWage !== null && hours !== ""
                                                                  ? (Number(hours) * hourlyWage).toFixed(2)
                                                                  : current.pay,
                                                      }),
                                            }));
                                        }}
                                        className="w-full rounded-2xl border border-gray-200 px-4 py-3 outline-none"
                                    />

                                    <span className="text-sm text-gray-400">시간</span>
                                </div>
                            </div>

                            {/* 급여 */}
                            <div>
                                <label className="text-sm font-medium">급여</label>

                                <div className="mt-2 flex items-center gap-2">
                                    <span className="text-gray-400">$</span>

                                    <input
                                        type="number"
                                        min="0"
                                        step="0.01"
                                        value={form.pay}
                                        onChange={(event) => updateForm("pay", normalizeNumberInput(event.target.value))}
                                        className="w-full rounded-2xl border border-gray-200 px-4 py-3 outline-none"
                                    />
                                </div>
                            </div>

                            {/* 팁 */}
                            <div>
                                <label className="text-sm font-medium">팁</label>

                                <div className="mt-2 flex items-center gap-2">
                                    <span className="text-gray-400">$</span>

                                    <input
                                        type="number"
                                        min="0"
                                        step="0.01"
                                        value={form.tips}
                                        onChange={(event) => updateForm("tips", normalizeNumberInput(event.target.value))}
                                        className="w-full rounded-2xl border border-gray-200 px-4 py-3 outline-none"
                                    />
                                </div>
                            </div>

                            {/* 공제 */}
                            <div>
                                <label className="text-sm font-medium">공제</label>

                                <div className="mt-2 flex items-center gap-2">
                                    <span className="text-gray-400">$</span>

                                    <input
                                        type="number"
                                        min="0"
                                        step="0.01"
                                        value={form.deductions}
                                        onChange={(event) => updateForm("deductions", normalizeNumberInput(event.target.value))}
                                        className="w-full rounded-2xl border border-gray-200 px-4 py-3 outline-none"
                                    />
                                </div>
                            </div>

                            {/* 추가 / 차감 */}
                            <div>
                                <div className="flex items-center justify-between">
                                    <div>
                                        <label className="text-sm font-medium">추가 / 차감</label>

                                        <p className="mt-1 text-xs text-gray-400">
                                            Holiday Pay 등의 금액을 추가하거나 차감할 수 있어요.
                                        </p>
                                    </div>
                                </div>

                                {form.adjustments.length > 0 && (
                                    <div className="mt-3 space-y-3">
                                        {form.adjustments.map((adjustment, index) => (
                                            <div key={index} className="rounded-2xl bg-gray-50 p-3">
                                                <div className="flex gap-2">
                                                    <select
                                                        value={adjustment.type}
                                                        onChange={(event) =>
                                                            updateAdjustment(index, "type", event.target.value as AdjustmentType)
                                                        }
                                                        className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm outline-none"
                                                    >
                                                        <option value="add">+ 추가</option>

                                                        <option value="subtract">− 차감</option>
                                                    </select>

                                                    <input
                                                        type="text"
                                                        value={adjustment.name}
                                                        onChange={(event) => updateAdjustment(index, "name", event.target.value)}
                                                        placeholder="예: Holiday Pay"
                                                        className="min-w-0 flex-1 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm outline-none"
                                                    />

                                                    <button
                                                        type="button"
                                                        onClick={() => removeAdjustment(index)}
                                                        className="px-2 text-gray-400"
                                                    >
                                                        ×
                                                    </button>
                                                </div>

                                                <div className="mt-2 flex items-center gap-2">
                                                    <span className="text-gray-400">$</span>

                                                    <input
                                                        type="number"
                                                        min="0"
                                                        step="0.01"
                                                        value={adjustment.amount === 0 ? "" : adjustment.amount}
                                                        onChange={(event) =>
                                                            updateAdjustment(index, "amount", event.target.value)
                                                        }
                                                        placeholder="0.00"
                                                        className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm outline-none"
                                                    />
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}

                                <div className="mt-3 grid grid-cols-2 gap-2">
                                    <button
                                        type="button"
                                        onClick={() => addAdjustment("add")}
                                        className="rounded-2xl border border-gray-200 py-3 text-sm font-medium"
                                    >
                                        + 금액 추가
                                    </button>

                                    <button
                                        type="button"
                                        onClick={() => addAdjustment("subtract")}
                                        className="rounded-2xl border border-gray-200 py-3 text-sm font-medium"
                                    >
                                        − 금액 차감
                                    </button>
                                </div>
                            </div>

                            {/* 계산된 실수령액 */}
                            <div className="rounded-3xl bg-gray-50 p-5">
                                <p className="text-xs text-gray-400">계산된 실수령액</p>

                                <p className="mt-1 text-2xl font-bold">{formatMoney(calculatedNetPay)}</p>

                                <button
                                    type="button"
                                    onClick={useCalculatedNetPay}
                                    className="mt-4 w-full rounded-2xl bg-white px-4 py-3 text-sm font-medium shadow-sm"
                                >
                                    이 금액이 맞나요?
                                </button>
                            </div>

                            {/* 실제 실수령액 */}
                            <div>
                                <label className="text-sm font-medium">실제 실수령액</label>

                                <div className="mt-2 flex items-center gap-2">
                                    <span className="text-gray-400">$</span>

                                    <input
                                        type="number"
                                        min="0"
                                        step="0.01"
                                        value={form.netPay}
                                        onChange={(event) => updateForm("netPay", normalizeNumberInput(event.target.value))}
                                        placeholder={calculatedNetPay.toFixed(2)}
                                        className="w-full rounded-2xl border border-gray-200 px-4 py-3 text-lg font-semibold outline-none"
                                    />
                                </div>

                                <p className="mt-2 text-xs text-gray-400">실제 급여명세서나 통장에 입금된 금액을 입력해주세요.</p>
                            </div>
                        </div>

                        <div className="mt-6 flex gap-3">
                            <button
                                type="button"
                                onClick={closeForm}
                                disabled={isSaving}
                                className="flex-1 rounded-2xl bg-gray-100 py-3 text-sm font-medium disabled:opacity-50"
                            >
                                취소
                            </button>

                            <button
                                type="button"
                                onClick={() => void savePayHistory()}
                                disabled={isSaving}
                                className="flex-1 rounded-2xl bg-gray-900 py-3 text-sm font-medium text-white disabled:opacity-50"
                            >
                                {isSaving ? "저장 중..." : "저장하기"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
