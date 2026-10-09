// lib/minimumWage.ts
// 지역별 일반 최저시급. 정부가 알려주는 공식 API가 없어서 여기에 직접 적어둔다.
// 해마다 인상될 때 이 표에 한 줄만 추가하면 된다. (코드 다른 곳은 건드릴 필요 없음)
//
// 주의: 이 값은 "일반" 최저시급이다. 학생·재택근무자·팁 받는 직종 등은 다른 기준이 있을 수 있어서,
// 화면에서는 단정하지 않고 "확인해보세요"로 안내한다.

import { getHourlyWageOn } from "@/lib/salary/wage";
import type { HourlyWageEntry } from "@/lib/salary/wage";

export type MinimumWageRule = {
    country: string;
    // 지역 코드(ON, BC 등). 나라 전체에 적용되면 null
    region: string | null;
    // 이 날부터 적용 (YYYY-MM-DD)
    effectiveDate: string;
    hourlyWage: number;
    currency: string;
    // 확인한 출처 (유지보수용 메모)
    source: string;
};

// 이 표를 마지막으로 확인한 날
export const MINIMUM_WAGE_CHECKED_AT = "2026-10-08";

export const MINIMUM_WAGE_RULES: MinimumWageRule[] = [
    // 캐나다 온타리오 (매년 10월 1일)
    { country: "CA", region: "ON", effectiveDate: "2025-10-01", hourlyWage: 17.6, currency: "CAD", source: "Ontario.ca" },
    { country: "CA", region: "ON", effectiveDate: "2026-10-01", hourlyWage: 17.95, currency: "CAD", source: "Ontario.ca" },

    // 캐나다 BC (매년 6월 1일)
    { country: "CA", region: "BC", effectiveDate: "2025-06-01", hourlyWage: 17.85, currency: "CAD", source: "gov.bc.ca" },
    { country: "CA", region: "BC", effectiveDate: "2026-06-01", hourlyWage: 18.25, currency: "CAD", source: "gov.bc.ca" },

    // 한국 (매년 1월 1일)
    { country: "KR", region: null, effectiveDate: "2026-01-01", hourlyWage: 10320, currency: "KRW", source: "최저임금위원회" },
    { country: "KR", region: null, effectiveDate: "2027-01-01", hourlyWage: 10700, currency: "KRW", source: "고용노동부 고시" },
];

const matches = (rule: MinimumWageRule, country: string | null | undefined, region: string | null | undefined) =>
    rule.country === (country ?? "").toUpperCase() &&
    (rule.region === null || rule.region === (region ?? "").toUpperCase());

const rulesFor = (country: string | null | undefined, region: string | null | undefined) =>
    MINIMUM_WAGE_RULES.filter((rule) => matches(rule, country, region)).sort((a, b) =>
        a.effectiveDate < b.effectiveDate ? -1 : 1,
    );

/** 그날 적용되는 최저시급 (표에 없으면 null) */
export const getMinimumWageOn = (country: string | null | undefined, region: string | null | undefined, date: string) => {
    const applicable = rulesFor(country, region).filter((rule) => rule.effectiveDate <= date);

    return applicable.length > 0 ? applicable[applicable.length - 1] : null;
};

/** 오늘 이후에 적용될 가장 가까운 최저시급 (없으면 null) */
export const getNextMinimumWage = (country: string | null | undefined, region: string | null | undefined, today: string) =>
    rulesFor(country, region).find((rule) => rule.effectiveDate > today) ?? null;

export type MinimumWageNotice =
    // 이미 인상됐는데 내 시급이 아직 그보다 낮음
    | { kind: "below"; rule: MinimumWageRule; currentWage: number }
    // 곧 인상 예정(daysUntil일 뒤)인데 내 시급이 그보다 낮음
    | { kind: "upcoming"; rule: MinimumWageRule; currentWage: number; daysUntil: number };

const UPCOMING_NOTICE_DAYS = 45;

const daysBetween = (from: string, to: string) =>
    Math.round((new Date(`${to}T00:00:00Z`).getTime() - new Date(`${from}T00:00:00Z`).getTime()) / 86_400_000);

/**
 * 최저시급 안내가 필요한지. 필요 없으면 null.
 * - 시급제가 아니거나, 시급을 아직 입력하지 않았으면 안내하지 않는다.
 * - 내 시급이 이미 최저시급 이상이면 안내하지 않는다.
 */
export const getMinimumWageNotice = ({
    country,
    region,
    currency,
    history,
    fallbackWage,
    today,
}: {
    country: string | null | undefined;
    region: string | null | undefined;
    currency: string | null | undefined;
    history: readonly HourlyWageEntry[] | null | undefined;
    fallbackWage: number | null | undefined;
    today: string;
}): MinimumWageNotice | null => {
    const hasWage = (history && history.length > 0) || Number(fallbackWage) > 0;

    if (!hasWage) {
        return null;
    }

    const currentWage = getHourlyWageOn(today, history, fallbackWage);

    const current = getMinimumWageOn(country, region, today);

    if (current && (!currency || current.currency === currency) && currentWage < current.hourlyWage) {
        return { kind: "below", rule: current, currentWage };
    }

    const next = getNextMinimumWage(country, region, today);

    if (next && (!currency || next.currency === currency)) {
        const daysUntil = daysBetween(today, next.effectiveDate);

        // 그날이 되어도 내 시급(그날 기준)이 새 최저시급보다 낮을 때만
        if (daysUntil <= UPCOMING_NOTICE_DAYS && getHourlyWageOn(next.effectiveDate, history, fallbackWage) < next.hourlyWage) {
            return { kind: "upcoming", rule: next, currentWage, daysUntil };
        }
    }

    return null;
};

// 최저시급 안내에서 "시급 바꾸기"를 눌렀을 때 설정 시트에 미리 채워줄 값
export type WagePreset = { hourlyWage: number; effectiveDate: string };

const REGION_NAMES: Record<string, string> = { ON: "온타리오", BC: "BC" };

export const getMinimumWageAreaName = (rule: MinimumWageRule) =>
    rule.region === null ? (rule.country === "KR" ? "한국" : rule.country) : (REGION_NAMES[rule.region] ?? rule.region);
