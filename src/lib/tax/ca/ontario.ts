import { calculateBracketTax, roundMoney, toNonNegative } from "@/lib/tax/ca/core";
import { CPP_RULES, EI_RULES, ONTARIO_RULES } from "@/lib/tax/ca/rules/2026";

const calculateOntarioHealthPremium = (income: number) => {
    // 소득이 over를 넘는 구간 중 가장 높은 구간을 적용
    const tier = [...ONTARIO_RULES.healthPremium].reverse().find((item) => income > item.over);

    if (!tier) {
        return 0;
    }

    return Math.min(tier.cap, tier.base + (income - tier.over) * tier.rate);
};

const calculateOntarioSurtax = (basicProvincialTax: number) => {
    const tax = Math.max(0, basicProvincialTax);

    return ONTARIO_RULES.surtax.reduce((total, { threshold, rate }) => total + Math.max(0, tax - threshold) * rate, 0);
};

const calculateOntarioTaxReduction = (provincialTax: number) => {
    const tax = Math.max(0, provincialTax);

    // 주세 <= 300: 전액 감면 / 300~600: 600 - 주세 / 600 초과: 없음
    const maximumReduction = ONTARIO_RULES.taxReductionBasicAmount * 2;

    return Math.max(0, Math.min(tax, maximumReduction - tax));
};

export const calculateOntarioTax = ({
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
    const basicTax = calculateBracketTax(taxableIncome, ONTARIO_RULES.brackets);

    // 2. 비환급 세액공제: 기본공제, CPP 기본분, EI
    const totalCreditAmount =
        ONTARIO_RULES.basicPersonalAmount + Math.min(cppBase, CPP_RULES.baseMaxCredit) + Math.min(ei, EI_RULES.max);

    const provincialTaxBeforeSurtax = Math.max(0, basicTax - totalCreditAmount * ONTARIO_RULES.lowestRate);

    // 3. surtax
    const provincialTaxIncludingSurtax = provincialTaxBeforeSurtax + calculateOntarioSurtax(provincialTaxBeforeSurtax);

    // 4. Health Premium (과세소득 기준) 은 감면 대상이 아님
    const healthPremium = calculateOntarioHealthPremium(taxableIncome);

    // 5. Tax reduction (surtax 포함 주세에 적용)
    const taxReduction = calculateOntarioTaxReduction(provincialTaxIncludingSurtax);

    return roundMoney(Math.max(0, provincialTaxIncludingSurtax + healthPremium - taxReduction));
};
