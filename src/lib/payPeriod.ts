// lib/payPeriod.ts
export type PayPeriod = {
    startDate: string;
    endDate: string;
    payDate: string;
};

export type PayFrequency = "weekly" | "biweekly" | "semi-monthly" | "monthly" | "custom";

export type SemiMonthlyType = "first-fifteenth" | "fifteenth-end";

export const formatDate = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");

    return `${year}-${month}-${day}`;
};

export const addDays = (dateString: string, days: number) => {
    const date = new Date(`${dateString}T00:00:00`);

    if (Number.isNaN(date.getTime())) {
        return "";
    }

    date.setDate(date.getDate() + days);

    return formatDate(date);
};

/*
 * 같은 '일(day)'의 다음 달 날짜. 다음 달에 그 날이 없으면 말일로 맞춤.
 * 예: 1/31 + 1개월 → 2/28 (setMonth를 쓰면 3/3으로 넘어가는 문제 방지)
 */
const addMonthClamped = (date: Date) => {
    const day = date.getDate();
    const next = new Date(date.getFullYear(), date.getMonth() + 1, 1);
    const lastDay = new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate();

    next.setDate(Math.min(day, lastDay));

    return next;
};

export const getPayPeriodEndDate = (
    startDate: string,
    frequency: PayFrequency,
    semiMonthlyType?: SemiMonthlyType,
    customPayDays?: number,
) => {
    if (!startDate) {
        return "";
    }

    const date = new Date(startDate + "T00:00:00");

    // 날짜가 잘못 들어온 경우
    if (Number.isNaN(date.getTime())) {
        return "";
    }

    switch (frequency) {
        case "weekly":
            date.setDate(date.getDate() + 6);
            break;

        case "biweekly":
            date.setDate(date.getDate() + 13);
            break;

        case "monthly": {
            // 다음 달 같은 날의 하루 전 (말일 보정)
            const nextStart = addMonthClamped(date);
            nextStart.setDate(nextStart.getDate() - 1);
            return formatDate(nextStart);
        }

        case "semi-monthly":
            if (semiMonthlyType === "fifteenth-end") {
                // 16일 ~ 다음 달 15일 (한 달에 한 번, 연 12회)
                if (date.getDate() <= 15) {
                    date.setDate(15);
                } else {
                    date.setMonth(date.getMonth() + 1);
                    date.setDate(15);
                }
            } else {
                // 1일 ~ 15일 / 16일 ~ 말일 (한 달에 두 번, 연 24회)
                if (date.getDate() <= 15) {
                    date.setDate(15);
                } else {
                    date.setMonth(date.getMonth() + 1);
                    date.setDate(0);
                }
            }
            break;

        case "custom":
            date.setDate(date.getDate() + (Number(customPayDays) || 14) - 1);
            break;

        default:
            return "";
    }

    return formatDate(date);
};

/*
 * 급여 기간의 일수 (시작일·종료일 포함). custom 주기의 연간 횟수 계산에 사용.
 */
export const getPayPeriodDays = (period: Pick<PayPeriod, "startDate" | "endDate">) => {
    const start = new Date(`${period.startDate}T00:00:00`);
    const end = new Date(`${period.endDate}T00:00:00`);

    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
        return 0;
    }

    // 서머타임으로 하루가 23/25시간이 되는 경우를 round로 보정
    return Math.round((end.getTime() - start.getTime()) / 86_400_000) + 1;
};

export const getPeriodsPerYear = (frequency: PayFrequency, customPayDays?: number, semiMonthlyType?: SemiMonthlyType) => {
    switch (frequency) {
        case "weekly":
            return 52;

        case "biweekly":
            return 26;

        case "semi-monthly":
            // 'fifteenth-end'(16일 ~ 다음 달 15일)는 이름과 달리 한 달에 한 번이라 연 12회
            return semiMonthlyType === "fifteenth-end" ? 12 : 24;

        case "monthly":
            return 12;

        case "custom": {
            // 기존에는 항상 26이었음. 실제 일수가 있으면 거기서 계산.
            const days = Number(customPayDays);
            return days > 0 ? 365 / days : 26;
        }

        default:
            return 26;
    }
};

