// lib/api/validate.ts
// 요청 값 검증 도구. 잘못된 값이면 ValidationError를 던지고, 라우트가 400으로 바꿔서 응답한다.

export class ValidationError extends Error {}

function fail(message: string): never {
    throw new ValidationError(message);
}

export const MAX_AMOUNT = 1_000_000_000;

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const TIME_PATTERN = /^(\d{2}):(\d{2})(?::\d{2})?$/;

const isEmpty = (value: unknown) => value === undefined || value === null || value === "";

const round2 = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;

export const parseDate = (value: unknown, label: string): string => {
    if (typeof value !== "string" || !DATE_PATTERN.test(value)) {
        fail(`${label} 형식이 올바르지 않습니다. (YYYY-MM-DD)`);
    }

    const text = value as string;
    const date = new Date(`${text}T00:00:00Z`);

    // 2026-02-31 같은 존재하지 않는 날짜 걸러내기
    if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== text) {
        fail(`${label}이(가) 존재하지 않는 날짜입니다.`);
    }

    return text;
};

export const parseOptionalDate = (value: unknown, label: string): string | null =>
    isEmpty(value) ? null : parseDate(value, label);

// "09:00" 또는 "09:00:00" → "09:00"
export const parseTime = (value: unknown, label: string): string => {
    const match = typeof value === "string" ? TIME_PATTERN.exec(value) : null;

    if (!match || Number(match[1]) > 23 || Number(match[2]) > 59) {
        fail(`${label} 형식이 올바르지 않습니다. (HH:MM)`);
    }

    return `${(match as RegExpExecArray)[1]}:${(match as RegExpExecArray)[2]}`;
};

export const parseAmount = (
    value: unknown,
    label: string,
    { min = 0, max = MAX_AMOUNT }: { min?: number; max?: number } = {},
): number => {
    const number = typeof value === "string" && value.trim() !== "" ? Number(value) : value;

    if (typeof number !== "number" || !Number.isFinite(number) || number < min || number > max) {
        fail(`${label}이(가) 올바르지 않습니다.`);
    }

    return round2(number as number);
};

export const parseOptionalAmount = (value: unknown, label: string, options?: { min?: number; max?: number }): number | null =>
    isEmpty(value) ? null : parseAmount(value, label, options);

export const parseInteger = (value: unknown, label: string, { min, max }: { min: number; max: number }): number => {
    const number = typeof value === "string" && value.trim() !== "" ? Number(value) : value;

    if (typeof number !== "number" || !Number.isInteger(number) || number < min || number > max) {
        fail(`${label}이(가) 올바르지 않습니다.`);
    }

    return number as number;
};

export const parseId = (value: unknown, label = "ID"): number => parseInteger(value, label, { min: 1, max: Number.MAX_SAFE_INTEGER });

export const parseEnum = <T extends string>(value: unknown, label: string, allowed: readonly T[]): T => {
    if (typeof value !== "string" || !allowed.includes(value as T)) {
        fail(`${label}이(가) 올바르지 않습니다.`);
    }

    return value as T;
};

export const parseOptionalEnum = <T extends string>(value: unknown, label: string, allowed: readonly T[]): T | null =>
    isEmpty(value) ? null : parseEnum(value, label, allowed);

export const parseBoolean = (value: unknown, fallback: boolean): boolean => {
    if (value === undefined || value === null) {
        return fallback;
    }

    if (typeof value !== "boolean") {
        fail("true/false 값이 필요한 항목이 올바르지 않습니다.");
    }

    return value as boolean;
};
