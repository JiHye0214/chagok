// lib/tax/ca/federal.ts
import { calculateBracketTax, roundMoney, toNonNegative } from "@/lib/tax/ca/core";
import { CPP_RULES, EI_RULES, FEDERAL_RULES } from "@/lib/tax/ca/rules/2026";

const getFederalBasicPersonalAmount = (income: number) => {
    const { bpaMax, bpaMin, bpaPhaseoutStart, bpaPhaseoutEnd } = FEDERAL_RULES;

    if (income <= bpaPhaseoutStart) {
        return bpaMax;
    }

    if (income >= bpaPhaseoutEnd) {
        return bpaMin;
    }

    const reduction = (income - bpaPhaseoutStart) * ((bpaMax - bpaMin) / (bpaPhaseoutEnd - bpaPhaseoutStart));

    return Math.max(bpaMin, bpaMax - reduction);
};

export const calculateFederalTax = ({
    annualIncome,
    annualTaxableIncome,
    annualCppBase = 0,
    annualEi = 0,
}: {
    annualIncome: number;
    // 소득공제(CPP 추가분 등)를 뺀 과세소득. 없으면 annualIncome과 같다고 봄.
    annualTaxableIncome?: number;
    annualCppBase?: number;
    annualEi?: number;
}) => {
    const safeIncome = toNonNegative(annualIncome);
    const taxableIncome = annualTaxableIncome === undefined ? safeIncome : toNonNegative(annualTaxableIncome);
    const safeCppBase = toNonNegative(annualCppBase);
    const safeEi = toNonNegative(annualEi);

    // 1. 구간표 기준 기본 연방세 (과세소득 기준)
    const basicTax = calculateBracketTax(taxableIncome, FEDERAL_RULES.brackets);

    // 2. 비환급 세액공제: 기본공제, CPP 기본분, EI, Canada Employment Amount
    const basicPersonalAmount = getFederalBasicPersonalAmount(taxableIncome);
    const cppBaseCredit = Math.min(safeCppBase, CPP_RULES.baseMaxCredit);
    const eiCredit = Math.min(safeEi, EI_RULES.max);
    const employmentAmount = Math.min(safeIncome, FEDERAL_RULES.canadaEmploymentAmountMax);

    const totalCreditAmount = basicPersonalAmount + cppBaseCredit + eiCredit + employmentAmount;
    const federalTaxCredits = totalCreditAmount * FEDERAL_RULES.lowestRate;

    return roundMoney(Math.max(0, basicTax - federalTaxCredits));
};