/*
 * ------------------------------------------------------------------
 * 급여 기간 찾기
 *
 * 세 화면(급여·근무 관리·급여 기록)이 각자 "현재 급여 기간"을 계산하던 것을 여기 한 곳으로 모았다.
 * 급여일은 항상 "급여 기간 종료일 + 오프셋(일)"이다. 오프셋은 저장된 payDateOffset을 쓰고,
 * 없으면 설정에 입력한 기준 급여일에서 계산한다.
 * ------------------------------------------------------------------
 */
export type PayPeriodSettings = {
    payFrequency: PayFrequency;
    payPeriodStartDate?: string | null;
    payDate?: string | null;
    payDateOffset?: number | null;
    semiMonthlyType?: SemiMonthlyType | null;
    customPayDays?: number | null;
};

const DAY_MS = 86_400_000;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

// 날짜 계산은 UTC 기준 "일 수"로 한다. (서머타임·시간대 영향 없음)
const toDayNumber = (value: string) => {
    if (!DATE_PATTERN.test(value)) {
        return null;
    }

    const [year, month, day] = value.split("-").map(Number);

    return Math.round(Date.UTC(year, month - 1, day) / DAY_MS);
};

const fromDayNumber = (day: number) => new Date(day * DAY_MS).toISOString().slice(0, 10);

const daysInMonth = (year: number, monthIndex: number) => new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();

// year, monthIndex(0~11)의 day일. 그 달에 없는 날이면 말일.
const clampedDay = (year: number, monthIndex: number, day: number) =>
    Math.round(Date.UTC(year, monthIndex, Math.min(day, daysInMonth(year, monthIndex))) / DAY_MS);

const getFixedPeriodLength = (settings: PayPeriodSettings) => {
    switch (settings.payFrequency) {
        case "weekly":
            return 7;

        case "biweekly":
            return 14;

        case "custom": {
            const days = Math.floor(Number(settings.customPayDays));

            return days > 0 ? days : 14;
        }

        default:
            return null;
    }
};

// date(YYYY-MM-DD)가 속한 급여 기간의 시작일·종료일. 기준일이 필요한데 없으면 null.
const getPayPeriodBounds = (settings: PayPeriodSettings, date: string): { startDate: string; endDate: string } | null => {
    const day = toDayNumber(date);

    if (day === null) {
        return null;
    }

    const anchorDay = settings.payPeriodStartDate ? toDayNumber(settings.payPeriodStartDate) : null;
    const fixedLength = getFixedPeriodLength(settings);

    // 매주 · 격주 · 직접 설정: 기준 시작일에서 일정한 일수마다
    if (fixedLength !== null) {
        if (anchorDay === null) {
            return null;
        }

        const index = Math.floor((day - anchorDay) / fixedLength);
        const start = anchorDay + index * fixedLength;

        return { startDate: fromDayNumber(start), endDate: fromDayNumber(start + fixedLength - 1) };
    }

    const [year, month] = [Number(date.slice(0, 4)), Number(date.slice(5, 7)) - 1];

    if (settings.payFrequency === "monthly") {
        // 기준 시작일의 '일'로 매달 시작. 기준이 없으면 달력 한 달(1일 ~ 말일).
        const startDayOfMonth = anchorDay === null ? 1 : Number(fromDayNumber(anchorDay).slice(8, 10));

        let start = clampedDay(year, month, startDayOfMonth);
        let startYear = year;
        let startMonth = month;

        if (start > day) {
            startMonth = month - 1;

            if (startMonth < 0) {
                startMonth = 11;
                startYear = year - 1;
            }

            start = clampedDay(startYear, startMonth, startDayOfMonth);
        }

        const nextStart = clampedDay(startYear, startMonth + 1, startDayOfMonth);

        return { startDate: fromDayNumber(start), endDate: fromDayNumber(nextStart - 1) };
    }

    if (settings.payFrequency === "semi-monthly") {
        const dayOfMonth = Number(date.slice(8, 10));

        if (settings.semiMonthlyType === "fifteenth-end") {
            // 16일 ~ 다음 달 15일
            const startMonth = dayOfMonth >= 16 ? month : month - 1;
            const start = clampedDay(year, startMonth, 16);
            const end = clampedDay(year, startMonth + 1, 15);

            return { startDate: fromDayNumber(start), endDate: fromDayNumber(end) };
        }

        // 1일 ~ 15일, 16일 ~ 말일
        if (dayOfMonth <= 15) {
            return { startDate: fromDayNumber(clampedDay(year, month, 1)), endDate: fromDayNumber(clampedDay(year, month, 15)) };
        }

        return {
            startDate: fromDayNumber(clampedDay(year, month, 16)),
            endDate: fromDayNumber(clampedDay(year, month, 31)),
        };
    }

    return null;
};

