"use client";

import { useEffect, useState } from "react";
import EditExpenseModal from "@/components/EditExpenseModal";

type Expense = {
    id: number;
    amount: number;
    category: string;
    memo: string;
    date: string;
};

export default function ExpensesPage() {
    const [expenses, setExpenses] = useState<Expense[]>(() => {
        if (typeof window === "undefined") {
            return [];
        }

        const savedExpenses = localStorage.getItem("chagok-expenses");

        return savedExpenses ? JSON.parse(savedExpenses) : [];
    });
    const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
    const [selectedCategory, setSelectedCategory] = useState("전체");
    const [currentMonth, setCurrentMonth] = useState(() => {
        const today = new Date();

        return {
            year: today.getFullYear(),
            month: today.getMonth(),
        };
    });

    const handleUpdateExpense = (updatedExpense: Expense) => {
        const updatedExpenses = expenses.map((expense) => (expense.id === updatedExpense.id ? updatedExpense : expense));

        setExpenses(updatedExpenses);
        localStorage.setItem("chagok-expenses", JSON.stringify(updatedExpenses));
        setEditingExpense(null);
    };

    const monthlyExpenses = expenses.filter((expense) => {
        const date = new Date(expense.date);

        return date.getFullYear() === currentMonth.year && date.getMonth() === currentMonth.month;
    });
    const filteredExpenses =
        selectedCategory === "전체"
            ? monthlyExpenses
            : monthlyExpenses.filter((expense) => expense.category === selectedCategory);
    const sortedExpenses = [...filteredExpenses].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    const monthlyTotal = monthlyExpenses.reduce((total, expense) => total + expense.amount, 0);
    const monthlyCategoryTotals = monthlyExpenses.reduce(
        (totals, expense) => {
            totals[expense.category] = (totals[expense.category] || 0) + expense.amount;

            return totals;
        },
        {} as Record<string, number>,
    );
    const today = new Date();

    const isCurrentMonth = currentMonth.year === today.getFullYear() && currentMonth.month === today.getMonth();

    const groupedExpenses = sortedExpenses.reduce(
        (groups, expense) => {
            const date = new Date(expense.date);

            const dateKey = `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;

            if (!groups[dateKey]) {
                groups[dateKey] = [];
            }

            groups[dateKey].push(expense);

            return groups;
        },
        {} as Record<string, Expense[]>,
    );

    return (
        <main className="min-h-screen bg-gray-50 px-5 py-8">
            <div className="mx-auto max-w-md">
                <h1 className="text-2xl font-bold">전체 지출</h1>

                {/* filter */}
                <div className="mt-6 flex items-center justify-between">
                    <button
                        onClick={() =>
                            setCurrentMonth((prev) => ({
                                year: prev.month === 0 ? prev.year - 1 : prev.year,
                                month: prev.month === 0 ? 11 : prev.month - 1,
                            }))
                        }
                        className="flex h-10 w-10 items-center justify-center rounded-full bg-white shadow-sm"
                    >
                        ‹
                    </button>

                    <div className="text-center">
                        <p className="text-lg font-semibold">
                            {currentMonth.year}년 {currentMonth.month + 1}월
                        </p>

                        <p className="mt-1 text-sm text-gray-500">총 지출 ${monthlyTotal.toFixed(2)}</p>

                        {!isCurrentMonth && (
                            <button
                                onClick={() =>
                                    setCurrentMonth({
                                        year: today.getFullYear(),
                                        month: today.getMonth(),
                                    })
                                }
                                className="mt-2 text-xs font-medium underline"
                            >
                                이번 달로 돌아가기
                            </button>
                        )}
                    </div>

                    <button
                        disabled={isCurrentMonth}
                        onClick={() =>
                            setCurrentMonth((prev) => ({
                                year: prev.month === 11 ? prev.year + 1 : prev.year,
                                month: prev.month === 11 ? 0 : prev.month + 1,
                            }))
                        }
                        className={`flex h-10 w-10 items-center justify-center rounded-full bg-white shadow-sm ${
                            isCurrentMonth ? "cursor-not-allowed opacity-30" : ""
                        }`}
                    >
                        ›
                    </button>
                </div>

                {/* category button */}
                <div className="mt-5 flex gap-2 overflow-x-auto pb-1">
                    {["전체", "식비", "교통", "쇼핑", "여행", "월세"].map((category) => (
                        <button
                            key={category}
                            onClick={() => setSelectedCategory(category)}
                            className={`shrink-0 rounded-full px-4 py-2 text-sm font-medium ${
                                selectedCategory === category ? "bg-black text-white" : "bg-white text-gray-500"
                            }`}
                        >
                            {category}
                        </button>
                    ))}
                </div>

                {/* category expense */}
                <section className="mt-6 rounded-3xl bg-white p-5 shadow-sm">
                    <h2 className="text-base font-semibold">카테고리별 소비</h2>

                    {Object.keys(monthlyCategoryTotals).length === 0 ? (
                        <p className="mt-5 text-center text-sm text-gray-400">아직 지출 기록이 없어요.</p>
                    ) : (
                        <div className="mt-5 space-y-4">
                            {Object.entries(monthlyCategoryTotals).map(([category, amount]) => {
                                const percentage = monthlyTotal > 0 ? (amount / monthlyTotal) * 100 : 0;

                                return (
                                    <div key={category}>
                                        <div className="mb-2 flex items-center justify-between">
                                            <span className="font-medium">{category}</span>

                                            <span className="text-sm font-medium">${amount.toFixed(2)}</span>
                                        </div>

                                        <div className="h-2 overflow-hidden rounded-full bg-gray-100">
                                            <div
                                                className="h-full rounded-full bg-black"
                                                style={{
                                                    width: `${percentage}%`,
                                                }}
                                            />
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </section>

                <div className="mt-6 space-y-4">
                    {Object.entries(groupedExpenses).map(([dateKey, dateExpenses]) => {
                        const [year, month, day] = dateKey.split("-").map(Number);

                        const date = new Date(year, month - 1, day);

                        const dailyTotal = dateExpenses.reduce((total, expense) => total + expense.amount, 0);

                        return (
                            <section key={dateKey}>
                                <div className="mb-3 flex items-center justify-between">
                                    <h2 className="text-sm font-medium text-gray-500">
                                        {date.toLocaleDateString("ko-KR", {
                                            month: "long",
                                            day: "numeric",
                                        })}
                                    </h2>

                                    <span className="text-sm font-medium">-${dailyTotal.toFixed(2)}</span>
                                </div>

                                <div className="space-y-3">
                                    {dateExpenses.map((expense) => (
                                        <div
                                            key={expense.id}
                                            onClick={() => setEditingExpense(expense)}
                                            className="flex cursor-pointer items-center justify-between rounded-2xl bg-white p-4 shadow-sm"
                                        >
                                            <div>
                                                <p className="font-medium">{expense.memo || expense.category}</p>

                                                <p className="mt-1 text-sm text-gray-400">{expense.category}</p>
                                            </div>

                                            <p className="font-medium">-${expense.amount.toFixed(2)}</p>
                                        </div>
                                    ))}
                                </div>
                            </section>
                        );
                    })}
                </div>
            </div>

            {editingExpense && (
                <EditExpenseModal
                    expense={editingExpense}
                    onClose={() => setEditingExpense(null)}
                    onSave={handleUpdateExpense}
                    onDelete={(id) => {
                        const updatedExpenses = expenses.filter((expense) => expense.id !== id);

                        setExpenses(updatedExpenses);
                        localStorage.setItem("chagok-expenses", JSON.stringify(updatedExpenses));
                        setEditingExpense(null);
                    }}
                />
            )}
        </main>
    );
}
