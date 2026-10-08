"use client";

import { useEffect, useMemo, useState } from "react";
import { formatDate, getSurroundingPayPeriods } from "@/lib/payPeriod";
import Link from "next/link";
import { ClipboardList, Lock, Settings } from "lucide-react";
import SalarySettingsSheet from "@/components/SalarySettingsSheet";
import { useCountUp, usePeriodEstimate, useSalaryData } from "@/lib/salary/hooks";
import { getSchedulesInPeriod, summarizeEstimate } from "@/lib/salary/estimate";
import { getPayPeriodStatus } from "@/lib/salary/status";
import { formatCurrency as formatMoney } from "@/lib/salary/format";
import type { PeriodEstimateOutcome } from "@/lib/salary/types";

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

// 계산할 수 없을 때 카드에 보여줄 안내
const getEstimateProblemMessage = (outcome: PeriodEstimateOutcome | null) => {
    switch (outcome?.status) {
        case "unsupported-country":
            return "아직 이 나라의 급여 계산을 지원하지 않아요.";

        case "no-profile":
            return "프로필에서 국가를 설정하면 예상 급여를 계산할 수 있어요.";

        case "no-settings":
            return "급여 설정을 먼저 해주세요.";

        default:
            return null;
    }
};

export default function SalaryPage() {
    const salaryData = useSalaryData();

    const { profile, settings: salarySettings, schedules, isLoading, reloadSettings } = salaryData;

    const currency = profile?.currency ?? null;

    const [planCode, setPlanCode] = useState<"free" | "pro">("free");
    const [isSalarySettingsOpen, setIsSalarySettingsOpen] = useState(false);

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

        loadPlan();
    }, []);

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

    const currentEstimateProblem = getEstimateProblemMessage(currentResult.outcome);

    const shouldShowPendingPay = Boolean(pendingPayPeriod && pendingPeriodEstimate);

    const animatedPendingNetPay = useCountUp(pendingPeriodEstimate?.netPay ?? 0, shouldShowPendingPay);

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

    if (isLoading) {
        return (
            <div className="flex h-[calc(100vh-152px)] items-center justify-center">
                <p className="text-sm text-gray-400">불러오는 중...</p>
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

                    <div className="flex items-center gap-2">
                        <Link
                            href="/salary/pay-history"
                            className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-gray-500 shadow-sm transition hover:bg-gray-50"
                            aria-label="급여 기록"
                        >
                            <ClipboardList size={18} strokeWidth={1.8} />
                        </Link>

                        <button
                            type="button"
                            onClick={() => setIsSalarySettingsOpen(true)}
                            className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-gray-500 shadow-sm transition hover:bg-gray-50"
                            aria-label="급여 설정"
                        >
                            <Settings size={18} strokeWidth={1.8} />
                        </button>
                    </div>
                </div>

                <p className="mt-2 text-sm text-gray-500">이번 급여는 얼마나 받을까요?</p>
            </header>
            {!salarySettings ? (
                <section className="rounded-3xl bg-white p-6 shadow-sm">
                    <p className="text-xs font-medium text-gray-400">급여 설정</p>

                    <h2 className="mt-2 text-lg font-bold text-gray-900">급여 정보를 먼저 설정해주세요</h2>

                    <p className="mt-2 text-sm leading-6 text-gray-500">
                        급여 방식과 급여 주기를 설정하면 예상 급여를 계산할 수 있어요.
                    </p>

                    <button
                        type="button"
                        onClick={() => setIsSalarySettingsOpen(true)}
                        className="mt-5 w-full rounded-2xl bg-gray-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-gray-800"
                    >
                        급여 설정하기
                    </button>
                </section>
            ) : (
                <>
                    {/* --------------------------------------------------
                    Pending Pay Status
                -------------------------------------------------- */}

                    {overduePayPeriod && (
                        <Link
                            href={`/salary/pay-history?startDate=${overduePayPeriod.startDate}&endDate=${overduePayPeriod.endDate}&payDate=${overduePayPeriod.payDate}`}
                            className="block w-full rounded-3xl bg-gray-900 p-5 text-left shadow-sm transition hover:shadow-md"
                        >
                            <p className="text-xs text-gray-400">급여 기록</p>

                            <p className="mt-1 text-lg font-bold text-white">지급일이 지났어요</p>

                            <p className="mt-1 text-sm text-gray-500">아직 기록되지 않은 급여가 있어요.</p>

                            <p className="mt-4 text-xs text-gray-400">
                                {formatDisplayDate(overduePayPeriod.startDate)}
                                {" ~ "}
                                {formatDisplayDate(overduePayPeriod.endDate)}
                            </p>

                            <p className="mt-3 text-xs font-medium text-gray-500">급여 기록에서 확인하기 →</p>
                        </Link>
                    )}

                    {shouldShowPendingPay && pendingPayPeriod && pendingPeriodEstimate && pendingPeriodEstimate.netPay > 0 && (
                        <button
                            type="button"
                            onClick={() => setIsPendingExpectedOpen(true)}
                            className="mt-4 block w-full rounded-3xl border border-blue-100 bg-blue-50 p-5 text-left shadow-sm transition hover:bg-blue-100/70"
                        >
                            <div className="flex items-start justify-between gap-4">
                                <div>
                                    <p className="text-xs text-blue-500">급여 예정</p>

                                    <p className="mt-2 text-lg font-semibold text-gray-900">
                                        <span className="text-blue-600">{getDdayLabel(pendingPayPeriod.payDate)}</span>{" "}
                                        {formatMoney(animatedPendingNetPay, currency)}를 받아요{" "}
                                    </p>

                                    <p className="mt-1 text-sm text-gray-500">
                                        지급일이 다가오고 있어요. 지출을 계획해 볼까요?
                                    </p>
                                </div>

                                <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-blue-600 shadow-sm">
                                    예상
                                </span>
                            </div>
                        </button>
                    )}

                    {salarySettings && !currentPayPeriod && (
                        <section className="mt-6 rounded-3xl bg-white p-5 shadow-sm">
                            <p className="text-xs font-medium text-blue-500">급여 기간</p>

                            <p className="mt-2 text-lg font-bold text-gray-900">급여 기간을 알 수 없어요</p>

                            <p className="mt-1 text-sm text-gray-500">
                                급여 설정에서 급여 기간 시작일을 입력하면 예상 급여를 계산할 수 있어요.
                            </p>

                            <button
                                type="button"
                                onClick={() => setIsSalarySettingsOpen(true)}
                                className="mt-4 w-full rounded-2xl bg-gray-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-gray-800"
                            >
                                급여 설정하기
                            </button>
                        </section>
                    )}

                    {currentPayPeriod && (
                        <div className="mt-6 rounded-3xl bg-white p-5 shadow-sm">
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
                            ) : currentEstimateProblem ? (
                                <p className="mt-5 text-sm text-gray-500">{currentEstimateProblem}</p>
                            ) : currentPeriodEstimate ? (
                                <>
                                    <p className="mt-5 text-xs text-gray-400">예상 급여</p>

                                    <p className="mt-1 text-2xl font-bold text-gray-900">
                                        {formatMoney(currentPeriodEstimate.netPay, currency)}
                                    </p>

                                    <div className="mt-3 flex items-center gap-3 text-sm text-gray-500">
                                        <span>
                                            {currentPeriodEstimate.hours.toFixed(2)}
                                            시간
                                        </span>

                                        <span>·</span>

                                        <span>
                                            팁{" "}
                                            {formatMoney(
                                                currentPeriodEstimate.cashTips + currentPeriodEstimate.paychequeTips,
                                                currency,
                                            )}
                                        </span>
                                    </div>
                                </>
                            ) : null}

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

                    <section className="mt-6">
                        {planCode === "pro" ? (
                            <div className="rounded-3xl bg-white p-5 shadow-sm">
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
                                                                        point.isEstimate ? "fill-blue-500" : "fill-gray-900"
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
                                                                                        예상{" "}
                                                                                        {formatMoney(point.value, currency)}{" "}
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
                            </div>
                        ) : (
                            <div className="relative overflow-hidden rounded-3xl bg-white shadow-sm">
                                {/* 잠긴 통계 미리보기 */}
                                <div className="pointer-events-none select-none blur-[2px] opacity-30">
                                    <div className="p-5">
                                        <div className="flex items-start justify-between">
                                            <div>
                                                <p className="text-xs text-gray-400">실수령액 통계</p>

                                                <h2 className="mt-1 text-lg font-bold text-gray-900">평균 실수령액</h2>
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
                                                평균
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* 잠금 안내 */}
                                <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/65">
                                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gray-100">
                                        <Lock size={20} strokeWidth={2} className="text-gray-500" />
                                    </div>

                                    <p className="mt-4 text-sm font-semibold text-gray-900">실수령액 통계</p>

                                    <p className="mt-1 text-xs text-gray-500">Pro에서 실수령액 통계를 확인할 수 있어요.</p>
                                </div>
                            </div>
                        )}
                    </section>

                    {/* --------------------------------------------------
                    Pending Expected Salary Modal
                -------------------------------------------------- */}

                    {isPendingExpectedOpen && pendingPayPeriod && pendingPeriodEstimate && (
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

                                            <span className="text-xs text-gray-400">
                                                {getDdayLabel(pendingPayPeriod.payDate)}
                                            </span>
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
                                        {formatMoney(pendingPeriodEstimate.netPay, currency)}
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
                                                    {pendingPeriodEstimate.hours.toFixed(2)}
                                                    시간
                                                </span>
                                            </div>

                                            <div className="flex justify-between">
                                                <span className="text-gray-500">기본 급여</span>

                                                <span className="font-medium text-gray-900">
                                                    {formatMoney(pendingPeriodEstimate.basePay, currency)}
                                                </span>
                                            </div>

                                            {pendingPeriodEstimate.paychequeTips > 0 && (
                                                <div className="flex justify-between">
                                                    <span className="text-gray-500">급여 포함 팁</span>

                                                    <span className="font-medium text-gray-900">
                                                        {formatMoney(pendingPeriodEstimate.paychequeTips, currency)}
                                                    </span>
                                                </div>
                                            )}

                                            {pendingPeriodEstimate.publicHolidayPay + pendingPeriodEstimate.premiumPay > 0 && (
                                                <div className="flex justify-between">
                                                    <span className="text-gray-500">공휴일 수당</span>

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
                                                    <span className="text-gray-500">휴가 수당</span>

                                                    <span className="font-medium text-gray-900">
                                                        {formatMoney(pendingPeriodEstimate.vacationPay, currency)}
                                                    </span>
                                                </div>
                                            )}

                                            <div className="my-1 border-t border-gray-200" />

                                            <div className="flex justify-between">
                                                <span className="font-medium text-gray-600">세전 급여</span>

                                                <span className="font-semibold text-gray-900">
                                                    {formatMoney(pendingPeriodEstimate.grossPay, currency)}
                                                </span>
                                            </div>

                                            <div className="flex justify-between">
                                                <span className="text-gray-500">예상 공제</span>

                                                <span className="text-gray-600">
                                                    - {formatMoney(pendingPeriodEstimate.deductions, currency)}
                                                </span>
                                            </div>

                                            <div className="my-1 border-t border-gray-200" />

                                            <div className="flex justify-between">
                                                <span className="font-semibold text-gray-900">실수령액</span>

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
                                            <span className="text-sm text-gray-500">현금 팁</span>

                                            <span className="text-sm font-semibold text-gray-900">
                                                {formatMoney(pendingPeriodEstimate.cashTips, currency)}
                                            </span>
                                        </div>

                                        <div className="mt-4 flex items-center justify-between rounded-2xl bg-white p-4 shadow-sm">
                                            <span className="text-sm font-semibold text-gray-700">예상 총 수령액</span>

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
                                                {warning}
                                            </p>
                                        ))}
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

                                    <button
                                        type="button"
                                        onClick={() => setSelectedPayHistory(null)}
                                        className="text-xl text-gray-400"
                                    >
                                        ×
                                    </button>
                                </div>

                                <p className="mt-6 text-4xl font-bold">
                                    {formatMoney(Number(selectedPayHistory.actualNetPay ?? 0), currency)}
                                </p>

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
                                                    ? `${formatMoney(Math.abs(selectedPayDifference), currency)} 많아요`
                                                    : `${formatMoney(Math.abs(selectedPayDifference), currency)} 적어요`}
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

                                        <span>
                                            {formatMoney(
                                                Number(selectedPayHistory.actualPay ?? selectedPayHistory.pay ?? 0),
                                                currency,
                                            )}
                                        </span>
                                    </div>

                                    {selectedPayHistory.actualTips > 0 && (
                                        <div className="flex justify-between">
                                            <span className="text-gray-400">실제 팁</span>

                                            <span>{formatMoney(Number(selectedPayHistory.actualTips ?? 0), currency)}</span>
                                        </div>
                                    )}

                                    {selectedPayHistory.cashTips > 0 && (
                                        <div className="flex justify-between">
                                            <span className="text-gray-400">현금 팁</span>

                                            <span>{formatMoney(Number(selectedPayHistory.cashTips ?? 0), currency)}</span>
                                        </div>
                                    )}

                                    {Number(selectedPayHistory.actualPay ?? 0) + Number(selectedPayHistory.actualTips ?? 0) >
                                        0 && (
                                        <div className="mt-4 border-t border-gray-800 pt-4">
                                            <div className="flex justify-between">
                                                <span className="text-gray-300">실제 세전 금액</span>

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
                                            <span className="text-gray-400">실제 공제</span>

                                            <span>
                                                - {formatMoney(Number(selectedPayHistory.actualDeductions ?? 0), currency)}
                                            </span>
                                        </div>
                                    )}

                                    {selectedPayHistory.adjustments.length > 0 && (
                                        <div className="mt-4 border-t border-gray-800 pt-4">
                                            <p className="mb-3 text-xs text-gray-500">조정 내역</p>

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

                                    <div className="mt-4 border-t border-gray-800 pt-4">
                                        <div className="flex justify-between">
                                            <span className="text-gray-300">실제 실수령액</span>

                                            <span className="font-semibold">
                                                {formatMoney(Number(selectedPayHistory.actualNetPay ?? 0), currency)}
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
                                                        currency,
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
                </>
            )}
            {/* 급여 설정 */}
            <SalarySettingsSheet
                isOpen={isSalarySettingsOpen}
                onClose={() => setIsSalarySettingsOpen(false)}
                onSaved={reloadSettings}
            />
        </div>
    );
}
