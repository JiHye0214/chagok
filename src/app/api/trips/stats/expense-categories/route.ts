import { NextResponse } from "next/server";
import { sql } from "@/lib/db";

export async function GET() {
    try {
        const categories = await sql`
            SELECT
                tec.name AS category,
                COALESCE(SUM(te.amount), 0) AS amount
            FROM trip_expenses te
            JOIN trip_expense_categories tec
                ON te.category_id = tec.id
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

        const total = result.reduce((sum, item) => sum + Number(item.amount), 0);

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
