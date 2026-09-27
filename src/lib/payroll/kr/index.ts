import type { PayrollDeduction, PayrollPayPeriod, PayrollResult } from "@/lib/payroll";
import type { PayFrequency } from "@/lib/payPeriod";

type KoreaPayrollInput = {
    grossPay: number;
    payFrequency: PayFrequency;
    payPeriod: PayrollPayPeriod;
};

export const calculateKoreaPayroll = ({ grossPay, payFrequency, payPeriod }: KoreaPayrollInput): PayrollResult => {
    // 한국 세금 계산은 다음 단계에서 구현
    // 지금은 구조만 연결

    void grossPay;
    void payFrequency;
    void payPeriod;

    const deductions: PayrollDeduction[] = [];

    return {
        deductions,
        totalDeductions: 0,
    };
};
