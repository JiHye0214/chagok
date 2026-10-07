// lib/tax/ca/provinces.ts
import { calculateOntarioTax } from "@/lib/tax/ca/ontario";

/*
 * 주별 소득세 규칙표.
 * 새 주를 추가할 때는 tax/ca/에 계산 함수를 만들고 여기에 한 줄만 추가.
 */
export type ProvincialTaxInput = {
    annualIncome: number;
    annualTaxableIncome: number;
    annualCppBase: number;
    annualEi: number;
};

export type ProvincialTaxRule = {
    key: string;
    name: string;
    calculate: (input: ProvincialTaxInput) => number;
};

export const PROVINCIAL_TAX_RULES: Record<string, ProvincialTaxRule> = {
    ON: { key: "ontario-income-tax", name: "Ontario Income Tax", calculate: calculateOntarioTax },
};
