// lib/api/mappers.ts
// DB 행(snake_case) → 화면에 내려주는 모양(camelCase). 같은 변환을 라우트마다 복사하지 않도록 한 곳에 모음.
// neon은 numeric을 문자열로 돌려주므로 여기서 숫자로 바꾼다.

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = Record<string, any>;

const toNumber = (value: unknown) => Number(value) || 0;
const toNullableNumber = (value: unknown) => (value === null || value === undefined ? null : Number(value));

// 값이 없는 숫자는 null이 아니라 생략(undefined)해서 내려준다. (화면이 `!== undefined`로 비어 있는지 판단함)
const toOptionalNumber = (value: unknown) => (value === null || value === undefined ? undefined : Number(value));

export const toSalarySettingsDto = (row: Row, hourlyWageHistory: { effectiveDate: string; hourlyWage: number }[] = []) => ({
    // 국가·통화는 프로필(/api/user/profile)이 기준이라 여기서는 내려주지 않는다.
    employmentType: (row.employment_type as string | null) ?? null,
    countryOptions: (row.country_options as Record<string, unknown> | null) ?? {},
    payType: row.pay_type as string,
    payFrequency: row.pay_frequency as string,
    hourlyWage: toOptionalNumber(row.hourly_wage),
    // 시급이 바뀐 날짜별 이력 (오래된 것 먼저). hourlyWage 는 오늘 적용되는 시급.
    hourlyWageHistory,
    monthlySalary: toOptionalNumber(row.monthly_salary),
    hasTips: Boolean(row.has_tips),
    tipType: (row.tip_type as string | null) ?? null,
    payPeriodStartDate: (row.pay_period_start_date as string | null) ?? null,
    payDate: (row.pay_date as string | null) ?? null,
    payDateOffset: toNullableNumber(row.pay_date_offset),
    semiMonthlyType: (row.semi_monthly_type as string | null) ?? null,
    customPayDays: toNullableNumber(row.custom_pay_days),
});

export const toWorkScheduleDto = (row: Row) => ({
    id: Number(row.id),
    date: String(row.date_text),
    startTime: String(row.start_text),
    endTime: String(row.end_text),
    hasBreak: Boolean(row.has_break),
    breakMinutes: toNumber(row.break_minutes),
    alarmEnabled: Boolean(row.alarm_enabled),
    alarmMinutesBefore: toNumber(row.alarm_minutes_before),
});

export const toPayPeriodTipsDto = (row: Row) => ({
    id: Number(row.id),
    payPeriodStart: String(row.start_text),
    payPeriodEnd: String(row.end_text),
    cashTips: toNumber(row.cash_tips),
    paychequeTips: toNumber(row.paycheque_tips),
});

export const toPayHistoryDto = (row: Row) => {
    const actualNetPay = toNumber(row.actual_net_pay);
    const cashTips = toNumber(row.actual_cash_tips);

    return {
        id: Number(row.id),
        startDate: String(row.start_date),
        endDate: String(row.end_date),
        payDate: row.pay_date ? String(row.pay_date) : null,

        hours: toNumber(row.actual_hours),

        // 아래 중복 필드(pay/actualPay 등)는 기존 화면과의 호환용. 화면을 정리할 때 하나로 줄이면 됨.
        pay: toNumber(row.actual_pay),
        actualPay: toNumber(row.actual_pay),
        tips: toNumber(row.actual_tips),
        actualTips: toNumber(row.actual_tips),
        cashTips,
        paychequeTips: toNumber(row.actual_paycheque_tips),
        deductions: toNumber(row.actual_deductions),
        actualDeductions: toNumber(row.actual_deductions),
        adjustments: Array.isArray(row.adjustments) ? row.adjustments : [],
        netPay: actualNetPay,
        actualNetPay,
        totalIncome: actualNetPay + cashTips,
        calculatedNetPay: actualNetPay,

        // 새 필드
        currencyCode: (row.currency_code as string | null) ?? null,
        earningLines: Array.isArray(row.earning_lines) ? row.earning_lines : [],
        deductionLines: Array.isArray(row.deduction_lines) ? row.deduction_lines : [],
        estimateSnapshot: (row.estimate_snapshot as Record<string, unknown> | null) ?? null,

        createdAt: row.created_at,
        updatedAt: row.updated_at,
    };
};
