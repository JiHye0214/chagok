// lib/api/payHistoryInput.ts
// 급여 기록 POST/PUT이 공통으로 쓰는 입력 검증 (기존에는 두 곳에 똑같은 코드가 복사돼 있었음)
import { ValidationError, parseAmount, parseDate, parseOptionalDate } from "@/lib/api/validate";

export type Adjustment = { type: "add" | "subtract"; name: string; amount: number };
export type EarningLine = { key: string; amount: number; taxable: boolean };
export type DeductionLine = { key: string; amount: number };

const MAX_ADJUSTMENTS = 30;
const MAX_LINES = 20;
const MAX_SNAPSHOT_LENGTH = 20_000;
const LINE_KEY_PATTERN = /^[a-z0-9][a-z0-9-]{0,39}$/;

// 사용자가 직접 입력하는 항목: 잘못된 항목은 기존처럼 조용히 제외한다.
const parseAdjustments = (value: unknown): Adjustment[] => {
    if (!Array.isArray(value)) {
        return [];
    }

    return value
        .slice(0, MAX_ADJUSTMENTS)
        .filter(
            (item) =>
                item &&
                (item.type === "add" || item.type === "subtract") &&
                typeof item.name === "string" &&
                Number.isFinite(Number(item.amount)) &&
                Number(item.amount) >= 0 &&
                Number(item.amount) <= 1_000_000_000,
        )
        .map((item) => ({
            type: item.type as "add" | "subtract",
            name: String(item.name).trim().slice(0, 60),
            amount: Math.round(Number(item.amount) * 100) / 100,
        }))
        .filter((item) => item.name.length > 0);
};

// 새 필드(수입/공제 내역): 없으면 null(= 기존 값 유지), 있으면 엄격하게 검증
const parseLines = <T>(value: unknown, label: string, build: (item: Record<string, unknown>) => T): T[] | null => {
    if (value === undefined || value === null) {
        return null;
    }

    if (!Array.isArray(value) || value.length > MAX_LINES) {
        throw new ValidationError(`${label}이(가) 올바르지 않습니다.`);
    }

    return value.map((item) => {
        if (typeof item !== "object" || item === null || !LINE_KEY_PATTERN.test(String((item as Record<string, unknown>).key))) {
            throw new ValidationError(`${label}의 항목 형식이 올바르지 않습니다.`);
        }

        return build(item as Record<string, unknown>);
    });
};

export const parsePayHistoryInput = (body: Record<string, unknown>) => {
    const payPeriodStart = parseDate(body.payPeriodStart, "급여 기간 시작일");
    const payPeriodEnd = parseDate(body.payPeriodEnd, "급여 기간 종료일");

    if (payPeriodStart > payPeriodEnd) {
        throw new ValidationError("급여 기간의 시작일이 종료일보다 늦습니다.");
    }

    // 안 보낸 값은 null → 저장할 때 기존 값을 유지한다. (0으로 덮어쓰면 수정할 때 저장돼 있던 팁이 사라짐)
    const optionalAmount = (value: unknown, label: string): number | null =>
        value === undefined || value === null || value === "" ? null : parseAmount(value, label);

    const currencyCode =
        body.currencyCode === undefined || body.currencyCode === null || body.currencyCode === ""
            ? null
            : /^[A-Z]{3}$/.test(String(body.currencyCode))
              ? String(body.currencyCode)
              : (() => {
                    throw new ValidationError("통화 코드가 올바르지 않습니다.");
                })();

    let estimateSnapshot: Record<string, unknown> | null = null;

    if (body.estimateSnapshot !== undefined && body.estimateSnapshot !== null) {
        if (
            typeof body.estimateSnapshot !== "object" ||
            Array.isArray(body.estimateSnapshot) ||
            JSON.stringify(body.estimateSnapshot).length > MAX_SNAPSHOT_LENGTH
        ) {
            throw new ValidationError("예상 계산 정보가 올바르지 않습니다.");
        }

        estimateSnapshot = body.estimateSnapshot as Record<string, unknown>;
    }

    return {
        payPeriodStart,
        payPeriodEnd,
        payDate: parseOptionalDate(body.payDate, "급여일"),

        hours: parseAmount(body.actualHours, "근무시간", { max: 10_000 }),
        pay: parseAmount(body.actualPay, "실제 급여"),
        tips: parseAmount(body.actualTips, "실제 팁"),
        deductions: parseAmount(body.actualDeductions, "공제액"),
        netPay: parseAmount(body.actualNetPay, "실제 실수령액", { min: -1_000_000_000 }),

        cashTips: optionalAmount(body.actualCashTips, "현금 팁"),
        paychequeTips: optionalAmount(body.actualPaychequeTips, "페이첵 팁"),

        adjustments: parseAdjustments(body.adjustments),

        // null이면 "보내지 않음" → 저장할 때 기존 값을 유지
        earningLines: parseLines<EarningLine>(body.earningLines, "수입 내역", (item) => ({
            key: String(item.key),
            amount: parseAmount(item.amount, "수입 내역의 금액"),
            taxable: item.taxable === undefined ? true : item.taxable === true,
        })),
        deductionLines: parseLines<DeductionLine>(body.deductionLines, "공제 내역", (item) => ({
            key: String(item.key),
            amount: parseAmount(item.amount, "공제 내역의 금액"),
        })),
        currencyCode,
        estimateSnapshot,
    };
};
