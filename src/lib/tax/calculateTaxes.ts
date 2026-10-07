// lib/tax/calculateTaxes.ts
import { calculateCanadaTaxes } from "@/lib/tax/ca/annual";
import { roundMoney } from "@/lib/tax/ca/core";
import { calculateFreelanceDeductions } from "@/lib/tax/kr/freelance";
import type { TaxCalculationResult, TaxDeduction } from "@/lib/tax/types";

export type { TaxDeduction, TaxCalculationResult } from "@/lib/tax/types";

export type TaxCountry = "CA" | "KR";

// case를 빠뜨리면 컴파일 에러, 런타임에 이상한 값이 오면 명확한 에러
const assertNever = (value: never): never => {
    throw new Error(`지원하지 않는 국가입니다: ${String(value)}`);
};

const sumAmounts = (deductions: TaxDeduction[]) => roundMoney(deductions.reduce((total, d) => total + d.amount, 0));

/*
 * 연간 소득 기준 세금 계산 (연간 요약 등).
 * 급여 1회분(공제 포함)이 필요하면 이 함수가 아니라 payroll의 calculatePayroll을 사용.
 * 두 함수는 같은 규칙(tax/ca/annual 등)을 쓰므로 숫자가 서로 어긋나지 않는다.
 *
 * province는 기본값이 없다. 지역을 안 고르면 주 소득세는 제외되고 warnings에 안내가 담긴다.
 */
export const calculateTaxes = ({
    country,
    annualGross,
    province,
}: {
    country: TaxCountry;
    annualGross: number;
    province?: string;
}): TaxCalculationResult => {
    switch (country) {
        case "CA": {
            const { deductions: annualDeductions, warnings } = calculateCanadaTaxes({
                annualIncome: annualGross,
                province,
            });

            const deductions = annualDeductions
                .map((deduction) => ({ ...deduction, amount: roundMoney(deduction.amount) }))
                .filter((deduction) => deduction.amount > 0);

            return {
                deductions,
                totalDeductions: sumAmounts(deductions),
                ...(warnings.length > 0 ? { warnings } : {}),
            };
        }

        case "KR": {
            const deductions = calculateFreelanceDeductions(annualGross);

            return {
                deductions,
                totalDeductions: sumAmounts(deductions),
            };
        }

        default:
            return assertNever(country);
    }
};
