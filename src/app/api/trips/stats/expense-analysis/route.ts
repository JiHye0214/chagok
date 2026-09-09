import { NextResponse } from "next/server";
import { sql } from "@/lib/db";

export async function GET() {
    try {
        const trips = await sql`
            SELECT
                t.id,
                t.title,
                t.city,
                t.country,
                t.country_code AS "countryCode",
                t.start_date AS "startDate",
                t.end_date AS "endDate",
                t.people,
                t.currency,
                COALESCE(
                    (
                        SELECT SUM(te.amount)
                        FROM trip_expenses te
                        WHERE te.trip_id = t.id
                    ),
                    0
                ) AS "totalExpense"
            FROM trips t
            WHERE t.trip_type = 'completed'
            ORDER BY t.end_date DESC
        `;

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
            GROUP BY tec.name
            ORDER BY amount DESC
        `;

        const dailyExpenses = await sql`
            SELECT
                te.expense_date AS "expenseDate",
                COALESCE(SUM(te.amount), 0) AS amount
            FROM trip_expenses te
            JOIN trips t
                ON te.trip_id = t.id
            WHERE t.trip_type = 'completed'
            GROUP BY te.expense_date
            ORDER BY te.expense_date ASC
        `;

        const tripStats = trips.map((trip) => {
            const startDate = new Date(trip.startDate);
            const endDate = new Date(trip.endDate);

            const nights = Math.max(1, Math.round((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)));

            const people = Math.max(1, Number(trip.people ?? 1));
            const totalExpense = Number(trip.totalExpense ?? 0);

            return {
                id: trip.id,
                title: trip.title,
                city: trip.city,
                country: trip.country,
                countryCode: trip.countryCode,
                startDate: trip.startDate,
                endDate: trip.endDate,
                people,
                currency: trip.currency || "CAD",
                totalExpense,
                nights,
                averagePerNight: totalExpense / nights,
                averagePerPersonPerNight: totalExpense / nights / people,
            };
        });

        const totalExpense = tripStats.reduce((sum, trip) => sum + trip.totalExpense, 0);

        const totalNights = tripStats.reduce((sum, trip) => sum + trip.nights, 0);

        const averagePerNight = totalNights > 0 ? totalExpense / totalNights : 0;

        const topCategory = categories[0]
            ? {
                  category: categories[0].category,
                  amount: Number(categories[0].amount),
              }
            : null;

        /*
         * 현재 앱은 여러 통화를 지원하지만
         * 환율 변환 없이 금액을 합산할 수밖에 없는 구조이므로,
         * 가장 많이 사용된 통화를 대표 통화로 사용한다.
         */
        const currencyCounts = tripStats.reduce<Record<string, number>>((result, trip) => {
            result[trip.currency] = (result[trip.currency] ?? 0) + 1;
            return result;
        }, {});

        const currency = Object.entries(currencyCounts).sort(([, countA], [, countB]) => countB - countA)[0]?.[0] ?? "CAD";

        return NextResponse.json({
            summary: {
                totalExpense,
                totalNights,
                averagePerNight,
                tripCount: tripStats.length,
                currency,
                topCategory,
            },

            categories: categories.map((item) => ({
                category: item.category,
                amount: Number(item.amount),
            })),

            trips: tripStats,

            dailyExpenses: dailyExpenses.map((item) => ({
                expenseDate: item.expenseDate,
                amount: Number(item.amount),
            })),
        });
    } catch (error) {
        console.error("여행 소비 분석 조회 실패:", error);

        return NextResponse.json(
            {
                error: "여행 소비 분석을 불러오지 못했습니다.",
            },
            { status: 500 },
        );
    }
}
