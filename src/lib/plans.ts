// lib/plans.ts
// 요금제 표시용 설정. 가격·한도를 한 곳에서 관리한다. (화면에 보이는 숫자)
// ⚠️ 한도는 서버가 실제로 막는 값과 같아야 한다.
//   급여 기록·근무 기록: lib/api/plan.ts (FREE_LIMITS)
//   생활 기록: api/living/transactions, api/living/integrations (FREE_LIVING_TRANSACTION_LIMIT)
//   고정지출·여행·여행 경비: api 라우트와 화면의 상수
// 숫자를 바꿀 때는 위 파일들도 같이 바꿔야 한다.

import type { MessageKey } from "@/lib/i18n";

export type PlanCode = "free" | "pro";

export type UpgradeReason =
    | "general"
    | "living-category"
    | "living-limit"
    | "fixed-expense"
    | "trip-limit"
    | "trip-expense-limit"
    | "trip-category"
    | "trip-stats"
    | "pay-history-limit"
    | "schedule-limit"
    | "multi-shift";

// 결제 기능이 열리면 true 로 바꾼다. (false 이면 "준비 중" 안내만 보여줌)
export const BILLING_ENABLED = false;

export const FREE_PLAN_LIMITS = {
    payHistory: 5,
    workSchedules: 100,
    livingTransactions: 300,
    fixedExpenses: 0,
    trips: 3,
    tripExpensesPerTrip: 30,
} as const;

export type PlanPrice = { currency: string; monthly: number; yearly: number };

// 통화별 가격. 환율로 환산하지 않고 나라별 체감 가격으로 따로 정한다.
export const PLAN_PRICES: PlanPrice[] = [
    { currency: "CAD", monthly: 3.99, yearly: 29.99 },
    { currency: "KRW", monthly: 3900, yearly: 29000 },
    { currency: "USD", monthly: 2.99, yearly: 21.99 },
];

export const getPlanPrice = (currency: string | null | undefined): PlanPrice =>
    PLAN_PRICES.find((price) => price.currency === currency) ?? PLAN_PRICES[0];

// 연간 결제가 월간 12번보다 몇 % 싼지
export const getYearlyDiscountPercent = (price: PlanPrice) =>
    Math.round((1 - price.yearly / (price.monthly * 12)) * 100);

// 요금제 안내 문구의 키와, 문구 안의 {count} 에 들어갈 한도 값.
// 실제 문장은 lib/i18n/messages 에 있고, 화면에서는 getUpgradeMessage 로 만든다.
const UPGRADE_MESSAGE_KEYS: Record<UpgradeReason, MessageKey> = {
    general: "plan.reason.general",
    "living-category": "plan.reason.livingCategory",
    "living-limit": "plan.reason.livingLimit",
    "fixed-expense": "plan.reason.fixedExpense",
    "trip-limit": "plan.reason.tripLimit",
    "trip-expense-limit": "plan.reason.tripExpenseLimit",
    "trip-category": "plan.reason.tripCategory",
    "trip-stats": "plan.reason.tripStats",
    "pay-history-limit": "plan.reason.payHistoryLimit",
    "schedule-limit": "plan.reason.scheduleLimit",
    "multi-shift": "plan.reason.multiShift",
};

const UPGRADE_MESSAGE_COUNTS: Partial<Record<UpgradeReason, number>> = {
    "living-limit": FREE_PLAN_LIMITS.livingTransactions,
    "trip-limit": FREE_PLAN_LIMITS.trips,
    "trip-expense-limit": FREE_PLAN_LIMITS.tripExpensesPerTrip,
    "pay-history-limit": FREE_PLAN_LIMITS.payHistory,
    "schedule-limit": FREE_PLAN_LIMITS.workSchedules,
};

type Translate = (key: MessageKey, params?: Record<string, string | number>) => string;

export const getUpgradeMessage = (reason: UpgradeReason, t: Translate) => {
    const count = UPGRADE_MESSAGE_COUNTS[reason];

    return t(UPGRADE_MESSAGE_KEYS[reason], count === undefined ? undefined : { count });
};

// 요금제 비교표. free: 숫자면 "N개", null 이면 사용 불가. pro: 무제한 또는 가능
export const PLAN_COMPARISON: {
    labelKey: MessageKey;
    free: number | null;
    pro: "unlimited" | "available";
}[] = [
    { labelKey: "plan.row.payHistory", free: FREE_PLAN_LIMITS.payHistory, pro: "unlimited" },
    { labelKey: "plan.row.workSchedules", free: FREE_PLAN_LIMITS.workSchedules, pro: "unlimited" },
    { labelKey: "plan.row.livingTransactions", free: FREE_PLAN_LIMITS.livingTransactions, pro: "unlimited" },
    { labelKey: "plan.row.fixedExpenses", free: FREE_PLAN_LIMITS.fixedExpenses || null, pro: "unlimited" },
    { labelKey: "plan.row.trips", free: FREE_PLAN_LIMITS.trips, pro: "unlimited" },
    { labelKey: "plan.row.categories", free: null, pro: "available" },
    { labelKey: "plan.row.tripStats", free: null, pro: "available" },
];
