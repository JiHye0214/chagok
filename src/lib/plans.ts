// lib/plans.ts
// 요금제 표시용 설정. 가격·한도를 한 곳에서 관리한다. (화면에 보이는 숫자)
// ⚠️ 한도는 서버가 실제로 막는 값과 같아야 한다.
//   급여 기록·근무 기록: lib/api/plan.ts (FREE_LIMITS)
//   생활 기록: api/living/transactions, api/living/integrations (FREE_LIVING_TRANSACTION_LIMIT)
//   고정지출·여행·여행 경비: api 라우트와 화면의 상수
// 숫자를 바꿀 때는 위 파일들도 같이 바꿔야 한다.

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
    | "schedule-limit";

// 결제 기능이 열리면 true 로 바꾼다. (false 이면 "준비 중" 안내만 보여줌)
export const BILLING_ENABLED = false;

export const FREE_PLAN_LIMITS = {
    payHistory: 5,
    workSchedules: 100,
    livingTransactions: 300,
    fixedExpenses: 5,
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

export const UPGRADE_MESSAGES: Record<UpgradeReason, string> = {
    general: "Pro로 더 편하게 기록해 보세요.",
    "living-category": "생활 카테고리 관리는 Pro에서 사용할 수 있어요.",
    "living-limit": `무료 플랜에서는 생활 기록을 최대 ${FREE_PLAN_LIMITS.livingTransactions}개까지 저장할 수 있어요.`,
    "fixed-expense": `무료 플랜에서는 고정지출을 최대 ${FREE_PLAN_LIMITS.fixedExpenses}개까지 저장할 수 있어요.`,
    "trip-limit": `무료 플랜에서는 여행을 최대 ${FREE_PLAN_LIMITS.trips}개까지 저장할 수 있어요.`,
    "trip-expense-limit": `무료 플랜에서는 여행당 경비를 최대 ${FREE_PLAN_LIMITS.tripExpensesPerTrip}개까지 입력할 수 있어요.`,
    "trip-category": "여행 경비 카테고리 관리는 Pro에서 사용할 수 있어요.",
    "trip-stats": "여행 통계와 소비 분석은 Pro에서 확인할 수 있어요.",
    "pay-history-limit": `무료 플랜에서는 급여 기록을 최대 ${FREE_PLAN_LIMITS.payHistory}개까지 저장할 수 있어요.`,
    "schedule-limit": `무료 플랜에서는 근무 기록을 최대 ${FREE_PLAN_LIMITS.workSchedules}개까지 저장할 수 있어요.`,
};

// 요금제 비교표 (free / pro 값)
export const PLAN_COMPARISON: { label: string; free: string; pro: string }[] = [
    { label: "급여 기록", free: `${FREE_PLAN_LIMITS.payHistory}개`, pro: "무제한" },
    { label: "근무 기록", free: `${FREE_PLAN_LIMITS.workSchedules}개`, pro: "무제한" },
    { label: "생활 기록", free: `${FREE_PLAN_LIMITS.livingTransactions}개`, pro: "무제한" },
    { label: "고정지출", free: `${FREE_PLAN_LIMITS.fixedExpenses}개`, pro: "무제한" },
    { label: "여행", free: `${FREE_PLAN_LIMITS.trips}개`, pro: "무제한" },
    { label: "생활·여행 카테고리 관리", free: "—", pro: "가능" },
    { label: "여행 통계·소비 분석", free: "—", pro: "가능" },
];
