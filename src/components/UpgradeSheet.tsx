"use client";

import { useState } from "react";
import BottomSheet from "@/components/BottomSheet";
import PlanComparisonTable from "@/components/PlanComparisonTable";
import { useI18n } from "@/components/I18nProvider";
import { formatCurrency } from "@/lib/salary/format";
import {
    BILLING_ENABLED,
    getPlanPrice,
    getUpgradeMessage,
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
    const { t } = useI18n();
    const [billingInterval, setBillingInterval] = useState<"monthly" | "yearly">("yearly");

    const price = getPlanPrice(currency);
    const priceCurrency = price.currency;
    const discount = getYearlyDiscountPercent(price);

    const selectedPrice = billingInterval === "yearly" ? price.yearly : price.monthly;

    return (
        <BottomSheet isOpen={isOpen} onClose={onClose} title={t("plan.title")}>
            <p className="text-sm leading-6 text-gray-600">{getUpgradeMessage(reason, t)}</p>

            {isPro ? (
                <div className="mt-5 rounded-3xl bg-white p-5 text-center shadow-sm">
                    <p className="text-sm font-semibold text-gray-900">{t("plan.alreadyPro")}</p>
                    <p className="mt-1 text-xs text-gray-500">{t("plan.alreadyProBody")}</p>
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
                            {t("plan.monthly")}
                        </button>

                        <button
                            type="button"
                            onClick={() => setBillingInterval("yearly")}
                            className={`rounded-xl py-2.5 text-sm font-medium transition-colors ${
                                billingInterval === "yearly" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500"
                            }`}
                        >
                            {t("plan.yearly")}
                            {discount > 0 && (
                                <span className="ml-1 text-xs text-emerald-600">{t("plan.discount", { percent: discount })}</span>
                            )}
                        </button>
                    </div>

                    <div className="mt-4 rounded-3xl bg-white p-5 shadow-sm">
                        <p className="text-3xl font-bold tracking-tight text-gray-950">
                            {formatCurrency(selectedPrice, priceCurrency)}
                            <span className="ml-1 text-sm font-normal text-gray-400">{billingInterval === "yearly" ? t("plan.perYear") : t("plan.perMonth")}</span>
                        </p>

                        {billingInterval === "yearly" && (
                            <p className="mt-1 text-xs text-gray-400">{t("plan.monthlyEquivalent", { price: formatCurrency(price.yearly / 12, priceCurrency) })}</p>
                        )}
                    </div>
                </>
            )}

            <PlanComparisonTable className="mt-5" />

            {!isPro &&
                (BILLING_ENABLED ? (
                    <button
                        type="button"
                        onClick={() => onSubscribe?.(billingInterval)}
                        className="mt-5 w-full rounded-2xl bg-gray-900 py-4 text-sm font-semibold text-white transition-colors hover:bg-gray-800"
                    >
                        {t("plan.start")}
                    </button>
                ) : (
                    <div className="mt-5 rounded-2xl bg-gray-100 px-4 py-4 text-center">
                        <p className="text-sm font-medium text-gray-500">{t("plan.billingSoon")}</p>
                        <p className="mt-1 text-xs text-gray-400">{t("plan.billingSoonBody")}</p>
                    </div>
                ))}
        </BottomSheet>
    );
}
