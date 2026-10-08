// lib/salary/dayPay.ts
// 달력의 하루 예상 급여. 공휴일 가산은 급여 계산 엔진과 같은 규칙(labor/)을 쓴다.
// (화면에서 "공휴일이면 50% 추가"를 직접 계산하던 것은 온타리오 규칙이라 한국·"공휴일 수당 없음" 설정에서 틀렸음)
import type { HolidayPayMode } from "@/lib/holiday";
import { getDefaultHolidayPayMode, getHolidayLaborRule } from "@/lib/labor/rules";

type DayPayContext = {
    country: string | null;
    region: string | null;
    // 사용자가 고른 공휴일 수당 방식. 없으면 나라별 기본값
    mode?: HolidayPayMode | null;
};

// 이 나라·설정에서 공휴일에 일하면 가산이 붙는지
export const hasHolidayPremium = ({ country, region, mode }: DayPayContext) => {
    if (!country) {
        return false;
    }

    const code = country.toUpperCase();
    const resolvedMode = mode ?? getDefaultHolidayPayMode(code);

    return resolvedMode !== "none" && Boolean(getHolidayLaborRule(code, region ?? undefined));
};

export const estimateDayPay = ({
    hours,
    hourlyWage,
    isHoliday,
    ...context
}: DayPayContext & { hours: number; hourlyWage: number; isHoliday: boolean }) => {
    const basePay = hours * hourlyWage;

    if (!isHoliday || !hasHolidayPremium(context)) {
        return basePay;
    }

    const rule = getHolidayLaborRule(context.country!.toUpperCase(), context.region ?? undefined);

    return basePay + (rule?.calculatePremiumPay({ hourlyWage, hours }) ?? 0);
};
