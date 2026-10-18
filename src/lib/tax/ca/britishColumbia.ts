// lib/tax/ca/britishColumbia.ts
import { calculateBracketTax, roundMoney, toNonNegative } from "@/lib/tax/ca/core";
import { BC_RULES, CPP_RULES, EI_RULES } from "@/lib/tax/ca/rules/2026";

// BC tax reduction: 과세소득이 낮을수록 받는 세액공제 (소득이 오르면 줄어 0이 됨)
const calculateBcTaxReduction = (taxableIncome: number) => {
    const { max, threshold, phaseOutRate } = BC_RULES.taxReduction;

    return Math.max(0, Math.min(max, max - (taxableIncome - threshold) * phaseOutRate));
};

export const calculateBritishColumbiaTax = ({
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
    const income = toNonNegative(annualIncome);
    const taxableIncome = annualTaxableIncome === undefined ? income : toNonNegative(annualTaxableIncome);
    const cppBase = toNonNegative(annualCppBase);
    const ei = toNonNegative(annualEi);

    // 1. 기본 주세
    const basicTax = calculateBracketTax(taxableIncome, BC_RULES.brackets);

    // 2. 비환급 세액공제: 기본공제, CPP 기본분, EI (BC는 최저 세율로 환산)
    const totalCreditAmount =
        BC_RULES.basicPersonalAmount + Math.min(cppBase, CPP_RULES.baseMaxCredit) + Math.min(ei, EI_RULES.max);

    const provincialTax = Math.max(0, basicTax - totalCreditAmount * BC_RULES.lowestRate);

    // 3. BC tax reduction
    return roundMoney(Math.max(0, provincialTax - calculateBcTaxReduction(taxableIncome)));
};
