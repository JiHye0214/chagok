// lib/salary/wage.ts
// 시급 변경 이력. "10월 1일부터 시급이 올랐다" 같은 경우, 그날 이전 근무는 예전 시급, 이후 근무는 새 시급으로 계산한다.
// 서버(API)와 화면이 같은 규칙을 쓰도록 순수 함수로만 둔다.

export type HourlyWageEntry = {
    // 이 날부터 적용 (YYYY-MM-DD)
    effectiveDate: string;
    hourlyWage: number;
};

// "처음부터 적용"을 뜻하는 날짜. 이력의 첫 줄(기본 시급)에 쓴다.
export const WAGE_BASELINE_DATE = "1970-01-01";

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export const isDateString = (value: unknown): value is string => typeof value === "string" && DATE_PATTERN.test(value);

// 날짜순(오래된 것 먼저)으로 정리. 잘못된 줄은 버린다.
export const normalizeWageHistory = (history: readonly HourlyWageEntry[] | null | undefined): HourlyWageEntry[] =>
    (history ?? [])
        .filter((entry) => isDateString(entry.effectiveDate) && Number.isFinite(entry.hourlyWage))
        .map((entry) => ({ effectiveDate: entry.effectiveDate, hourlyWage: Number(entry.hourlyWage) }))
        .sort((a, b) => (a.effectiveDate < b.effectiveDate ? -1 : a.effectiveDate > b.effectiveDate ? 1 : 0));

/**
 * 어떤 날의 시급.
 * - 그 날짜 이하인 이력 중 가장 늦은 것
 * - 이력이 전부 그 날짜보다 미래이면 가장 이른 시급
 * - 이력이 없으면 fallback
 */
export const getHourlyWageOn = (
    date: string,
    history: readonly HourlyWageEntry[] | null | undefined,
    fallback: number | null | undefined = 0,
): number => {
    const sorted = normalizeWageHistory(history);

    if (sorted.length === 0) {
        return Number(fallback) || 0;
    }

    const day = date.slice(0, 10);
    let found = sorted[0];

    for (const entry of sorted) {
        if (entry.effectiveDate <= day) {
            found = entry;
        } else {
            break;
        }
    }

    return found.hourlyWage;
};

// 여러 근무일의 시급 기본급 합계 (날짜마다 그날 시급을 곱함)
export const calculateHourlyBasePay = (
    items: readonly { date: string; hours: number }[],
    history: readonly HourlyWageEntry[] | null | undefined,
    fallback: number | null | undefined = 0,
): number => items.reduce((total, item) => total + item.hours * getHourlyWageOn(item.date, history, fallback), 0);
