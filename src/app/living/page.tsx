"use client";

import { useState } from "react";
import { ChevronRight, Plus, X } from "lucide-react";

// --------------------------------------------------
// 임시 데이터
// API 연결 전까지 화면 확인용
// --------------------------------------------------

const livingData = {
    remaining: 480,
    monthlySpending: 420,
    dailyAverage: 22.1,

    categories: [
        {
            name: "식비",
            amount: 280,
        },
        {
            name: "쇼핑",
            amount: 95,
        },
        {
            name: "교통",
            amount: 45,
        },
    ],
};

const savingData = {
    current: 3200,
    goal: 10000,
};

const groceryData = {
    total: 5,
    completed: 2,

    stores: [
        {
            name: "Walmart",
            count: 3,
        },
        {
            name: "T&T",
            count: 2,
        },
        {
            name: "Costco",
            count: 1,
        },
    ],
};

const fridgeData = {
    total: 18,

    categories: [
        {
            name: "냉장",
            count: 8,
        },
        {
            name: "냉동",
            count: 6,
        },
        {
            name: "상온",
            count: 4,
        },
    ],

    expiringSoon: 3,
};

// --------------------------------------------------
// Helpers
// --------------------------------------------------

const formatMoney = (amount: number) => {
    return `$${amount.toLocaleString("en-CA", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    })}`;
};

// --------------------------------------------------
// Main
// --------------------------------------------------

