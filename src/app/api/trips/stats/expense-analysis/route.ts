import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/user";

export async function GET() {
    try {
        const user = await getCurrentUser();

        if (!user) {
            return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
        }

        // --------------------------------------------------------
        // Pro 플랜 확인
        // --------------------------------------------------------

        const [subscription] = await sql`
            SELECT
                p.code AS plan_code
            FROM subscriptions s
            JOIN plans p
                ON p.id = s.plan_id
            WHERE s.user_id = ${user.id}
            LIMIT 1
        `;

        const planCode = subscription?.plan_code ?? "free";

        if (planCode === "free") {
            return NextResponse.json(
                {
                    error: "여행 소비 분석은 Pro 플랜에서 사용할 수 있어요.",
                    code: "TRIP_EXPENSE_ANALYSIS_PRO_ONLY",
                },
                { status: 403 },
            );
        }

        // --------------------------------------------------------
        // 여행별 소비
        // --------------------------------------------------------

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

            WHERE t.user_id = ${user.id}
              AND t.trip_type = 'completed'

            ORDER BY t.end_date DESC
        `;

        // --------------------------------------------------------
        // 카테고리별 소비
        // --------------------------------------------------------

        const categories = await sql`
            SELECT
                tec.name AS category,
                COALESCE(
                    SUM(te.amount),
                    0
                ) AS amount

            FROM trip_expenses te

            JOIN trip_expense_categories tec
                ON te.category_id = tec.id

            JOIN trips t
                ON te.trip_id = t.id

            WHERE t.user_id = ${user.id}
              AND t.trip_type = 'completed'

            GROUP BY tec.name

            ORDER BY amount DESC
        `;

        // --------------------------------------------------------
        // 날짜별 소비
        // --------------------------------------------------------

        const dailyExpenses = await sql`
            SELECT
                te.expense_date AS "expenseDate",
                COALESCE(
                    SUM(te.amount),
                    0
                ) AS amount

            FROM trip_expenses te

            JOIN trips t
                ON te.trip_id = t.id

            WHERE t.user_id = ${user.id}
              AND t.trip_type = 'completed'

            GROUP BY te.expense_date

            ORDER BY te.expense_date ASC
        `;

        // --------------------------------------------------------
        // 여행별 통계 계산
        // --------------------------------------------------------

        const tripStats = trips.map((trip) => {
            const startDate = new Date(trip.startDate);

            const endDate = new Date(trip.endDate);

            const nights = Math.max(1, Math.round((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)));

            const people = Math.max(1, Number(trip.people ?? 1));

            const totalExpense = Number(trip.totalExpense ?? 0);

            return {
                id: Number(trip.id),

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

        // --------------------------------------------------------
        // 전체 소비
        // --------------------------------------------------------

        const totalExpense = tripStats.reduce((sum, trip) => sum + trip.totalExpense, 0);

        const totalNights = tripStats.reduce((sum, trip) => sum + trip.nights, 0);

        const averagePerNight = totalNights > 0 ? totalExpense / totalNights : 0;

        // --------------------------------------------------------
        // 가장 많이 사용한 카테고리
        // --------------------------------------------------------

        const topCategory = categories[0]
            ? {
                  category: categories[0].category,

                  amount: Number(categories[0].amount),
              }
            : null;

        // --------------------------------------------------------
        // 대표 통화
        //
        // 현재 앱은 여러 통화를 지원하지만
        // 환율 변환 없이 합산하는 구조이므로
        // 가장 많이 사용된 통화를 대표 통화로 사용한다.
        // --------------------------------------------------------

        const currencyCounts = tripStats.reduce<Record<string, number>>((result, trip) => {
            result[trip.currency] = (result[trip.currency] ?? 0) + 1;

            return result;
        }, {});

        const currency = Object.entries(currencyCounts).sort(([, countA], [, countB]) => countB - countA)[0]?.[0] ?? "CAD";

        // --------------------------------------------------------
        // 최종 응답
        // --------------------------------------------------------

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
