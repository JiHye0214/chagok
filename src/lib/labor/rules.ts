// lib/labor/rules.ts
import { getCanadaLaborRule } from "@/lib/labor/ca";
import { KOREA_HOLIDAY_RULE } from "@/lib/labor/kr";

export type PublicHolidayPayInput = {
    hourlyWage: number;
    // 캐나다(ON): 공휴일 직전 4주 임금과 그 기간 베케이션 페이
    regularWagesBeforeHoliday: number;
    vacationPayBeforeHoliday: number;
    // 한국: 하루 소정근로시간
    scheduledHoursPerDay: number;
};

// 나라마다 필요한 값이 달라서, 각 규칙은 위 입력 중 자기가 쓰는 값만 꺼내 쓴다
export type HolidayLaborRule = {
    calculatePremiumPay: (input: { hourlyWage: number; hours: number }) => number;
    calculatePublicHolidayPay: (input: PublicHolidayPayInput) => number;
};

export const getHolidayLaborRule = (country: string, region?: string): HolidayLaborRule | undefined => {
    switch (country) {
        case "CA":
            return getCanadaLaborRule(region);

        case "KR":
            return KOREA_HOLIDAY_RULE;

        default:
            return undefined;
    }
};

/*
 * 사용자가 설정하지 않았을 때의 공휴일 수당 방식.
 * - CA: 법정 기준(full)
 * - KR: 현재 지원하는 3.3% 사업소득은 법정 가산 대상이 아닐 수 있어 none. 근로자라면 사용자가 직접 선택.
 */
export const getDefaultHolidayPayMode = (country: string): "full" | "worked-only" | "none" => (country === "KR" ? "none" : "full");
