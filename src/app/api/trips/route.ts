import { NextResponse } from "next/server";
import { sql } from "@/lib/db";

export async function GET() {
    try {
        const trips = await sql`
            SELECT
                id,
                trip_type AS "tripType",
                title,
                city,
                country,
                country_code AS "countryCode",
                start_date AS "startDate",
                end_date AS "endDate",
                people,
                budget,
                currency,
                rating
            FROM trips
            ORDER BY start_date DESC
        `;

        return NextResponse.json(trips);
    } catch (error) {
        console.error("여행 목록 조회 실패:", error);

        return NextResponse.json(
            { error: "여행 목록을 불러오지 못했습니다." },
            { status: 500 },
        );
    }
}

export async function POST(request: Request) {
    try {
        const body = await request.json();

        const {
            tripType,
            title,
            city,
            country,
            countryCode,
            startDate,
            endDate,
            people,
            budget,
            currency,
            rating,
        } = body;

        const [trip] = await sql`
            INSERT INTO trips (
                trip_type,
                title,
                city,
                country,
                country_code,
                start_date,
                end_date,
                people,
                budget,
                currency,
                rating
            )
            VALUES (
                ${tripType},
                ${title?.trim() || null},
                ${city},
                ${country},
                ${countryCode},
                ${startDate},
                ${endDate},
                ${Number(people) || 1},
                ${tripType === "upcoming"
                    ? Number(budget) || 0
                    : null},
                ${currency || "CAD"},
                ${tripType === "completed"
                    ? Number(rating) || 0
                    : 0}
            )
            RETURNING
                id,
                trip_type AS "tripType",
                title,
                city,
                country,
                country_code AS "countryCode",
                start_date AS "startDate",
                end_date AS "endDate",
                people,
                budget,
                currency,
                rating
        `;

        return NextResponse.json(trip, { status: 201 });
    } catch (error) {
        console.error("여행 저장 실패:", error);

        return NextResponse.json(
            { error: "여행을 저장하지 못했습니다." },
            { status: 500 },
        );
    }
}