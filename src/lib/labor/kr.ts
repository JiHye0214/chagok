// lib/labor/kr.ts
/*
 * 한국 공휴일 관련 노동 규칙 (시급제 기준).
 *
 * - 휴일근로 가산: 8시간 이내 50%, 8시간 초과분 100% 가산 (정규 시급 분은 기본급에 이미 포함이라 가산분만 계산)
 * - 유급휴일 임금: 공휴일에 일하지 않아도 하루 소정근로시간분 임금 (일하면 가산과 별도로 추가)
 *
 * 주의:
 * - 상시 5인 미만 사업장은 휴일 가산·유급 공휴일 적용 대상이 아니므로 사용자가 "none"을 고르게 해야 함.
 * - 3.3% 사업소득(프리랜서)은 근로기준법상 근로자가 아니면 법적 의무가 아님. 그래서 한국 기본값은 "none".
 * - 연장·야간 가산, 소정근로일이 아닌 공휴일 처리 등은 아직 반영하지 않음.
 */

export const KOREA_HOLIDAY_RULE = {
    calculatePremiumPay: ({ hourlyWage, hours }: { hourlyWage: number; hours: number }) => {
        const withinEight = Math.min(Math.max(0, hours), 8);
        const overEight = Math.max(0, hours - 8);

        return hourlyWage * (withinEight * 0.5 + overEight * 1.0);
    },

    calculatePublicHolidayPay: ({ hourlyWage, scheduledHoursPerDay }: { hourlyWage: number; scheduledHoursPerDay: number }) =>
        hourlyWage * scheduledHoursPerDay,
};
