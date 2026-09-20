import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/user";

export async function PUT(request: Request) {
    try {
        const user = await getCurrentUser();

        if (!user) {
            return NextResponse.json(
                {
                    error: "로그인이 필요해요.",
                },
                { status: 401 },
            );
        }

        const body = await request.json();
        const targetAmount = Number(body.targetAmount);

        if (!Number.isFinite(targetAmount) || targetAmount <= 0) {
            return NextResponse.json(
                {
                    error: "저축 목표 금액을 확인해주세요.",
                },
                { status: 400 },
            );
        }

        const existing = await sql`
            SELECT id
            FROM savings_goals
            WHERE user_id = ${user.id}
            ORDER BY id
            LIMIT 1
        `;

        let result;

        if (existing.length > 0) {
            result = await sql`
                UPDATE savings_goals
                SET target_amount = ${targetAmount}
                WHERE id = ${existing[0].id}
                  AND user_id = ${user.id}
                RETURNING id, name, target_amount
            `;
        } else {
            result = await sql`
                INSERT INTO savings_goals (
                    user_id,
                    name,
                    target_amount
                )
                VALUES (
                    ${user.id},
                    '저축 목표',
                    ${targetAmount}
                )
                RETURNING id, name, target_amount
            `;
        }

        return NextResponse.json({
            id: result[0].id,
            name: result[0].name,
            targetAmount: Number(result[0].target_amount),
        });
    } catch (error) {
        console.error("PUT /api/living/savings-goal error:", error);

        return NextResponse.json(
            {
                error: "저축 목표를 저장하지 못했어요.",
            },
            {
                status: 500,
            },
        );
    }
}
