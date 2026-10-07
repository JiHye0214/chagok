import type { CanadaPayrollInput, PayrollDeduction, PayrollResult } from "@/lib/payroll/types";

import { getPayPeriodDays, getPeriodsPerYear } from "@/lib/payPeriod";

import { roundMoney } from "@/lib/tax/ca/core";
import { calculateFederalTax } from "@/lib/tax/ca/federal";
import { calculateOntarioTax } from "@/lib/tax/ca/ontario";
import { CPP_RULES, EI_RULES } from "@/lib/tax/ca/rules/2026";

const {
    rate: CPP_RATE,
    baseRate: CPP_BASE_RATE,
    enhancedRate: CPP_ENHANCED_RATE,
    cpp2Rate: CPP2_RATE,
    basicExemption: CPP_BASIC_EXEMPTION,
    ympe: CPP_YMPE,
    yampe: CPP_YAMPE,
    max: CPP_MAX,
    cpp2Max: CPP2_MAX,
} = CPP_RULES;

const { rate: EI_RATE, maxInsurableEarnings: EI_MAX_INSURABLE_EARNINGS, max: EI_MAX } = EI_RULES;

/*
 * 주별 소득세 규칙표.
 * 새 주를 추가할 때는 tax/ca/에 계산 함수를 만들고 여기에 한 줄만 추가.
 */
type ProvincialTaxInput = {
    annualIncome: number;
    annualTaxableIncome: number;
    annualCppBase: number;
    annualEi: number;
};

type ProvincialTaxRule = {
    key: string;
    name: string;
    calculate: (input: ProvincialTaxInput) => number;
};

const PROVINCIAL_TAX_RULES: Record<string, ProvincialTaxRule> = {
    ON: { key: "ontario-income-tax", name: "Ontario Income Tax", calculate: calculateOntarioTax },
};

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

    const currentCpp2Earnings = Math.max(0, Math.min(ytdGrossPay + grossPay, CPP_YAMPE) - Math.max(previousEarnings, CPP_YMPE));

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
    const periodsPerYear = getPeriodsPerYear(payFrequency, payFrequency === "custom" ? getPayPeriodDays(payPeriod) : undefined);

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

    // 연간 기준 CPP: 기본분(4.95%)은 세액공제, 추가분(1%)과 CPP2는 소득공제
    const annualPensionableEarnings = Math.min(Math.max(0, annualIncome - CPP_BASIC_EXEMPTION), CPP_YMPE - CPP_BASIC_EXEMPTION);

    const annualCppBase = annualPensionableEarnings * CPP_BASE_RATE;
    const annualCppEnhanced = annualPensionableEarnings * CPP_ENHANCED_RATE;
    const annualCpp2 = Math.max(0, Math.min(annualIncome, CPP_YAMPE) - CPP_YMPE) * CPP2_RATE;

    const annualEi = Math.min(annualIncome, EI_MAX_INSURABLE_EARNINGS) * EI_RATE;

    // 소득세를 매기는 소득 = 연간 소득 - 소득공제 대상 CPP
    const annualTaxableIncome = Math.max(0, annualIncome - annualCppEnhanced - annualCpp2);

    const federalAnnualTax = calculateFederalTax({
        annualIncome,
        annualTaxableIncome,
        annualCppBase,
        annualEi,
    });

    const allDeductions: PayrollDeduction[] = [
        { key: "cpp", name: "CPP", amount: cpp },
        { key: "cpp2", name: "CPP2", amount: cpp2 },
        { key: "ei", name: "EI", amount: ei },
        {
            key: "federal-income-tax",
            name: "Federal Income Tax",
            amount: roundMoney(federalAnnualTax / periodsPerYear),
        },
    ];

    // 주 소득세: 규칙표에 없는 주(또는 미선택)는 조용히 0원 처리하지 않고 경고를 남김
    const warnings: string[] = [];
    const provincialRule = regionCode ? PROVINCIAL_TAX_RULES[regionCode] : undefined;

    if (provincialRule) {
        const provincialAnnualTax = provincialRule.calculate({ annualIncome, annualTaxableIncome, annualCppBase, annualEi });

        allDeductions.push({
            key: provincialRule.key,
            name: provincialRule.name,
            amount: roundMoney(provincialAnnualTax / periodsPerYear),
        });
    } else {
        warnings.push(
            regionCode
                ? `${regionCode} 주 소득세는 아직 지원하지 않아 계산에서 제외했어요.`
                : "지역(주)이 선택되지 않아 주 소득세를 계산에서 제외했어요.",
        );
    }

    const deductions = allDeductions.filter((deduction) => deduction.amount > 0);

    const totalDeductions = roundMoney(deductions.reduce((total, deduction) => total + deduction.amount, 0));

    return {
        deductions,
        totalDeductions,
        ...(warnings.length > 0 ? { warnings } : {}),
    };
};