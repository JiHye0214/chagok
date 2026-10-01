import { calculateCanadaTaxes } from "./ca";

export type TaxDeduction = {
    key: string;
    name: string;
    amount: number;
};

export type TaxCalculationResult = {
    deductions: TaxDeduction[];
    totalDeductions: number;
};

export const calculateTaxes = ({
    country,
    annualGross,
    province = "ON",
}: {
    country: string;
    annualGross: number;
    province?: string;
}): TaxCalculationResult => {
    switch (country) {
        case "CA": {
            const result = calculateCanadaTaxes({
                annualIncome: annualGross,
                province,
            });

            const deductions: TaxDeduction[] = [
                {
                    key: "federal-income-tax",
                    name: "Federal Income Tax",
                    amount: result.federalTax,
                },
                ...(province === "ON"
                    ? [
                          {
                              key: "ontario-income-tax",
                              name: "Ontario Income Tax",
                              amount: result.provincialTax,
                          },
                      ]
                    : []),
            ].filter((deduction) => deduction.amount > 0);

            const totalDeductions = deductions.reduce((total, deduction) => total + deduction.amount, 0);

            return {
                deductions,
                totalDeductions: Math.round(totalDeductions * 100) / 100,
            };
        }

        /*
         * Korea is intentionally left untouched
         * for the current Canada-first refactor.
         *
         * Add the existing Korea implementation back
         * here when the Korea tax module is reviewed.
         */
        case "KR":
            return {
                deductions: [],
                totalDeductions: 0,
            };

        default:
            return {
                deductions: [],
                totalDeductions: 0,
            };
    }
};
