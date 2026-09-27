import type { PayFrequency, PayPeriod } from "@/lib/payPeriod";

export type PayrollDeduction = {
    key: string;
    name: string;
    amount: number;
};

export type PayrollResult = {
    deductions: PayrollDeduction[];
    totalDeductions: number;
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
    payPeriod: PayPeriod;
};

export type CanadaPayrollInput = PayrollInput & {
    regionCode?: string;
    ytd?: PayrollYtd;
};

export type KoreaPayrollInput = PayrollInput;
