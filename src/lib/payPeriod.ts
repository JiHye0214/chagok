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
            // TODO: fifteenth-end에서 16일 시작이 다음 달 15일로 끝남(약 30일). 의도 확인 필요.
            if (semiMonthlyType === "first-fifteenth") {
                if (date.getDate() <= 15) {
                    date.setDate(15);
                } else {
                    date.setMonth(date.getMonth() + 1);
                    date.setDate(0);
                }
            } else {
                if (date.getDate() <= 15) {
                    date.setDate(15);
                } else {
                    date.setMonth(date.getMonth() + 1);
                    date.setDate(15);
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

export const getPeriodsPerYear = (frequency: PayFrequency, customPayDays?: number) => {
    switch (frequency) {
        case "weekly":
            return 52;

        case "biweekly":
            return 26;

        case "semi-monthly":
            return 24;

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
