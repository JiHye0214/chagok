// lib/salary/types.ts
// 화면(클라이언트)이 서버 API에서 받는 데이터의 모양.
import type { ExpectedSalaryResult, ExpectedSalarySettings } from "@/lib/payroll/calculateExpectedSalary";
import type { CountryOptions } from "@/lib/payroll/countryOptions";
import type { SemiMonthlyType } from "@/lib/payPeriod";
import type { HourlyWageEntry } from "@/lib/salary/wage";
import type { PayFrequency } from "@/lib/payPeriod";

// /api/user/profile 응답 중 급여 계산에 쓰는 부분. 국가·지역·통화는 항상 프로필이 기준이다.
export type SalaryProfile = {
    countryCode: string | null;
    provinceCode: string | null;
    currency: string | null;
};

// /api/salary/salary-settings 응답
export type SalarySettingsData = {
    payType: ExpectedSalarySettings["payType"];
    payFrequency: PayFrequency;
    hasTips: boolean;
    tipType?: ExpectedSalarySettings["tipType"] | null;
    // 오늘 적용되는 시급
    hourlyWage?: number;
    // 시급이 바뀐 날짜별 이력 (오래된 것 먼저). 근무일마다 그날 시급으로 계산하는 데 쓴다.
    hourlyWageHistory?: HourlyWageEntry[];
    monthlySalary?: number;
    payPeriodStartDate?: string | null;
    payDate?: string | null;
    payDateOffset?: number | null;
    semiMonthlyType?: SemiMonthlyType | null;
    customPayDays?: number | null;
    employmentType?: string | null;
    // 베케이션 비율(분수 0.04 = 4%), 공휴일 수당 방식 등 나라별 설정
    countryOptions?: CountryOptions;
};

// /api/salary/work-schedules 응답
export type WorkScheduleData = {
    id: number;
    date: string;
    startTime: string;
    endTime: string;
    hasBreak: boolean;
    breakMinutes: number;
    alarmEnabled: boolean;
    alarmMinutesBefore: number;
};

// /api/salary/pay-period-tips 응답
export type PeriodTipsData = {
    id?: number;
    payPeriodStart: string;
    payPeriodEnd: string;
    cashTips: number;
    paychequeTips: number;
};

export type PayPeriodData = {
    startDate: string;
    endDate: string;
    payDate: string;
};

export type HolidayData = {
    date: string;
    name: string;
    global: boolean;
};

export type PeriodEstimateStatus = "ok" | "no-profile" | "no-settings" | "unsupported-country";

export type PeriodEstimateOutcome =
    | { status: "ok"; estimate: ExpectedSalaryResult; currency: string | null; countryOptions: CountryOptions }
    | { status: Exclude<PeriodEstimateStatus, "ok"> };
