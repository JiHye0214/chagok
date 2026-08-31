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
};

type HolidayPayInput = {
    date: string;
    hourlyWage: number;
    hours: number;

    province: string;

    holidays: Holiday[];

    // Public Holiday Pay 계산에 필요한 값
    regularWagesBeforeHoliday?: number;
    vacationPayBeforeHoliday?: number;
};

/**
 * 특정 날짜가 공휴일인지 확인
 */
export function isHoliday(
    date: string,
    holidays: Holiday[],
): Holiday | null {
    return (
        holidays.find(
            (holiday) => holiday.date === date,
        ) ?? null
    );
}

/**
 * 특정 급여기간에 포함되는 공휴일을 가져온다.
 */
export function getHolidaysInPayPeriod(
    startDate: string,
    endDate: string,
    holidays: Holiday[],
): Holiday[] {
    return holidays.filter(
        (holiday) =>
            holiday.date >= startDate &&
            holiday.date <= endDate,
    );
}

/**
 * 특정 급여기간에 공휴일이 있는지 확인
 */
export function hasHolidayInPayPeriod(
    startDate: string,
    endDate: string,
    holidays: Holiday[],
): boolean {
    return (
        getHolidaysInPayPeriod(
            startDate,
            endDate,
            holidays,
        ).length > 0
    );
}

/**
 * 특정 급여기간의 첫 번째 공휴일
 */
export function getFirstHolidayInPayPeriod(
    startDate: string,
    endDate: string,
    holidays: Holiday[],
): Holiday | null {
    return (
        getHolidaysInPayPeriod(
            startDate,
            endDate,
            holidays,
        )[0] ?? null
    );
}

/**
 * 공휴일 급여 계산
 *
 * province를 호출하는 쪽에서 전달받는다.
 *
 * 예:
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
    province,
    holidays,
    regularWagesBeforeHoliday = 0,
    vacationPayBeforeHoliday = 0,
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

    /*
     * ----------------------------------------
     * Premium Pay
     * ----------------------------------------
     *
     * 현재는 Ontario를 기준으로 계산.
     *
     * Regular wage의 50%가 추가된다.
     *
     * $20 × 8시간 = $160
     * Premium = $160 × 50% = $80
     */
    let premiumPay = 0;

    if (province === "ON") {
        premiumPay = hourlyWage * hours * 0.5;
    }

    /*
     * ----------------------------------------
     * Public Holiday Pay
     * ----------------------------------------
     *
     * Ontario:
     *
     * (공휴일 직전 4주간 regular wages
     *  + vacation pay)
     * ÷ 20
     *
     * 여기서는 필요한 값을 호출하는 쪽에서
     * 전달받도록 한다.
     */
    let publicHolidayPay = 0;

    if (province === "ON") {
        publicHolidayPay =
            (regularWagesBeforeHoliday +
                vacationPayBeforeHoliday) /
            20;
    }

    return {
        isHoliday: true,
        holiday,
        premiumPay,
        publicHolidayPay,
    };
}