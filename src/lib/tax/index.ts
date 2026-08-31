import { calculateCanadaTaxes } from "./ca";

export const calculateTaxes = ({
    country,
    province,
    annualGross,
}: {
    country: string;
    province: string;
    annualGross: number;
}) => {
    switch (country) {
        case "CA":
            return calculateCanadaTaxes(
                annualGross,
                province
            );

        default:
            return {
                cpp: 0,
                cpp2: 0,
                ei: 0,
                federalTax: 0,
                provincialTax: 0,
                provinceName: province,
                totalDeductions: 0,
            };
    }
};