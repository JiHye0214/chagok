"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import BackButtonHeader from "@/components/BackButtonHeader";
import { formatDate } from "@/lib/payPeriod";
import { Lock } from "lucide-react";
import { useCountUp, usePeriodEstimate, useSalaryData } from "@/lib/salary/hooks";
import { getSchedulesInPeriod, summarizeEstimate } from "@/lib/salary/estimate";
import { getPayPeriodStatus } from "@/lib/salary/status";
import { formatCurrency, getCurrencySymbol } from "@/lib/salary/format";
import type { PayPeriodData } from "@/lib/salary/types";

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

    currencyCode: string | null;
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

type HistoryFilter = "all" | "month" | "3months" | "6months" | "year" | "custom";

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
const getPresetDateRange = (filter: Exclude<HistoryFilter, "custom" | "all">) => {
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
    const [isFormMounted, setIsFormMounted] = useState(false);
    const [isFormAnimating, setIsFormAnimating] = useState(false);

    const [isSaving, setIsSaving] = useState(false);

    // 프로필·급여 설정·근무 일정은 세 급여 화면이 같은 훅으로 불러온다
    const salaryData = useSalaryData();

    const { profile, settings: salarySettings, schedules, isLoading: isSalaryLoading } = salaryData;

    const currency = profile?.currency ?? null;

    const hourlyWage = salarySettings?.hourlyWage ?? null;

    const formCurrency = selectedHistory?.currencyCode ?? currency;

    const formatMoney = (value: number | null | undefined) => formatCurrency(Number(value), currency);

    // 국가 변경 전에 기록한 내역은 그때의 통화로 보여준다
    const formatMoneyFor = (history: { currencyCode: string | null }) => (value: number | null | undefined) =>
        formatCurrency(Number(value), history.currencyCode ?? currency);

    const [form, setForm] = useState<FormState>(emptyForm);

    const [isPendingExpectedOpen, setIsPendingExpectedOpen] = useState(false);

    // 급여 화면에서 넘어온 미기록 급여 기간 (URL ?startDate=&endDate=&payDate=)
    const [urlPeriod, setUrlPeriod] = useState<PayPeriodData | null>(null);

    const [hasHandledUrlPeriod, setHasHandledUrlPeriod] = useState(false);

    /*
     * 급여 기록 필터
     */
    const [historyFilter, setHistoryFilter] = useState<HistoryFilter>("all");

    const [customStartDate, setCustomStartDate] = useState("");
    const [customEndDate, setCustomEndDate] = useState("");

    const [isHistoryFilterOpen, setIsHistoryFilterOpen] = useState(false);

    /*
     * 급여 기록이 많을 때
     * 처음에는 6개만 표시
     */
    const [isHistoryExpanded, setIsHistoryExpanded] = useState(false);

    const loadPayHistory = async () => {
        try {
            const response = await fetch("/api/salary/pay-history");

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

                currencyCode?: string | null;
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

                    currencyCode: item.currencyCode ?? null,
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
        void loadPayHistory();
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

        if (startDate && endDate) {
            setUrlPeriod({ startDate, endDate, payDate: payDate ?? endDate });
        }
    }, []);

    /*
     * 지급일이 오늘 이후인 급여는
     * 아직 실제 지급된 급여가 아니므로 리스트에서 숨김
     *
     * 지급일이 없는 수동 기록은 그대로 표시
     */
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

        if (historyFilter === "all") {
            return { startDate: "0000-01-01", endDate: "9999-12-31" };
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

        return sortedPayHistory.filter((history) => {
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
    }, [sortedPayHistory, historyDateRange]);

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
     * Add Modal Open
     *
     */
    useEffect(() => {
        if (isFormOpen) {
            setIsFormMounted(true);

            document.body.style.overflow = "hidden";

            const frame = window.requestAnimationFrame(() => {
                window.requestAnimationFrame(() => {
                    setIsFormAnimating(true);
                });
            });

            return () => {
                window.cancelAnimationFrame(frame);
                document.body.style.overflow = "";
            };
        }

        setIsFormAnimating(false);

        const timer = window.setTimeout(() => {
            setIsFormMounted(false);
        }, 350);

        document.body.style.overflow = "";

        return () => {
            clearTimeout(timer);
            document.body.style.overflow = "";
        };
    }, [isFormOpen]);

    /*
     * ---------------------------------------------------------
     * 곧 받을 급여 / 아직 기록하지 않은 지난 급여
     *
     * 급여 화면과 같은 규칙(lib/salary/status)으로 판단한다.
     * ---------------------------------------------------------
     */
    const payPeriodStatus = useMemo(
        () =>
            isLoading
                ? { upcoming: null, overdue: null }
                : getPayPeriodStatus({ settings: salarySettings, schedules, recordedPeriods: payHistory }),
        [isLoading, salarySettings, schedules, payHistory],
    );

    const pendingPayPeriod = payPeriodStatus.upcoming;
    const overduePayPeriod = payPeriodStatus.overdue;

    // 팁과 공휴일을 불러와 예상 급여를 계산한다
    const pendingResult = usePeriodEstimate(salaryData, pendingPayPeriod);

    const pendingPeriodEstimate = useMemo(
        () => (pendingResult.outcome?.status === "ok" ? summarizeEstimate(pendingResult.outcome.estimate) : null),
        [pendingResult.outcome],
    );

    const shouldShowPendingPay = Boolean(pendingPayPeriod && pendingPeriodEstimate);

    const animatedPendingNetPay = useCountUp(pendingPeriodEstimate?.netPay ?? 0, shouldShowPendingPay);

    /*
     * URL에서 넘어온 미기록 급여 입력
     */
    const openFormForPeriod = (period: PayPeriodData) => {
        const periodHours = getSchedulesInPeriod(schedules, period).reduce(
            (total, schedule) =>
                total + calculateHours(schedule.startTime, schedule.endTime, schedule.hasBreak ? schedule.breakMinutes : 0),
            0,
        );

        setSelectedHistory(null);

        setForm({
            ...emptyForm,

            startDate: period.startDate,

            endDate: period.endDate,

            payDate: period.payDate,

            hours: periodHours > 0 ? periodHours.toFixed(2) : "",

            pay: hourlyWage !== null && periodHours > 0 ? (periodHours * hourlyWage).toFixed(2) : "",
        });

        setIsFormOpen(true);
    };

    // 급여 화면에서 "기록하러 가기"로 넘어오면 해당 기간이 채워진 입력 폼을 바로 연다
    useEffect(() => {
        if (hasHandledUrlPeriod || !urlPeriod || isLoading || isSalaryLoading) {
            return;
        }

        setHasHandledUrlPeriod(true);

        const isRecorded = payHistory.some(
            (history) => history.startDate === urlPeriod.startDate && history.endDate === urlPeriod.endDate,
        );

        if (!isRecorded) {
            openFormForPeriod(urlPeriod);
        }
    }, [hasHandledUrlPeriod, urlPeriod, isLoading, isSalaryLoading, payHistory]);

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

        if (!Number.isFinite(netPay) || netPay <= 0) {
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

            const response = await fetch("/api/salary/pay-history", {
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

            if (urlPeriod && urlPeriod.startDate === form.startDate && urlPeriod.endDate === form.endDate) {
                setUrlPeriod(null);

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
            const response = await fetch("/api/salary/pay-history", {
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

    if (isLoading || isSalaryLoading) {
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

                {/* 지급일이 지났는데 기록하지 않은 급여 */}
                {overduePayPeriod &&
                    (planCode === "free" && payHistory.length >= 5 ? (
                        <div className="mt-5 flex items-center gap-3 rounded-2xl bg-gray-50 p-4">
                            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gray-100">
                                <Lock size={16} className="text-gray-500" />
                            </div>

                            <div>
                                <p className="text-sm font-semibold text-gray-900">급여 기록 5개를 모두 사용했어요.</p>

                                <p className="mt-1 text-xs text-gray-500">기존 기록을 삭제하면 새로운 급여를 등록할 수 있어요.</p>
                            </div>
                        </div>
                    ) : (
                        <button
                            type="button"
                            onClick={() => openFormForPeriod(overduePayPeriod)}
                            className="mt-5 block w-full rounded-3xl bg-gray-900 p-5 text-left shadow-sm transition hover:shadow-md"
                        >
                            <p className="text-xs text-gray-400">급여 기록</p>

                            <p className="mt-1 text-lg font-bold text-white">지급일이 지났어요</p>

                            <p className="mt-1 text-sm text-gray-500">아직 기록되지 않은 급여가 있어요.</p>

                            <p className="mt-4 text-xs text-gray-400">
                                {formatDisplayDate(overduePayPeriod.startDate)}
                                {" ~ "}
                                {formatDisplayDate(overduePayPeriod.endDate)}
                            </p>

                            <p className="mt-3 text-xs font-medium text-gray-500">지금 기록하기 →</p>
                        </button>
                    ))}

                {/* 급여 예정 */}
                {shouldShowPendingPay && pendingPayPeriod && pendingPeriodEstimate && pendingPeriodEstimate.netPay > 0 && (
                    <button
                        type="button"
                        onClick={() => setIsPendingExpectedOpen(true)}
                        className={`${overduePayPeriod ? "mt-4" : "mt-10"} block w-full rounded-3xl border border-blue-100 bg-blue-50 p-5 text-left shadow-sm transition hover:bg-blue-100/70`}
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

                                <p className="mt-1 text-sm text-gray-500">지급일 {formatDisplayDate(pendingPayPeriod.payDate)}</p>
                            </div>

                            <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-blue-600 shadow-sm">
                                예상
                            </span>
                        </div>
                    </button>
                )}

                {/* 기록 추가 */}
                {planCode === "free" && payHistory.length >= 5 ? (
                    // 위에서 이미 제한 안내가 표시된 경우 중복 표시하지 않음
                    !overduePayPeriod && (
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

                                            <p className="mt-1 font-medium">{formatMoneyFor(history)(history.pay)}</p>
                                        </div>

                                        <div>
                                            <p className="text-xs text-gray-400">팁</p>

                                            <p className="mt-1 font-medium">{formatMoneyFor(history)(history.tips)}</p>
                                        </div>

                                        <div>
                                            <p className="text-xs text-gray-400">실수령액</p>

                                            <p className="mt-1 text-lg font-bold">{formatMoneyFor(history)(history.netPay)}</p>
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

                            <p className="mt-5 text-4xl font-bold">{formatMoneyFor(selectedHistory)(selectedHistory.netPay)}</p>

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

                                    <span>{formatMoneyFor(selectedHistory)(selectedHistory.pay)}</span>
                                </div>

                                <div className="flex justify-between">
                                    <span className="text-gray-400">팁</span>

                                    <span>{formatMoneyFor(selectedHistory)(selectedHistory.tips)}</span>
                                </div>

                                {selectedHistory.deductions > 0 && (
                                    <div className="flex justify-between">
                                        <span className="text-gray-400">공제</span>

                                        <span>-{formatMoneyFor(selectedHistory)(selectedHistory.deductions)}</span>
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
                                                        {formatMoneyFor(selectedHistory)(adjustment.amount)}
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

                                    <span className="text-xl font-bold">{formatMoneyFor(selectedHistory)(selectedHistory.netPay)}</span>
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
            {isPendingExpectedOpen && pendingPayPeriod && pendingPeriodEstimate && (
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

                                    {pendingPeriodEstimate.publicHolidayPay + pendingPeriodEstimate.premiumPay > 0 && (
                                        <div className="flex justify-between">
                                            <span className="text-gray-500">공휴일 수당</span>

                                            <span className="font-medium text-gray-900">
                                                {formatMoney(
                                                    pendingPeriodEstimate.publicHolidayPay + pendingPeriodEstimate.premiumPay,
                                                )}
                                            </span>
                                        </div>
                                    )}

                                    {pendingPeriodEstimate.vacationPay > 0 && (
                                        <div className="flex justify-between">
                                            <span className="text-gray-500">휴가 수당</span>

                                            <span className="font-medium text-gray-900">
                                                {formatMoney(pendingPeriodEstimate.vacationPay)}
                                            </span>
                                        </div>
                                    )}

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

                        {pendingPeriodEstimate.warnings.length > 0 && (
                            <div className="mt-5 rounded-2xl bg-amber-50 px-4 py-3">
                                {pendingPeriodEstimate.warnings.map((warning) => (
                                    <p key={warning} className="text-xs leading-5 text-amber-700">
                                        {warning}
                                    </p>
                                ))}
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

            {isFormMounted && (
                <div className="fixed inset-0 z-[10000]">
                    {/* Backdrop */}

                    <button
                        type="button"
                        aria-label="닫기"
                        onClick={closeForm}
                        className={`absolute inset-0 bg-black/30 transition-opacity duration-300 ease-out ${
                            isFormAnimating ? "opacity-100" : "opacity-0"
                        }`}
                    />

                    {/* Bottom Sheet */}

                    <div
                        className={`absolute inset-x-0 bottom-0 mx-auto flex max-h-[95dvh] w-full max-w-md flex-col rounded-t-[2rem] bg-white shadow-2xl transform-gpu transition-transform duration-[350ms] ease-[cubic-bezier(0.22,1,0.36,1)] ${
                            isFormAnimating ? "translate-y-0" : "translate-y-full"
                        }`}
                    >
                        {/* Handle */}

                        <div className="flex shrink-0 items-center justify-center px-6 pb-4 pt-3">
                            <div className="h-1.5 w-10 rounded-full bg-gray-300" />
                        </div>

                        {/* Content */}

                        <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-8 pt-2 scrollbar-hide">
                            {/* Header */}

                            <div>
                                <h2 className="text-xl font-bold">{selectedHistory ? "급여 기록 수정" : "실제 급여 기록"}</h2>

                                <p className="mt-1 text-sm text-gray-400">실제로 받은 급여를 기록해주세요.</p>
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
                                        <span className="text-gray-400">{getCurrencySymbol(formCurrency)}</span>

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
                                        <span className="text-gray-400">{getCurrencySymbol(formCurrency)}</span>

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
                                        <span className="text-gray-400">{getCurrencySymbol(formCurrency)}</span>

                                        <input
                                            type="number"
                                            min="0"
                                            step="0.01"
                                            value={form.deductions}
                                            onChange={(event) =>
                                                updateForm("deductions", normalizeNumberInput(event.target.value))
                                            }
                                            className="w-full rounded-2xl border border-gray-200 px-4 py-3 outline-none"
                                        />
                                    </div>
                                </div>

                                {/* 추가 / 차감 */}

                                <div>
                                    <div>
                                        <label className="text-sm font-medium">추가 / 차감</label>

                                        <p className="mt-1 text-xs text-gray-400">
                                            Holiday Pay 등의 금액을 추가하거나 차감할 수 있어요.
                                        </p>
                                    </div>

                                    {form.adjustments.length > 0 && (
                                        <div className="mt-3 space-y-3">
                                            {form.adjustments.map((adjustment, index) => (
                                                <div key={index} className="rounded-2xl bg-gray-50 p-3">
                                                    <div className="flex gap-2">
                                                        <select
                                                            value={adjustment.type}
                                                            onChange={(event) =>
                                                                updateAdjustment(
                                                                    index,
                                                                    "type",
                                                                    event.target.value as AdjustmentType,
                                                                )
                                                            }
                                                            className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm outline-none"
                                                        >
                                                            <option value="add">+ 추가</option>
                                                            <option value="subtract">− 차감</option>
                                                        </select>

                                                        <input
                                                            type="text"
                                                            value={adjustment.name}
                                                            onChange={(event) =>
                                                                updateAdjustment(index, "name", event.target.value)
                                                            }
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
                                                        <span className="text-gray-400">{getCurrencySymbol(formCurrency)}</span>

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

                                    <p className="mt-1 text-2xl font-bold">{formatCurrency(Number(calculatedNetPay), formCurrency)}</p>

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
                                        <span className="text-gray-400">{getCurrencySymbol(formCurrency)}</span>

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

                                    <p className="mt-2 text-xs text-gray-400">
                                        실제 급여명세서나 통장에 입금된 금액을 입력해주세요.
                                    </p>
                                </div>
                            </div>

                            {/* Buttons */}

                            <button
                                type="button"
                                onClick={() => void savePayHistory()}
                                disabled={isSaving}
                                className="mt-6 w-full rounded-2xl bg-gray-900 py-4 text-sm font-semibold text-white disabled:opacity-50"
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
