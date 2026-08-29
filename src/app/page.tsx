"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import styles from "./page.module.css";
import ExpenseModal from "@/components/ExpenseModal";
import EditExpenseModal from "@/components/EditExpenseModal";

type Expense = {
    id: number;
    amount: number;
    category: string;
    memo: string;
    date: string;
};

// 어제냐 오늘이냐 어쩌고냐
function formatExpenseDate(date: string) {
    const expenseDate = new Date(date);
    const today = new Date();

    const isToday =
        expenseDate.getFullYear() === today.getFullYear() &&
        expenseDate.getMonth() === today.getMonth() &&
        expenseDate.getDate() === today.getDate();

    if (isToday) {
        return "오늘";
    }

    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);

    const isYesterday =
        expenseDate.getFullYear() === yesterday.getFullYear() &&
        expenseDate.getMonth() === yesterday.getMonth() &&
        expenseDate.getDate() === yesterday.getDate();

    if (isYesterday) {
        return "어제";
    }

    return `${expenseDate.getMonth() + 1}월 ${expenseDate.getDate()}일`;
}

export default function Home() {
    const router = useRouter();

    const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);
    const [expenses, setExpenses] = useState<Expense[]>(() => {
        if (typeof window === "undefined") {
            return [];
        }

        const savedExpenses = localStorage.getItem("chagok-expenses");

        return savedExpenses ? JSON.parse(savedExpenses) : [];
    });

    const [budget, setBudget] = useState<number | null>(() => {
        if (typeof window === "undefined") {
            return null;
        }

        const savedBudget = localStorage.getItem("chagok-budget");

        return savedBudget ? Number(savedBudget) : null;
    });

    const [editingExpense, setEditingExpense] = useState<Expense | null>(null);

    useEffect(() => {
        localStorage.setItem("chagok-expenses", JSON.stringify(expenses));
    }, [expenses]);

    useEffect(() => {
        if (budget === null) {
            localStorage.removeItem("chagok-budget");
            return;
        }

        localStorage.setItem("chagok-budget", String(budget));
    }, [budget]);

    const handleUpdateExpense = (updatedExpense: Expense) => {
        setExpenses((prev) => prev.map((expense) => (expense.id === updatedExpense.id ? updatedExpense : expense)));
    };

    const handleDeleteExpense = (id: number) => {
        setExpenses((prev) => prev.filter((expense) => expense.id !== id));
    };

    const totalExpense = expenses.reduce((total, expense) => total + expense.amount, 0);
    const categoryTotals = expenses.reduce(
        (totals, expense) => {
            totals[expense.category] = (totals[expense.category] || 0) + expense.amount;

            return totals;
        },
        {} as Record<string, number>,
    );
    const budgetUsage = budget !== null && budget > 0 ? Math.min((totalExpense / budget) * 100, 100) : 0;
    const remainingBudget = budget !== null ? budget - totalExpense : null;

    // 최근 지출순 정렬
    const sortedExpenses = [...expenses].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    // Today
    const today = new Date();
    const currentDate = `${today.getMonth() + 1}월 ${today.getDate()}일`;

    return (
        <main className={styles.container}>
            <div className={styles.inner}>
                <div className="mx-auto max-w-md">
                    {/* Header */}
                    <header className={styles.header}>
                        <h1 className={styles.logo}>차곡</h1>

                        <span className={styles.date}>{currentDate}</span>
                    </header>

                    {/* Main Balance */}
                    <section className="mb-5 rounded-3xl bg-white p-6 shadow-sm">
                        <p className="text-sm text-gray-500">이번 달 쓸 수 있는 돈</p>

                        <p className="mt-2 text-4xl font-bold tracking-tight">
                            {budget !== null ? `$${Math.max(remainingBudget ?? 0, 0).toFixed(2)}` : "$0.00"}
                        </p>

                        <div className="mt-6">
                            <div className="mb-2 flex justify-between text-sm">
                                <span className="text-gray-500">이번 달 예산</span>
                                <span className="font-medium">{budget !== null ? `$${budget.toFixed(2)}` : "-"}</span>
                            </div>

                            <div className="h-2 overflow-hidden rounded-full bg-gray-100">
                                <div className="h-full rounded-full bg-black" style={{ width: `${budgetUsage}%` }} />
                            </div>
                        </div>
                    </section>

                    <section className="mb-5 rounded-3xl bg-white p-6 shadow-sm">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-gray-500">이번 달 예산</p>

                                {budget === null ? (
                                    <p className="mt-2 text-lg font-medium">예산을 설정하지 않았어요</p>
                                ) : (
                                    <p className="mt-2 text-2xl font-semibold">${budget.toFixed(2)}</p>
                                )}
                            </div>

                            <button
                                onClick={() => {
                                    const value = window.prompt("이번 달 예산을 입력해주세요.");

                                    if (value === null) return;

                                    const numberValue = Number(value);

                                    if (!numberValue || numberValue <= 0) {
                                        alert("올바른 금액을 입력해주세요.");
                                        return;
                                    }

                                    setBudget(numberValue);
                                }}
                                className="rounded-full bg-gray-100 px-4 py-2 text-sm font-medium"
                            >
                                {budget === null ? "설정" : "수정"}
                            </button>
                        </div>

                        {budget !== null && (
                            <div className="mt-5">
                                <div className="mb-2 flex justify-between text-sm">
                                    <span className="text-gray-500">사용한 금액</span>

                                    <span>{budgetUsage.toFixed(0)}%</span>
                                </div>

                                <div className="h-2 overflow-hidden rounded-full bg-gray-100">
                                    <div className="h-full rounded-full bg-black" style={{ width: `${budgetUsage}%` }} />
                                </div>

                                <p className="mt-3 text-sm text-gray-500">
                                    {remainingBudget !== null && remainingBudget >= 0
                                        ? `$${remainingBudget.toFixed(2)} 남았어요`
                                        : `$${Math.abs(remainingBudget ?? 0).toFixed(2)} 초과했어요`}
                                </p>
                            </div>
                        )}
                    </section>

                    {/* Summary */}
                    <section className={styles.card}>
                        <p className={styles.cardLabel}>이번 달 지출</p>

                        <p className={styles.mainAmount}>${totalExpense.toFixed(2)}</p>
                    </section>

                    {/* Category */}
                    <section className="mb-5 rounded-3xl bg-white p-6 shadow-sm">
                        <h2 className="mb-5 text-lg font-semibold">이번 달 소비</h2>

                        {Object.keys(categoryTotals).length === 0 ? (
                            <p className="py-4 text-center text-sm text-gray-400">아직 지출 기록이 없어요.</p>
                        ) : (
                            <div className="space-y-5">
                                {Object.entries(categoryTotals).map(([category, amount]) => {
                                    const percentage = totalExpense > 0 ? (amount / totalExpense) * 100 : 0;

                                    return (
                                        <div key={category}>
                                            <div className="mb-2 flex items-center justify-between">
                                                <div className="flex items-center gap-2">
                                                    <span>
                                                        {category === "식비"
                                                            ? "🍜"
                                                            : category === "교통"
                                                              ? "🚇"
                                                              : category === "쇼핑"
                                                                ? "🛍️"
                                                                : category === "여행"
                                                                  ? "✈️"
                                                                  : category === "월세"
                                                                    ? "🏠"
                                                                    : "💳"}
                                                    </span>

                                                    <span className="font-medium">{category}</span>
                                                </div>

                                                <span className="font-medium">${amount.toFixed(2)}</span>
                                            </div>

                                            <div className="h-2 overflow-hidden rounded-full bg-gray-100">
                                                <div
                                                    className="h-full rounded-full bg-black"
                                                    style={{
                                                        width: `${percentage}%`,
                                                    }}
                                                />
                                            </div>

                                            <p className="mt-1 text-right text-xs text-gray-400">{percentage.toFixed(0)}%</p>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </section>

                    {/* Recent Expenses */}
                    <section className="rounded-3xl bg-white p-6 shadow-sm">
                        <div className="mb-5 flex items-center justify-between">
                            <h2 className="text-lg font-semibold">최근 지출</h2>

                            <button onClick={() => router.push("/expenses")} className="text-sm text-gray-500">
                                전체보기
                            </button>
                        </div>

                        <div className="space-y-5">
                            {expenses.length === 0 ? (
                                <p className="py-6 text-center text-sm text-gray-400">아직 지출 기록이 없어요.</p>
                            ) : (
                                <div className="space-y-5">
                                    {sortedExpenses.map((expense) => (
                                        <div
                                            key={expense.id}
                                            onClick={() => setEditingExpense(expense)}
                                            className="flex items-center justify-between"
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-100">
                                                    {expense.category === "식비"
                                                        ? "🍜"
                                                        : expense.category === "교통"
                                                          ? "🚇"
                                                          : expense.category === "쇼핑"
                                                            ? "🛍️"
                                                            : expense.category === "여행"
                                                              ? "✈️"
                                                              : "💳"}
                                                </div>

                                                <div>
                                                    <p className="font-medium">{expense.memo || expense.category}</p>

                                                    <p className="text-sm text-gray-400">
                                                        {expense.category} · {formatExpenseDate(expense.date)}
                                                    </p>
                                                </div>
                                            </div>

                                            <p className="font-medium">-${expense.amount.toFixed(2)}</p>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </section>

                    {/* Bottom Navigation */}
                    <nav className="fixed bottom-0 left-0 right-0 border-t border-gray-100 bg-white/90 px-5 py-3 backdrop-blur-md">
                        <div className="mx-auto flex max-w-md items-center justify-around">
                            <button className="flex flex-col items-center gap-1 text-black">
                                <span>⌂</span>
                                <span className="text-xs">홈</span>
                            </button>

                            <button className="flex flex-col items-center gap-1 text-gray-400">
                                <span>₩</span>
                                <span className="text-xs">생활</span>
                            </button>

                            <button className="flex flex-col items-center gap-1 text-gray-400">
                                <span>💼</span>
                                <span className="text-xs">급여</span>
                            </button>

                            <button className="flex flex-col items-center gap-1 text-gray-400">
                                <span>✈️</span>
                                <span className="text-xs">여행</span>
                            </button>
                        </div>
                    </nav>

                    <div className="h-20" />

                    <button
                        onClick={() => setIsExpenseModalOpen(true)}
                        className="fixed bottom-24 right-5 flex h-14 w-14 items-center justify-center rounded-full bg-black text-2xl text-white shadow-lg"
                    >
                        +
                    </button>
                </div>

                {isExpenseModalOpen && (
                    <ExpenseModal
                        onClose={() => setIsExpenseModalOpen(false)}
                        onAdd={(expense) => {
                            setExpenses((prev) => [
                                ...prev,
                                {
                                    id: Date.now(),
                                    ...expense,
                                    date: new Date().toISOString(),
                                },
                            ]);
                        }}
                    />
                )}
                {editingExpense && (
                    <EditExpenseModal
                        expense={editingExpense}
                        onClose={() => setEditingExpense(null)}
                        onSave={handleUpdateExpense}
                        onDelete={handleDeleteExpense}
                    />
                )}
            </div>
        </main>
    );
}
