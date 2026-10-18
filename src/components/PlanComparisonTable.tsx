"use client";

import { Check } from "lucide-react";
import { useI18n } from "@/components/I18nProvider";
import { PLAN_COMPARISON } from "@/lib/plans";

// 무료 / Pro 비교표. 요금제 시트와 설정의 Pro 혜택 시트가 함께 쓴다.
export default function PlanComparisonTable({ className = "" }: { className?: string }) {
    const { t } = useI18n();

    return (
        <div className={`overflow-hidden rounded-3xl bg-white shadow-sm ${className}`}>
            <div className="grid grid-cols-[1fr_72px_72px] gap-2 border-b border-gray-100 px-4 py-3 text-xs text-gray-400">
                <span />
                <span className="text-center">{t("plan.colFree")}</span>
                <span className="text-center font-semibold text-gray-900">Pro</span>
            </div>

            {PLAN_COMPARISON.map((row) => (
                <div
                    key={row.labelKey}
                    className="grid grid-cols-[1fr_72px_72px] items-center gap-2 border-b border-gray-50 px-4 py-3 text-sm last:border-b-0"
                >
                    <span className="text-gray-700">{t(row.labelKey)}</span>
                    <span className="text-center text-xs text-gray-400">
                        {row.free === null ? t("plan.none") : t("plan.countUnit", { count: row.free })}
                    </span>
                    <span className="flex items-center justify-center gap-1 text-center text-xs font-medium text-gray-900">
                        {row.pro === "available" && <Check size={12} strokeWidth={2.5} />}
                        {row.pro === "available" ? t("plan.available") : t("plan.unlimited")}
                    </span>
                </div>
            ))}
        </div>
    );
}
