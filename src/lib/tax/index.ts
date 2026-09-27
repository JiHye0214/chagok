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

export const calculateTaxes = ({ country, annualGross }: { country: string; annualGross: number }): TaxCalculationResult => {
    switch (country) {
        case "CA":
            return calculateCanadaTaxes(annualGross);

        case "KR":
            return calculateKoreaTaxes(annualGross);

        default:
            return {
                deductions: [],
                totalDeductions: 0,
            };
    }
};
