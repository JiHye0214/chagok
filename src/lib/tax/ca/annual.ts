// lib/tax/ca/annual.ts
import { toNonNegative } from "@/lib/tax/ca/core";
import { calculateFederalTax } from "@/lib/tax/ca/federal";
import { PROVINCIAL_TAX_RULES } from "@/lib/tax/ca/provinces";
import { CPP_RULES, EI_RULES } from "@/lib/tax/ca/rules/2026";
import type { TaxDeduction } from "@/lib/tax/types";

/*
 * 캐나다 연간 소득세 (연방 + 주).
 * 소득세에 영향을 주는 CPP/EI를 연간 소득으로부터 계산해서 반영한다.
 *  - CPP 기본분(4.95%), EI: 세액공제
 *  - CPP 추가분(1%), CPP2: 소득공제
 * 금액은 모두 "연간" 기준. 급여 1회분이 필요하면 호출하는 쪽에서 나눈다.
 */
export const calculateCanadaTaxes = ({ annualIncome, province }: { annualIncome: number; province?: string }) => {
    const income = toNonNegative(annualIncome);

    const { basicExemption, ympe, yampe, baseRate, enhancedRate, cpp2Rate } = CPP_RULES;

    const annualPensionableEarnings = Math.min(Math.max(0, income - basicExemption), ympe - basicExemption);

    const annualCppBase = annualPensionableEarnings * baseRate;
    const annualCppEnhanced = annualPensionableEarnings * enhancedRate;
    const annualCpp2 = Math.max(0, Math.min(income, yampe) - ympe) * cpp2Rate;

    const annualEi = Math.min(income, EI_RULES.maxInsurableEarnings) * EI_RULES.rate;

    // 소득세를 매기는 소득 = 연간 소득 - 소득공제 대상 CPP
    const annualTaxableIncome = Math.max(0, income - annualCppEnhanced - annualCpp2);

    const deductions: TaxDeduction[] = [
        {
            key: "federal-income-tax",
            name: "Federal Income Tax",
            amount: calculateFederalTax({ annualIncome: income, annualTaxableIncome, annualCppBase, annualEi }),
        },
    ];

    // 주 소득세: 규칙표에 없는 주(또는 미선택)는 조용히 0원 처리하지 않고 경고를 남김
    const warnings: string[] = [];
    const provincialRule = province ? PROVINCIAL_TAX_RULES[province] : undefined;

    if (provincialRule) {
        deductions.push({
            key: provincialRule.key,
            name: provincialRule.name,
            amount: provincialRule.calculate({ annualIncome: income, annualTaxableIncome, annualCppBase, annualEi }),
        });
    } else {
        warnings.push(
            province
                ? `${province} 주 소득세는 아직 지원하지 않아 계산에서 제외했어요.`
                : "지역(주)이 선택되지 않아 주 소득세를 계산에서 제외했어요.",
        );
    }

    return { deductions, warnings };
};
