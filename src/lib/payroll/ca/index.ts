import type { CanadaPayrollInput, PayrollDeduction, PayrollResult } from "@/lib/payroll/types";

const CPP_RATE = 0.0595;
const CPP_BASE_RATE = 0.0495;
const CPP2_RATE = 0.04;

const CPP_BASIC_EXEMPTION = 3500;
const CPP_YMPE = 74600;
const CPP_YAMPE = 85000;

const CPP_MAX = 4230.45;
const CPP2_MAX = 416;

const EI_RATE = 0.0163;
const EI_MAX_INSURABLE_EARNINGS = 68900;
const EI_MAX = 1123.07;

const FEDERAL_BASIC_PERSONAL_AMOUNT_MAX = 16452;
const FEDERAL_BASIC_PERSONAL_AMOUNT_MIN = 14829;
const FEDERAL_CEA_MAX = 1501;

const FEDERAL_BRACKETS = [
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

const ONTARIO_BRACKETS = [
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

const BC_BRACKETS = [
    {
        limit: 50363,
        rate: 0.0614,
        constant: 0,
    },
    {
        limit: 100728,
        rate: 0.077,
        constant: 786,
    },
    {
        limit: 115648,
        rate: 0.105,
        constant: 3606,
    },
    {
        limit: 140430,
        rate: 0.1229,
        constant: 5676,
    },
    {
        limit: 190405,
        rate: 0.147,
        constant: 9061,
    },
    {
        limit: 265545,
        rate: 0.168,
        constant: 13059,
    },
    {
        limit: Infinity,
        rate: 0.205,
        constant: 22884,
    },
];

const BC_BASIC_PERSONAL_AMOUNT = 13216;

const roundMoney = (value: number) => Math.round(value * 100) / 100;

const getPeriodsPerYear = (payFrequency: CanadaPayrollInput["payFrequency"]) => {
    switch (payFrequency) {
        case "weekly":
            return 52;

        case "biweekly":
            return 26;

        case "semi-monthly":
            return 24;

        case "monthly":
            return 12;

        case "custom":
            return 26;

        default:
            return 26;
    }
};

const getBracketTax = (
    income: number,
    brackets: {
        limit: number;
        rate: number;
        constant: number;
    }[],
) => {
    const safeIncome = Math.max(0, income);

    const bracket = brackets.find((item) => safeIncome <= item.limit) ?? brackets[brackets.length - 1];

    return Math.max(0, safeIncome * bracket.rate - bracket.constant);
};

const getFederalBasicPersonalAmount = (income: number) => {
    if (income <= 181440) {
        return FEDERAL_BASIC_PERSONAL_AMOUNT_MAX;
    }

    if (income >= 258482) {
        return FEDERAL_BASIC_PERSONAL_AMOUNT_MIN;
    }

    const reduction = (income - 181440) * (1623 / (258482 - 181440));

    return Math.max(FEDERAL_BASIC_PERSONAL_AMOUNT_MIN, FEDERAL_BASIC_PERSONAL_AMOUNT_MAX - reduction);
};

const calculateCpp = ({ grossPay, ytdGrossPay, ytdCpp }: { grossPay: number; ytdGrossPay: number; ytdCpp: number }) => {
    const previousPensionableEarnings = Math.max(0, Math.min(ytdGrossPay, CPP_YMPE));

    const currentPensionableEarnings = Math.max(0, Math.min(grossPay, CPP_YMPE - previousPensionableEarnings));

    const previousContribution = Math.min(Math.max(0, ytdCpp), CPP_MAX);

    const annualContributionRoom = Math.max(0, CPP_MAX - previousContribution);

    const contributionBase = Math.max(
        0,
        currentPensionableEarnings - (previousPensionableEarnings === 0 ? CPP_BASIC_EXEMPTION : 0),
    );

    const cpp = Math.min(contributionBase * CPP_RATE, annualContributionRoom);

    return roundMoney(cpp);
};

const calculateCpp2 = ({ grossPay, ytdGrossPay, ytdCpp2 }: { grossPay: number; ytdGrossPay: number; ytdCpp2: number }) => {
    const previousCpp2Earnings = Math.max(0, Math.min(ytdGrossPay, CPP_YAMPE));

    const currentCpp2Earnings = Math.max(
        0,
        Math.min(ytdGrossPay + grossPay, CPP_YAMPE) - Math.max(previousCpp2Earnings, CPP_YMPE),
    );

    const contributionRoom = Math.max(0, CPP2_MAX - Math.max(0, ytdCpp2));

    return roundMoney(Math.min(currentCpp2Earnings * CPP2_RATE, contributionRoom));
};

const calculateEi = ({ grossPay, ytdGrossPay, ytdEi }: { grossPay: number; ytdGrossPay: number; ytdEi: number }) => {
    const previousInsurableEarnings = Math.max(0, Math.min(ytdGrossPay, EI_MAX_INSURABLE_EARNINGS));

    const currentInsurableEarnings = Math.max(0, Math.min(grossPay, EI_MAX_INSURABLE_EARNINGS - previousInsurableEarnings));

    const contributionRoom = Math.max(0, EI_MAX - Math.max(0, ytdEi));

    return roundMoney(Math.min(currentInsurableEarnings * EI_RATE, contributionRoom));
};

const calculateFederalTax = ({
    annualIncome,
    annualCppBase,
    annualEi,
}: {
    annualIncome: number;
    annualCppBase: number;
    annualEi: number;
}) => {
    const basicTax = getBracketTax(annualIncome, FEDERAL_BRACKETS);

    const basicPersonalAmount = getFederalBasicPersonalAmount(annualIncome);

    const employmentAmount = Math.min(annualIncome, FEDERAL_CEA_MAX);

    const cppBaseCredit = Math.min(annualCppBase, 3519.45);

    const eiCredit = Math.min(annualEi, EI_MAX);

    const creditBase = basicPersonalAmount + employmentAmount + cppBaseCredit + eiCredit;

    const federalCredits = creditBase * 0.14;

    return roundMoney(Math.max(0, basicTax - federalCredits));
};

const calculateOntarioTax = ({
    annualIncome,
    annualCppBase,
    annualEi,
}: {
    annualIncome: number;
    annualCppBase: number;
    annualEi: number;
}) => {
    const basicTax = getBracketTax(annualIncome, ONTARIO_BRACKETS);

    const cppCredit = Math.min(annualCppBase, 3519.45) * 0.0505;

    const eiCredit = Math.min(annualEi, EI_MAX) * 0.0505;

    const personalCredit = 12989 * 0.0505;

    let tax = basicTax - cppCredit - eiCredit - personalCredit;

    tax = Math.max(0, tax);

    // Ontario Health Premium
    let healthPremium = 0;

    if (annualIncome > 20000) {
        if (annualIncome <= 36000) {
            healthPremium = Math.min(300, annualIncome * 0.06);
        } else if (annualIncome <= 48000) {
            healthPremium = Math.min(450, 300 + (annualIncome - 36000) * 0.06);
        } else if (annualIncome <= 72000) {
            healthPremium = Math.min(600, 450 + (annualIncome - 48000) * 0.25);
        } else if (annualIncome <= 200000) {
            healthPremium = Math.min(750, 600 + (annualIncome - 72000) * 0.25);
        } else {
            healthPremium = Math.min(900, 750 + (annualIncome - 200000) * 0.25);
        }
    }

    // Ontario surtax
    const surtaxBase = Math.max(0, tax);

    let surtax = 0;

    if (surtaxBase > 5818) {
        surtax = (surtaxBase - 5818) * 0.2;

        if (surtaxBase > 7446) {
            surtax = 5818 * 0.2 + (surtaxBase - 7446) * 0.36;
        }
    }

    return roundMoney(tax + healthPremium + surtax);
};

const calculateBcTax = ({
    annualIncome,
    annualCppBase,
    annualEi,
}: {
    annualIncome: number;
    annualCppBase: number;
    annualEi: number;
}) => {
    const basicTax = getBracketTax(annualIncome, BC_BRACKETS);

    const cppCredit = Math.min(annualCppBase, 3519.45) * 0.056;

    const eiCredit = Math.min(annualEi, EI_MAX) * 0.056;

    const personalCredit = BC_BASIC_PERSONAL_AMOUNT * 0.056;

    let tax = basicTax - cppCredit - eiCredit - personalCredit;

    tax = Math.max(0, tax);

    // 2026 BC tax reduction
    if (annualIncome <= 25570) {
        tax = Math.max(0, tax - Math.min(805, tax));
    } else if (annualIncome <= 44952) {
        const reduction = Math.max(0, 805 - (annualIncome - 25570) * 0.0356);

        tax = Math.max(0, tax - Math.min(reduction, tax));
    }

    return roundMoney(tax);
};

export const calculateCanadaPayroll = ({
    grossPay,
    regionCode,
    payFrequency,
    payPeriod,
    ytd,
}: CanadaPayrollInput): PayrollResult => {
    void payPeriod;

    const safeGrossPay = Math.max(0, Number(grossPay) || 0);

    const periodsPerYear = getPeriodsPerYear(payFrequency);

    const safeYtd = {
        grossPay: Math.max(0, Number(ytd?.grossPay) || 0),
        cpp: Math.max(0, Number(ytd?.cpp) || 0),
        cpp2: Math.max(0, Number(ytd?.cpp2) || 0),
        ei: Math.max(0, Number(ytd?.ei) || 0),
    };

    const cpp = calculateCpp({
        grossPay: safeGrossPay,
        ytdGrossPay: safeYtd.grossPay,
        ytdCpp: safeYtd.cpp,
    });

    const cpp2 = calculateCpp2({
        grossPay: safeGrossPay,
        ytdGrossPay: safeYtd.grossPay,
        ytdCpp2: safeYtd.cpp2,
    });

    const ei = calculateEi({
        grossPay: safeGrossPay,
        ytdGrossPay: safeYtd.grossPay,
        ytdEi: safeYtd.ei,
    });

    /*
     * 예상 급여이므로 현재 급여를 연간화해서
     * 연방/주 소득세를 추정한다.
     */
    const annualIncome = safeGrossPay * periodsPerYear;

    const annualCppBase =
        Math.min(annualIncome, CPP_YMPE) > CPP_BASIC_EXEMPTION
            ? Math.min(annualIncome - CPP_BASIC_EXEMPTION, CPP_YMPE - CPP_BASIC_EXEMPTION) * CPP_BASE_RATE
            : 0;

    const annualEi = Math.min(annualIncome, EI_MAX_INSURABLE_EARNINGS) * EI_RATE;

    const federalAnnualTax = calculateFederalTax({
        annualIncome,
        annualCppBase,
        annualEi,
    });

    const provincialAnnualTax =
        regionCode === "BC"
            ? calculateBcTax({
                  annualIncome,
                  annualCppBase,
                  annualEi,
              })
            : calculateOntarioTax({
                  annualIncome,
                  annualCppBase,
                  annualEi,
              });

    const federalTax = federalAnnualTax / periodsPerYear;

    const provincialTax = provincialAnnualTax / periodsPerYear;

    const deductions: PayrollDeduction[] = [
        {
            key: "cpp",
            name: "CPP",
            amount: cpp,
        },
        {
            key: "cpp2",
            name: "CPP2",
            amount: cpp2,
        },
        {
            key: "ei",
            name: "EI",
            amount: ei,
        },
        {
            key: "federal-income-tax",
            name: "Federal Income Tax",
            amount: roundMoney(federalTax),
        },
        {
            key: "provincial-income-tax",
            name: regionCode === "BC" ? "BC Income Tax" : "Ontario Income Tax",
            amount: roundMoney(provincialTax),
        },
    ].filter((deduction) => deduction.amount > 0);

    const totalDeductions = roundMoney(deductions.reduce((total, deduction) => total + deduction.amount, 0));

    return {
        deductions,
        totalDeductions,
    };
};
