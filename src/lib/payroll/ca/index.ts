import type { CanadaPayrollInput, PayrollDeduction, PayrollResult } from "@/lib/payroll/types";

import { getPeriodsPerYear } from "@/lib/payPeriod";

import { calculateFederalTax } from "@/lib/tax/ca/federal";
import { calculateOntarioTax } from "@/lib/tax/ca/ontario";

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

const roundMoney = (value: number) => Math.round(value * 100) / 100;

/**
 * CPP base + first additional contribution
 *
 * 현재 급여기간에서 실제로 공제할 CPP.
 *
 * YTD gross와 YTD CPP를 이용해서
 * 연간 최대 공제액을 넘지 않도록 한다.
 */
const calculateCpp = ({ grossPay, ytdGrossPay, ytdCpp }: { grossPay: number; ytdGrossPay: number; ytdCpp: number }) => {
    const previousPensionableEarnings = Math.max(0, Math.min(ytdGrossPay, CPP_YMPE));

    const currentPensionableEarnings = Math.max(0, Math.min(grossPay, CPP_YMPE - previousPensionableEarnings));

    const previousContribution = Math.min(Math.max(0, ytdCpp), CPP_MAX);

    const contributionRoom = Math.max(0, CPP_MAX - previousContribution);

    /*
     * The $3,500 basic exemption is applied once
     * during the year.
     *
     * For an expected-pay calculation without a precise
     * pay-period allocation, the first period with
     * pensionable earnings receives the exemption.
     */
    const currentContributionBase = Math.max(
        0,
        currentPensionableEarnings - (previousPensionableEarnings === 0 ? CPP_BASIC_EXEMPTION : 0),
    );

    return roundMoney(Math.min(currentContributionBase * CPP_RATE, contributionRoom));
};

/**
 * Second additional CPP contribution.
 *
 * CPP2 applies only to pensionable earnings
 * between YMPE and YAMPE.
 */
const calculateCpp2 = ({ grossPay, ytdGrossPay, ytdCpp2 }: { grossPay: number; ytdGrossPay: number; ytdCpp2: number }) => {
    const previousEarnings = Math.max(0, Math.min(ytdGrossPay, CPP_YAMPE));

    const currentEarningsAtYampee = Math.max(
        0,
        Math.min(ytdGrossPay + grossPay, CPP_YAMPE) - Math.max(previousEarnings, CPP_YMPE),
    );

    const contributionRoom = Math.max(0, CPP2_MAX - Math.max(0, ytdCpp2));

    return roundMoney(Math.min(currentEarningsAtYampee * CPP2_RATE, contributionRoom));
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
    /*
     * payPeriod is retained here because the payroll API
     * needs the actual pay-period context.
     *
     * The current annualized tax model only needs
     * payFrequency. We will use payPeriod when we later
     * support date-specific/custom payroll calculations.
     */
    void payPeriod;

    const safeGrossPay = Math.max(0, Number(grossPay) || 0);

    const periodsPerYear = getPeriodsPerYear(payFrequency);

    const safeYtd = {
        grossPay: Math.max(0, Number(ytd?.grossPay) || 0),
        cpp: Math.max(0, Number(ytd?.cpp) || 0),
        cpp2: Math.max(0, Number(ytd?.cpp2) || 0),
        ei: Math.max(0, Number(ytd?.ei) || 0),
    };

    /*
     * -----------------------------------------
     * 1. Current-period CPP / CPP2 / EI
     * -----------------------------------------
     */

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
     * -----------------------------------------
     * 2. Annualized income
     * -----------------------------------------
     *
     * Example:
     *
     * biweekly $1,500
     * → $1,500 × 26
     * → $39,000 annualized income
     *
     * Then annual tax is calculated and divided
     * back into 26 pay periods.
     */
    const annualIncome = safeGrossPay * periodsPerYear;

    /*
     * -----------------------------------------
     * 3. Annual CPP base contribution
     * -----------------------------------------
     *
     * Federal/Ontario income-tax credits use
     * the CPP base contribution, not CPP2.
     *
     * CPP base maximum = $3,519.45.
     */
    const annualCppBase =
        Math.min(Math.max(0, annualIncome - CPP_BASIC_EXEMPTION), CPP_YMPE - CPP_BASIC_EXEMPTION) * CPP_BASE_RATE;

    /*
     * -----------------------------------------
     * 4. Annual EI
     * -----------------------------------------
     */
    const annualEi = Math.min(annualIncome, EI_MAX_INSURABLE_EARNINGS) * EI_RATE;

    /*
     * -----------------------------------------
     * 5. Federal annual tax
     * -----------------------------------------
     */
    const federalAnnualTax = calculateFederalTax({
        annualIncome,
        annualCppBase,
        annualEi,
    });

    /*
     * Convert annual tax back to this pay period.
     */
    const federalTax = roundMoney(federalAnnualTax / periodsPerYear);

    /*
     * -----------------------------------------
     * 6. Ontario annual tax
     * -----------------------------------------
     *
     * For this Canada implementation we only
     * calculate Ontario as the supported province.
     *
     * Other provinces should not silently receive
     * Ontario tax.
     */
    const provincialAnnualTax =
        regionCode === "ON"
            ? calculateOntarioTax({
                  annualIncome,
                  annualCppBase,
                  annualEi,
              })
            : 0;

    const provincialTax = roundMoney(provincialAnnualTax / periodsPerYear);

    /*
     * -----------------------------------------
     * 7. Build deductions
     * -----------------------------------------
     */
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
            amount: federalTax,
        },
        ...(regionCode === "ON"
            ? [
                  {
                      key: "ontario-income-tax",
                      name: "Ontario Income Tax",
                      amount: provincialTax,
                  },
              ]
            : []),
    ].filter((deduction) => deduction.amount > 0);

    const totalDeductions = roundMoney(deductions.reduce((total, deduction) => total + deduction.amount, 0));

    return {
        deductions,
        totalDeductions,
    };
};
