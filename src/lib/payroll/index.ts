import { calculateCanadaPayroll } from "./ca";
import { calculateKoreaPayroll } from "./kr";

import type { PayrollInput, PayrollResult } from "./types";

export type { PayrollDeduction, PayrollResult, PayrollYtd, PayrollInput, CanadaPayrollInput, KoreaPayrollInput } from "./types";

export const calculatePayroll = ({
    country,
    regionCode,
    grossPay,
    payFrequency,
    payPeriod,
    ytd,
}: PayrollInput & {
    country: string;
    regionCode?: string;
    ytd?: {
        grossPay: number;
        cpp: number;
        cpp2: number;
        ei: number;
    };
}): PayrollResult => {
    switch (country) {
        case "CA":
            return calculateCanadaPayroll({
                grossPay,
                regionCode,
                payFrequency,
                payPeriod,
                ytd,
            });

        case "KR":
            return calculateKoreaPayroll({
                grossPay,
                payFrequency,
                payPeriod,
            });

        default:
            return {
                deductions: [],
                totalDeductions: 0,
            };
    }
};
