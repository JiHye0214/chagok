const FEDERAL_BASIC_PERSONAL_AMOUNT_MAX = 16452;
const FEDERAL_BASIC_PERSONAL_AMOUNT_MIN = 14829;

const FEDERAL_BASIC_PERSONAL_AMOUNT_PHASEOUT_START = 181440;
const FEDERAL_BASIC_PERSONAL_AMOUNT_PHASEOUT_END = 258482;

const FEDERAL_CEA_MAX = 1501;
const FEDERAL_LOWEST_RATE = 0.14;

const FEDERAL_TAX_BRACKETS = [
    {
        limit: 58523,
        rate: 0.14,
        constant: 0,
    },
    {
        limit: 117045,
        rate: 0.205,
        constant: 3804,
    },
    {
        limit: 181440,
        rate: 0.26,
        constant: 10241,
    },
    {
        limit: 258482,
        rate: 0.29,
        constant: 15685,
    },
    {
        limit: Infinity,
        rate: 0.33,
        constant: 26024,
    },
];

const roundMoney = (value: number) => Math.round(value * 100) / 100;

const getFederalBasicPersonalAmount = (annualIncome: number) => {
    if (annualIncome <= FEDERAL_BASIC_PERSONAL_AMOUNT_PHASEOUT_START) {
        return FEDERAL_BASIC_PERSONAL_AMOUNT_MAX;
    }

    if (annualIncome >= FEDERAL_BASIC_PERSONAL_AMOUNT_PHASEOUT_END) {
        return FEDERAL_BASIC_PERSONAL_AMOUNT_MIN;
    }

    const reduction =
        (annualIncome - FEDERAL_BASIC_PERSONAL_AMOUNT_PHASEOUT_START) *
        (1623 / (FEDERAL_BASIC_PERSONAL_AMOUNT_PHASEOUT_END - FEDERAL_BASIC_PERSONAL_AMOUNT_PHASEOUT_START));

    return Math.max(FEDERAL_BASIC_PERSONAL_AMOUNT_MIN, FEDERAL_BASIC_PERSONAL_AMOUNT_MAX - reduction);
};

const calculateBasicFederalTax = (annualTaxableIncome: number) => {
    const safeIncome = Math.max(0, annualTaxableIncome);

    const bracket =
        FEDERAL_TAX_BRACKETS.find((item) => safeIncome <= item.limit) ?? FEDERAL_TAX_BRACKETS[FEDERAL_TAX_BRACKETS.length - 1];

    return Math.max(0, safeIncome * bracket.rate - bracket.constant);
};

export const calculateFederalTax = ({
    annualIncome,
    annualCppBase = 0,
    annualEi = 0,
}: {
    annualIncome: number;
    annualCppBase?: number;
    annualEi?: number;
}) => {
    const safeIncome = Math.max(0, Number(annualIncome) || 0);
    const safeCppBase = Math.max(0, Number(annualCppBase) || 0);
    const safeEi = Math.max(0, Number(annualEi) || 0);

    /*
     * Federal basic tax
     *
     * CRA 2026 payroll formula uses annual taxable income
     * against the federal rate/constant table.
     */
    const basicTax = calculateBasicFederalTax(safeIncome);

    /*
     * Federal non-refundable tax credits
     *
     * 1. Basic personal amount
     * 2. CPP base contribution
     * 3. EI premium
     * 4. Canada Employment Amount
     */
    const basicPersonalAmount = getFederalBasicPersonalAmount(safeIncome);

    const cppBaseCredit = Math.min(safeCppBase, 3519.45);

    const eiCredit = Math.min(safeEi, 1123.07);

    const employmentAmount = Math.min(safeIncome, FEDERAL_CEA_MAX);

    const totalCreditAmount = basicPersonalAmount + cppBaseCredit + eiCredit + employmentAmount;

    const federalTaxCredits = totalCreditAmount * FEDERAL_LOWEST_RATE;

    return roundMoney(Math.max(0, basicTax - federalTaxCredits));
};
