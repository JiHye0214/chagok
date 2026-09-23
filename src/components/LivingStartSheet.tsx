"use client";

import { useEffect, useState } from "react";

type LivingStartSheetProps = {
    isOpen: boolean;
    onClose: () => void;
    onSaved?: () => void;
};

export default function LivingStartSheet({ isOpen, onClose, onSaved }: LivingStartSheetProps) {
    const [isMounted, setIsMounted] = useState(false);
    const [isAnimating, setIsAnimating] = useState(false);

    const [initialLivingMoney, setInitialLivingMoney] = useState("");
    const [initialSavingsMoney, setInitialSavingsMoney] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        if (isOpen) {
            setIsMounted(true);

            const loadSettings = async () => {
                try {
                    setIsLoading(true);

                    const response = await fetch("/api/living/settings");

                    if (!response.ok) {
                        throw new Error("생활 설정을 불러오지 못했습니다.");
                    }

                    const data = await response.json();

                    if (data) {
                        setInitialLivingMoney(String(data.initialLivingMoney ?? ""));
                        setInitialSavingsMoney(String(data.initialSavingsMoney ?? ""));
                    }
                } catch (error) {
                    console.error(error);
                } finally {
                    setIsLoading(false);
                }
            };

            void loadSettings();

            document.body.style.overflow = "hidden";

            const frame = window.requestAnimationFrame(() => {
                window.requestAnimationFrame(() => {
                    setIsAnimating(true);
                });
            });

            return () => {
                window.cancelAnimationFrame(frame);
                document.body.style.overflow = "";
            };
        }

        setIsAnimating(false);

        const timer = window.setTimeout(() => {
            setIsMounted(false);
        }, 350);

        document.body.style.overflow = "";

        return () => {
            clearTimeout(timer);
            document.body.style.overflow = "";
        };
    }, [isOpen]);

    if (!isMounted) {
        return null;
    }

    const livingMoney = Number(initialLivingMoney || 0);
    const savingsMoney = Number(initialSavingsMoney || 0);
    const totalMoney = livingMoney + savingsMoney;

    const handleSave = async () => {
        if (!Number.isFinite(livingMoney) || livingMoney < 0 || !Number.isFinite(savingsMoney) || savingsMoney < 0) {
            return;
        }

        try {
            setIsSaving(true);

            const response = await fetch("/api/living/settings", {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    initialLivingMoney: livingMoney,
                    initialSavingsMoney: savingsMoney,
                }),
            });

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.error || "생활 설정 저장에 실패했습니다.");
            }

            onSaved?.();
            onClose();
        } catch (error) {
            console.error(error);
            alert(error instanceof Error ? error.message : "생활 설정을 저장하지 못했어요.");
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[10000]">
            <button
                type="button"
                aria-label="닫기"
                onClick={onClose}
                className={`absolute inset-0 bg-black/30 transition-opacity duration-300 ease-out ${
                    isAnimating ? "opacity-100" : "opacity-0"
                }`}
            />

            <div
                className={`absolute inset-x-0 bottom-0 mx-auto flex max-h-[95dvh] w-full max-w-md flex-col rounded-t-[2rem] bg-gray-50 shadow-2xl transform-gpu transition-transform duration-[350ms] ease-[cubic-bezier(0.22,1,0.36,1)] ${
                    isAnimating ? "translate-y-0" : "translate-y-full"
                }`}
            >
                <div className="flex shrink-0 items-center justify-center px-6 pb-4 pt-3">
                    <div className="h-1.5 w-10 rounded-full bg-gray-300" />
                </div>

                <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-8 pt-2">
                    <div className="mb-7">
                        <p className="text-xs text-gray-400">생활</p>
                        <h2 className="mt-1 text-2xl font-bold tracking-[-0.04em] text-gray-950">생활을 시작해볼까요?</h2>
                        <p className="mt-2 text-sm leading-6 text-gray-500">지금 가지고 있는 돈과 저축해둔 금액을 알려주세요.</p>
                    </div>

                    {isLoading ? (
                        <div className="space-y-4">
                            <div className="h-24 animate-pulse rounded-3xl bg-white" />
                            <div className="h-24 animate-pulse rounded-3xl bg-white" />
                        </div>
                    ) : (
                        <>
                            <div className="space-y-4">
                                <div className="rounded-3xl bg-white p-5 shadow-sm">
                                    <label className="block text-xs font-medium text-gray-400">현재 가지고 있는 돈</label>

                                    <div className="mt-3 flex items-center gap-2">
                                        <span className="text-xl font-semibold text-gray-400">$</span>

                                        <input
                                            type="number"
                                            min="0"
                                            inputMode="decimal"
                                            value={initialLivingMoney}
                                            onChange={(e) => setInitialLivingMoney(e.target.value)}
                                            className="min-w-0 flex-1 bg-transparent text-2xl font-bold text-gray-950 outline-none placeholder:text-gray-300"
                                            placeholder="0"
                                        />
                                    </div>
                                </div>

                                <div className="rounded-3xl bg-white p-5 shadow-sm">
                                    <label className="block text-xs font-medium text-gray-400">저축한 돈</label>

                                    <div className="mt-3 flex items-center gap-2">
                                        <span className="text-xl font-semibold text-gray-400">$</span>

                                        <input
                                            type="number"
                                            min="0"
                                            inputMode="decimal"
                                            value={initialSavingsMoney}
                                            onChange={(e) => setInitialSavingsMoney(e.target.value)}
                                            className="min-w-0 flex-1 bg-transparent text-2xl font-bold text-gray-950 outline-none placeholder:text-gray-300"
                                            placeholder="0"
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="mt-5 rounded-3xl border border-gray-200 bg-white p-5">
                                <div className="flex items-center justify-between">
                                    <span className="text-sm text-gray-500">총 자산</span>
                                    <span className="text-xl font-bold text-gray-950">
                                        $
                                        {new Intl.NumberFormat("en-CA", {
                                            minimumFractionDigits: 2,
                                            maximumFractionDigits: 2,
                                        }).format(totalMoney)}
                                    </span>
                                </div>
                            </div>

                            <button
                                type="button"
                                disabled={isSaving}
                                onClick={() => void handleSave()}
                                className="mt-5 w-full rounded-2xl bg-gray-900 py-4 text-sm font-semibold text-white transition-colors hover:bg-gray-800 disabled:opacity-50"
                            >
                                {isSaving ? "저장 중..." : "생활 시작하기"}
                            </button>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}
