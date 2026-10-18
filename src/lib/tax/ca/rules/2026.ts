// lib/tax/ca/rules/2026.ts
/*
 * 2026 캐나다 급여 세금 규칙. 숫자는 이 파일에만 둔다.
 * 출처: CRA T4127 (Payroll Deductions Formulas), Ontario·BC 규칙.
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

/*
 * British Columbia 2026 (연 기준 법정 세율).
 * 출처: BC 2026 예산(최저 구간 5.06% -> 5.60%), 2026 구간표, 기본공제 13,216.
 * 참고: CRA 급여 원천징수는 7월부터 최저 구간 6.14%로 따로 조정해 연 합계를 맞춘다.
 *       여기서는 연 기준 법정 세율(5.60%)로 계산한다.
 */
export const BC_RULES = {
    lowestRate: 0.056,
    basicPersonalAmount: 13216,
    brackets: [
        { limit: 50363, rate: 0.056, constant: 0 },
        { limit: 100728, rate: 0.077, constant: 1057.62 },
        { limit: 115648, rate: 0.105, constant: 3878.01 },
        { limit: 140430, rate: 0.1229, constant: 5948.11 },
        { limit: 190405, rate: 0.147, constant: 9332.47 },
        { limit: 265545, rate: 0.168, constant: 13330.97 },
        { limit: Infinity, rate: 0.205, constant: 23156.14 },
    ],
    // BC tax reduction: 소득이 threshold 이하면 최대액, 넘으면 phaseOutRate 비율로 줄어 0이 됨
    taxReduction: { max: 690, threshold: 25570, phaseOutRate: 0.0356 },
} as const;
