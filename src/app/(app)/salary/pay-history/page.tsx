"use client";

import DateInput from "@/components/DateInput";
import LoadingScreen from "@/components/LoadingScreen";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import BackButtonHeader from "@/components/BackButtonHeader";
import { formatDate } from "@/lib/payPeriod";
import { useUpgrade } from "@/components/UpgradeProvider";
import { Lock } from "lucide-react";
import { useCountUp, usePeriodEstimate, useSalaryData } from "@/lib/salary/hooks";
import { getSchedulesInPeriod, summarizeEstimate } from "@/lib/salary/estimate";
import { getPayPeriodStatus } from "@/lib/salary/status";
import { formatCurrency, getCurrencySymbol } from "@/lib/salary/format";
import type { PayPeriodData } from "@/lib/salary/types";
import BottomSheet from "@/components/BottomSheet";
import { useDialog } from "@/components/DialogProvider";
import { useI18n } from "@/components/I18nProvider";
import { translateWarning } from "@/lib/i18n/warnings";
import type { MessageKey } from "@/lib/i18n";
import UsageMeter from "@/components/UsageMeter";
import { FREE_PLAN_LIMITS } from "@/lib/plans";
import { getCountryLabel, getRegionLabel } from "@/lib/countries";
import { calculateHourlyBasePay, getHourlyWageOn } from "@/lib/salary/wage";

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

    // 기록을 저장할 때의 나라/지역
    countryCode?: string | null;
    provinceCode?: string | null;
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

type TFn = (key: MessageKey, params?: Record<string, string | number>) => string;

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

