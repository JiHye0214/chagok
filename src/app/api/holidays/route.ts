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
        const province = searchParams.get("province");

        if (!year || !province) {
            return NextResponse.json(
                { error: "year와 province가 필요합니다." },
                { status: 400 },
            );
        }

        const response = await fetch(
            `https://date.nager.at/api/v3/PublicHolidays/${year}/CA`,
            {
                next: {
                    revalidate: 86400,
                },
            },
        );

        if (!response.ok) {
            throw new Error("Nager 공휴일 API 조회 실패");
        }

        const holidays: NagerHoliday[] = await response.json();

        const subdivisionCode = `CA-${province}`;

        const filteredHolidays = holidays
            .filter((holiday) => {
                // 캐나다 전체에 적용되는 공휴일
                if (holiday.global) {
                    return true;
                }

                // 해당 주/준주에 적용되는 공휴일
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