// 급여일 = 급여 기간 종료일 + 이 값(일). 저장된 값이 없으면 기준 급여일에서 계산하고, 그것도 없으면 종료일 당일.
export const getPayDateOffset = (settings: PayPeriodSettings) => {
    if (settings.payDateOffset !== null && settings.payDateOffset !== undefined && Number.isFinite(Number(settings.payDateOffset))) {
        return Number(settings.payDateOffset);
    }

    if (settings.payDate && settings.payPeriodStartDate) {
        const anchorBounds = getPayPeriodBounds(settings, settings.payPeriodStartDate);
        const anchorEnd = anchorBounds ? toDayNumber(anchorBounds.endDate) : null;
        const payDay = toDayNumber(settings.payDate);

        if (anchorEnd !== null && payDay !== null) {
            return payDay - anchorEnd;
        }
    }

    return 0;
};

// date가 속한 급여 기간(급여일 포함). 기간을 계산할 수 없으면 null.
export const getPayPeriodAt = (settings: PayPeriodSettings, date: string): PayPeriod | null => {
    const bounds = getPayPeriodBounds(settings, date);
    const endDay = bounds ? toDayNumber(bounds.endDate) : null;

    if (!bounds || endDay === null) {
        return null;
    }

    return { ...bounds, payDate: fromDayNumber(endDay + getPayDateOffset(settings)) };
};

// 바로 다음(1) 또는 바로 이전(-1) 급여 기간
export const getAdjacentPayPeriod = (settings: PayPeriodSettings, period: PayPeriod, direction: 1 | -1): PayPeriod | null => {
    const base = toDayNumber(direction === 1 ? period.endDate : period.startDate);

    return base === null ? null : getPayPeriodAt(settings, fromDayNumber(base + direction));
};

// 오늘 기준 지난·현재·다음 급여 기간
export const getSurroundingPayPeriods = (settings: PayPeriodSettings, today: string = formatDate(new Date())) => {
    const current = getPayPeriodAt(settings, today);

    if (!current) {
        return null;
    }

    return {
        previous: getAdjacentPayPeriod(settings, current, -1),
        current,
        next: getAdjacentPayPeriod(settings, current, 1),
    };
};

// 이미 끝난 급여 기간을 최근 순으로 count개
export const getEndedPayPeriods = (settings: PayPeriodSettings, count: number, today: string = formatDate(new Date())) => {
    const surrounding = getSurroundingPayPeriods(settings, today);
    const periods: PayPeriod[] = [];

    let cursor = surrounding?.previous ?? null;

    while (cursor && periods.length < count) {
        periods.push(cursor);
        cursor = getAdjacentPayPeriod(settings, cursor, -1);
    }

    return periods;
};
