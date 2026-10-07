// lib/tax/ca/core.ts
export const roundMoney = (value: number) => Math.round(value * 100) / 100;

export type TaxBracket = {
    limit: number;
    rate: number;
    constant: number;
};

/*
 * CRA 급여공제 공식의 구간표 방식: 세금 = 소득 × 해당 구간 세율 - 상수
 * 연방/주 모두 같은 방식이라 공통으로 사용.
 */
export const calculateBracketTax = (income: number, brackets: readonly TaxBracket[]) => {
    const safeIncome = Math.max(0, income);

    const bracket = brackets.find((item) => safeIncome <= item.limit) ?? brackets[brackets.length - 1];

    return Math.max(0, safeIncome * bracket.rate - bracket.constant);
};

// 입력값 정리: 숫자가 아니거나 음수면 0
export const toNonNegative = (value: unknown) => Math.max(0, Number(value) || 0);