const getDdayLabel = (targetDate: string, t: TFn) => {
    const days = getDaysDifference(targetDate);

    if (days === 0) {
        return t("sal.dday.today");
    }

    if (days === 1) {
        return t("sal.dday.tomorrow");
    }

    if (days === 2) {
        return t("sal.dday.dayAfter");
    }

    if (days > 2) {
        return t("sal.dday.inDays", { days });
    }

    if (days === -1) {
        return t("sal.dday.yesterday");
    }

    return t("sal.dday.daysAgo", { days: Math.abs(days) });
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
    const { t, language } = useI18n();
    const { confirm, alert: showAlert } = useDialog();
    const { openUpgrade, planCode, isPlanLoaded } = useUpgrade();

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
                countryCode?: string | null;
                provinceCode?: string | null;
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

                    countryCode: item.countryCode ?? null,

                    provinceCode: item.provinceCode ?? null,
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
        // 시급이 중간에 바뀐 기간도 날짜별 시급으로 계산한다
        const periodDays = getSchedulesInPeriod(schedules, period).map((schedule) => ({
            date: schedule.date.slice(0, 10),
            hours: calculateHours(schedule.startTime, schedule.endTime, schedule.hasBreak ? schedule.breakMinutes : 0),
        }));

        const periodHours = periodDays.reduce((total, day) => total + day.hours, 0);

        setSelectedHistory(null);

        setForm({
            ...emptyForm,

            startDate: period.startDate,

            endDate: period.endDate,

            payDate: period.payDate,

            hours: periodHours > 0 ? periodHours.toFixed(2) : "",

            pay:
                hourlyWage !== null && periodHours > 0
                    ? calculateHourlyBasePay(periodDays, salarySettings?.hourlyWageHistory, hourlyWage).toFixed(2)
                    : "",
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
            openUpgrade("pay-history-limit");
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

    // 입력이 올바른지 미리 확인한다. 문제가 있으면 첫 번째 이유를 돌려주고, 저장 버튼은 그동안 비활성화된다.
    const getFormError = (): string | null => {
        const hours = Number(form.hours);
        const pay = Number(form.pay);
        const tips = Number(form.tips || 0);
        const deductions = Number(form.deductions || 0);
        const netPay = Number(form.netPay);

        if (!form.startDate || !form.endDate) {
            return t("payh.err.period");
        }

        if (form.endDate < form.startDate) {
            return t("payh.err.periodOrder");
        }

        if (!form.payDate) {
            return t("payh.err.payDate");
        }

        if (form.hours === "" || !Number.isFinite(hours) || hours < 0) {
            return t("payh.err.hours");
        }

        if (form.pay === "" || !Number.isFinite(pay) || pay < 0) {
            return t("payh.err.pay");
        }

        if (!Number.isFinite(tips) || tips < 0) {
            return t("payh.err.tips");
        }

        if (!Number.isFinite(deductions) || deductions < 0) {
            return t("payh.err.deductions");
        }

        if (form.netPay === "" || !Number.isFinite(netPay) || netPay <= 0) {
            return t("payh.err.netPay");
        }

        return null;
    };

    const formError = getFormError();

    /*
     * 저장
     */
    const savePayHistory = async () => {
        // 버튼이 비활성화되어 있어서 보통은 여기까지 오지 않지만, 한 번 더 막는다.
        if (formError) {
            return;
        }

        const hours = Number(form.hours);

        const pay = Number(form.pay);

        const tips = Number(form.tips || 0);

        const deductions = Number(form.deductions || 0);

        const netPay = Number(form.netPay);

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

            showAlert(t("payh.err.saveFailed"));
        } finally {
            setIsSaving(false);
        }
    };

    /*
     * 삭제
     */
    const deletePayHistory = async (history: PayHistory) => {
        const confirmed = await confirm(
            t("payh.confirmDelete", { start: formatDisplayDate(history.startDate), end: formatDisplayDate(history.endDate) }),
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

            showAlert(t("payh.err.deleteFailed"));
        }
    };

    if (isLoading || isSalaryLoading || !isPlanLoaded) {
        return <LoadingScreen />;
    }

    return (
        <>
            <div className="mx-auto max-w-md">
                <BackButtonHeader
                    href="/salary"
                    title={t("payh.k001")}
                    description={t("payh.k002")}
                />

                <UsageMeter
                    label={t("payh.k001")}
                    used={payHistory.length}
                    limit={FREE_PLAN_LIMITS.payHistory}
                    reason="pay-history-limit"
                    className="mt-6"
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
                                <p className="text-sm font-semibold text-gray-900">{t("payh.k003")}</p>

                                <p className="mt-1 text-xs text-gray-500">{t("payh.k004")}</p>
                            </div>

                            <button
                                type="button"
                                onClick={() => openUpgrade("pay-history-limit")}
                                className="ml-auto shrink-0 rounded-full bg-gray-900 px-3 py-2 text-xs font-medium text-white"
                            >
                                {t("payh.k005")}
                            </button>
                        </div>
                    ) : (
                        <button
                            type="button"
                            onClick={() => openFormForPeriod(overduePayPeriod)}
                            className="mt-5 block w-full rounded-3xl bg-gray-900 p-5 text-left shadow-sm transition hover:shadow-md"
                        >
                            <p className="text-xs text-gray-400">{t("payh.k001")}</p>

                            <p className="mt-1 text-lg font-bold text-white">{t("payh.k006")}</p>

                            <p className="mt-1 text-sm text-gray-500">{t("payh.k007")}</p>

                            <p className="mt-4 text-xs text-gray-400">
                                {formatDisplayDate(overduePayPeriod.startDate)}
                                {" ~ "}
                                {formatDisplayDate(overduePayPeriod.endDate)}
                            </p>

                            <p className="mt-3 text-xs font-medium text-gray-500">{t("payh.k008")}</p>
                        </button>
                    ))}

                {/* 급여 예정 */}
                {shouldShowPendingPay && pendingPayPeriod && pendingPeriodEstimate && pendingPeriodEstimate.netPay > 0 && (
                    <button
                        type="button"
                        onClick={() => setIsPendingExpectedOpen(true)}
                        className={`${overduePayPeriod ? "mt-4" : "mt-10"} block w-full rounded-3xl border border-[#D9E7DE] bg-[#EEF4F0] p-5 text-left shadow-sm transition hover:bg-[#E3EDE6]`}
                    >
                        <div className="flex items-start justify-between gap-4">
                            <div>
                                <p className="text-xs text-[#5B8A6A]">{t("payh.k009")}</p>

                                <p className="mt-1 text-sm font-semibold text-gray-700">
                                    {formatDisplayDate(pendingPayPeriod.startDate)}
                                    {" ~ "}
                                    {formatDisplayDate(pendingPayPeriod.endDate)}
                                </p>

                                <p className="mt-3 text-lg font-semibold text-gray-900">
                                    <span className="text-[#3F6B4F]">{getDdayLabel(pendingPayPeriod.payDate, t)}</span>{" "}
                                    {t("sal.receive", { amount: formatMoney(animatedPendingNetPay) })}
                                </p>

                                <p className="mt-1 text-sm text-gray-500">{t("sal.payDate", { date: formatDisplayDate(pendingPayPeriod.payDate) })}</p>
                            </div>

                            <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-[#3F6B4F] shadow-sm">
                                {t("payh.k010")}
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
                                <p className="text-sm font-semibold text-gray-900">{t("payh.k003")}</p>

                                <p className="mt-1 text-xs text-gray-500">{t("payh.k004")}</p>
                            </div>

                            <button
                                type="button"
                                onClick={() => openUpgrade("pay-history-limit")}
                                className="ml-auto shrink-0 rounded-full bg-gray-900 px-3 py-2 text-xs font-medium text-white"
                            >
                                {t("payh.k005")}
                            </button>
                        </div>
                    )
                ) : (
                    <button
                        type="button"
                        onClick={openCreateForm}
                        className="mt-6 flex w-full items-center justify-between rounded-3xl bg-white p-5 text-left shadow-sm transition hover:shadow-md"
                    >
                        <div>
                            <p className="font-semibold">{t("payh.k011")}</p>

                            <p className="mt-1 text-sm text-gray-400">{t("payh.k012")}</p>
                        </div>

                        <span className="text-xl">+</span>
                    </button>
                )}

                {/* --------------------------------------------------
                    {t("payh.k013")}
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
                                    { value: "month" as const, label: t("payh.filter.month") },
                                    { value: "3months" as const, label: t("payh.filter.3months") },
                                    { value: "6months" as const, label: t("payh.filter.6months") },
                                    { value: "year" as const, label: t("payh.filter.year") },
                                    { value: "custom" as const, label: t("payh.filter.custom") },
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
                                    {t("payh.k014")}
                                </button>
                            </div>
                        </div>

                        {/* 필터 버튼 / 닫기 버튼 */}
                        <button
                            type="button"
                            aria-label={isHistoryFilterOpen ? t("payh.filter.close") : t("payh.filter.open")}
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
                                    <p className="mb-2 text-xs text-gray-400">{t("payh.k015")}</p>

                                    <DateInput
                                        variant="outline"
                                        compact
                                        value={customStartDate}
                                        placeholder={t("common.startDate")}
                                        onChange={(value) => {
                                            setCustomStartDate(value);
                                            setIsHistoryExpanded(false);
                                        }}
                                    />
                                </div>

                                <div>
                                    <p className="mb-2 text-xs text-gray-400">{t("payh.k016")}</p>

                                    <DateInput
                                        variant="outline"
                                        compact
                                        value={customEndDate}
                                        placeholder={t("common.endDate")}
                                        onChange={(value) => {
                                            setCustomEndDate(value);
                                            setIsHistoryExpanded(false);
                                        }}
                                    />
                                </div>
                            </div>

                            {customStartDate && customEndDate && customStartDate > customEndDate && (
                                <p className="mt-3 text-xs text-red-500">{t("payh.k017")}</p>
                            )}
                        </div>
                    )}
                </section>

                {historyFilter === "custom" && (!customStartDate || !customEndDate || customStartDate > customEndDate) ? (
                    <section className="mt-3 rounded-3xl bg-white p-6 shadow-sm">
                        <p className="text-sm text-gray-400">
                            {customStartDate && customEndDate && customStartDate > customEndDate
                                ? t("payh.range.reselect")
                                : t("payh.range.select")}
                        </p>
                    </section>
                ) : filteredPayHistory.length === 0 ? (
                    <section className="mt-3 rounded-3xl bg-white p-6 shadow-sm">
                        <p className="text-sm text-gray-400">{t("payh.k018")}</p>
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
                                            {index === 0 && <p className="text-xs text-gray-400">{t("payh.k019")}</p>}

                                            <p className="mt-1 font-semibold">
                                                {formatDisplayDate(history.startDate)}
                                                {" ~ "}
                                                {formatDisplayDate(history.endDate)}
                                            </p>

                                            {history.payDate && (
                                                <p className="mt-1 text-xs text-gray-400">
                                                    {t("sal.payDate", { date: formatDisplayDate(history.payDate) })}
                                                </p>
                                            )}
                                        </div>

                                        <span className="text-gray-300">→</span>
                                    </div>

                                    <div className="mt-5 grid grid-cols-2 gap-y-4 text-sm">
                                        <div>
                                            <p className="text-xs text-gray-400">{t("payh.k020")}</p>

                                            <p className="mt-1 font-medium">
                                                {history.hours.toFixed(2)}
                                                {t("payh.k021")}
                                            </p>
                                        </div>

                                        <div>
                                            <p className="text-xs text-gray-400">{t("payh.k022")}</p>

                                            <p className="mt-1 font-medium">{formatMoneyFor(history)(history.pay)}</p>
                                        </div>

                                        <div>
                                            <p className="text-xs text-gray-400">{t("payh.k023")}</p>

                                            <p className="mt-1 font-medium">{formatMoneyFor(history)(history.tips)}</p>
                                        </div>

                                        <div>
                                            <p className="text-xs text-gray-400">{t("payh.k024")}</p>

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
                                    ? t("payh.collapse")
                                    : t("payh.more", { count: filteredPayHistory.length - displayedPayHistory.length })}
                            </button>
                        )}
                    </>
                )}
            </div>

            {/* 상세 모달 */}
            <BottomSheet plain isOpen={Boolean(selectedHistory && !isFormOpen)} onClose={() => setSelectedHistory(null)}>
                {selectedHistory && !isFormOpen && (
                    <>
                            <section className="text-gray-950">
                                <div className="flex items-start justify-between">
                                    <div>
                                        <p className="text-xs text-gray-500">
                                            {formatDisplayDate(selectedHistory.startDate)}
                                            {" ~ "}
                                            {formatDisplayDate(selectedHistory.endDate)}
                                        </p>

                                        {selectedHistory.payDate && (
                                            <p className="mt-1 text-xs text-gray-500">
                                                {t("sal.payDate", { date: formatDisplayDate(selectedHistory.payDate) })}
                                            </p>
                                        )}

                                        {selectedHistory.countryCode && (
                                            <p className="mt-1 text-xs text-gray-500">
                                                {getCountryLabel(selectedHistory.countryCode, { short: true, language })}
                                                {selectedHistory.provinceCode
                                                    ? ` · ${getRegionLabel(selectedHistory.countryCode, selectedHistory.provinceCode) || selectedHistory.provinceCode}`
                                                    : ""}
                                            </p>
                                        )}
                                    </div>

                                </div>

                                <p className="mt-5 text-4xl font-bold">{formatMoneyFor(selectedHistory)(selectedHistory.netPay)}</p>

                                <div className="mt-6 space-y-3 text-sm">
                                    <div className="flex justify-between">
                                        <span className="text-gray-400">{t("payh.k025")}</span>

                                        <span>
                                            {selectedHistory.hours.toFixed(2)}
                                            {t("payh.k021")}
                                        </span>
                                    </div>

                                    <div className="flex justify-between">
                                        <span className="text-gray-400">{t("payh.k022")}</span>

                                        <span>{formatMoneyFor(selectedHistory)(selectedHistory.pay)}</span>
                                    </div>

                                    <div className="flex justify-between">
                                        <span className="text-gray-400">{t("payh.k023")}</span>

                                        <span>{formatMoneyFor(selectedHistory)(selectedHistory.tips)}</span>
                                    </div>

                                    {selectedHistory.deductions > 0 && (
                                        <div className="flex justify-between">
                                            <span className="text-gray-400">{t("payh.k026")}</span>

                                            <span>-{formatMoneyFor(selectedHistory)(selectedHistory.deductions)}</span>
                                        </div>
                                    )}

                                    {selectedHistory.adjustments.length > 0 && (
                                        <div className="border-t border-gray-100 pt-4">
                                            <p className="mb-3 text-xs text-gray-500">{t("payh.k027")}</p>

                                            <div className="space-y-2">
                                                {selectedHistory.adjustments.map((adjustment, index) => (
                                                    <div key={`${adjustment.name}-${index}`} className="flex justify-between">
                                                        <span className="text-gray-400">{adjustment.name}</span>

                                                        <span className={adjustment.type === "add" ? "text-gray-950" : "text-gray-400"}>
                                                            {adjustment.type === "add" ? "+" : "-"}
                                                            {formatMoneyFor(selectedHistory)(adjustment.amount)}
                                                        </span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>

                                <div className="mt-6 rounded-2xl bg-gray-50 p-4 text-gray-950">
                                    <div className="flex items-center justify-between">
                                        <span className="text-sm font-medium">{t("payh.k028")}</span>

                                        <span className="text-xl font-bold">{formatMoneyFor(selectedHistory)(selectedHistory.netPay)}</span>
                                    </div>
                                </div>

                                <div className="mt-5 flex gap-3">
                                    <button
                                        type="button"
                                        onClick={() => openEditForm(selectedHistory)}
                                        className="flex-1 rounded-2xl border border-gray-200 py-3 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
                                    >
                                        {t("payh.k029")}
                                    </button>

                                    <button
                                        type="button"
                                        onClick={() => void deletePayHistory(selectedHistory)}
                                        className="flex-1 rounded-2xl border border-red-200 py-3 text-sm font-medium text-red-500 transition hover:bg-red-50"
                                    >
                                        {t("payh.k030")}
                                    </button>
                                </div>
                            </section>
                
                
                    </>
                )}
            </BottomSheet>

            {/* Pending Expected Salary Modal */}
            <BottomSheet isOpen={Boolean(isPendingExpectedOpen && pendingPayPeriod && pendingPeriodEstimate)} onClose={() => setIsPendingExpectedOpen(false)}>
                {isPendingExpectedOpen && pendingPayPeriod && pendingPeriodEstimate && (
                    <>
                            <div className="flex items-start justify-between">
                                <div>
                                    <div className="flex items-center gap-2">
                                        <span className="rounded-full bg-[#EEF4F0] px-2.5 py-1 text-[11px] font-semibold text-[#3F6B4F]">
                                            {t("payh.k010")}
                                        </span>

                                        <span className="text-xs text-gray-400">{getDdayLabel(pendingPayPeriod.payDate, t)}</span>
                                    </div>

                                    <p className="mt-3 text-lg font-bold text-gray-900">{t("payh.k031")}</p>

                                    <p className="mt-1 text-sm text-gray-500">
                                        {formatDisplayDate(pendingPayPeriod.startDate)}
                                        {" ~ "}
                                        {formatDisplayDate(pendingPayPeriod.endDate)}
                                    </p>
                                </div>

                            </div>

                            <div className="mt-6 rounded-3xl bg-[#EEF4F0] p-5">
                                <p className="text-xs font-medium text-[#5B8A6A]">{t("payh.k032")}</p>

                                <p className="mt-2 text-4xl font-bold tracking-tight text-gray-900">
                                    {formatMoney(pendingPeriodEstimate.netPay)}
                                </p>

                                <div className="mt-4 flex items-center justify-between">
                                    <span className="text-sm text-gray-500">{t("payh.k033")}</span>

                                    <span className="text-sm font-semibold text-gray-900">
                                        {formatDisplayDate(pendingPayPeriod.payDate)}
                                    </span>
                                </div>
                            </div>

                            <div className="mt-6">
                                <p className="mb-3 text-xs font-semibold text-gray-400">{t("payh.k034")}</p>

                                <div className="rounded-3xl bg-gray-50 p-5">
                                    <div className="space-y-4 text-sm">
                                        <div className="flex justify-between">
                                            <span className="text-gray-500">{t("payh.k025")}</span>

                                            <span className="font-medium text-gray-900">
                                                {pendingPeriodEstimate.hours.toFixed(2)}
                                                {t("payh.k021")}
                                            </span>
                                        </div>

                                        <div className="flex justify-between">
                                            <span className="text-gray-500">{t("payh.k035")}</span>

                                            <span className="font-medium text-gray-900">
                                                {formatMoney(pendingPeriodEstimate.basePay)}
                                            </span>
                                        </div>

                                        {pendingPeriodEstimate.paychequeTips > 0 && (
                                            <div className="flex justify-between">
                                                <span className="text-gray-500">{t("payh.k036")}</span>

                                                <span className="font-medium text-gray-900">
                                                    {formatMoney(pendingPeriodEstimate.paychequeTips)}
                                                </span>
                                            </div>
                                        )}

                                        {pendingPeriodEstimate.publicHolidayPay + pendingPeriodEstimate.premiumPay > 0 && (
                                            <div className="flex justify-between">
                                                <span className="text-gray-500">{t("payh.k037")}</span>

                                                <span className="font-medium text-gray-900">
                                                    {formatMoney(
                                                        pendingPeriodEstimate.publicHolidayPay + pendingPeriodEstimate.premiumPay,
                                                    )}
                                                </span>
                                            </div>
                                        )}

{pendingPeriodEstimate.overtimePay > 0 && (
                                            <div className="flex justify-between">
                                                <span className="text-gray-500">{t("sal.overtime")}</span>

                                                <span className="font-medium text-gray-900">{formatMoney(pendingPeriodEstimate.overtimePay)}</span>
                                            </div>
                                        )}

                                        {pendingPeriodEstimate.vacationPay > 0 && (
                                            <div className="flex justify-between">
                                                <span className="text-gray-500">{t("payh.k038")}</span>

                                                <span className="font-medium text-gray-900">
                                                    {formatMoney(pendingPeriodEstimate.vacationPay)}
                                                </span>
                                            </div>
                                        )}

                                        <div className="my-1 border-t border-gray-200" />

                                        <div className="flex justify-between">
                                            <span className="font-medium text-gray-600">{t("payh.k039")}</span>

                                            <span className="font-semibold text-gray-900">
                                                {formatMoney(pendingPeriodEstimate.grossPay)}
                                            </span>
                                        </div>

                                        <div className="flex justify-between">
                                            <span className="text-gray-500">{t("payh.k040")}</span>

                                            <span className="text-gray-600">- {formatMoney(pendingPeriodEstimate.deductions)}</span>
                                        </div>

                                        <div className="my-1 border-t border-gray-200" />

                                        <div className="flex justify-between">
                                            <span className="font-semibold text-gray-900">{t("payh.k024")}</span>

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
                                        <span className="text-sm text-gray-500">{t("payh.k041")}</span>

                                        <span className="text-sm font-semibold text-gray-900">
                                            {formatMoney(pendingPeriodEstimate.cashTips)}
                                        </span>
                                    </div>

                                    <div className="mt-4 flex items-center justify-between rounded-2xl bg-white p-4 shadow-sm">
                                        <span className="text-sm font-semibold text-gray-700">{t("payh.k042")}</span>

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
                                            {translateWarning(warning, t)}
                                        </p>
                                    ))}
                                </div>
                            )}

                            <div className="mt-5 rounded-2xl bg-amber-50 px-4 py-3">
                                <p className="text-xs leading-5 text-amber-700">
                                    {t("payh.k043")}
                                </p>
                            </div>

                            <Link
                                href="/salary/schedule"
                                onClick={() => setIsPendingExpectedOpen(false)}
                                className="mt-5 block w-full rounded-2xl bg-gray-900 py-4 text-center text-sm font-semibold text-white transition hover:bg-gray-800"
                            >
                                {t("payh.k044")}
                            </Link>
                
                
                    </>
                )}
            </BottomSheet>

            {/* 입력 / 수정 모달 */}

            {isFormMounted && (
                <div className="fixed inset-0 z-[10000]">
                    {/* Backdrop */}

                    <button
                        type="button"
                        aria-label={t("payh.k045")}
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
                                <h2 className="text-xl font-bold">{selectedHistory ? t("payh.form.edit") : t("payh.form.new")}</h2>

                                <p className="mt-1 text-sm text-gray-400">{t("payh.k046")}</p>
                            </div>

                            <div className="mt-6 space-y-5">
                                {/* 급여 기간 */}

                                <div>
                                    <label className="text-sm font-medium">{t("payh.k047")}</label>

                                    <div className="mt-2 grid grid-cols-2 gap-2">
                                        <DateInput
                                            variant="outline"
                                            compact
                                            value={form.startDate}
                                            placeholder={t("common.startDate")}
                                            onChange={(value) => updateForm("startDate", value)}
                                        />

                                        <DateInput
                                            variant="outline"
                                            compact
                                            value={form.endDate}
                                            placeholder={t("common.endDate")}
                                            onChange={(value) => updateForm("endDate", value)}
                                        />
                                    </div>
                                </div>

                                {/* 지급일 */}

                                <div>
                                    <label className="text-sm font-medium">{t("payh.k033")}</label>

                                    <DateInput
                                        variant="outline"
                                        compact
                                        className="mt-2"
                                        value={form.payDate}
                                        placeholder={t("payh.k033")}
                                        onChange={(value) => updateForm("payDate", value)}
                                    />
                                </div>

                                {/* 근무시간 */}

                                <div>
                                    <label className="text-sm font-medium">{t("payh.k048")}</label>

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
                                                                      ? (
                                                                            Number(hours) *
                                                                            getHourlyWageOn(
                                                                                current.endDate,
                                                                                salarySettings?.hourlyWageHistory,
                                                                                hourlyWage,
                                                                            )
                                                                        ).toFixed(2)
                                                                      : current.pay,
                                                          }),
                                                }));
                                            }}
                                            className="w-full rounded-2xl border border-gray-200 px-4 py-3 outline-none"
                                        />

                                        <span className="text-sm text-gray-400">{t("payh.k021")}</span>
                                    </div>
                                </div>

                                {/* 급여 */}

                                <div>
                                    <label className="text-sm font-medium">{t("payh.k022")}</label>

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
                                    <label className="text-sm font-medium">{t("payh.k023")}</label>

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
                                    <label className="text-sm font-medium">{t("payh.k026")}</label>

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
                                        <label className="text-sm font-medium">{t("payh.k027")}</label>

                                        <p className="mt-1 text-xs text-gray-400">
                                            {t("payh.k049")}
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
                                                            <option value="add">{t("payh.k050")}</option>
                                                            <option value="subtract">{t("payh.k051")}</option>
                                                        </select>

                                                        <input
                                                            type="text"
                                                            value={adjustment.name}
                                                            onChange={(event) =>
                                                                updateAdjustment(index, "name", event.target.value)
                                                            }
                                                            placeholder={t("payh.k052")}
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
                                            {t("payh.addAmount")}
                                        </button>

                                        <button
                                            type="button"
                                            onClick={() => addAdjustment("subtract")}
                                            className="rounded-2xl border border-gray-200 py-3 text-sm font-medium"
                                        >
                                            {t("payh.subAmount")}
                                        </button>
                                    </div>
                                </div>

                                {/* 계산된 실수령액 */}

                                <div className="rounded-3xl bg-gray-50 p-5">
                                    <p className="text-xs text-gray-400">{t("payh.k053")}</p>

                                    <p className="mt-1 text-2xl font-bold">{formatCurrency(Number(calculatedNetPay), formCurrency)}</p>

                                    <button
                                        type="button"
                                        onClick={useCalculatedNetPay}
                                        className="mt-4 w-full rounded-2xl bg-white px-4 py-3 text-sm font-medium shadow-sm"
                                    >
                                        {t("payh.k054")}
                                    </button>
                                </div>

                                {/* 실제 실수령액 */}

                                <div>
                                    <label className="text-sm font-medium">{t("payh.k055")}</label>

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
                                        {t("payh.k056")}
                                    </p>
                                </div>
                            </div>

                            {/* Buttons */}

                            <button
                                type="button"
                                onClick={() => void savePayHistory()}
                                disabled={isSaving || formError !== null}
                                className="mt-6 w-full rounded-2xl bg-gray-900 py-4 text-sm font-semibold text-white transition-colors hover:bg-gray-800 disabled:cursor-not-allowed disabled:bg-gray-200 disabled:text-gray-400 disabled:hover:bg-gray-200"
                            >
                                {isSaving ? t("common.saving") : t("payh.saveBtn")}
                            </button>

                            {formError && !isSaving && <p className="mt-3 text-center text-xs text-gray-400">{formError}</p>}
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
