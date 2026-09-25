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

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);

        const year = searchParams.get("year");
        const country = searchParams.get("country")?.toUpperCase();
        const province = searchParams.get("province")?.toUpperCase() || null;

        if (!year || !country) {
            return NextResponse.json(
                {
                    error: "year와 country가 필요합니다.",
                },
                { status: 400 },
            );
        }

        const response = await fetch(`https://date.nager.at/api/v3/PublicHolidays/${year}/${country}`, {
            next: {
                revalidate: 86400,
            },
        });

        if (!response.ok) {
            throw new Error(`Nager 공휴일 API 조회 실패: ${response.status}`);
        }

        const holidays: NagerHoliday[] = await response.json();

        const filteredHolidays = holidays
            .filter((holiday) => {
                // 국가 전체 공휴일
                if (holiday.global) {
                    return true;
                }

                // 지역 정보가 없는 국가
                if (!province) {
                    return false;
                }

                // 캐나다처럼 province/subdivision을 사용하는 경우
                const subdivisionCode = `${country}-${province}`;

                return holiday.counties?.includes(subdivisionCode) ?? false;
            })
            .map((holiday) => ({
                date: holiday.date,
                name: holiday.localName || holiday.name,
                global: holiday.global,
            }));

        return NextResponse.json(filteredHolidays);
    } catch (error) {
        console.error("Holiday API error:", error);

        return NextResponse.json(
            {
                error: "공휴일을 불러오지 못했습니다.",
            },
            {
                status: 500,
            },
        );
    }
}
