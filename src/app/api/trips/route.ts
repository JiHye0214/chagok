import { NextResponse } from "next/server";
import { sql } from "@/lib/db";

type DestinationCity = {
    city: string;
    latitude?: number | null;
    longitude?: number | null;
};

type Destination = {
    country: string;
    countryCode: string;
    cities: DestinationCity[];
};

export async function GET() {
    try {
        const trips = await sql`
            SELECT
                t.id,
                t.trip_type AS "tripType",
                t.title,

                COALESCE(
                    (
                        SELECT json_agg(
                            json_build_object(
                                'country',
                                CASE
                                    WHEN UPPER(td.country_code) = 'US' THEN 'United States'
                                    WHEN UPPER(td.country_code) = 'KR' THEN 'South Korea'
                                    ELSE td.country
                                END,
                                'countryCode', td.country_code,
                                'cities',
                                COALESCE(
                                    (
                                        SELECT json_agg(
                                            json_build_object(
                                                'city', tdc.city,
                                                'latitude', tdc.latitude,
                                                'longitude', tdc.longitude
                                            )
                                            ORDER BY tdc.sort_order ASC, tdc.id ASC
                                        )
                                        FROM trip_destination_cities tdc
                                        WHERE tdc.destination_id = td.id
                                    ),
                                    '[]'::json
                                )
                            )
                            ORDER BY td.sort_order ASC, td.id ASC
                        )
                        FROM trip_destinations td
                        WHERE td.trip_id = t.id
                    ),
                    '[]'::json
                ) AS destinations,

                t.start_date AS "startDate",
                t.end_date AS "endDate",
                t.people,
                t.budget,
                t.currency,
                t.rating,

                COALESCE(
                    (
                        SELECT SUM(te.amount)
                        FROM trip_expenses te
                        WHERE te.trip_id = t.id
                    ),
                    0
                ) AS "totalExpense"

            FROM trips t
            ORDER BY t.start_date DESC
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
            destinations,
            startDate,
            endDate,
            people,
            budget,
            currency,
            rating,
        } = body as {
            tripType: "upcoming" | "completed";
            title?: string;
            destinations?: Destination[];
            startDate: string;
            endDate: string;
            people: number | string;
            budget?: number | string;
            currency?: string;
            rating?: number | string;
        };

        // ----------------------------------------
        // 기본 validation
        // ----------------------------------------

        if (tripType !== "upcoming" && tripType !== "completed") {
            return NextResponse.json(
                { error: "잘못된 여행 유형입니다." },
                { status: 400 },
            );
        }

        if (!startDate || !endDate) {
            return NextResponse.json(
                { error: "여행 일정을 입력해주세요." },
                { status: 400 },
            );
        }

        if (new Date(endDate) < new Date(startDate)) {
            return NextResponse.json(
                { error: "여행 종료일은 시작일보다 빠를 수 없습니다." },
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

        // ----------------------------------------
        // 목적지 validation
        // ----------------------------------------

        if (!Array.isArray(destinations) || destinations.length === 0) {
            return NextResponse.json(
                { error: "여행지를 하나 이상 추가해주세요." },
                { status: 400 },
            );
        }

        const normalizedDestinations: Destination[] = [];

        for (const destination of destinations) {
            const country = String(destination?.country ?? "").trim();

            const countryCode = String(destination?.countryCode ?? "")
                .trim()
                .toUpperCase();

            if (!country || !countryCode) {
                return NextResponse.json(
                    { error: "국가 정보를 확인해주세요." },
                    { status: 400 },
                );
            }

            if (
                !Array.isArray(destination.cities) ||
                destination.cities.length === 0
            ) {
                return NextResponse.json(
                    {
                        error: `${country}에 도시를 하나 이상 추가해주세요.`,
                    },
                    { status: 400 },
                );
            }

            const normalizedCities: DestinationCity[] = [];

            for (const cityData of destination.cities) {
                const city = String(cityData?.city ?? "").trim();

                if (!city) {
                    return NextResponse.json(
                        { error: "도시 이름을 확인해주세요." },
                        { status: 400 },
                    );
                }

                const latitude =
                    cityData?.latitude === null ||
                    cityData?.latitude === undefined
                        ? null
                        : Number(cityData.latitude);

                const longitude =
                    cityData?.longitude === null ||
                    cityData?.longitude === undefined
                        ? null
                        : Number(cityData.longitude);

                if (
                    latitude !== null &&
                    (!Number.isFinite(latitude) ||
                        latitude < -90 ||
                        latitude > 90)
                ) {
                    return NextResponse.json(
                        {
                            error: `${city}의 위도 값이 올바르지 않습니다.`,
                        },
                        { status: 400 },
                    );
                }

                if (
                    longitude !== null &&
                    (!Number.isFinite(longitude) ||
                        longitude < -180 ||
                        longitude > 180)
                ) {
                    return NextResponse.json(
                        {
                            error: `${city}의 경도 값이 올바르지 않습니다.`,
                        },
                        { status: 400 },
                    );
                }

                normalizedCities.push({
                    city,
                    latitude,
                    longitude,
                });
            }

            normalizedDestinations.push({
                country,
                countryCode,
                cities: normalizedCities,
            });
        }

        // ----------------------------------------
        // 기존 trips 컬럼에는 첫 번째 목적지를 임시 저장
        // ----------------------------------------

        const firstDestination = normalizedDestinations[0];
        const firstCity = firstDestination.cities[0];

        // ----------------------------------------
        // 여행 생성
        // ----------------------------------------

        const [trip] = await sql`
            INSERT INTO trips (
                trip_type,
                title,
                city,
                country,
                country_code,
                latitude,
                longitude,
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

                ${firstCity.city},
                ${firstDestination.country},
                ${firstDestination.countryCode},
                ${firstCity.latitude},
                ${firstCity.longitude},

                ${startDate},
                ${endDate},
                ${parsedPeople},

                ${tripType === "upcoming" ? Number(budget) || 0 : null},

                ${currency || "CAD"},

                ${tripType === "completed" ? Number(rating) || 0 : 0}
            )
            RETURNING
                id,
                trip_type AS "tripType",
                title,
                start_date AS "startDate",
                end_date AS "endDate",
                people,
                budget,
                currency,
                rating
        `;

        if (!trip) {
            return NextResponse.json(
                { error: "여행 저장에 실패했습니다." },
                { status: 500 },
            );
        }

        // ----------------------------------------
        // 국가 + 도시 저장
        // ----------------------------------------

        const savedDestinations = [];

        for (
            let destinationIndex = 0;
            destinationIndex < normalizedDestinations.length;
            destinationIndex++
        ) {
            const destination = normalizedDestinations[destinationIndex];

            const [savedDestination] = await sql`
                INSERT INTO trip_destinations (
                    trip_id,
                    country,
                    country_code,
                    sort_order
                )
                VALUES (
                    ${trip.id},
                    ${destination.country},
                    ${destination.countryCode},
                    ${destinationIndex}
                )
                RETURNING
                    id,
                    country,
                    country_code AS "countryCode",
                    sort_order
            `;

            if (!savedDestination) {
                throw new Error("여행 국가 저장에 실패했습니다.");
            }

            const savedCities = [];

            for (
                let cityIndex = 0;
                cityIndex < destination.cities.length;
                cityIndex++
            ) {
                const city = destination.cities[cityIndex];

                const [savedCity] = await sql`
                    INSERT INTO trip_destination_cities (
                        destination_id,
                        city,
                        latitude,
                        longitude,
                        sort_order
                    )
                    VALUES (
                        ${savedDestination.id},
                        ${city.city},
                        ${city.latitude},
                        ${city.longitude},
                        ${cityIndex}
                    )
                    RETURNING
                        id,
                        city,
                        latitude,
                        longitude,
                        sort_order
                `;

                if (!savedCity) {
                    throw new Error("여행 도시 저장에 실패했습니다.");
                }

                savedCities.push(savedCity);
            }

            savedDestinations.push({
                country: savedDestination.country,
                countryCode: savedDestination.countryCode,
                cities: savedCities.map((city) => ({
                    city: city.city,
                    latitude: city.latitude,
                    longitude: city.longitude,
                })),
            });
        }

        // ----------------------------------------
        // 최종 응답
        // ----------------------------------------

        return NextResponse.json(
            {
                ...trip,
                destinations: savedDestinations,
            },
            { status: 201 },
        );
    } catch (error) {
        console.error("여행 저장 실패:", error);

        return NextResponse.json(
            { error: "여행을 저장하지 못했습니다." },
            { status: 500 },
        );
    }
}