// lib/payroll/calculatePayroll.ts
import { calculateCanadaPayroll } from "./ca/calculateCanadaPayroll";
import { calculateKoreaPayroll } from "./kr/calculateKoreaPayroll";

import type { CanadaPayrollInput, KoreaPayrollInput, PayrollResult } from "./types";

export type {
    PayrollDeduction,
    PayrollResult,
    PayrollYtd,
    PayrollInput,
    CanadaPayrollInput,
    KoreaPayrollInput,
} from "./types";

// 급여 계산이 지원하는 나라. 나라를 추가할 때 여기와 아래 switch에 추가한다.
export const PAYROLL_COUNTRIES = ["CA", "KR"] as const;

export type PayrollCountry = (typeof PAYROLL_COUNTRIES)[number];

// DB/설정에서 온 string을 안전하게 좁힐 때 사용
export const isPayrollCountry = (value: unknown): value is PayrollCountry =>
    typeof value === "string" && (PAYROLL_COUNTRIES as readonly string[]).includes(value);

/*
 * 나라별로 받는 값이 다르므로 country를 기준으로 구분되는 유니온.
 * - CA: regionCode, ytd 사용 가능
 * - KR: 공통 입력만 (regionCode를 넣으면 컴파일 에러)
 * 새 나라 추가 시 여기에 한 줄 + 아래 switch에 case 추가.
 */
export type PayrollRequest =
    | ({ country: "CA" } & CanadaPayrollInput)
    | ({ country: "KR" } & KoreaPayrollInput);

// case를 빠뜨리면 컴파일 에러, 런타임에 이상한 값이 오면 명확한 에러
const assertNever = (value: never): never => {
    throw new Error(`지원하지 않는 국가입니다: ${JSON.stringify(value)}`);
};

export const calculatePayroll = (request: PayrollRequest): PayrollResult => {
    switch (request.country) {
        case "CA":
            return calculateCanadaPayroll(request);

        case "KR":
            return calculateKoreaPayroll(request);

        default:
            return assertNever(request);
    }
};
