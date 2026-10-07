// lib/tax/kr/freelance.ts
/*
 * 한국 프리랜서(사업소득) 3.3% 원천징수
 *
 * - 소득세: 지급액 × 3%, 원 단위 미만 절사
 * - 지방소득세: 소득세의 10% (= 지급액의 0.3%), 10원 미만 절사
 *
 * 부동소수점 오차 걱정이 없도록 정수끼리 곱한 뒤 나누는 방식으로 계산한다.
 * (0~300만 원 전수 검사에서 정수 정답과 한 건도 다르지 않음)
 *
 * TODO(확인 필요): 소액부징수(원천징수 소득세가 1,000원 미만이면 징수하지 않음)는 아직 반영하지 않음.
 */

export const KR_FREELANCE_RULES = {
    incomeTaxPercent: 3,
    localTaxPercentOfIncomeTax: 10,
    localTaxRoundingUnit: 10,
} as const;

export const calculateFreelanceWithholding = (grossPay: number) => {
    const { incomeTaxPercent, localTaxPercentOfIncomeTax, localTaxRoundingUnit } = KR_FREELANCE_RULES;

    // 원 미만 금액은 원천징수 대상에서 제외
    const payment = Math.floor(Math.max(0, Number(grossPay) || 0));

    const incomeTax = Math.floor((payment * incomeTaxPercent) / 100);

    const localIncomeTax =
        Math.floor((incomeTax * localTaxPercentOfIncomeTax) / (100 * localTaxRoundingUnit)) * localTaxRoundingUnit;

    return { incomeTax, localIncomeTax };
};

// 공제 항목(이름 포함). payroll과 calculateTaxes가 같은 표기를 쓰도록 여기서 만든다.
export const calculateFreelanceDeductions = (grossPay: number) => {
    const { incomeTax, localIncomeTax } = calculateFreelanceWithholding(grossPay);

    return [
        { key: "income-tax", name: "소득세 (3%)", amount: incomeTax },
        { key: "local-income-tax", name: "지방소득세 (0.3%)", amount: localIncomeTax },
    ].filter((deduction) => deduction.amount > 0);
};
