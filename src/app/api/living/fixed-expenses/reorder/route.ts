import { NextResponse } from "next/server";
import { sql } from "@/lib/db";

export async function PATCH(request: Request) {
    try {
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
            WHERE is_active = TRUE
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
