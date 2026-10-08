// lib/payroll/types.ts
import type { PayFrequency, PayPeriod, SemiMonthlyType } from "@/lib/payPeriod";

export type PayrollDeduction = {
    key: string;
    name: string;
    amount: number;
};

export type PayrollResult = {
    deductions: PayrollDeduction[];
    totalDeductions: number;
    // 계산에서 제외했거나 추정한 항목 안내 (예: 미지원 주). UI에서 "예상 금액" 근처에 표시.
    warnings?: string[];
};

export type PayrollYtd = {
    grossPay: number;
    cpp: number;
    cpp2: number;
    ei: number;
};

export type PayrollInput = {
    grossPay: number;
    payFrequency: PayFrequency;
    // 급여 주기가 semi-monthly일 때의 규칙. 연간 지급 횟수(24회/12회) 계산에 필요
    semiMonthlyType?: SemiMonthlyType;
    payPeriod: PayPeriod;
};

export type CanadaPayrollInput = PayrollInput & {
    regionCode?: string;
    ytd?: PayrollYtd;
};

export type KoreaPayrollInput = PayrollInput;
