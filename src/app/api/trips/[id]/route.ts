import { NextResponse } from "next/server";
import { sql } from "@/lib/db";

type RouteContext = {
    params: Promise<{
        id: string;
    }>;
};

export async function PUT(request: Request, context: RouteContext) {
    try {
        const { id } = await context.params;
        const tripId = Number(id);

        if (!Number.isInteger(tripId)) {
            return NextResponse.json(
                { error: "잘못된 여행 ID입니다." },
                { status: 400 },
            );
        }

        const body = await request.json();

        const {
            title,
            city,
            country,
            countryCode,
            startDate,
            endDate,
            people,
            rating,
            latitude,
            longitude,
        } = body;

        if (!city?.trim()) {
            return NextResponse.json(
                { error: "여행지를 입력해주세요." },
                { status: 400 },
            );
        }

        if (!country?.trim() || !countryCode?.trim()) {
            return NextResponse.json(
                { error: "국가 정보를 입력해주세요." },
                { status: 400 },
            );
        }

        if (!startDate || !endDate) {
            return NextResponse.json(
                { error: "여행 일정을 입력해주세요." },
                { status: 400 },
            );
        }

        const parsedPeople = Number(people);

        if (!Number.isInteger(parsedPeople) || parsedPeople < 1) {
            return NextResponse.json(
                { error: "인원은 1명 이상이어야 합니다." },
                { status: 400 },
            );
        }

        const parsedLatitude =
            latitude === null || latitude === undefined
                ? null
                : Number(latitude);

        const parsedLongitude =
            longitude === null || longitude === undefined
                ? null
                : Number(longitude);

        if (
            parsedLatitude === null ||
            parsedLongitude === null ||
            Number.isNaN(parsedLatitude) ||
            Number.isNaN(parsedLongitude)
        ) {
            return NextResponse.json(
                { error: "위치 정보가 올바르지 않습니다." },
                { status: 400 },
            );
        }

        if (parsedLatitude < -90 || parsedLatitude > 90) {
            return NextResponse.json(
                { error: "위도 값이 올바르지 않습니다." },
                { status: 400 },
            );
        }

        if (parsedLongitude < -180 || parsedLongitude > 180) {
            return NextResponse.json(
                { error: "경도 값이 올바르지 않습니다." },
                { status: 400 },
            );
        }

        const [trip] = await sql`
            UPDATE trips
            SET
                title = ${title?.trim() || null},
                city = ${city.trim()},
                country = ${country.trim()},
                country_code = ${countryCode.trim()},
                latitude = ${parsedLatitude},
                longitude = ${parsedLongitude},
                start_date = ${startDate},
                end_date = ${endDate},
                people = ${parsedPeople},
                rating = ${Number(rating) || 0}
            WHERE id = ${tripId}
            RETURNING
                id,
                trip_type AS "tripType",
                title,
                city,
                country,
                country_code AS "countryCode",
                latitude,
                longitude,
                start_date AS "startDate",
                end_date AS "endDate",
                people,
                budget,
                currency,
                rating
        `;

        if (!trip) {
            return NextResponse.json(
                { error: "여행을 찾을 수 없습니다." },
                { status: 404 },
            );
        }

        return NextResponse.json(trip);
    } catch (error) {
        console.error("여행 수정 실패:", error);

        return NextResponse.json(
            { error: "여행을 수정하지 못했습니다." },
            { status: 500 },
        );
    }
}