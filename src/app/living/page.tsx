"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronRight, CircleDollarSign, Coins } from "lucide-react";
import { useRouter } from "next/navigation";

type CategorySpending = {
    name: string;
    amount: number;
};

type LivingSummary = {
    balance: number;
    income: number;
    expense: number;
    fixedExpense: number;
    livingToSavings: number;
    savingsToLiving: number;
    variableSpending: CategorySpending[];
    savings: {
        current: number;
        goal: number;
    };
};

const formatMoney = (amount: number) =>
    new Intl.NumberFormat("en-CA", {
        style: "currency",
        currency: "CAD",
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    }).format(amount);

const getCurrentMonth = () => {
    const now = new Date();

    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
};

function SavingsDollar({ progress }: { progress: number }) {
    const clampedProgress = Math.min(Math.max(progress, 0), 100);

    return (
        <div className="relative h-28 w-28 shrink-0">
            {/* 전체 아이콘 */}
            <CircleDollarSign
                size={92}
                strokeWidth={1.5}
                className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-gray-200"
            />

            {/* 진행된 부분 */}
            <div
                className="absolute bottom-2 left-1/2 -translate-x-1/2 overflow-hidden"
                style={{
                    width: 92,
                    height: `${92 * (clampedProgress / 100)}px`,
                }}
            >
                <CircleDollarSign size={92} strokeWidth={1.5} className="absolute bottom-0 left-0 text-[#8BA47B]" />
            </div>
        </div>
    );
}

