const ONTARIO_BASIC_PERSONAL_AMOUNT = 12989;
const ONTARIO_LOWEST_RATE = 0.0505;

// Ontario tax reduction의 basic personal amount
const ONTARIO_TAX_REDUCTION_BASIC_AMOUNT = 300;

const ONTARIO_TAX_BRACKETS = [
    {
        limit: 53891,
        rate: 0.0505,
        constant: 0,
    },
    {
        limit: 107785,
        rate: 0.0915,
        constant: 2210,
    },
    {
        limit: 150000,
        rate: 0.1116,
        constant: 4376,
    },
    {
        limit: 220000,
        rate: 0.1216,
        constant: 5876,
    },
    {
        limit: Infinity,
        rate: 0.1316,
        constant: 8076,
    },
];

const CPP_BASE_MAX_CREDIT = 3519.45;
const EI_MAX_CREDIT = 1123.07;

const roundMoney = (value: number) => Math.round(value * 100) / 100;

const calculateBasicOntarioTax = (annualTaxableIncome: number) => {
    const income = Math.max(0, annualTaxableIncome);

    const bracket =
        ONTARIO_TAX_BRACKETS.find((item) => income <= item.limit) ?? ONTARIO_TAX_BRACKETS[ONTARIO_TAX_BRACKETS.length - 1];

    return Math.max(0, income * bracket.rate - bracket.constant);
};

const calculateOntarioHealthPremium = (annualTaxableIncome: number) => {
    const income = Math.max(0, annualTaxableIncome);

    if (income <= 20000) {
        return 0;
    }

    if (income <= 36000) {
        return Math.min(300, (income - 20000) * 0.06);
    }

    if (income <= 48000) {
        return Math.min(450, 300 + (income - 36000) * 0.06);
    }

    if (income <= 72000) {
        return Math.min(600, 450 + (income - 48000) * 0.25);
    }

    if (income <= 200000) {
        return Math.min(750, 600 + (income - 72000) * 0.25);
    }

    return Math.min(900, 750 + (income - 200000) * 0.25);
};

const calculateOntarioSurtax = (basicProvincialTax: number) => {
    const tax = Math.max(0, basicProvincialTax);

    if (tax <= 5818) {
        return 0;
    }

    if (tax <= 7446) {
        return (tax - 5818) * 0.2;
    }

    return (tax - 5818) * 0.2 + (tax - 7446) * 0.36;
};

const calculateOntarioTaxReduction = (basicProvincialTax: number) => {
    const tax = Math.max(0, basicProvincialTax);

    /*
     * 2026 Ontario basic tax reduction:
     *
     * Basic personal amount for the reduction = $300.
     *
     * If provincial tax is:
     *   <= $300  → reduction = all provincial tax
     *   $300–$600 → reduction = $600 - provincial tax
     *   > $600    → reduction = $0
     */
    const maximumReduction = ONTARIO_TAX_REDUCTION_BASIC_AMOUNT * 2;

    return Math.max(0, Math.min(tax, maximumReduction - tax));
};

export const calculateOntarioTax = ({
    annualIncome,
    annualCppBase = 0,
    annualEi = 0,
}: {
    annualIncome: number;
    annualCppBase?: number;
    annualEi?: number;
}) => {
    const income = Math.max(0, Number(annualIncome) || 0);

    const cppBase = Math.max(0, Number(annualCppBase) || 0);

    const ei = Math.max(0, Number(annualEi) || 0);

    /*
     * 1. Ontario basic provincial tax
     */
    const basicTax = calculateBasicOntarioTax(income);

    /*
     * 2. Ontario non-refundable tax credits
     *
     * Basic personal amount
     * CPP base contribution
     * EI premium
     */
    const cppCredit = Math.min(cppBase, CPP_BASE_MAX_CREDIT);

    const eiCredit = Math.min(ei, EI_MAX_CREDIT);

    const personalCredit = ONTARIO_BASIC_PERSONAL_AMOUNT;

    const totalCreditAmount = personalCredit + cppCredit + eiCredit;

    const provincialTaxCredits = totalCreditAmount * ONTARIO_LOWEST_RATE;

    /*
     * 3. Basic provincial tax after credits
     */
    const provincialTaxBeforeSurtax = Math.max(0, basicTax - provincialTaxCredits);

    /*
     * 4. Ontario surtax
     */
    const surtax = calculateOntarioSurtax(provincialTaxBeforeSurtax);

    /*
     * 5. Provincial tax including surtax
     */
    const provincialTaxIncludingSurtax = provincialTaxBeforeSurtax + surtax;

    /*
     * 6. Ontario Health Premium
     *
     * Calculated from annual taxable income.
     */
    const healthPremium = calculateOntarioHealthPremium(income);

    /*
     * 7. Ontario tax reduction
     *
     * Applied to provincial tax including surtax,
     * not to the health premium.
     */
    const taxReduction = calculateOntarioTaxReduction(provincialTaxIncludingSurtax);

    /*
     * 8. Final Ontario provincial tax
     */
    const totalOntarioTax = provincialTaxIncludingSurtax + healthPremium - taxReduction;

    return roundMoney(Math.max(0, totalOntarioTax));
};
