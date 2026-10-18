"use client";

import LoadingScreen from "@/components/LoadingScreen";
import { useEffect, useMemo, useState } from "react";
import { formatDate, getSurroundingPayPeriods } from "@/lib/payPeriod";
import Link from "next/link";
import { useUpgrade } from "@/components/UpgradeProvider";
import { ClipboardList, Lock, Settings } from "lucide-react";
import SalarySettingsSheet from "@/components/SalarySettingsSheet";
import { useCountUp, usePeriodEstimate, useSalaryData } from "@/lib/salary/hooks";
import { getSchedulesInPeriod, summarizeEstimate } from "@/lib/salary/estimate";
import { getPayPeriodStatus } from "@/lib/salary/status";
import { formatCurrency as formatMoney } from "@/lib/salary/format";
import type { PeriodEstimateOutcome } from "@/lib/salary/types";
import BottomSheet from "@/components/BottomSheet";
import { useI18n } from "@/components/I18nProvider";
import { translateWarning } from "@/lib/i18n/warnings";
import type { MessageKey } from "@/lib/i18n";
import MinimumWageNotice from "@/components/MinimumWageNotice";
import type { WagePreset } from "@/lib/minimumWage";

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

    currencyCode?: string | null;

    createdAt?: string;
    updatedAt?: string;
};

type GraphPoint = {
    startDate: string;
    endDate: string;
    payDate: string | null;
    value: number;
    isEstimate: boolean;
    history?: PayHistory;
};

type TFn = (key: MessageKey, params?: Record<string, string | number>) => string;

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

// 계산할 수 없을 때 카드에 보여줄 안내
const getEstimateProblemMessage = (outcome: PeriodEstimateOutcome | null, t: TFn) => {
    switch (outcome?.status) {
        case "unsupported-country":
            return t("sal.problem.unsupported");

        case "no-profile":
            return t("sal.problem.noProfile");

        case "no-settings":
            return t("sal.problem.noSettings");

        default:
            return null;
    }
};

