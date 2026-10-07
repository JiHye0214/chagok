// (기존 holidays/route.ts 자리에 그대로 교체)
import { NextResponse } from "next/server";

type NagerHoliday = {
    date: string;
    localName: string;
    name: string;
    countryCode: string;
    fixed: boolean;
    global: boolean;
    counties: string[] | null;
    launchYear: number | null;
    types: string[];
};

/*
 * 응답: 공휴일 배열 [{ date, name, global, types, regions }]
 *  - types: Nager의 분류 (Public, Bank, Optional …). 어떤 분류를 급여 계산에 쓸지는 나라별 규칙이 정한다.
 *  - regions: 적용 지역 코드 (예: ["CA-ON"]). 전국 공휴일이면 null.
 *
 * 쿼리:
 *  - country (필수, ISO 3166-1 alpha-2), year (필수)
 *  - endYear (선택): 급여 기간이 연말·연초에 걸칠 때 year ~ endYear를 함께 조회 (최대 2년)
 *  - province (선택): 지역 코드 (예: ON). 있으면 해당 지역 공휴일만
 *  - types (선택): 쉼표로 구분한 분류만 반환 (예: Public). 없으면 걸러내지 않음
 *
 * 오류: 404 + code "HOLIDAYS_UNAVAILABLE" = 해당 나라의 공휴일 데이터 없음 (클라이언트는 "공휴일 수당 제외" 안내를 띄울 것)
 *       502 + code "UPSTREAM_ERROR" = Nager 조회 실패
 */
export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);

        const yearParam = searchParams.get("year");
        const endYearParam = searchParams.get("endYear") ?? yearParam;
        const country = searchParams.get("country")?.toUpperCase();
        const province = searchParams.get("province")?.toUpperCase() || null;
        const typesFilter = searchParams.get("types")?.split(",").map((type) => type.trim().toLowerCase());

        if (!yearParam || !country) {
            return NextResponse.json({ error: "year와 country가 필요합니다." }, { status: 400 });
        }

        // 외부 API 주소에 그대로 들어가는 값이라 형식을 검증
        if (!/^\d{4}$/.test(yearParam) || !/^\d{4}$/.test(endYearParam ?? "") || !/^[A-Z]{2}$/.test(country)) {
            return NextResponse.json({ error: "year는 4자리 숫자, country는 2자리 국가 코드여야 합니다." }, { status: 400 });
        }

        if (province && !/^[A-Z0-9]{1,3}$/.test(province)) {
            return NextResponse.json({ error: "province 형식이 올바르지 않습니다." }, { status: 400 });
        }

        const startYear = Number(yearParam);
        const endYear = Number(endYearParam);

        if (endYear < startYear || endYear - startYear > 1) {
            return NextResponse.json({ error: "endYear는 year 이상, 최대 1년 뒤까지 가능합니다." }, { status: 400 });
        }

        const years = Array.from({ length: endYear - startYear + 1 }, (_, index) => startYear + index);

        const results = await Promise.all(
            years.map(async (year) => {
                const response = await fetch(`https://date.nager.at/api/v3/PublicHolidays/${year}/${country}`, {
                    next: {
                        revalidate: 86400,
                    },
                });

                // 지원하지 않는 나라 (Nager 응답 방식은 실제 호출로 확인 필요)
                if (response.status === 404 || response.status === 204) {
                    return null;
                }

                if (!response.ok) {
                    throw new Error(`Nager 공휴일 API 조회 실패: ${response.status}`);
                }

                return (await response.json()) as NagerHoliday[];
            }),
        );

        if (results.every((result) => result === null)) {
            return NextResponse.json(
                { error: `${country}의 공휴일 데이터가 없습니다.`, code: "HOLIDAYS_UNAVAILABLE" },
                { status: 404 },
            );
        }

        const holidays = results.flatMap((result) => result ?? []);

        const filteredHolidays = holidays
            .filter((holiday) => {
                // 분류 필터 (요청한 경우에만)
                if (typesFilter && !holiday.types?.some((type) => typesFilter.includes(type.toLowerCase()))) {
                    return false;
                }

                // 국가 전체 공휴일
                if (holiday.global) {
                    return true;
                }

                // 지역 정보가 없는 요청
                if (!province) {
                    return false;
                }

                // 캐나다처럼 province/subdivision을 사용하는 경우
                const subdivisionCode = `${country}-${province}`;

                return holiday.counties?.includes(subdivisionCode) ?? false;
            })
            .sort((a, b) => a.date.localeCompare(b.date))
            .map((holiday) => ({
                date: holiday.date,
                name: holiday.localName || holiday.name,
                global: holiday.global,
                types: holiday.types ?? [],
                regions: holiday.counties,
            }));

        return NextResponse.json(filteredHolidays);
    } catch (error) {
        console.error("Holiday API error:", error);

        return NextResponse.json(
            {
                error: "공휴일을 불러오지 못했습니다.",
                code: "UPSTREAM_ERROR",
            },
            {
                status: 502,
            },
        );
    }
}
