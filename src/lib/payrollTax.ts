export type Province = "ON" | "BC" | "AB" | "SK" | "MB" | "QC";

export type PayFrequency =
    | "weekly"
    | "biweekly"
    | "semi-monthly"
    | "monthly"
    | "custom";

type TaxResult = {
    grossPay: number;
    federalTax: number;
    provincialTax: number;
    cpp: number;
    ei: number;
    totalDeductions: number;
    netPay: number;
};

const FEDERAL_BRACKETS = [
    { limit: 58523, rate: 0.14 },
    { limit: 117045, rate: 0.205 },
    { limit: 181440, rate: 0.26 },
    { limit: 258482, rate: 0.29 },
    { limit: Infinity, rate: 0.33 },
];

const ONTARIO_BRACKETS = [
    { limit: 53891, rate: 0.0505 },
    { limit: 107785, rate: 0.0915 },
    { limit: 150000, rate: 0.1116 },
    { limit: 220000, rate: 0.1216 },
    { limit: Infinity, rate: 0.1316 },
];

const calculateProgressiveTax = (
    annualIncome: number,
    brackets: { limit: number; rate: number }[],
) => {
    let tax = 0;
    let previousLimit = 0;

    for (const bracket of brackets) {
        const taxableInBracket = Math.min(
            Math.max(annualIncome - previousLimit, 0),
            bracket.limit - previousLimit,
        );

        tax += taxableInBracket * bracket.rate;

        if (annualIncome <= bracket.limit) {
            break;
        }

        previousLimit = bracket.limit;
    }

    return tax;
};

export const calculatePayrollTax = (
    grossPay: number,
    province: Province,
    payFrequency: PayFrequency,
): TaxResult => {
    const periodsPerYear =
        payFrequency === "weekly"
            ? 52
            : payFrequency === "biweekly"
              ? 26
              : payFrequency === "semi-monthly"
                ? 24
                : payFrequency === "monthly"
                  ? 12
                  : 26;

    const annualIncome = grossPay * periodsPerYear;

    const federalAnnualTax = calculateProgressiveTax(
        annualIncome,
        FEDERAL_BRACKETS,
    );

    const provincialAnnualTax =
        province === "ON"
            ? calculateProgressiveTax(
                  annualIncome,
                  ONTARIO_BRACKETS,
              )
            : 0;

    const federalTax = federalAnnualTax / periodsPerYear;

    const provincialTax =
        provincialAnnualTax / periodsPerYear;

    // 2026 CPP
    const cppAnnual = Math.min(
        Math.max(annualIncome - 3500, 0) * 0.0595,
        4230.45,
    );

    const cpp = cppAnnual / periodsPerYear;

    // 2026 EI
    const eiAnnual = Math.min(
        annualIncome * 0.0163,
        1123.07,
    );

    const ei = eiAnnual / periodsPerYear;

    const totalDeductions =
        federalTax +
        provincialTax +
        cpp +
        ei;

    const netPay = Math.max(
        grossPay - totalDeductions,
        0,
    );

    return {
        grossPay,
        federalTax,
        provincialTax,
        cpp,
        ei,
        totalDeductions,
        netPay,
    };
};