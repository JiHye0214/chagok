"use client";

import { useEffect, useState } from "react";
import { EXPENSE_CATEGORIES } from "@/constants/categories";

type Expense = {
    id: number;
    amount: number;
    category: string;
    memo: string;
    date: string;
};

export default function LivingPage() {
    const [expenses, setExpenses] = useState<Expense[]>(() => {
        if (typeof window === "undefined") {
            return [];
        }

        const savedExpenses = localStorage.getItem("chagok-expenses");

        return savedExpenses ? JSON.parse(savedExpenses) : [];
    });

    const [livingBudget, setLivingBudget] = useState<number | null>(() => {
        if (typeof window === "undefined") {
            return null;
        }

        const savedBudget = localStorage.getItem("chagok-living-budget");

        return savedBudget ? Number(savedBudget) : null;
    });

    useEffect(() => {
        if (livingBudget === null) {
            localStorage.removeItem("chagok-living-budget");
            return;
        }

        localStorage.setItem("chagok-living-budget", String(livingBudget));
    }, [livingBudget]);

    const today = new Date();

    const monthlyExpenses = expenses.filter((expense) => {
        const date = new Date(expense.date);

        return date.getFullYear() === today.getFullYear() && date.getMonth() === today.getMonth();
    });

    const categoryTotals = monthlyExpenses.reduce(
        (totals, expense) => {
            totals[expense.category] = (totals[expense.category] || 0) + expense.amount;

            return totals;
        },
        {} as Record<string, number>,
    );

    const totalLivingExpense = monthlyExpenses
        .filter((expense) => expense.category !== "여행")
        .reduce((total, expense) => total + expense.amount, 0);

    const livingBudgetUsage =
        livingBudget !== null && livingBudget > 0 ? Math.min((totalLivingExpense / livingBudget) * 100, 100) : 0;

    const remainingLivingBudget = livingBudget !== null ? livingBudget - totalLivingExpense : null;

    return (
        <div className="mx-auto max-w-md">
            <header>
                <p className="text-sm text-gray-500">차곡</p>

                <h1 className="mt-2 text-3xl font-bold">생활비</h1>
            </header>

            <section className="mt-6 rounded-3xl bg-white p-6 shadow-sm">
                <div className="flex items-center justify-between">
                    <div>
                        <p className="text-sm text-gray-500">이번 달 생활비</p>

                        <p className="mt-2 text-4xl font-bold">${totalLivingExpense.toFixed(2)}</p>
                    </div>

                    <button
                        onClick={() => {
                            const value = window.prompt("이번 달 생활비 예산을 입력해주세요.");

                            if (value === null) return;

                            const numberValue = Number(value);

                            if (!numberValue || numberValue <= 0) {
                                alert("올바른 금액을 입력해주세요.");
                                return;
                            }

                            setLivingBudget(numberValue);
                        }}
                        className="rounded-full bg-gray-100 px-4 py-2 text-sm font-medium"
                    >
                        {livingBudget === null ? "예산 설정" : "수정"}
                    </button>
                </div>

                {livingBudget !== null && (
                    <div className="mt-6">
                        <div className="mb-2 flex justify-between text-sm">
                            <span className="text-gray-500">예산 ${livingBudget.toFixed(2)}</span>

                            <span>{livingBudgetUsage.toFixed(0)}%</span>
                        </div>

                        <div className="h-2 overflow-hidden rounded-full bg-gray-100">
                            <div
                                className="h-full rounded-full bg-black"
                                style={{
                                    width: `${livingBudgetUsage}%`,
                                }}
                            />
                        </div>

                        <p className="mt-3 text-sm text-gray-500">
                            {remainingLivingBudget !== null && remainingLivingBudget >= 0
                                ? `$${remainingLivingBudget.toFixed(2)} 남았어요`
                                : `$${Math.abs(remainingLivingBudget ?? 0).toFixed(2)} 초과했어요`}
                        </p>
                    </div>
                )}
            </section>

            <section className="mt-5 grid grid-cols-2 gap-3">
                <div className="rounded-3xl bg-white p-5 shadow-sm">
                    <p className="text-sm text-gray-500">🍜 식비</p>

                    <p className="mt-2 text-xl font-semibold">${(categoryTotals["식비"] || 0).toFixed(2)}</p>
                </div>

                <div className="rounded-3xl bg-white p-5 shadow-sm">
                    <p className="text-sm text-gray-500">🚇 교통</p>

                    <p className="mt-2 text-xl font-semibold">${(categoryTotals["교통"] || 0).toFixed(2)}</p>
                </div>

                <div className="rounded-3xl bg-white p-5 shadow-sm">
                    <p className="text-sm text-gray-500">🏠 주거</p>

                    <p className="mt-2 text-xl font-semibold">${(categoryTotals["월세"] || 0).toFixed(2)}</p>
                </div>

                <div className="rounded-3xl bg-white p-5 shadow-sm">
                    <p className="text-sm text-gray-500">🛍️ 쇼핑</p>

                    <p className="mt-2 text-xl font-semibold">${(categoryTotals["쇼핑"] || 0).toFixed(2)}</p>
                </div>

                <div className="col-span-2 rounded-3xl bg-white p-5 shadow-sm">
                    <p className="text-sm text-gray-500">💳 기타</p>

                    <p className="mt-2 text-xl font-semibold">${(categoryTotals["기타"] || 0).toFixed(2)}</p>
                </div>
            </section>
        </div>
    );
}
