// lib/payroll/countryOptions.ts
// 나라별 설정(country_options JSON) 검증. 나라마다 허용하는 항목이 다르다.
import type { HolidayPayMode } from "@/lib/holiday";
import type { PayrollCountry } from "@/lib/payroll/calculatePayroll";

export type CountryOptions = {
    // CA: 매 급여에 얹어 받는 베케이션 페이 비율 (0.04 = 4%)
    vacationPayRate?: number;
    // CA/KR: 공휴일 수당 지급 방식
    holidayPayMode?: HolidayPayMode;
};

const HOLIDAY_PAY_MODES: readonly HolidayPayMode[] = ["full", "worked-only", "none"];

// 나라별로 받을 수 있는 항목. 목록에 없는 항목은 거부한다.
const ALLOWED_KEYS: Record<PayrollCountry, readonly (keyof CountryOptions)[]> = {
    CA: ["vacationPayRate", "holidayPayMode"],
    KR: ["holidayPayMode"],
};

export type ParsedCountryOptions = { ok: true; value: CountryOptions } | { ok: false; error: string };

export const parseCountryOptions = (country: PayrollCountry, raw: unknown): ParsedCountryOptions => {
    if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
        return { ok: false, error: "나라별 설정은 객체여야 합니다." };
    }

    const input = raw as Record<string, unknown>;
    const allowed = ALLOWED_KEYS[country];
    const unknownKey = Object.keys(input).find((key) => !(allowed as readonly string[]).includes(key));

    if (unknownKey) {
        return { ok: false, error: `${country}에서 지원하지 않는 설정입니다: ${unknownKey}` };
    }

    const value: CountryOptions = {};

    if (input.vacationPayRate !== undefined && input.vacationPayRate !== null) {
        const rate = input.vacationPayRate;

        if (typeof rate !== "number" || !Number.isFinite(rate) || rate < 0 || rate > 0.2) {
            return { ok: false, error: "베케이션 페이 비율은 0~20% 사이여야 합니다." };
        }

        value.vacationPayRate = rate;
    }

    if (input.holidayPayMode !== undefined && input.holidayPayMode !== null) {
        const mode = input.holidayPayMode;

        if (typeof mode !== "string" || !HOLIDAY_PAY_MODES.includes(mode as HolidayPayMode)) {
            return { ok: false, error: "공휴일 수당 방식이 올바르지 않습니다." };
        }

        value.holidayPayMode = mode as HolidayPayMode;
    }

    return { ok: true, value };
};