export default function LivingPage() {
    const router = useRouter();

    const [month] = useState(getCurrentMonth);
    const [data, setData] = useState<LivingSummary | null>(null);
    const [loading, setLoading] = useState(true);

    const [isEditingSavingsGoal, setIsEditingSavingsGoal] = useState(false);
    const [savingsGoalInput, setSavingsGoalInput] = useState("");
    const [isSavingGoal, setIsSavingGoal] = useState(false);

    useEffect(() => {
        const loadLiving = async () => {
            try {
                const response = await fetch(`/api/living?month=${month}`);

                if (!response.ok) {
                    throw new Error("생활 데이터를 불러오지 못했습니다.");
                }

                const result = await response.json();
                setData(result);
            } catch (error) {
                console.error(error);
            } finally {
                setLoading(false);
            }
        };

        loadLiving();
    }, [month]);

    const maxSpending = useMemo(() => {
        if (!data?.variableSpending?.length) return 1;

        return Math.max(...data.variableSpending.map((item) => item.amount), 1);
    }, [data]);

    const currentMonthLabel = useMemo(() => {
        const [year, monthNumber] = month.split("-");

        return `${year}.${monthNumber}`;
    }, [month]);

    const remainingSavings = Math.max((data?.savings.goal ?? 0) - (data?.savings.current ?? 0), 0);

    const savingsProgress = data?.savings.goal ? Math.min(((data?.savings.current ?? 0) / data.savings.goal) * 100, 100) : 0;

    return (
        <div className="mx-auto max-w-md">
            {/* Header */}
            <header className="mt-5 mb-10">
                <p className="text-sm text-gray-500">차곡</p>

                <h1 className=" mt-2 text-3xl font-bold">생활</h1>

                <p className="mt-2 text-sm text-gray-500">이번 달 생활비를 한눈에 확인해보세요.</p>
            </header>

            {loading ? (
                <div className="space-y-5">
                    <div className="h-[390px] animate-pulse bg-white" />

                    <div className="h-72 animate-pulse rounded-3xl bg-white" />

                    <div className="h-64 animate-pulse rounded-3xl bg-white" />
                </div>
            ) : (
                <div className="space-y-5">
                    {/* This month's living money */}
                    <button type="button" onClick={() => router.push("/living/manage")} className="group w-full text-left">
                        <div
                            className="relative"
                            style={{
                                filter: "drop-shadow(0 1px 2px rgba(0, 0, 0, 0.09))",
                            }}
                        >
                            {/* Receipt body */}
                            <div
                                className="bg-white p-5  rounded-t-3xl"
                                style={{
                                    clipPath:
                                        "polygon(0 0, 100% 0, 100% 98%, 97.5% 100%, 95% 98%, 92.5% 100%, 90% 98%, 87.5% 100%, 85% 98%, 82.5% 100%, 80% 98%, 77.5% 100%, 75% 98%, 72.5% 100%, 70% 98%, 67.5% 100%, 65% 98%, 62.5% 100%, 60% 98%, 57.5% 100%, 55% 98%, 52.5% 100%, 50% 98%, 47.5% 100%, 45% 98%, 42.5% 100%, 40% 98%, 37.5% 100%, 35% 98%, 32.5% 100%, 30% 98%, 27.5% 100%, 25% 98%, 22.5% 100%, 20% 98%, 17.5% 100%, 15% 98%, 12.5% 100%, 10% 98%, 7.5% 100%, 5% 98%, 2.5% 100%, 0 98%)",
                                }}
                            >
                                {/* Month */}
                                <div className="flex items-center justify-between">
                                    <p className="text-xs text-gray-400">{currentMonthLabel}</p>
                                </div>

                                {/* Balance */}
                                <div>
                                    <h2 className="mt-1 text-lg font-bold">이번 달 남은 금액</h2>

                                    <p className="mt-2 text-3xl font-bold">{formatMoney(data?.balance ?? 0)}</p>
                                </div>

                                {/* Divider */}
                                <div className="my-4 border-t border-dashed border-gray-200" />

                                {/* Income / Expense */}
                                <div className="space-y-2 text-sm text-gray-500">
                                    <div className="flex items-center justify-between">
                                        <span>수입</span>

                                        <span>+ {formatMoney(data?.income ?? 0)}</span>
                                    </div>

                                    <div className="flex items-center justify-between">
                                        <span>지출</span>

                                        <span>- {formatMoney((data?.expense ?? 0) - (data?.fixedExpense ?? 0))}</span>
                                    </div>

                                    <div className="flex items-center justify-between">
                                        <span>고정 지출</span>

                                        <span>- {formatMoney(data?.fixedExpense ?? 0)}</span>
                                    </div>
                                </div>

                                {/* View details */}
                                <div className="mt-4 flex items-center justify-between border-t border-gray-100 pt-4">
                                    <span className="text-[11px] font-medium tracking-[0.06em] text-gray-400">VIEW DETAILS</span>

                                    <ChevronRight
                                        size={15}
                                        className="text-gray-300 transition-colors group-hover:text-gray-500"
                                    />
                                </div>
                            </div>
                        </div>
                    </button>

                    {/* Variable spending */}
                    <section className="rounded-3xl bg-white p-5 shadow-sm">
                        <div className="mb-8">
                            <div className="flex items-end justify-between">
                                <div>
                                    <p className="text-xs text-gray-400">이번 달 지출</p>
                                    <h2 className="mt-1 text-lg font-bold">변동지출</h2>
                                </div>
                                <p className="text-md font-medium text-gray-900">
                                    {formatMoney(data?.variableSpending?.reduce((sum, item) => sum + item.amount, 0) ?? 0)}
                                </p>
                            </div>
                        </div>

                        {data?.variableSpending?.length ? (
                            (() => {
                                const total = data.variableSpending.reduce((sum, item) => sum + item.amount, 0);

                                return (
                                    <div className="space-y-2">
                                        {data.variableSpending.map((category) => {
                                            const percentage = total > 0 ? (category.amount / total) * 100 : 0;

                                            return (
                                                <button
                                                    key={category.name}
                                                    type="button"
                                                    onClick={() =>
                                                        router.push(
                                                            `/living/manage?category=${encodeURIComponent(category.name)}`,
                                                        )
                                                    }
                                                    className="relative flex h-10 w-full items-center overflow-hidden rounded-sm bg-gray-50 text-left"
                                                >
                                                    <div
                                                        className="absolute inset-y-0 left-0 bg-[#304B67]/15"
                                                        style={{
                                                            width: `${percentage}%`,
                                                        }}
                                                    />

                                                    <div className="relative z-10 flex w-full items-center justify-between px-3">
                                                        <span className="text-sm font-medium text-gray-700">{category.name}</span>

                                                        <div className="flex items-center gap-3">
                                                            <span className="text-sm font-medium text-gray-900">
                                                                {formatMoney(category.amount)}
                                                            </span>
                                                            <span className="text-xs text-gray-400">
                                                                {percentage.toFixed(0)}%
                                                            </span>
                                                        </div>
                                                    </div>
                                                </button>
                                            );
                                        })}
                                    </div>
                                );
                            })()
                        ) : (
                            <div className="flex h-56 items-center justify-center text-sm text-gray-400">
                                이번 달 지출이 아직 없어요.
                            </div>
                        )}
                    </section>

                    {/* Savings */}
                    <section className="rounded-3xl bg-white p-5 shadow-sm">
                        <div>
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-xs text-gray-400">저축 현황</p>

                                    <h2 className="mt-1 text-lg font-bold">저축</h2>
                                </div>

                                <button
                                    type="button"
                                    onClick={() => {
                                        setSavingsGoalInput(String(data?.savings.goal ?? ""));
                                        setIsEditingSavingsGoal(true);
                                    }}
                                    className="text-xs text-gray-400 transition-colors hover:text-gray-700"
                                >
                                    목표 수정
                                </button>
                            </div>
                        </div>

                        <div className="mt-2 flex items-start justify-between gap-3">
                            <div>
                                <p className="text-3xl font-bold">{formatMoney(data?.savings.current ?? 0)}</p>

                                <div className="mt-5 space-y-1.5">
                                    <div className="flex items-center justify-between gap-8">
                                        <span className="text-xs text-gray-400">목표</span>

                                        <span className="text-sm font-medium text-gray-900">
                                            {formatMoney(data?.savings.goal ?? 0)}
                                        </span>
                                    </div>

                                    <div className="flex items-center justify-between gap-8">
                                        <span className="text-xs text-gray-400">남은 금액</span>

                                        <span className="text-sm font-medium text-gray-900">{formatMoney(remainingSavings)}</span>
                                    </div>
                                </div>
                            </div>
                            <SavingsDollar progress={savingsProgress} />
                        </div>

                        <div className="mt-6 flex gap-2">
                            <button
                                type="button"
                                onClick={() => router.push("/living/manage?type=transfer&direction=living_to_savings")}
                                className="flex-1 rounded-2xl bg-gray-900 py-3 text-[13px] font-medium text-white transition-colors hover:bg-gray-800"
                            >
                                저축하기
                            </button>

                            <button
                                type="button"
                                onClick={() => router.push("/living/manage?type=transfer&direction=savings_to_living")}
                                className="flex-1 rounded-2xl bg-gray-100 py-3 text-[13px] font-medium text-gray-700 transition-colors hover:bg-gray-200"
                            >
                                가져오기
                            </button>
                        </div>
                    </section>
                </div>
            )}

            {isEditingSavingsGoal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center px-5">
                    <button
                        type="button"
                        aria-label="모달 닫기"
                        onClick={() => setIsEditingSavingsGoal(false)}
                        className="absolute inset-0 bg-black/30"
                    />

                    <div className="relative w-full max-w-sm rounded-3xl bg-white p-5 shadow-xl">
                        <div className="mb-5">
                            <p className="text-xs text-gray-400">저축</p>

                            <h3 className="mt-1 text-lg font-semibold tracking-[-0.03em] text-gray-900">저축 목표 수정</h3>
                        </div>

                        <div>
                            <label className="mb-2 block text-xs text-gray-400">목표 금액</label>

                            <input
                                type="number"
                                min="1"
                                value={savingsGoalInput}
                                onChange={(e) => setSavingsGoalInput(e.target.value)}
                                autoFocus
                                className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-3 text-sm outline-none transition-colors"
                                placeholder="목표 금액을 입력하세요"
                            />
                        </div>

                        <div className="mt-5 flex gap-2">
                            <button
                                type="button"
                                onClick={() => setIsEditingSavingsGoal(false)}
                                className="flex-1 rounded-2xl bg-gray-100 py-3 text-[13px] font-medium text-gray-700 transition-colors hover:bg-gray-200"
                            >
                                취소
                            </button>

                            <button
                                type="button"
                                disabled={isSavingGoal}
                                onClick={async () => {
                                    const targetAmount = Number(savingsGoalInput);

                                    if (!Number.isFinite(targetAmount) || targetAmount <= 0) {
                                        return;
                                    }

                                    try {
                                        setIsSavingGoal(true);

                                        const response = await fetch("/api/living/savings-goal", {
                                            method: "PUT",
                                            headers: {
                                                "Content-Type": "application/json",
                                            },
                                            body: JSON.stringify({
                                                targetAmount,
                                            }),
                                        });

                                        if (!response.ok) {
                                            throw new Error("저축 목표 수정에 실패했습니다.");
                                        }

                                        setIsEditingSavingsGoal(false);

                                        const refreshResponse = await fetch(`/api/living?month=${getCurrentMonth()}`);

                                        if (refreshResponse.ok) {
                                            const refreshedData = await refreshResponse.json();

                                            setData(refreshedData);
                                        }
                                    } catch (error) {
                                        console.error(error);
                                    } finally {
                                        setIsSavingGoal(false);
                                    }
                                }}
                                className="flex-1 rounded-2xl bg-gray-900 py-3 text-[13px] font-medium text-white transition-colors hover:bg-gray-800 disabled:opacity-50"
                            >
                                {isSavingGoal ? "저장 중" : "저장"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
