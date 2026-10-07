/*
 * 캐나다 주별 노동 규칙 (베케이션 페이, 공휴일 수당).
 * 세금 계산과는 무관: 여기서 나온 금액은 그냥 "추가 급여"로 grossPay에 더해진다.
 *
 * 새 주를 추가할 때는 아래 표에 해당 주 항목을 추가한다.
 * 규칙이 없는 주는 계산에서 제외되고 경고가 표시된다.
 */

export type CanadaLaborRule = {
    // 매 급여에 얹어 받는 베케이션 페이의 기본 비율 (UI 기본값용)
    defaultVacationPayRate: number;

    // 공휴일에 일한 시간에 추가로 붙는 금액 (정규 시급 분은 기본급에 이미 포함)
    calculatePremiumPay: (input: { hourlyWage: number; hours: number }) => number;

    // 공휴일 당일 일을 했든 안 했든 받는 Public Holiday Pay
    calculatePublicHolidayPay: (input: { regularWagesBeforeHoliday: number; vacationPayBeforeHoliday: number }) => number;
};

export const CANADA_LABOR_RULES: Record<string, CanadaLaborRule> = {
    ON: {
        // 근속 5년 미만 4%, 5년 이상 6%
        defaultVacationPayRate: 0.04,

        // 공휴일 근무 시 정규 시급의 1.5배 → 정규분(기본급에 포함) 외 추가 50%
        calculatePremiumPay: ({ hourlyWage, hours }) => hourlyWage * hours * 0.5,

        // (공휴일 직전 4주 regular wages + 그 기간 vacation pay) ÷ 20
        calculatePublicHolidayPay: ({ regularWagesBeforeHoliday, vacationPayBeforeHoliday }) =>
            (regularWagesBeforeHoliday + vacationPayBeforeHoliday) / 20,
    },
};

export const getCanadaLaborRule = (province?: string) => (province ? CANADA_LABOR_RULES[province] : undefined);

export const getDefaultVacationPayRate = (province?: string) => getCanadaLaborRule(province)?.defaultVacationPayRate ?? 0;
