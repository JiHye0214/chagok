// lib/payroll/ca/calculateCanadaPayroll.ts
import type { CanadaPayrollInput, PayrollDeduction, PayrollResult } from "@/lib/payroll/types";

import { getPayPeriodDays, getPeriodsPerYear } from "@/lib/payPeriod";

import { roundMoney } from "@/lib/tax/ca/core";
import { calculateCanadaTaxes } from "@/lib/tax/ca/annual";
import { CPP_RULES, EI_RULES } from "@/lib/tax/ca/rules/2026";

const {
    rate: CPP_RATE,
    cpp2Rate: CPP2_RATE,
    basicExemption: CPP_BASIC_EXEMPTION,
    ympe: CPP_YMPE,
    yampe: CPP_YAMPE,
    max: CPP_MAX,
    cpp2Max: CPP2_MAX,
} = CPP_RULES;

const { rate: EI_RATE, maxInsurableEarnings: EI_MAX_INSURABLE_EARNINGS, max: EI_MAX } = EI_RULES;

/**
 * CPP base + first additional contribution
 */
const calculateCpp = ({
    grossPay,
    ytdGrossPay,
    ytdCpp,
    periodsPerYear,
}: {
    grossPay: number;
    ytdGrossPay: number;
    ytdCpp: number;
    periodsPerYear: number;
}) => {
    const previousPensionableEarnings = Math.max(0, Math.min(ytdGrossPay, CPP_YMPE));

    const currentPensionableEarnings = Math.max(0, Math.min(grossPay, CPP_YMPE - previousPensionableEarnings));

    const previousContribution = Math.min(Math.max(0, ytdCpp), CPP_MAX);

    const contributionRoom = Math.max(0, CPP_MAX - previousContribution);

    // 기본공제($3,500)는 첫 급여에 몰아서 적용하지 않고 급여 주기마다 나눠서 적용 (CRA 방식)
    const exemptionPerPeriod = CPP_BASIC_EXEMPTION / periodsPerYear;

    const currentContributionBase = Math.max(0, currentPensionableEarnings - exemptionPerPeriod);

    return roundMoney(Math.min(currentContributionBase * CPP_RATE, contributionRoom));
};

/**
 * Second additional CPP contribution.
 */
const calculateCpp2 = ({ grossPay, ytdGrossPay, ytdCpp2 }: { grossPay: number; ytdGrossPay: number; ytdCpp2: number }) => {
    const previousEarnings = Math.max(0, Math.min(ytdGrossPay, CPP_YAMPE));

    const currentCpp2Earnings = Math.max(
        0,
        Math.min(ytdGrossPay + grossPay, CPP_YAMPE) - Math.max(previousEarnings, CPP_YMPE),
    );

    const contributionRoom = Math.max(0, CPP2_MAX - Math.max(0, ytdCpp2));

    return roundMoney(Math.min(currentCpp2Earnings * CPP2_RATE, contributionRoom));
};

/**
 * Employment Insurance.
 */
const calculateEi = ({ grossPay, ytdGrossPay, ytdEi }: { grossPay: number; ytdGrossPay: number; ytdEi: number }) => {
    const previousInsurableEarnings = Math.max(0, Math.min(ytdGrossPay, EI_MAX_INSURABLE_EARNINGS));

    const currentInsurableEarnings = Math.max(0, Math.min(grossPay, EI_MAX_INSURABLE_EARNINGS - previousInsurableEarnings));

    const contributionRoom = Math.max(0, EI_MAX - Math.max(0, ytdEi));

    return roundMoney(Math.min(currentInsurableEarnings * EI_RATE, contributionRoom));
};

export const calculateCanadaPayroll = ({
    grossPay,
    regionCode,
    payFrequency,
    payPeriod,
    ytd,
}: CanadaPayrollInput): PayrollResult => {
    const safeGrossPay = Math.max(0, Number(grossPay) || 0);

    // custom 주기는 실제 급여 기간 일수로 연간 횟수를 계산
    const periodsPerYear = getPeriodsPerYear(
        payFrequency,
        payFrequency === "custom" ? getPayPeriodDays(payPeriod) : undefined,
    );

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
        periodsPerYear,
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

    const annualIncome = safeGrossPay * periodsPerYear;

    // 연방/주 소득세는 tax 레이어에서 연 기준으로 계산하고, 여기서는 급여 1회분으로 나눔
    const taxes = calculateCanadaTaxes({ annualIncome, province: regionCode });

    const allDeductions: PayrollDeduction[] = [
        { key: "cpp", name: "CPP", amount: cpp },
        { key: "cpp2", name: "CPP2", amount: cpp2 },
        { key: "ei", name: "EI", amount: ei },
        ...taxes.deductions.map((deduction) => ({
            ...deduction,
            amount: roundMoney(deduction.amount / periodsPerYear),
        })),
    ];

    const warnings = taxes.warnings;

    const deductions = allDeductions.filter((deduction) => deduction.amount > 0);

    const totalDeductions = roundMoney(deductions.reduce((total, deduction) => total + deduction.amount, 0));

    return {
        deductions,
        totalDeductions,
        ...(warnings.length > 0 ? { warnings } : {}),
    };
};
