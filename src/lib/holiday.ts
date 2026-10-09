// lib/holiday.ts
import { getHolidayLaborRule } from "@/lib/labor/rules";

export type Holiday = {
    date: string;
    name: string;
    global: boolean;
};

export type HolidayPayResult = {
    isHoliday: boolean;
    holiday: Holiday | null;

    // 공휴일에 실제 근무했을 때 추가되는 Premium Pay
    premiumPay: number;

    // 공휴일 자체로 발생하는 Public Holiday Pay
    publicHolidayPay: number;

    // 지원하지 않는 주 등, 계산에서 제외한 항목 안내
    warnings?: string[];
};

type HolidayPayInput = {
    date: string;
    hourlyWage: number;
    hours: number;

    // 기본값 "CA". 캐나다는 province(ON 등), 한국은 "KR"
    country?: string;
    province: string;

    holidays: Holiday[];

    // Public Holiday Pay 계산에 필요한 값 (나라별로 필요한 값만 사용됨)
    regularWagesBeforeHoliday?: number;
    vacationPayBeforeHoliday?: number;
    scheduledHoursPerDay?: number;
};

/*
 * 회사가 공휴일 수당을 주는 방식
 * - full: 공휴일 수당(Public Holiday Pay) + 일했을 때 프리미엄  (법정 기준 / 기본값)
 * - worked-only: 일한 경우에만 프리미엄(추가 50%), 쉬면 없음
 * - none: 공휴일이라고 더 주는 것 없음
 */
export type HolidayPayMode = "full" | "worked-only" | "none";

const round2 = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;

/**
 * 특정 날짜가 공휴일인지 확인
 */
export function isHoliday(date: string, holidays: Holiday[]): Holiday | null {
    return holidays.find((holiday) => holiday.date === date) ?? null;
}

/**
 * 특정 급여기간에 포함되는 공휴일을 가져온다.
 */
export function getHolidaysInPayPeriod(startDate: string, endDate: string, holidays: Holiday[]): Holiday[] {
    return holidays.filter((holiday) => holiday.date >= startDate && holiday.date <= endDate);
}

/**
 * 특정 급여기간에 공휴일이 있는지 확인
 */
export function hasHolidayInPayPeriod(startDate: string, endDate: string, holidays: Holiday[]): boolean {
    return getHolidaysInPayPeriod(startDate, endDate, holidays).length > 0;
}

/**
 * 특정 급여기간의 첫 번째 공휴일
 */
export function getFirstHolidayInPayPeriod(startDate: string, endDate: string, holidays: Holiday[]): Holiday | null {
    return getHolidaysInPayPeriod(startDate, endDate, holidays)[0] ?? null;
}

/**
 * 공휴일 하루의 급여 계산 (주별 규칙은 labor/ca.ts의 표를 사용)
 *
 * calculateHolidayPay({
 *     province: "ON",
 *     date: "2026-09-07",
 *     hourlyWage: 20,
 *     hours: 8,
 *     holidays,
 * });
 */
export function calculateHolidayPay({
    date,
    hourlyWage,
    hours,
    country = "CA",
    province,
    holidays,
    regularWagesBeforeHoliday = 0,
    vacationPayBeforeHoliday = 0,
    scheduledHoursPerDay = 8,
}: HolidayPayInput): HolidayPayResult {
    const holiday = isHoliday(date, holidays);

    if (!holiday) {
        return {
            isHoliday: false,
            holiday: null,
            premiumPay: 0,
            publicHolidayPay: 0,
        };
    }

    const rule = getHolidayLaborRule(country, province);

    // 규칙이 없는 나라/주는 조용히 0원 처리하지 않고 경고를 남긴다
    if (!rule) {
        return {
            isHoliday: true,
            holiday,
            premiumPay: 0,
            publicHolidayPay: 0,
            warnings: [`${country === "CA" ? province || "지역 미선택" : country}의 공휴일 수당 규칙은 아직 지원하지 않아 계산에서 제외했어요.`],
        };
    }

    return {
        isHoliday: true,
        holiday,
        premiumPay: rule.calculatePremiumPay({ hourlyWage, hours }),
        publicHolidayPay: rule.calculatePublicHolidayPay({
            hourlyWage,
            regularWagesBeforeHoliday,
            vacationPayBeforeHoliday,
            scheduledHoursPerDay,
        }),
    };
}

/**
 * 급여기간 전체의 공휴일 수당 합계.
 *
 * regularWagesBeforeHoliday(직전 4주 급여)는 기록이 없을 때 호출하는 쪽에서 추정해서 넘긴다.
 * vacationPayRate는 매 급여에 얹어 받는 베케이션 페이 비율 (Public Holiday Pay 계산에 포함됨).
 */
export function calculatePeriodHolidayPay({
    country = "CA",
    province,
    hourlyWage,
    hourlyWageOn,
    startDate,
    endDate,
    hoursByDate,
    holidays,
    regularWagesBeforeHoliday,
    vacationPayRate = 0,
    scheduledHoursPerDay = 8,
    mode = "full",
}: {
    country?: string;
    province: string;
    hourlyWage: number;
    // 공휴일마다 그날의 시급을 돌려주는 함수. 없으면 hourlyWage 하나를 쓴다. (시급이 중간에 바뀐 경우)
    hourlyWageOn?: (date: string) => number;
    startDate: string;
    endDate: string;
    hoursByDate: Record<string, number>;
    holidays: Holiday[];
    regularWagesBeforeHoliday: number;
    vacationPayRate?: number;
    scheduledHoursPerDay?: number;
    mode?: HolidayPayMode;
}) {
    if (mode === "none") {
        return { premiumPay: 0, publicHolidayPay: 0, warnings: [] as string[] };
    }

    let premiumPay = 0;
    let publicHolidayPay = 0;
    const warnings = new Set<string>();

    for (const holiday of getHolidaysInPayPeriod(startDate, endDate, holidays)) {
        const result = calculateHolidayPay({
            date: holiday.date,
            hourlyWage: hourlyWageOn ? hourlyWageOn(holiday.date) : hourlyWage,
            hours: hoursByDate[holiday.date] ?? 0,
            country,
            province,
            holidays,
            regularWagesBeforeHoliday,
            vacationPayBeforeHoliday: regularWagesBeforeHoliday * vacationPayRate,
            scheduledHoursPerDay,
        });

        premiumPay += result.premiumPay;

        // 일한 경우에만 주는 회사는 공휴일 자체 수당을 더하지 않음
        if (mode === "full") {
            publicHolidayPay += result.publicHolidayPay;
        }
        result.warnings?.forEach((warning) => warnings.add(warning));
    }

    return {
        premiumPay: round2(premiumPay),
        publicHolidayPay: round2(publicHolidayPay),
        warnings: [...warnings],
    };
}
