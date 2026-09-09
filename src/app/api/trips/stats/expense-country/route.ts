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
            GROUP BY tec.name
            ORDER BY amount DESC
        `;

        const topFive = categories.slice(0, 5);
        const rest = categories.slice(5);

        const otherAmount = rest.reduce((sum, item) => sum + Number(item.amount), 0);

        const result = [...topFive];

        if (otherAmount > 0) {
            result.push({
                category: "기타",
                amount: otherAmount,
            });
        }

        const totalExpense = result.reduce((sum, item) => sum + Number(item.amount), 0);

        const stats = result.map((item) => ({
            category: item.category,
            amount: Number(item.amount),
            percentage: totalExpense > 0 ? Number(((Number(item.amount) / totalExpense) * 100).toFixed(1)) : 0,
        }));

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
