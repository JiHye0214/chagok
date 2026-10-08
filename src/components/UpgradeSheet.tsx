"use client";

import { useState } from "react";
import { Check } from "lucide-react";
import BottomSheet from "@/components/BottomSheet";
import { formatCurrency } from "@/lib/salary/format";
import {
    BILLING_ENABLED,
    PLAN_COMPARISON,
    UPGRADE_MESSAGES,
    getPlanPrice,
    getYearlyDiscountPercent,
} from "@/lib/plans";
import type { UpgradeReason } from "@/lib/plans";

type UpgradeSheetProps = {
    isOpen: boolean;
    onClose: () => void;
    reason?: UpgradeReason;
    isPro: boolean;
    currency: string | null;
    // 결제 시작 (BILLING_ENABLED 가 true 일 때만 쓰임). 결제 서비스가 정해지면 연결한다.
    onSubscribe?: (interval: "monthly" | "yearly") => void;
};

export default function UpgradeSheet({ isOpen, onClose, reason = "general", isPro, currency, onSubscribe }: UpgradeSheetProps) {
    const [billingInterval, setBillingInterval] = useState<"monthly" | "yearly">("yearly");

    const price = getPlanPrice(currency);
    const priceCurrency = price.currency;
    const discount = getYearlyDiscountPercent(price);

    const selectedPrice = billingInterval === "yearly" ? price.yearly : price.monthly;

    return (
        <BottomSheet isOpen={isOpen} onClose={onClose} title="Pro">
            <p className="text-sm leading-6 text-gray-600">{UPGRADE_MESSAGES[reason]}</p>

            {isPro ? (
                <div className="mt-5 rounded-3xl bg-white p-5 text-center shadow-sm">
                    <p className="text-sm font-semibold text-gray-900">이미 Pro를 사용 중이에요</p>
                    <p className="mt-1 text-xs text-gray-500">모든 기능을 제한 없이 쓸 수 있어요.</p>
                </div>
            ) : (
                <>
                    <div className="mt-5 grid grid-cols-2 gap-2 rounded-2xl bg-gray-100 p-1">
                        <button
                            type="button"
                            onClick={() => setBillingInterval("monthly")}
                            className={`rounded-xl py-2.5 text-sm font-medium transition-colors ${
                                billingInterval === "monthly" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500"
                            }`}
                        >
                            월간
                        </button>

                        <button
                            type="button"
                            onClick={() => setBillingInterval("yearly")}
                            className={`rounded-xl py-2.5 text-sm font-medium transition-colors ${
                                billingInterval === "yearly" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500"
                            }`}
                        >
                            연간{discount > 0 && <span className="ml-1 text-xs text-emerald-600">{discount}% 할인</span>}
                        </button>
                    </div>

                    <div className="mt-4 rounded-3xl bg-white p-5 shadow-sm">
                        <p className="text-3xl font-bold tracking-tight text-gray-950">
                            {formatCurrency(selectedPrice, priceCurrency)}
                            <span className="ml-1 text-sm font-normal text-gray-400">/ {billingInterval === "yearly" ? "년" : "월"}</span>
                        </p>

                        {billingInterval === "yearly" && (
                            <p className="mt-1 text-xs text-gray-400">월 {formatCurrency(price.yearly / 12, priceCurrency)} 꼴이에요.</p>
                        )}
                    </div>
                </>
            )}

            <div className="mt-5 overflow-hidden rounded-3xl bg-white shadow-sm">
                <div className="grid grid-cols-[1fr_72px_72px] gap-2 border-b border-gray-100 px-4 py-3 text-xs text-gray-400">
                    <span />
                    <span className="text-center">무료</span>
                    <span className="text-center font-semibold text-gray-900">Pro</span>
                </div>

                {PLAN_COMPARISON.map((row) => (
                    <div
                        key={row.label}
                        className="grid grid-cols-[1fr_72px_72px] items-center gap-2 border-b border-gray-50 px-4 py-3 text-sm last:border-b-0"
                    >
                        <span className="text-gray-700">{row.label}</span>
                        <span className="text-center text-xs text-gray-400">{row.free}</span>
                        <span className="flex items-center justify-center gap-1 text-center text-xs font-medium text-gray-900">
                            {row.pro === "가능" && <Check size={12} strokeWidth={2.5} />}
                            {row.pro}
                        </span>
                    </div>
                ))}
            </div>

            {!isPro &&
                (BILLING_ENABLED ? (
                    <button
                        type="button"
                        onClick={() => onSubscribe?.(billingInterval)}
                        className="mt-5 w-full rounded-2xl bg-gray-900 py-4 text-sm font-semibold text-white transition-colors hover:bg-gray-800"
                    >
                        Pro 시작하기
                    </button>
                ) : (
                    <div className="mt-5 rounded-2xl bg-gray-100 px-4 py-4 text-center">
                        <p className="text-sm font-medium text-gray-500">결제 기능을 준비 중이에요</p>
                        <p className="mt-1 text-xs text-gray-400">곧 만나요. 조금만 기다려 주세요.</p>
                    </div>
                ))}
        </BottomSheet>
    );
}
