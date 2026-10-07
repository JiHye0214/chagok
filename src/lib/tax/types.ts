// lib/tax/types.ts
export type TaxDeduction = {
    key: string;
    name: string;
    amount: number;
};

export type TaxCalculationResult = {
    deductions: TaxDeduction[];
    totalDeductions: number;
    // 계산에서 제외했거나 추정한 항목 안내 (예: 미지원 주)
    warnings?: string[];
};