export default function LivingPage() {
    const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);
    const [isSavingModalOpen, setIsSavingModalOpen] = useState(false);

    const savingPercent = savingData.goal > 0 ? Math.min(100, Math.round((savingData.current / savingData.goal) * 100)) : 0;

    return (
        <div className="mx-auto max-w-md">
            {/* --------------------------------------------------
                Header
            -------------------------------------------------- */}

            <header className="mt-5 mb-8">
                <p className="text-sm text-gray-500">차곡</p>

                <div className="mt-2 flex items-center justify-between">
                    <h1 className="text-3xl font-bold tracking-tight text-gray-900">생활</h1>
                </div>

                <p className="mt-2 text-sm leading-relaxed text-gray-500">생활비를 관리하고, 일상을 차곡차곡 기록해보세요.</p>
            </header>

            {/* --------------------------------------------------
                생활비
            -------------------------------------------------- */}

            <section>
                <div className="rounded-3xl bg-white p-5 shadow-sm">
                    <div className="flex items-start justify-between">
                        <div>
                            <p className="text-xs text-gray-400">생활비</p>

                            <h2 className="mt-1 text-lg font-bold text-gray-900">이번 달 변동 지출</h2>
                        </div>

                        <button
                            type="button"
                            onClick={() => setIsExpenseModalOpen(true)}
                            className="flex h-8 items-center gap-1.5 rounded-full bg-gray-100 px-3 text-xs font-medium text-gray-600 transition"
                        >
                            <Plus size={14} />
                            지출 추가
                        </button>
                    </div>

                    <div className="mt-5">
                        <p className="text-xs text-gray-400">남은 생활비</p>

                        <p className="mt-1 text-3xl font-bold tracking-tight text-gray-900">
                            {formatMoney(livingData.remaining)}
                        </p>
                    </div>

                    <div className="mt-5 grid grid-cols-2 gap-3">
                        <div className="rounded-2xl bg-gray-50 p-4">
                            <p className="text-[11px] text-gray-400">이번 달 지출</p>

                            <p className="mt-1 text-base font-bold text-gray-900">{formatMoney(livingData.monthlySpending)}</p>
                        </div>

                        <div className="rounded-2xl bg-gray-50 p-4">
                            <p className="text-[11px] text-gray-400">일 평균</p>

                            <p className="mt-1 text-base font-bold text-gray-900">{formatMoney(livingData.dailyAverage)}</p>
                        </div>
                    </div>

                    <div className="mt-4 flex flex-wrap gap-2">
                        {livingData.categories.map((category) => (
                            <span
                                key={category.name}
                                className="rounded-full bg-gray-100 px-3 py-2 text-[11px] font-medium text-gray-500"
                            >
                                <span className="text-gray-700">{category.name}</span> {formatMoney(category.amount)}
                            </span>
                        ))}
                    </div>
                </div>
            </section>

            {/* --------------------------------------------------
                저축
            -------------------------------------------------- */}

            <section className="mt-6">
                <div className="rounded-3xl bg-white p-5 shadow-sm">
                    <div className="flex items-start justify-between">
                        <div>
                            <p className="text-xs text-gray-400">저축</p>

                            <h2 className="mt-1 text-lg font-bold text-gray-900">저축 목표</h2>
                        </div>

                        <button
                            type="button"
                            onClick={() => setIsSavingModalOpen(true)}
                            className="flex h-8 items-center gap-1.5 rounded-full bg-gray-100 px-3 text-xs font-medium text-gray-600 transition"
                        >
                            <span className="flex h-3.5 w-3.5 items-center justify-center text-[15px] leading-none font-medium">
                                ±
                            </span>
                            저축 수정
                        </button>
                    </div>

                    <div className="mt-5 flex items-center gap-4">
                        {/* 클레이 화분 */}
                        <ClayPlant percent={savingPercent} />

                        <div className="min-w-0 flex-1">
                            <div className="flex items-baseline gap-1">
                                <p className="text-2xl font-bold tracking-tight text-gray-900">
                                    {formatMoney(savingData.current)}
                                </p>

                                <span className="text-xs text-gray-400">/ {formatMoney(savingData.goal)}</span>
                            </div>

                            <div className="mt-4 h-2 overflow-hidden rounded-full bg-gray-100">
                                <div
                                    className="h-full rounded-full bg-gray-900 transition-all duration-700"
                                    style={{
                                        width: `${savingPercent}%`,
                                    }}
                                />
                            </div>

                            <div className="mt-2 flex items-center justify-between">
                                <p className="text-[11px] text-gray-400">
                                    목표까지 {formatMoney(Math.max(0, savingData.goal - savingData.current))}
                                </p>

                                <p className="text-[11px] font-medium text-gray-500">{savingPercent}%</p>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* --------------------------------------------------
                장보기
            -------------------------------------------------- */}

            <section className="mt-6">
                <div className="rounded-3xl bg-white p-5 shadow-sm">
                    <div className="flex items-start justify-between">
                        <div>
                            <p className="text-xs text-gray-400">장보기</p>

                            <h2 className="mt-1 text-lg font-bold text-gray-900">이번 주 장보기</h2>
                        </div>

                        {groceryData.total > 0 && <ChevronRight size={18} className="mt-1 text-gray-300" />}
                    </div>

                    {groceryData.total === 0 ? (
                        <div className="mt-5 rounded-2xl bg-gray-50 px-4 py-6 text-center">
                            <p className="text-sm text-gray-400">이번 주 장볼 물품이 없어요.</p>

                            <p className="mt-1 text-xs text-gray-300">장볼 물품을 추가해 보세요.</p>
                        </div>
                    ) : (
                        <>
                            {/* <p className="mt-5 text-sm text-gray-400">{groceryData.total}개</p> */}

                            <div className="mt-5 -mx-1 overflow-x-auto px-1 scrollbar-hide">
                                <div className="flex w-max gap-2">
                                    {groceryData.stores.map((store) => (
                                        <div
                                            key={store.name}
                                            className="w-[88px] shrink-0 rounded-2xl bg-gray-50 p-3 text-center"
                                        >
                                            <div className="flex h-8 items-center justify-center">
                                                <span className="text-[11px] font-semibold text-gray-500">{store.name}</span>
                                            </div>

                                            <p className="mt-2 text-sm font-bold text-gray-900">{store.count}개</p>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </>
                    )}
                </div>
            </section>

            {/* --------------------------------------------------
                냉장고
            -------------------------------------------------- */}

            <section className="mt-6">
                <div className="rounded-3xl bg-white p-5 shadow-sm">
                    <div className="flex items-start justify-between">
                        <div>
                            <p className="text-xs text-gray-400">냉장고</p>

                            <h2 className="mt-1 text-lg font-bold text-gray-900">냉장고 현황</h2>
                        </div>

                        {fridgeData.total > 0 && <ChevronRight size={18} className="mt-1 text-gray-300" />}
                    </div>

                    {fridgeData.total === 0 ? (
                        <div className="mt-5 rounded-2xl bg-gray-50 px-4 py-6 text-center">
                            <p className="text-sm text-gray-400">냉장고에 등록된 물품이 없어요.</p>

                            <p className="mt-1 text-xs text-gray-300">냉장고에 있는 식재료를 등록해 보세요.</p>
                        </div>
                    ) : (
                        <>
                            <div className="mt-5 grid grid-cols-3 gap-2">
                                {fridgeData.categories.map((category) => (
                                    <div key={category.name} className="rounded-2xl bg-gray-50 p-4">
                                        <p className="text-[11px] text-gray-400">{category.name}</p>

                                        <p className="mt-1 text-xl font-bold text-gray-900">
                                            {category.count}
                                            <span className="ml-0.5 text-xs font-medium text-gray-400">개</span>
                                        </p>
                                    </div>
                                ))}
                            </div>

                            {fridgeData.expiringSoon > 0 && (
                                <div className="mt-3 flex items-center justify-between rounded-2xl bg-gray-50 px-4 py-3">
                                    <div className="flex items-center gap-2">
                                        <span className="text-sm">⚠️</span>

                                        <p className="text-xs text-gray-500">유통기한 임박</p>
                                    </div>

                                    <p className="text-xs font-semibold text-gray-800">{fridgeData.expiringSoon}개</p>
                                </div>
                            )}
                        </>
                    )}
                </div>
            </section>

            {/* --------------------------------------------------
                지출 추가 Modal
            -------------------------------------------------- */}

            {isExpenseModalOpen && <ExpenseModal onClose={() => setIsExpenseModalOpen(false)} />}

            {/* --------------------------------------------------
                저축하기 Modal
            -------------------------------------------------- */}
            {isSavingModalOpen && <SavingModal onClose={() => setIsSavingModalOpen(false)} />}
        </div>
    );
}

// --------------------------------------------------
// Section: Clay Plant
// --------------------------------------------------

function ClayPlant({ percent }: { percent: number }) {
    const level = percent >= 80 ? 3 : percent >= 50 ? 2 : percent >= 20 ? 1 : 0;

    return (
        <div className="relative h-[105px] w-[105px] shrink-0">
            {/* 식물 */}
            {level > 0 && (
                <div className="absolute bottom-[42px] left-1/2 h-[53px] w-[60px] -translate-x-1/2">
                    {/* 줄기 */}
                    <div className="absolute bottom-0 left-1/2 h-[42px] w-[4px] -translate-x-1/2 rounded-full bg-[#83966f]" />

                    {/* 왼쪽 잎 */}
                    <div className="absolute bottom-[12px] left-[3px] h-[22px] w-[18px] rotate-[-32deg] rounded-[75%_25%_75%_25%] bg-[#91a77b] shadow-[inset_2px_2px_3px_rgba(255,255,255,0.35),1px_2px_3px_rgba(0,0,0,0.08)]" />

                    {/* 오른쪽 잎 */}
                    <div className="absolute bottom-[18px] right-[3px] h-[22px] w-[18px] rotate-[32deg] rounded-[25%_75%_25%_75%] bg-[#849a70] shadow-[inset_-2px_2px_3px_rgba(255,255,255,0.35),1px_2px_3px_rgba(0,0,0,0.08)]" />

                    {level >= 2 && (
                        <>
                            <div className="absolute bottom-[29px] left-[12px] h-[20px] w-[17px] rotate-[-38deg] rounded-[75%_25%_75%_25%] bg-[#a0b489] shadow-[inset_2px_2px_3px_rgba(255,255,255,0.35)]" />

                            <div className="absolute bottom-[34px] right-[12px] h-[20px] w-[17px] rotate-[38deg] rounded-[25%_75%_25%_75%] bg-[#94aa7d] shadow-[inset_-2px_2px_3px_rgba(255,255,255,0.35)]" />
                        </>
                    )}

                    {level >= 3 && (
                        <div className="absolute bottom-[40px] left-1/2 h-[19px] w-[16px] -translate-x-1/2 rounded-full bg-[#a9ba92] shadow-[inset_2px_2px_3px_rgba(255,255,255,0.4)]" />
                    )}
                </div>
            )}

            {/* 흙 */}
            <div className="absolute bottom-[32px] left-1/2 z-10 h-[10px] w-[55px] -translate-x-1/2 rounded-[50%] bg-[#66594f] shadow-[inset_0_2px_2px_rgba(255,255,255,0.12)]" />

            {/* 화분 */}
            <div
                className="
                    absolute
                    bottom-[3px]
                    left-1/2
                    z-20
                    h-[39px]
                    w-[60px]
                    -translate-x-1/2
                    rounded-[7px_7px_22px_22px]
                    bg-[#d7b39d]
                    shadow-[inset_3px_3px_5px_rgba(255,255,255,0.45),inset_-4px_-4px_6px_rgba(110,70,50,0.13),0_6px_9px_rgba(0,0,0,0.10)]
                "
            />

            {/* 화분 입구 */}
            <div
                className="
                    absolute
                    bottom-[36px]
                    left-1/2
                    z-30
                    h-[10px]
                    w-[65px]
                    -translate-x-1/2
                    rounded-[50%]
                    bg-[#c99f87]
                    shadow-[inset_0_2px_2px_rgba(255,255,255,0.35)]
                "
            />

            {/* 클레이 하이라이트 */}
            <div className="absolute bottom-[13px] left-[28px] z-40 h-[11px] w-[3px] rotate-[8deg] rounded-full bg-white/20" />
        </div>
    );
}

// --------------------------------------------------
// Section: Expense Modal
// --------------------------------------------------

function ExpenseModal({ onClose }: { onClose: () => void }) {
    const [amount, setAmount] = useState("");
    const [category, setCategory] = useState("식비");

    const categories = ["식비", "쇼핑", "교통", "기타"];

    return (
        <div
            className="fixed inset-0 z-50 flex items-end justify-center bg-black/30 sm:items-center sm:px-4"
            onPointerDown={onClose}
        >
            <div
                className="w-full max-w-md rounded-t-3xl bg-white p-5 shadow-xl sm:rounded-3xl"
                onPointerDown={(event) => event.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between">
                    <div>
                        <p className="text-xs text-gray-400">생활비</p>

                        <h2 className="mt-1 text-lg font-bold text-gray-900">지출 추가</h2>
                    </div>

                    <button
                        type="button"
                        onClick={onClose}
                        className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-100 text-gray-400 transition "
                    >
                        <X size={16} />
                    </button>
                </div>

                {/* Amount */}
                <div className="mt-7 flex items-center border-b border-gray-200 pb-3">
                    <span className="text-2xl font-semibold text-gray-300">$</span>

                    <input
                        type="number"
                        inputMode="decimal"
                        value={amount}
                        onChange={(event) => setAmount(event.target.value)}
                        placeholder="0.00"
                        autoFocus
                        className="ml-2 w-full bg-transparent text-3xl font-bold tracking-tight text-gray-900 outline-none placeholder:text-gray-200"
                    />
                </div>

                {/* Category */}
                <div className="mt-6">
                    <p className="mb-2 text-xs text-gray-400">카테고리</p>

                    <div className="grid grid-cols-4 gap-2">
                        {categories.map((item) => (
                            <button
                                key={item}
                                type="button"
                                onClick={() => setCategory(item)}
                                className={`rounded-xl px-2 py-2.5 text-xs font-medium transition ${
                                    category === item ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-500 "
                                }`}
                            >
                                {item}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Save */}
                <button
                    type="button"
                    onClick={onClose}
                    disabled={!amount || Number(amount) <= 0}
                    className="mt-7 flex h-12 w-full items-center justify-center rounded-2xl bg-gray-900 text-sm font-semibold text-white transition disabled:cursor-not-allowed disabled:bg-gray-200"
                >
                    저장
                </button>
            </div>
        </div>
    );
}

function SavingModal({ onClose }: { onClose: () => void }) {
    const [amount, setAmount] = useState("");
    const [mode, setMode] = useState<"add" | "subtract">("add");

    const currentAmount = savingData.current;
    const value = Number(amount);

    const handleSave = () => {
        if (!value || value <= 0) {
            return;
        }

        if (mode === "subtract" && value > currentAmount) {
            return;
        }

        // TODO:
        // await fetch("/api/living/savings", {
        //     method: "POST",
        //     body: JSON.stringify({
        //         amount: value,
        //         type: mode,
        //     }),
        // });

        onClose();
    };

    const isInvalid = !amount || value <= 0 || (mode === "subtract" && value > currentAmount);

    return (
        <div
            className="fixed inset-0 z-50 flex items-end justify-center bg-black/30 sm:items-center sm:px-4"
            onPointerDown={onClose}
        >
            <div
                className="w-full max-w-md rounded-t-3xl bg-white p-5 shadow-xl sm:rounded-3xl"
                onPointerDown={(event) => event.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between">
                    <div>
                        <p className="text-xs text-gray-400">저축</p>

                        <h2 className="mt-1 text-lg font-bold text-gray-900">저축 수정</h2>
                    </div>

                    <button
                        type="button"
                        onClick={onClose}
                        className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-100 text-gray-400 transition "
                    >
                        <X size={16} />
                    </button>
                </div>

                {/* Mode */}
                <div className="mt-5 grid grid-cols-2 gap-2">
                    <button
                        type="button"
                        onClick={() => setMode("add")}
                        className={`h-10 rounded-xl text-sm font-medium transition ${
                            mode === "add" ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-500 "
                        }`}
                    >
                        + 저축
                    </button>

                    <button
                        type="button"
                        onClick={() => setMode("subtract")}
                        className={`h-10 rounded-xl text-sm font-medium transition ${
                            mode === "subtract" ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-500 "
                        }`}
                    >
                        − 사용
                    </button>
                </div>

                {/* Amount */}
                <div className="mt-6 flex items-center border-b border-gray-200 pb-3">
                    <span className="text-2xl font-semibold text-gray-300">$</span>

                    <input
                        type="number"
                        inputMode="decimal"
                        min="0"
                        value={amount}
                        onChange={(event) => setAmount(event.target.value)}
                        placeholder="0.00"
                        autoFocus
                        className="ml-2 w-full bg-transparent text-3xl font-bold tracking-tight text-gray-900 outline-none placeholder:text-gray-200"
                    />
                </div>

                {mode === "subtract" && value > currentAmount && (
                    <p className="mt-2 text-xs text-red-400">현재 저축액보다 많이 사용할 수 없어요.</p>
                )}

                {/* Save */}
                <button
                    type="button"
                    onClick={handleSave}
                    disabled={isInvalid}
                    className="mt-7 flex h-12 w-full items-center justify-center rounded-2xl bg-gray-900 text-sm font-semibold text-white transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:bg-gray-200"
                >
                    저장
                </button>
            </div>
        </div>
    );
}
