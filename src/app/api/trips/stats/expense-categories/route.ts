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
        // 사용자 여행의 카테고리별 소비
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

            GROUP BY tec.name

            ORDER BY amount DESC
        `;

        // 상위 5개 카테고리
        const topFive = categories.slice(0, 5);

        // 나머지는 기타로 합산
        const rest = categories.slice(5);

        const otherAmount = rest.reduce((sum, item) => sum + Number(item.amount), 0);

        const result = [...topFive];

        if (otherAmount > 0) {
            result.push({
                category: "기타",
                amount: otherAmount,
            });
        }

        // 전체 금액
        const total = result.reduce((sum, item) => sum + Number(item.amount), 0);

        // 비율 계산
        const stats = result.map((item) => ({
            category: item.category,

            amount: Number(item.amount),

            percentage: total > 0 ? Number(((Number(item.amount) / total) * 100).toFixed(1)) : 0,
        }));

        return NextResponse.json(stats);
    } catch (error) {
        console.error("카테고리별 소비 통계 조회 실패:", error);

        return NextResponse.json(
            {
                error: "카테고리별 소비 통계를 불러오지 못했습니다.",
            },
            { status: 500 },
        );
    }
}
