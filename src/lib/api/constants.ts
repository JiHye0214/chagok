// lib/api/constants.ts
// 허용하는 값 목록. 타입과 어긋나면 컴파일 에러가 나도록 Record로 만들어 둠 (값을 추가하면 여기도 같이 고쳐야 함).
import type { PayFrequency, SemiMonthlyType } from "@/lib/payPeriod";
import type { ExpectedSalarySettings } from "@/lib/payroll/calculateExpectedSalary";

type PayType = ExpectedSalarySettings["payType"];
type TipType = NonNullable<ExpectedSalarySettings["tipType"]>;

const keysOf = <T extends string>(record: Record<T, true>) => Object.keys(record) as T[];

export const PAY_TYPES = keysOf<PayType>({ hourly: true, salary: true, commission: true, other: true });

export const PAY_FREQUENCIES = keysOf<PayFrequency>({
    weekly: true,
    biweekly: true,
    "semi-monthly": true,
    monthly: true,
    custom: true,
});

export const TIP_TYPES = keysOf<TipType>({ cash: true, paycheque: true, both: true });

export const SEMI_MONTHLY_TYPES = keysOf<SemiMonthlyType>({ "first-fifteenth": true, "fifteenth-end": true });

// employee: 직원(근로소득), freelance: 프리랜서(사업소득)
export const EMPLOYMENT_TYPES = ["employee", "freelance"] as const;
export type EmploymentType = (typeof EMPLOYMENT_TYPES)[number];
