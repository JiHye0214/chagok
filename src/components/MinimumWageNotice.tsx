"use client";

import { useEffect, useState } from "react";
import { todayDateString } from "@/lib/dateOnly";
import { getMinimumWageAreaName, getMinimumWageNotice } from "@/lib/minimumWage";
import type { WagePreset } from "@/lib/minimumWage";
import { formatCurrency } from "@/lib/salary/format";
import type { SalaryProfile, SalarySettingsData } from "@/lib/salary/types";

type MinimumWageNoticeProps = {
    profile: SalaryProfile | null;
    settings: SalarySettingsData | null;
    // "시급 바꾸기"를 누르면 새 최저시급과 적용일을 채워서 설정 시트를 열어준다
    onApply: (preset: WagePreset) => void;
    className?: string;
};

// 한 번 닫은 안내는 같은 인상 건에 대해서는 다시 띄우지 않는다. (브라우저에만 기억)
const getDismissKey = (area: string, effectiveDate: string) => `chagok:minwage-dismissed:${area}:${effectiveDate}`;

export default function MinimumWageNotice({ profile, settings, onApply, className = "" }: MinimumWageNoticeProps) {
    const [isDismissed, setIsDismissed] = useState(false);

    const notice =
        profile && settings && settings.payType === "hourly"
            ? getMinimumWageNotice({
                  country: profile.countryCode,
                  region: profile.provinceCode,
                  currency: profile.currency,
                  history: settings.hourlyWageHistory,
                  fallbackWage: settings.hourlyWage,
                  today: todayDateString(),
              })
            : null;

    const dismissKey = notice ? getDismissKey(getMinimumWageAreaName(notice.rule), notice.rule.effectiveDate) : null;

    useEffect(() => {
        if (!dismissKey) {
            return;
        }

        try {
            setIsDismissed(window.localStorage.getItem(dismissKey) === "1");
        } catch {
            setIsDismissed(false);
        }
    }, [dismissKey]);

    if (!notice || !dismissKey || isDismissed) {
        return null;
    }

    const area = getMinimumWageAreaName(notice.rule);
    const currency = notice.rule.currency;

    const title = notice.kind === "below" ? `${area} 최저시급이 올랐어요` : `${area} 최저시급이 곧 올라요`;

    const description =
        notice.kind === "below"
            ? `${notice.rule.effectiveDate}부터 ${formatCurrency(notice.rule.hourlyWage, currency)}예요. 지금 시급은 ${formatCurrency(notice.currentWage, currency)}으로 되어 있어요.`
            : `${notice.rule.effectiveDate}(${notice.daysUntil}일 뒤)부터 ${formatCurrency(notice.rule.hourlyWage, currency)}이 돼요. 지금 시급은 ${formatCurrency(notice.currentWage, currency)}으로 되어 있어요.`;

    const handleDismiss = () => {
        setIsDismissed(true);

        try {
            window.localStorage.setItem(dismissKey, "1");
        } catch {
            // 저장이 막힌 브라우저에서는 이번 방문 동안만 숨긴다
        }
    };

    return (
        <section className={`rounded-3xl border border-amber-100 bg-amber-50 p-5 ${className}`}>
            <p className="text-xs font-medium text-amber-600">시급 확인</p>

            <p className="mt-1 text-lg font-bold text-gray-900">{title}</p>

            <p className="mt-1 text-sm leading-6 text-gray-600">{description}</p>

            <p className="mt-1 text-xs leading-5 text-gray-400">
                일반 근로자 기준이에요. 학생이나 특정 직종은 기준이 다를 수 있어서 해당될 때만 바꿔주세요.
            </p>

            <div className="mt-4 flex gap-2">
                <button
                    type="button"
                    onClick={() => onApply({ hourlyWage: notice.rule.hourlyWage, effectiveDate: notice.rule.effectiveDate })}
                    className="flex-1 rounded-2xl bg-gray-900 py-3 text-sm font-semibold text-white transition-colors hover:bg-gray-800"
                >
                    {formatCurrency(notice.rule.hourlyWage, currency)}으로 바꾸기
                </button>

                <button
                    type="button"
                    onClick={handleDismiss}
                    className="rounded-2xl bg-white px-4 py-3 text-sm font-medium text-gray-500 transition-colors hover:bg-gray-100"
                >
                    괜찮아요
                </button>
            </div>
        </section>
    );
}
