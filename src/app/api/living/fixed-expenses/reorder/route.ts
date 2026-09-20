import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/user";

async function getPlanCode(userId: string) {
    const [subscription] = await sql`
        SELECT
            p.code AS plan_code
        FROM subscriptions s
        JOIN plans p
            ON p.id = s.plan_id
        WHERE s.user_id = ${userId}
        LIMIT 1
    `;

    return subscription?.plan_code ?? "free";
}

const isPro = (planCode: string) => planCode !== "free";

export async function PATCH(request: Request) {
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

        const planCode = await getPlanCode(user.id);

        if (!isPro(planCode)) {
            return NextResponse.json(
                {
                    error: "고정지출은 Pro 플랜에서 사용할 수 있어요.",
                    code: "FIXED_EXPENSE_PRO_ONLY",
                },
                { status: 403 },
            );
        }

        const body = await request.json();

        const { ids } = body as {
            ids?: unknown;
        };

        if (!Array.isArray(ids)) {
            return NextResponse.json(
                {
                    error: "정렬할 고정지출 목록이 필요해요.",
                },
                { status: 400 },
            );
        }

        const normalizedIds = ids.map((id) => Number(id));

        const hasInvalidId = normalizedIds.some((id) => !Number.isInteger(id) || id <= 0);

        if (hasInvalidId) {
            return NextResponse.json(
                {
                    error: "고정지출 목록을 확인해주세요.",
                },
                { status: 400 },
            );
        }

        const uniqueIds = new Set(normalizedIds);

        if (uniqueIds.size !== normalizedIds.length) {
            return NextResponse.json(
                {
                    error: "중복된 고정지출이 있어요.",
                },
                { status: 400 },
            );
        }

        if (normalizedIds.length === 0) {
            return NextResponse.json({
                success: true,
            });
        }

        const existingRows = await sql`
            SELECT id
            FROM living_fixed_expenses
            WHERE user_id = ${user.id}
              AND is_active = TRUE
              AND id = ANY(${normalizedIds})
        `;

        if (existingRows.length !== normalizedIds.length) {
            return NextResponse.json(
                {
                    error: "존재하지 않는 고정지출이 포함되어 있어요.",
                },
                { status: 400 },
            );
        }

        await sql.transaction(
            normalizedIds.map(
                (id, index) => sql`
                    UPDATE living_fixed_expenses
                    SET
                        sort_order = ${index},
                        updated_at = CURRENT_TIMESTAMP
                    WHERE id = ${id}
                      AND user_id = ${user.id}
                      AND is_active = TRUE
                `,
            ),
        );

        return NextResponse.json({
            success: true,
        });
    } catch (error) {
        console.error("PATCH /api/living/fixed-expenses/reorder error:", error);

        return NextResponse.json(
            {
                error: "고정지출 순서를 저장하지 못했어요.",
            },
            { status: 500 },
        );
    }
}
