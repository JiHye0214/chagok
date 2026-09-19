import { NextResponse } from "next/server";
import { sql } from "@/lib/db";

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const countryCode = searchParams.get("countryCode");

        if (!countryCode) {
            return NextResponse.json(
                {
                    error: "국가 코드가 필요합니다.",
                },
                { status: 400 },
            );
        }

        const categories = await sql`
            SELECT
                tec.name AS category,
                COALESCE(SUM(te.amount), 0) AS amount
            FROM trip_expenses te
            JOIN trip_expense_categories tec
                ON te.category_id = tec.id
            JOIN trips t
                ON te.trip_id = t.id
            WHERE t.trip_type = 'completed'
              AND t.country_code = ${countryCode}
              AND tec.name <> '총지출'
            GROUP BY tec.name
            ORDER BY amount DESC
        `;

        // --------------------------------------------------
        // 카테고리 정리
        // --------------------------------------------------

        // 이미 존재하는 "기타" 금액
        const existingOther = categories.find((item) => item.category === "기타");

        const existingOtherAmount = existingOther ? Number(existingOther.amount) : 0;

        // "기타"를 제외한 실제 카테고리
        const normalCategories = categories.filter((item) => item.category !== "기타");

        // 상위 5개 카테고리
        const topFive = normalCategories.slice(0, 5);

        // 상위 5개에 포함되지 않은 나머지
        const rest = normalCategories.slice(5);

        // 나머지 카테고리는 모두 "기타"로 합침
        const restOtherAmount = rest.reduce((sum, item) => sum + Number(item.amount), 0);

        // 기존 "기타" + 나머지 카테고리의 금액
        const otherAmount = existingOtherAmount + restOtherAmount;

        const result = [...topFive];

        // 기타는 항상 한 번만 추가
        if (otherAmount > 0) {
            result.push({
                category: "기타",
                amount: otherAmount,
            });
        }

        // --------------------------------------------------
        // 비율 계산
        // --------------------------------------------------

        const totalExpense = result.reduce((sum, item) => sum + Number(item.amount), 0);

        const stats = result.map((item) => ({
            category: item.category,
            amount: Number(item.amount),
            percentage: totalExpense > 0 ? Number(((Number(item.amount) / totalExpense) * 100).toFixed(1)) : 0,
        }));

        // --------------------------------------------------
        // 여행별 숙박일수 / 평균 지출
        // --------------------------------------------------

        const trips = await sql`
            SELECT
                t.start_date AS "startDate",
                t.end_date AS "endDate",
                COALESCE(
                    (
                        SELECT SUM(te2.amount)
                        FROM trip_expenses te2
                        WHERE te2.trip_id = t.id
                    ),
                    0
                ) AS "totalExpense"
            FROM trips t
            WHERE t.trip_type = 'completed'
              AND t.country_code = ${countryCode}
        `;

        const totalNights = trips.reduce((sum, trip) => {
            const startDate = new Date(trip.startDate);
            const endDate = new Date(trip.endDate);

            const nights = Math.max(1, Math.round((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)));

            return sum + nights;
        }, 0);

        const averagePerNight = totalNights > 0 ? totalExpense / totalNights : 0;

        // --------------------------------------------------
        // 국가 정보
        // --------------------------------------------------

        const country = await sql`
            SELECT
                country AS "country",
                country_code AS "countryCode"
            FROM trips
            WHERE trip_type = 'completed'
              AND country_code = ${countryCode}
            LIMIT 1
        `;

        return NextResponse.json({
            country: country[0]?.country ?? countryCode,
            countryCode,
            categories: stats,
            summary: {
                totalExpense,
                totalNights,
                averagePerNight,
                tripCount: trips.length,
            },
        });
    } catch (error) {
        console.error("국가별 소비 통계 조회 실패:", error);

        return NextResponse.json(
            {
                error: "국가별 소비 통계를 불러오지 못했습니다.",
            },
            { status: 500 },
        );
    }
}