export default function SalaryPage() {
    const { t } = useI18n();
    const salaryData = useSalaryData();

    const { profile, settings: salarySettings, schedules, isLoading, reloadSettings } = salaryData;

    const currency = profile?.currency ?? null;

    const { openUpgrade, planCode, isPlanLoaded } = useUpgrade();
    const [isSalarySettingsOpen, setIsSalarySettingsOpen] = useState(false);
    // 최저시급 안내에서 시트를 열 때 미리 채워줄 시급/적용일
    const [wagePreset, setWagePreset] = useState<WagePreset | null>(null);

    const [payHistory, setPayHistory] = useState<PayHistory[]>([]);
    const [isPayHistoryLoaded, setIsPayHistoryLoaded] = useState(false);

    const [isPendingExpectedOpen, setIsPendingExpectedOpen] = useState(false);

    const [selectedPayHistory, setSelectedPayHistory] = useState<PayHistory | null>(null);

    const [hoveredGraphPoint, setHoveredGraphPoint] = useState<GraphPoint | null>(null);

    /*
     * --------------------------------------------------
     * Premium User
     * --------------------------------------------------
     */


    /*
     * --------------------------------------------------
     * Load Actual Pay History
     * --------------------------------------------------
     */

    useEffect(() => {
        const loadPayHistory = async () => {
            try {
                const response = await fetch("/api/salary/pay-history");

                if (!response.ok) {
                    throw new Error("급여 기록 조회 실패");
                }

                const data: PayHistory[] = await response.json();

                setPayHistory(data);
            } catch (error) {
                console.error("급여 기록 조회 실패:", error);
            } finally {
                setIsPayHistoryLoaded(true);
            }
        };

        loadPayHistory();
    }, []);

    /*
     * --------------------------------------------------
     * Pay Periods
     *
     * 현재 급여 기간 / 곧 받을 급여 / 아직 기록하지 않은 지난 급여는
     * 급여 기록 화면과 같은 규칙(lib/payPeriod, lib/salary/status)으로 정한다.
     * --------------------------------------------------
     */

    const today = formatDate(new Date());

    const currentPayPeriod = useMemo(
        () => (salarySettings ? (getSurroundingPayPeriods(salarySettings, today)?.current ?? null) : null),
        [salarySettings, today],
    );

    const payPeriodStatus = useMemo(
        () =>
            isPayHistoryLoaded
                ? getPayPeriodStatus({ settings: salarySettings, schedules, recordedPeriods: payHistory, today })
                : { upcoming: null, overdue: null },
        [isPayHistoryLoaded, salarySettings, schedules, payHistory, today],
    );

    const pendingPayPeriod = payPeriodStatus.upcoming;
    const overduePayPeriod = payPeriodStatus.overdue;

    /*
     * --------------------------------------------------
     * Estimates (현재 기간 / 곧 받을 급여)
     * --------------------------------------------------
     */

    const currentResult = usePeriodEstimate(salaryData, currentPayPeriod);
    const pendingResult = usePeriodEstimate(salaryData, pendingPayPeriod);

    const currentPeriodSchedules = useMemo(
        () => (currentPayPeriod ? getSchedulesInPeriod(schedules, currentPayPeriod) : []),
        [schedules, currentPayPeriod],
    );

    const currentPeriodEstimate = useMemo(
        () => (currentResult.outcome?.status === "ok" ? summarizeEstimate(currentResult.outcome.estimate) : null),
        [currentResult.outcome],
    );

    const pendingPeriodEstimate = useMemo(
        () => (pendingResult.outcome?.status === "ok" ? summarizeEstimate(pendingResult.outcome.estimate) : null),
        [pendingResult.outcome],
    );

    const currentEstimateProblem = getEstimateProblemMessage(currentResult.outcome, t);

    const shouldShowPendingPay = Boolean(pendingPayPeriod && pendingPeriodEstimate);

    const animatedPendingNetPay = useCountUp(pendingPeriodEstimate?.totalIncome ?? 0, shouldShowPendingPay);

    /*
     * --------------------------------------------------
     * Actual Net Pay Statistics
     * --------------------------------------------------
     */

    const actualPayPeriods = payHistory
        // 국가를 바꾸기 전 다른 통화 기록은 통계에서 제외
        .filter((history) => !history.currencyCode || !currency || history.currencyCode === currency)
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
        shouldShowPendingPay && pendingPayPeriod && pendingPeriodEstimate
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
            <header className="mt-5 mb-10">
                <p className="text-sm text-gray-500">{t("common.appName")}</p>

                <div className="mt-2 flex items-center justify-between">
                    <h1 className="text-3xl font-bold">{t("sal.k002")}</h1>

                    <div className="flex items-center gap-2">
                        <Link
                            href="/salary/pay-history"
                            className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-gray-500 shadow-sm transition hover:bg-gray-50"
                            aria-label={t("sal.k003")}
                        >
                            <ClipboardList size={18} strokeWidth={1.8} />
                        </Link>

                        <button
                            type="button"
                            onClick={() => setIsSalarySettingsOpen(true)}
                            className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-gray-500 shadow-sm transition hover:bg-gray-50"
                            aria-label={t("sal.k004")}
                        >
                            <Settings size={18} strokeWidth={1.8} />
                        </button>
                    </div>
                </div>

                <p className="mt-2 text-sm text-gray-500">{t("sal.k005")}</p>
            </header>
            {!salarySettings ? (
                <section className="rounded-3xl bg-white p-6 shadow-sm">
                    <p className="text-xs font-medium text-gray-400">{t("sal.k004")}</p>

                    <h2 className="mt-2 text-lg font-bold text-gray-900">{t("sal.k006")}</h2>

                    <p className="mt-2 text-sm leading-6 text-gray-500">
                        {t("sal.k007")}
                    </p>

                    <button
                        type="button"
                        onClick={() => setIsSalarySettingsOpen(true)}
                        className="mt-5 w-full rounded-2xl bg-gray-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-gray-800"
                    >
                        {t("sal.k008")}
                    </button>
                </section>
            ) : (
                <>
                    <MinimumWageNotice
                        profile={profile}
                        settings={salarySettings}
                        onApply={(preset) => {
                            setWagePreset(preset);
                            setIsSalarySettingsOpen(true);
                        }}
                        className="mb-4"
                    />

                    {/* --------------------------------------------------
                    Pending Pay Status
                -------------------------------------------------- */}

                    {overduePayPeriod && (
                        <Link
                            href={`/salary/pay-history?startDate=${overduePayPeriod.startDate}&endDate=${overduePayPeriod.endDate}&payDate=${overduePayPeriod.payDate}`}
                            className="block w-full rounded-3xl bg-gray-900 p-5 text-left shadow-sm transition hover:shadow-md"
                        >
                            <p className="text-xs text-gray-400">{t("sal.k003")}</p>

                            <p className="mt-1 text-lg font-bold text-white">{t("sal.k009")}</p>

                            <p className="mt-1 text-sm text-gray-500">{t("sal.k010")}</p>

                            <p className="mt-4 text-xs text-gray-400">
                                {formatDisplayDate(overduePayPeriod.startDate)}
                                {" ~ "}
                                {formatDisplayDate(overduePayPeriod.endDate)}
                            </p>

                            <p className="mt-3 text-xs font-medium text-gray-500">{t("sal.k011")}</p>
                        </Link>
                    )}

                    {shouldShowPendingPay && pendingPayPeriod && pendingPeriodEstimate && pendingPeriodEstimate.netPay > 0 && (
                        <button
                            type="button"
                            onClick={() => setIsPendingExpectedOpen(true)}
                            className="mt-4 block w-full rounded-3xl border border-[#D9E7DE] bg-[#EEF4F0] p-5 text-left shadow-sm transition hover:bg-[#E3EDE6]"
                        >
                            <div className="flex items-start justify-between gap-4">
                                <div className="min-w-0">
                                    <p className="text-xs text-[#5B8A6A]">{t("sal.k012")}</p>

                                    <p className="mt-2 text-lg font-semibold text-gray-900">
                                        <span className="text-[#3F6B4F]">{getDdayLabel(pendingPayPeriod.payDate, t)}</span>{" "}
                                        {t("sal.receive", { amount: formatMoney(animatedPendingNetPay, currency) })}{" "}
                                    </p>

                                    <p className="mt-1 text-sm text-gray-500">
                                        {t("sal.k013")}
                                    </p>
                                </div>

                                <span className="shrink-0 whitespace-nowrap rounded-full bg-white px-3 py-1 text-xs font-semibold text-[#3F6B4F] shadow-sm">
                                    {t("sal.k014")}
                                </span>
                            </div>
                        </button>
                    )}

                    {salarySettings && !currentPayPeriod && (
                        <section className="mt-6 rounded-3xl bg-white p-5 shadow-sm">
                            <p className="text-xs font-medium text-[#5B8A6A]">{t("sal.k015")}</p>

                            <p className="mt-2 text-lg font-bold text-gray-900">{t("sal.k016")}</p>

                            <p className="mt-1 text-sm text-gray-500">
                                {t("sal.k017")}
                            </p>

                            <button
                                type="button"
                                onClick={() => setIsSalarySettingsOpen(true)}
                                className="mt-4 w-full rounded-2xl bg-gray-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-gray-800"
                            >
                                {t("sal.k008")}
                            </button>
                        </section>
                    )}

                    {currentPayPeriod && (
                        <div className="mt-6 rounded-3xl bg-white p-5 shadow-sm">
                            <p className="text-xs font-medium text-[#5B8A6A]">{t("sal.k018")}</p>

                            <p className="mt-1 text-sm font-semibold text-gray-900">
                                {formatDisplayDate(currentPayPeriod.startDate)}
                                {" ~ "}
                                {formatDisplayDate(currentPayPeriod.endDate)}
                            </p>

                            {currentPeriodSchedules.length === 0 ? (
                                <div>
                                    <p className="mt-5 text-lg font-bold text-gray-900">{t("sal.k019")}</p>

                                    <p className="mt-1 text-sm text-gray-500">{t("sal.k020")}</p>
                                </div>
                            ) : currentEstimateProblem ? (
                                <p className="mt-5 text-sm text-gray-500">{currentEstimateProblem}</p>
                            ) : currentPeriodEstimate ? (
                                <>
                                    <p className="mt-5 text-xs text-gray-400">{t("sal.k021")}</p>

                                    <p className="mt-1 text-2xl font-bold text-gray-900">
                                        {formatMoney(currentPeriodEstimate.totalIncome, currency)}
                                    </p>

                                    <div className="mt-3 flex items-center gap-3 text-sm text-gray-500">
                                        <span>
                                            {currentPeriodEstimate.hours.toFixed(2)}
                                            {t("sal.k022")}
                                        </span>

                                        <span>·</span>

                                        <span>
                                            {t("sal.tips", {
                                                amount: formatMoney(
                                                    currentPeriodEstimate.cashTips + currentPeriodEstimate.paychequeTips,
                                                    currency,
                                                ),
                                            })}
                                        </span>
                                    </div>
                                </>
                            ) : null}

                            <Link
                                href="/salary/schedule"
                                className="mt-5 block w-full rounded-2xl bg-gray-900 px-4 py-3 text-center text-sm font-semibold text-white transition hover:bg-gray-800"
                            >
                                {currentPeriodSchedules.length === 0 ? t("sal.addSchedule.first") : t("sal.addSchedule.more")}
                            </Link>
                        </div>
                    )}

                    {/* --------------------------------------------------
                    Actual Net Pay Statistics
                -------------------------------------------------- */}

                    <section className="mt-6">
                        {planCode === "pro" ? (
                            <div className="rounded-3xl bg-white p-5 shadow-sm">
                                <div className="flex items-start justify-between">
                                    <div>
                                        <p className="text-xs text-gray-400">{t("sal.k023")}</p>

                                        <h2 className="mt-1 text-lg font-bold">{t("sal.k024")}</h2>
                                    </div>

                                    <Link
                                        href="/salary/pay-history"
                                        className="rounded-full bg-gray-100 px-3 py-2 text-xs font-medium text-gray-600"
                                    >
                                        {t("sal.k025")}
                                    </Link>
                                </div>

                                <p className="mt-2 text-3xl font-bold">
                                    {averageActualNetPay !== null ? formatMoney(averageActualNetPay, currency) : "-"}{" "}
                                </p>

                                {graphPayHistory.length > 0 ? (
                                    <div className="mt-8">
                                        <div className="relative h-48 w-full">
                                            {(() => {
                                                const values = graphPayHistory.map((point) => point.value);

                                                const allValues = [
                                                    ...values,
                                                    ...(averageActualNetPay !== null ? [averageActualNetPay] : []),
                                                ];

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
                                                            : paddingX +
                                                              (index / (graphPayHistory.length - 1)) * (width - paddingX * 2);

                                                    const y =
                                                        height -
                                                        paddingY -
                                                        ((point.value - minValue) / range) * (height - paddingY * 2);

                                                    return {
                                                        ...point,
                                                        x,
                                                        y,
                                                    };
                                                });

                                                const linePoints = points.map((point) => `${point.x},${point.y}`).join(" ");

                                                const averageY =
                                                    averageActualNetPay !== null
                                                        ? height -
                                                          paddingY -
                                                          ((averageActualNetPay - minValue) / range) * (height - paddingY * 2)
                                                        : null;

                                                return (
                                                    <svg
                                                        viewBox={`0 0 ${width} ${height}`}
                                                        className="h-full w-full overflow-visible"
                                                    >
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
                                                                <circle cx={point.x} cy={point.y} r="12" fill="transparent" />

                                                                <circle
                                                                    cx={point.x}
                                                                    cy={point.y}
                                                                    r="4"
                                                                    className={
                                                                        point.isEstimate ? "fill-[#6E9B7C]" : "fill-gray-900"
                                                                    }
                                                                />

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
                                                                                <div className="rounded-lg bg-gray-900 px-2.5 py-2 text-center text-[10px] text-white shadow-md">
                                                                                    <div className="font-semibold">
                                                                                        {t("sal.graph.estimate", { amount: formatMoney(point.value, currency) })}{" "}
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
                                                    className={point.isEstimate ? "font-medium text-[#5B8A6A]" : ""}
                                                >
                                                    {point.payDate ? formatDisplayDate(point.payDate) : t("sal.graph.scheduled")}
                                                </span>
                                            ))}
                                        </div>

                                        <div className="mt-4 flex items-center justify-end gap-2 text-xs text-gray-400">
                                            <span className="h-px w-5 border-t border-dashed border-gray-300" />
                                            {t("sal.k026")}
                                        </div>
                                    </div>
                                ) : (
                                    <div className="mt-6 rounded-2xl bg-gray-100 p-4 text-sm text-gray-500">
                                        {t("sal.k027")}
                                        <br />
                                        {t("sal.k028")}
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="relative overflow-hidden rounded-3xl bg-white shadow-sm">
                                {/* 잠긴 통계 미리보기 */}
                                <div className="pointer-events-none select-none blur-[2px] opacity-30">
                                    <div className="p-5">
                                        <div className="flex items-start justify-between">
                                            <div>
                                                <p className="text-xs text-gray-400">{t("sal.k023")}</p>

                                                <h2 className="mt-1 text-lg font-bold text-gray-900">{t("sal.k024")}</h2>
                                            </div>

                                            <span className="rounded-full bg-gray-100 px-3 py-2 text-xs font-medium text-gray-500">
                                                Salary Statistics
                                            </span>
                                        </div>

                                        <p className="mt-2 text-3xl font-bold text-gray-900">
                                            {formatMoney(currency === "KRW" ? 2450000 : 2450, currency)}
                                        </p>

                                        <div className="mt-8">
                                            <div className="relative h-48 w-full">
                                                <svg viewBox="0 0 320 150" className="h-full w-full overflow-visible">
                                                    <line
                                                        x1="16"
                                                        y1="75"
                                                        x2="304"
                                                        y2="75"
                                                        stroke="currentColor"
                                                        strokeWidth="1"
                                                        strokeDasharray="4 4"
                                                        className="text-gray-300"
                                                    />

                                                    <polyline
                                                        points="16,105 88,80 160,92 232,50 304,65"
                                                        fill="none"
                                                        stroke="currentColor"
                                                        strokeWidth="2"
                                                        strokeLinecap="round"
                                                        strokeLinejoin="round"
                                                        className="text-gray-900"
                                                    />

                                                    {[105, 80, 92, 50, 65].map((y, index) => (
                                                        <circle
                                                            key={index}
                                                            cx={16 + index * 72}
                                                            cy={y}
                                                            r="4"
                                                            className="fill-gray-900"
                                                        />
                                                    ))}
                                                </svg>
                                            </div>

                                            <div className="mt-2 flex justify-between text-[10px] text-gray-400">
                                                <span>Sep 01</span>
                                                <span>Sep 15</span>
                                                <span>Sep 30</span>
                                                <span>Oct 15</span>
                                                <span>Oct 30</span>
                                            </div>

                                            <div className="mt-4 flex items-center justify-end gap-2 text-xs text-gray-400">
                                                <span className="h-px w-5 border-t border-dashed border-gray-300" />
                                                {t("sal.k026")}
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* 잠금 안내 */}
                                <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/65">
                                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gray-100">
                                        <Lock size={20} strokeWidth={2} className="text-gray-500" />
                                    </div>

                                    <p className="mt-4 text-sm font-semibold text-gray-900">{t("sal.k023")}</p>

                                    <p className="mt-1 text-xs text-gray-500">{t("sal.k029")}</p>

                                    <button
                                        type="button"
                                        onClick={() => openUpgrade("general")}
                                        className="mt-4 rounded-full bg-gray-900 px-4 py-2 text-xs font-medium text-white"
                                    >
                                        {t("sal.k030")}
                                    </button>
                                </div>
                            </div>
                        )}
                    </section>

                    {/* --------------------------------------------------
                    Pending Expected Salary Modal
                -------------------------------------------------- */}

                    <BottomSheet isOpen={Boolean(isPendingExpectedOpen && pendingPayPeriod && pendingPeriodEstimate)} onClose={() => setIsPendingExpectedOpen(false)}>
                        {isPendingExpectedOpen && pendingPayPeriod && pendingPeriodEstimate && (
                            <>
                                    {/* Header */}
                                    <div className="flex items-start justify-between">
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <span className="rounded-full bg-[#EEF4F0] px-2.5 py-1 text-[11px] font-semibold text-[#3F6B4F]">
                                                    {t("sal.k014")}
                                                </span>

                                                <span className="text-xs text-gray-400">
                                                    {getDdayLabel(pendingPayPeriod.payDate, t)}
                                                </span>
                                            </div>

                                            <p className="mt-3 text-lg font-bold text-gray-900">{t("sal.k031")}</p>

                                            <p className="mt-1 text-sm text-gray-500">
                                                {formatDisplayDate(pendingPayPeriod.startDate)}
                                                {" ~ "}
                                                {formatDisplayDate(pendingPayPeriod.endDate)}
                                            </p>
                                        </div>

                                    </div>

                                    {/* Main Amount */}
                                    <div className="mt-6 rounded-3xl bg-[#EEF4F0] p-5">
                                        <p className="text-xs font-medium text-[#5B8A6A]">{t("sal.k032")}</p>

                                        <p className="mt-2 text-4xl font-bold tracking-tight text-gray-900">
                                            {formatMoney(pendingPeriodEstimate.netPay, currency)}
                                        </p>

                                        <div className="mt-4 flex items-center justify-between">
                                            <span className="text-sm text-gray-500">{t("sal.k033")}</span>

                                            <span className="text-sm font-semibold text-gray-900">
                                                {formatDisplayDate(pendingPayPeriod.payDate)}
                                            </span>
                                        </div>
                                    </div>

                                    {/* Breakdown */}
                                    <div className="mt-6">
                                        <p className="mb-3 text-xs font-semibold text-gray-400">{t("sal.k034")}</p>

                                        <div className="rounded-3xl bg-gray-50 p-5">
                                            <div className="space-y-4 text-sm">
                                                <div className="flex justify-between">
                                                    <span className="text-gray-500">{t("sal.k035")}</span>

                                                    <span className="font-medium text-gray-900">
                                                        {pendingPeriodEstimate.hours.toFixed(2)}
                                                        {t("sal.k022")}
                                                    </span>
                                                </div>

                                                <div className="flex justify-between">
                                                    <span className="text-gray-500">{t("sal.k036")}</span>

                                                    <span className="font-medium text-gray-900">
                                                        {formatMoney(pendingPeriodEstimate.basePay, currency)}
                                                    </span>
                                                </div>

                                                {pendingPeriodEstimate.paychequeTips > 0 && (
                                                    <div className="flex justify-between">
                                                        <span className="text-gray-500">{t("sal.k037")}</span>

                                                        <span className="font-medium text-gray-900">
                                                            {formatMoney(pendingPeriodEstimate.paychequeTips, currency)}
                                                        </span>
                                                    </div>
                                                )}

                                                {pendingPeriodEstimate.publicHolidayPay + pendingPeriodEstimate.premiumPay > 0 && (
                                                    <div className="flex justify-between">
                                                        <span className="text-gray-500">{t("sal.k038")}</span>

                                                        <span className="font-medium text-gray-900">
                                                            {formatMoney(
                                                                pendingPeriodEstimate.publicHolidayPay +
                                                                    pendingPeriodEstimate.premiumPay,
                                                                currency,
                                                            )}
                                                        </span>
                                                    </div>
                                                )}

                                                {pendingPeriodEstimate.vacationPay > 0 && (
                                                    <div className="flex justify-between">
                                                        <span className="text-gray-500">{t("sal.k039")}</span>

                                                        <span className="font-medium text-gray-900">
                                                            {formatMoney(pendingPeriodEstimate.vacationPay, currency)}
                                                        </span>
                                                    </div>
                                                )}

                                                <div className="my-1 border-t border-gray-200" />

                                                <div className="flex justify-between">
                                                    <span className="font-medium text-gray-600">{t("sal.k040")}</span>

                                                    <span className="font-semibold text-gray-900">
                                                        {formatMoney(pendingPeriodEstimate.grossPay, currency)}
                                                    </span>
                                                </div>

                                                <div className="flex justify-between">
                                                    <span className="text-gray-500">{t("sal.k041")}</span>

                                                    <span className="text-gray-600">
                                                        - {formatMoney(pendingPeriodEstimate.deductions, currency)}
                                                    </span>
                                                </div>

                                                <div className="my-1 border-t border-gray-200" />

                                                <div className="flex justify-between">
                                                    <span className="font-semibold text-gray-900">{t("sal.k042")}</span>

                                                    <span className="font-bold text-gray-900">
                                                        {formatMoney(pendingPeriodEstimate.netPay, currency)}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Cash Tips */}
                                    {pendingPeriodEstimate.cashTips > 0 && (
                                        <div className="mt-4 rounded-3xl bg-gray-50 p-5">
                                            <div className="flex justify-between">
                                                <span className="text-sm text-gray-500">{t("sal.k043")}</span>

                                                <span className="text-sm font-semibold text-gray-900">
                                                    {formatMoney(pendingPeriodEstimate.cashTips, currency)}
                                                </span>
                                            </div>

                                            <div className="mt-4 flex items-center justify-between rounded-2xl bg-white p-4 shadow-sm">
                                                <span className="text-sm font-semibold text-gray-700">{t("sal.k044")}</span>

                                                <span className="text-xl font-bold text-gray-900">
                                                    {formatMoney(pendingPeriodEstimate.totalIncome, currency)}
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

                                    {/* Notice */}
                                    <div className="mt-5 rounded-2xl bg-amber-50 px-4 py-3">
                                        <p className="text-xs leading-5 text-amber-700">
                                            {t("sal.k045")}
                                        </p>
                                    </div>

                                    {/* Button */}
                                    <Link
                                        href="/salary/schedule"
                                        className="mt-5 block w-full rounded-2xl bg-gray-900 py-4 text-center text-sm font-semibold text-white transition hover:bg-gray-800"
                                    >
                                        {t("sal.k046")}
                                    </Link>
                        
                        
                            </>
                        )}
                    </BottomSheet>

                    {/* --------------------------------------------------
                    Actual Net Pay Detail Modal
                -------------------------------------------------- */}

                    <BottomSheet isOpen={Boolean(selectedPayHistory)} onClose={() => setSelectedPayHistory(null)}>
                        {selectedPayHistory && (
                            <>
                                    <div className="rounded-3xl bg-white p-6 text-gray-950 shadow-sm">
                                        <div className="flex items-start justify-between">
                                            <div>
                                                <p className="text-xs text-gray-500">{t("sal.k047")}</p>

                                                <p className="mt-1 text-sm font-semibold">
                                                    {formatDisplayDate(selectedPayHistory.startDate)}
                                                    {" ~ "}
                                                    {formatDisplayDate(selectedPayHistory.endDate)}
                                                </p>

                                                {selectedPayHistory.payDate && (
                                                    <p className="mt-1 text-xs text-gray-500">
                                                        {t("sal.payDate", { date: formatDisplayDate(selectedPayHistory.payDate) })}
                                                    </p>
                                                )}
                                            </div>

                                        </div>

                                        <p className="mt-6 text-4xl font-bold">
                                            {formatMoney(Number(selectedPayHistory.actualNetPay ?? 0), currency)}
                                        </p>

                                        <p className="mt-2 text-sm text-gray-400">{t("sal.k048")}</p>

                                        {selectedPayDifference !== null && selectedPayChangePercent !== null && (
                                            <div className="mt-5 rounded-2xl bg-gray-50 p-4">
                                                <p className="text-xs text-gray-500">{t("sal.k049")}</p>

                                                <p className="mt-2 text-sm">
                                                    {t("sal.vsAverage")}{" "}
                                                    <span
                                                        className={
                                                            selectedPayDifference >= 0
                                                                ? "font-semibold text-red-400"
                                                                : "font-semibold text-gray-500"
                                                        }
                                                    >
                                                        {selectedPayDifference >= 0
                                                            ? t("sal.more", { amount: formatMoney(Math.abs(selectedPayDifference), currency) })
                                                            : t("sal.less", { amount: formatMoney(Math.abs(selectedPayDifference), currency) })}
                                                    </span>
                                                </p>

                                                <p className="mt-1 text-xs text-gray-500">
                                                    {selectedPayDifference >= 0
                                                        ? t("sal.higher", { percent: Math.abs(selectedPayChangePercent).toFixed(1) })
                                                        : t("sal.lower", { percent: Math.abs(selectedPayChangePercent).toFixed(1) })}
                                                </p>
                                            </div>
                                        )}

                                        <div className="mt-6 space-y-3 text-sm">
                                            <div className="flex justify-between">
                                                <span className="text-gray-400">{t("sal.k035")}</span>

                                                <span>
                                                    {Number(selectedPayHistory.hours ?? 0).toFixed(2)}
                                                    {t("sal.k022")}
                                                </span>
                                            </div>

                                            <div className="flex justify-between">
                                                <span className="text-gray-400">{t("sal.k050")}</span>

                                                <span>
                                                    {formatMoney(
                                                        Number(selectedPayHistory.actualPay ?? selectedPayHistory.pay ?? 0),
                                                        currency,
                                                    )}
                                                </span>
                                            </div>

                                            {selectedPayHistory.actualTips > 0 && (
                                                <div className="flex justify-between">
                                                    <span className="text-gray-400">{t("sal.k051")}</span>

                                                    <span>{formatMoney(Number(selectedPayHistory.actualTips ?? 0), currency)}</span>
                                                </div>
                                            )}

                                            {selectedPayHistory.cashTips > 0 && (
                                                <div className="flex justify-between">
                                                    <span className="text-gray-400">{t("sal.k043")}</span>

                                                    <span>{formatMoney(Number(selectedPayHistory.cashTips ?? 0), currency)}</span>
                                                </div>
                                            )}

                                            {Number(selectedPayHistory.actualPay ?? 0) + Number(selectedPayHistory.actualTips ?? 0) >
                                                0 && (
                                                <div className="mt-4 border-t border-gray-100 pt-4">
                                                    <div className="flex justify-between">
                                                        <span className="text-gray-600">{t("sal.k052")}</span>

                                                        <span className="font-semibold">
                                                            {formatMoney(
                                                                Number(selectedPayHistory.actualPay ?? 0) +
                                                                    Number(selectedPayHistory.actualTips ?? 0),
                                                                currency,
                                                            )}
                                                        </span>
                                                    </div>
                                                </div>
                                            )}

                                            {selectedPayHistory.actualDeductions > 0 && (
                                                <div className="flex justify-between">
                                                    <span className="text-gray-400">{t("sal.k053")}</span>

                                                    <span>
                                                        - {formatMoney(Number(selectedPayHistory.actualDeductions ?? 0), currency)}
                                                    </span>
                                                </div>
                                            )}

                                            {selectedPayHistory.adjustments.length > 0 && (
                                                <div className="mt-4 border-t border-gray-100 pt-4">
                                                    <p className="mb-3 text-xs text-gray-500">{t("sal.k054")}</p>

                                                    <div className="space-y-2">
                                                        {selectedPayHistory.adjustments.map((adjustment, index) => (
                                                            <div key={`${adjustment.name}-${index}`} className="flex justify-between">
                                                                <span className="text-gray-400">{adjustment.name}</span>

                                                                <span
                                                                    className={
                                                                        adjustment.type === "add" ? "text-green-400" : "text-red-400"
                                                                    }
                                                                >
                                                                    {adjustment.type === "add" ? "+" : "-"}
                                                                    {formatMoney(Number(adjustment.amount ?? 0), currency)}
                                                                </span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}

                                            <div className="mt-4 border-t border-gray-100 pt-4">
                                                <div className="flex justify-between">
                                                    <span className="text-gray-600">{t("sal.k048")}</span>

                                                    <span className="font-semibold">
                                                        {formatMoney(Number(selectedPayHistory.actualNetPay ?? 0), currency)}
                                                    </span>
                                                </div>
                                            </div>

                                            {selectedPayHistory.cashTips > 0 && (
                                                <div className="mt-4">
                                                    <div className="flex justify-between rounded-2xl bg-gray-50 p-3 text-gray-950">
                                                        <span className="text-sm font-medium">{t("sal.k055")}</span>

                                                        <span className="text-lg font-bold">
                                                            {formatMoney(
                                                                Number(selectedPayHistory.actualNetPay ?? 0) +
                                                                    Number(selectedPayHistory.cashTips ?? 0),
                                                                currency,
                                                            )}
                                                        </span>
                                                    </div>
                                                </div>
                                            )}
                                        </div>

                                        <Link
                                            href="/salary/pay-history"
                                            className="mt-6 block w-full rounded-2xl bg-gray-900 py-4 text-center text-sm font-semibold text-white"
                                        >
                                            {t("sal.k056")}
                                        </Link>
                            
                                    </div>
                        
                            </>
                        )}
                    </BottomSheet>
                </>
            )}
            {/* 급여 설정 */}
            <SalarySettingsSheet
                isOpen={isSalarySettingsOpen}
                onClose={() => {
                    setIsSalarySettingsOpen(false);
                    setWagePreset(null);
                }}
                onSaved={reloadSettings}
                wagePreset={wagePreset}
            />
        </div>
    );
}
