const calculateProgressiveTax = (income: number, brackets: { limit: number; rate: number }[]) => {
    let tax = 0;
    let previousLimit = 0;

    for (const bracket of brackets) {
        const taxable = Math.min(income, bracket.limit) - previousLimit;

        if (taxable > 0) {
            tax += taxable * bracket.rate;
        }

        if (income <= bracket.limit) {
            break;
        }

        previousLimit = bracket.limit;
    }

    return tax;
};

const ONTARIO_BASIC_PERSONAL_AMOUNT = 12989;

const ONTARIO_TAX_BRACKETS = [
    {
        limit: 53891,
        rate: 0.0505,
    },
    {
        limit: 107785,
        rate: 0.0915,
    },
    {
        limit: 150000,
        rate: 0.1116,
    },
    {
        limit: 220000,
        rate: 0.1216,
    },
    {
        limit: Infinity,
        rate: 0.1316,
    },
];

export const calculateOntarioTax = (annualGross: number) => {
    const ontarioTaxableIncome = Math.max(0, annualGross - ONTARIO_BASIC_PERSONAL_AMOUNT);

    return calculateProgressiveTax(ontarioTaxableIncome, ONTARIO_TAX_BRACKETS);
};
