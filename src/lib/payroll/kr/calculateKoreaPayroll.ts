// lib/payroll/kr/calculateKoreaPayroll.ts
import type { KoreaPayrollInput, PayrollResult } from "@/lib/payroll/types";

import { calculateFreelanceDeductions } from "@/lib/tax/kr/freelance";

/*
 * 한국 급여 계산: 현재는 프리랜서(사업소득) 3.3% 원천징수만 지원.
 * 한국은 급여 주기와 상관없이 지급액 기준이라 payFrequency, payPeriod는 사용하지 않음.
 * TODO: 직장인(근로소득) 4대보험 + 간이세액표는 별도 규칙으로 추가
 */
export const calculateKoreaPayroll = ({ grossPay }: KoreaPayrollInput): PayrollResult => {
    const deductions = calculateFreelanceDeductions(grossPay);

    const totalDeductions = deductions.reduce((total, deduction) => total + deduction.amount, 0);

    return {
        deductions,
        totalDeductions,
    };
};
