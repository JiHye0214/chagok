// lib/salary/loaders.ts
// 급여 화면이 쓰는 API 호출을 한 곳에 모았다. (주소를 화면마다 따로 적어서 틀리던 문제 방지)
import type {
    HolidayData,
    PayPeriodData,
    PeriodTipsData,
    SalaryProfile,
    SalarySettingsData,
    WorkScheduleData,
} from "@/lib/salary/types";
import { getHolidayYearRange } from "@/lib/salary/estimate";

export class ApiError extends Error {
    constructor(
        message: string,
        public status: number,
        public code?: string,
    ) {
        super(message);
    }
}

const getJson = async <T>(url: string): Promise<T> => {
    const response = await fetch(url);

    if (!response.ok) {
        let code: string | undefined;

        try {
            code = ((await response.json()) as { code?: string })?.code;
        } catch {
            // 본문이 JSON이 아니면 코드는 없음
        }

        throw new ApiError(`요청 실패: ${url} (${response.status})`, response.status, code);
    }

    return (await response.json()) as T;
};

export const fetchProfile = async (): Promise<SalaryProfile> => {
    const data = await getJson<{ countryCode?: string | null; provinceCode?: string | null; currency?: string | null }>(
        "/api/user/profile",
    );

    return {
        countryCode: data.countryCode ?? null,
        provinceCode: data.provinceCode ?? null,
        currency: data.currency ?? null,
    };
};

export const fetchSalarySettings = () => getJson<SalarySettingsData | null>("/api/salary/salary-settings");

export const fetchWorkSchedules = (range?: { from: string; to: string }) =>
    getJson<WorkScheduleData[]>(
        range
            ? `/api/salary/work-schedules?from=${encodeURIComponent(range.from)}&to=${encodeURIComponent(range.to)}`
            : "/api/salary/work-schedules",
    );

export const fetchPeriodTips = (period: Pick<PayPeriodData, "startDate" | "endDate">) =>
    getJson<PeriodTipsData | null>(
        `/api/salary/pay-period-tips?startDate=${encodeURIComponent(period.startDate)}&endDate=${encodeURIComponent(period.endDate)}`,
    );

/*
 * 급여 기간에 해당하는 공휴일.
 * 그 나라의 공휴일 데이터가 없으면 unavailable: true 로 알려줘서 화면이 "공휴일 수당 제외"를 안내할 수 있게 한다.
 */
export const fetchHolidays = async ({
    country,
    province,
    period,
}: {
    country: string;
    province: string | null;
    period: Pick<PayPeriodData, "startDate" | "endDate">;
}): Promise<{ holidays: HolidayData[]; unavailable: boolean }> => {
    const { year, endYear } = getHolidayYearRange(period);

    const params = new URLSearchParams({ country, year: String(year) });

    if (endYear !== year) {
        params.set("endYear", String(endYear));
    }

    if (province) {
        params.set("province", province);
    }

    try {
        return { holidays: await getJson<HolidayData[]>(`/api/holidays?${params.toString()}`), unavailable: false };
    } catch (error) {
        if (error instanceof ApiError && error.code === "HOLIDAYS_UNAVAILABLE") {
            return { holidays: [], unavailable: true };
        }

        throw error;
    }
};
