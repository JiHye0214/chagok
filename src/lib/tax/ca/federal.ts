const calculateProgressiveTax = (
    income: number,
    brackets: { limit: number; rate: number }[]
) => {
    let tax = 0;
    let previousLimit = 0;

    for (const bracket of brackets) {
        const taxable =
            Math.min(income, bracket.limit) - previousLimit;

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

export const calculateFederalTax = (
    annualGross: number
) => {
    const federalTaxableIncome = Math.max(
        0,
        annualGross - 16452
    );

    return calculateProgressiveTax(
        federalTaxableIncome,
        [
            {
                limit: 58523,
                rate: 0.14,
            },
            {
                limit: 117045,
                rate: 0.205,
            },
            {
                limit: 181440,
                rate: 0.26,
            },
            {
                limit: 258482,
                rate: 0.29,
            },
            {
                limit: Infinity,
                rate: 0.33,
            },
        ]
    );
};