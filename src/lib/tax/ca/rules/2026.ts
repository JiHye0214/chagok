// lib/tax/ca/rules/2026.ts
/*
 * 2026 캐나다 급여 세금 규칙. 숫자는 이 파일에만 둔다.
 * 출처: CRA T4127 (Payroll Deductions Formulas), Ontario 규칙.
 * 새해에는 이 파일을 복사해 2027.ts로 만들고 숫자만 바꾸면 됨.
 */

export const CPP_RULES = {
    rate: 0.0595, // 기본 + 1차 추가 (4.95% + 1%)
    baseRate: 0.0495, // 세액공제 대상 (기본분)
    enhancedRate: 0.01, // 소득공제 대상 (추가분)
    cpp2Rate: 0.04,
    basicExemption: 3500,
    ympe: 74600,
    yampe: 85000,
    max: 4230.45, // (ympe - basicExemption) * rate
    baseMaxCredit: 3519.45, // (ympe - basicExemption) * baseRate
    cpp2Max: 416, // (yampe - ympe) * cpp2Rate
} as const;

export const EI_RULES = {
    rate: 0.0163,
    maxInsurableEarnings: 68900,
    max: 1123.07, // maxInsurableEarnings * rate
} as const;

export const FEDERAL_RULES = {
    lowestRate: 0.14,
    bpaMax: 16452,
    bpaMin: 14829,
    bpaPhaseoutStart: 181440,
    bpaPhaseoutEnd: 258482,
    canadaEmploymentAmountMax: 1501,
    brackets: [
        { limit: 58523, rate: 0.14, constant: 0 },
        { limit: 117045, rate: 0.205, constant: 3804 },
        { limit: 181440, rate: 0.26, constant: 10241 },
        { limit: 258482, rate: 0.29, constant: 15685 },
        { limit: Infinity, rate: 0.33, constant: 26024 },
    ],
} as const;

export const ONTARIO_RULES = {
    lowestRate: 0.0505,
    basicPersonalAmount: 12989,
    brackets: [
        { limit: 53891, rate: 0.0505, constant: 0 },
        { limit: 107785, rate: 0.0915, constant: 2210 },
        { limit: 150000, rate: 0.1116, constant: 4376 },
        { limit: 220000, rate: 0.1216, constant: 5876 },
        { limit: Infinity, rate: 0.1316, constant: 8076 },
    ],
    // surtax: 기본 주세(세액공제 후)가 threshold를 넘는 부분에 각각 rate 적용
    surtax: [
        { threshold: 5818, rate: 0.2 },
        { threshold: 7446, rate: 0.36 },
    ],
    // Ontario tax reduction: 주세가 (기본금액 × 2) 미만일 때 감면
    taxReductionBasicAmount: 300,
    // Ontario Health Premium: 소득이 over를 넘으면 min(cap, base + (소득 - over) * rate)
    healthPremium: [
        { over: 20000, base: 0, rate: 0.06, cap: 300 },
        { over: 36000, base: 300, rate: 0.06, cap: 450 },
        { over: 48000, base: 450, rate: 0.25, cap: 600 },
        { over: 72000, base: 600, rate: 0.25, cap: 750 },
        { over: 200000, base: 750, rate: 0.25, cap: 900 },
    ],
} as const;
