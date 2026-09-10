import { NextResponse } from "next/server";
import { sql } from "@/lib/db";

type RouteContext = {
    params: Promise<{
        id: string;
    }>;
};

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

export async function PUT(request: Request, context: RouteContext) {
    try {
        const { id } = await context.params;
        const tripId = Number(id);

        if (!Number.isInteger(tripId)) {
            return NextResponse.json({ error: "잘못된 여행 ID입니다." }, { status: 400 });
        }

        const body = await request.json();

        const { title, destinations, startDate, endDate, people, rating } = body as {
            title?: string;
            destinations?: Destination[];
            startDate: string;
            endDate: string;
            people: number | string;
            rating?: number | string;
        };

        // ----------------------------------------
        // 기본 validation
        // ----------------------------------------

        if (!startDate || !endDate) {
            return NextResponse.json({ error: "여행 일정을 입력해주세요." }, { status: 400 });
        }

        if (new Date(endDate) < new Date(startDate)) {
            return NextResponse.json({ error: "여행 종료일은 시작일보다 빠를 수 없습니다." }, { status: 400 });
        }

        const parsedPeople = Number(people);

        if (!Number.isInteger(parsedPeople) || parsedPeople < 1) {
            return NextResponse.json({ error: "인원은 1명 이상이어야 합니다." }, { status: 400 });
        }

        // ----------------------------------------
        // 목적지 validation
        // ----------------------------------------

        if (!Array.isArray(destinations) || destinations.length === 0) {
            return NextResponse.json({ error: "여행지를 하나 이상 추가해주세요." }, { status: 400 });
        }

        const normalizedDestinations: Destination[] = [];

        for (const destination of destinations) {
            const country = String(destination?.country ?? "").trim();

            const countryCode = String(destination?.countryCode ?? "")
                .trim()
                .toUpperCase();

            if (!country || !countryCode) {
                return NextResponse.json({ error: "국가 정보를 확인해주세요." }, { status: 400 });
            }

            if (!Array.isArray(destination.cities) || destination.cities.length === 0) {
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
                    return NextResponse.json({ error: "도시 이름을 확인해주세요." }, { status: 400 });
                }

                const latitude =
                    cityData?.latitude === null || cityData?.latitude === undefined ? null : Number(cityData.latitude);

                const longitude =
                    cityData?.longitude === null || cityData?.longitude === undefined ? null : Number(cityData.longitude);

                if (latitude !== null && (!Number.isFinite(latitude) || latitude < -90 || latitude > 90)) {
                    return NextResponse.json(
                        {
                            error: `${city}의 위도 값이 올바르지 않습니다.`,
                        },
                        { status: 400 },
                    );
                }

                if (longitude !== null && (!Number.isFinite(longitude) || longitude < -180 || longitude > 180)) {
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
        // 기존 여행 확인
        // ----------------------------------------

        const [existingTrip] = await sql`
            SELECT
                id,
                trip_type AS "tripType"
            FROM trips
            WHERE id = ${tripId}
        `;

        if (!existingTrip) {
            return NextResponse.json({ error: "여행을 찾을 수 없습니다." }, { status: 404 });
        }

        // ----------------------------------------
        // 기존 trips 목적지 컬럼은
        // 첫 번째 국가/도시를 임시로 유지
        // ----------------------------------------

        const firstDestination = normalizedDestinations[0];
        const firstCity = firstDestination.cities[0];

        // ----------------------------------------
        // 여행 기본 정보 수정
        // ----------------------------------------

        const [trip] = await sql`
            UPDATE trips
            SET
                title = ${title?.trim() || null},

                city = ${firstCity.city},
                country = ${firstDestination.country},
                country_code = ${firstDestination.countryCode},
                latitude = ${firstCity.latitude},
                longitude = ${firstCity.longitude},

                start_date = ${startDate},
                end_date = ${endDate},
                people = ${parsedPeople},
                rating = ${Number(rating) || 0}
            WHERE id = ${tripId}
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

        // ----------------------------------------
        // 기존 목적지 삭제
        // ----------------------------------------
        //
        // trip_destinations 삭제 시
        // trip_destination_cities도 CASCADE 삭제됨
        //

        await sql`
            DELETE FROM trip_destinations
            WHERE trip_id = ${tripId}
        `;

        // ----------------------------------------
        // 새로운 국가 + 도시 저장
        // ----------------------------------------

        const savedDestinations = [];

        for (let destinationIndex = 0; destinationIndex < normalizedDestinations.length; destinationIndex++) {
            const destination = normalizedDestinations[destinationIndex];

            const [savedDestination] = await sql`
                INSERT INTO trip_destinations (
                    trip_id,
                    country,
                    country_code,
                    sort_order
                )
                VALUES (
                    ${tripId},
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

            for (let cityIndex = 0; cityIndex < destination.cities.length; cityIndex++) {
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

                savedCities.push({
                    city: savedCity.city,
                    latitude: savedCity.latitude,
                    longitude: savedCity.longitude,
                });
            }

            savedDestinations.push({
                country: savedDestination.country,
                countryCode: savedDestination.countryCode,
                cities: savedCities,
            });
        }

        // ----------------------------------------
        // 최종 응답
        // ----------------------------------------

        return NextResponse.json({
            ...trip,
            destinations: savedDestinations,
        });
    } catch (error) {
        console.error("여행 수정 실패:", error);

        return NextResponse.json({ error: "여행을 수정하지 못했습니다." }, { status: 500 });
    }
}

export async function DELETE(request: Request, context: RouteContext) {
    try {
        const { id } = await context.params;
        const tripId = Number(id);

        if (!Number.isInteger(tripId)) {
            return NextResponse.json({ error: "잘못된 여행 ID입니다." }, { status: 400 });
        }

        // ----------------------------------------
        // 여행 존재 여부 확인
        // ----------------------------------------

        const [existingTrip] = await sql`
            SELECT id
            FROM trips
            WHERE id = ${tripId}
        `;

        if (!existingTrip) {
            return NextResponse.json({ error: "여행을 찾을 수 없습니다." }, { status: 404 });
        }

        // ----------------------------------------
        // 여행 경비 삭제
        // ----------------------------------------

        await sql`
            DELETE FROM trip_expenses
            WHERE trip_id = ${tripId}
        `;

        // ----------------------------------------
        // 경비 카테고리 삭제
        // ----------------------------------------

        await sql`
            DELETE FROM trip_expense_categories
            WHERE trip_id = ${tripId}
        `;

        // ----------------------------------------
        // 여행 목적지 삭제
        // ----------------------------------------
        //
        // trip_destination_cities는
        // destination_id 기준 CASCADE 삭제
        //

        await sql`
            DELETE FROM trip_destinations
            WHERE trip_id = ${tripId}
        `;

        // ----------------------------------------
        // 여행 삭제
        // ----------------------------------------

        await sql`
            DELETE FROM trips
            WHERE id = ${tripId}
        `;

        return NextResponse.json({
            success: true,
        });
    } catch (error) {
        console.error("여행 삭제 실패:", error);

        return NextResponse.json({ error: "여행을 삭제하지 못했습니다." }, { status: 500 });
    }
}
