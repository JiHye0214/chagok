import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/user";

type CategoryKind = "fixed" | "variable" | "income";

type CategoryRow = {
    id: number;
    name: string;
    kind: CategoryKind;
    sort_order: number;
    is_active?: boolean;
};

const isCategoryKind = (value: unknown): value is CategoryKind => {
    return value === "fixed" || value === "variable" || value === "income";
};

export async function GET() {
    try {
        const user = await getCurrentUser();

        if (!user) {
            return NextResponse.json({ error: "로그인이 필요해요." }, { status: 401 });
        }

        const rows = await sql`
            SELECT
                id,
                name,
                kind,
                sort_order
            FROM living_categories
            WHERE user_id = ${user.id}
              AND is_active = TRUE
            ORDER BY
                kind,
                sort_order,
                id
        `;

        const categories = (rows as CategoryRow[]).map((row) => ({
            id: row.id,
            name: row.name,
            kind: row.kind,
            sortOrder: row.sort_order,
        }));

        return NextResponse.json({
            categories,
        });
    } catch (error) {
        console.error("GET /api/living/categories error:", error);

        return NextResponse.json(
            {
                error: "생활 카테고리를 불러오지 못했어요.",
            },
            { status: 500 },
        );
    }
}

export async function POST(request: Request) {
    try {
        const user = await getCurrentUser();

        if (!user) {
            return NextResponse.json({ error: "로그인이 필요해요." }, { status: 401 });
        }

        const body = await request.json();

        const { name, kind } = body as {
            name?: string;
            kind?: CategoryKind;
        };

        const trimmedName = name?.trim();

        if (!trimmedName) {
            return NextResponse.json(
                {
                    error: "카테고리 이름을 입력해주세요.",
                },
                { status: 400 },
            );
        }

        if (!isCategoryKind(kind)) {
            return NextResponse.json(
                {
                    error: "카테고리 유형을 확인해주세요.",
                },
                { status: 400 },
            );
        }

        const existing = await sql`
            SELECT
                id,
                is_active
            FROM living_categories
            WHERE user_id = ${user.id}
              AND name = ${trimmedName}
              AND kind = ${kind}
            LIMIT 1
        `;

        if (existing.length > 0) {
            if (existing[0].is_active) {
                return NextResponse.json(
                    {
                        error: "이미 존재하는 카테고리예요.",
                    },
                    { status: 409 },
                );
            }

            // 비활성화된 기존 카테고리를 다시 활성화하는 경우
            // 현재 활성 카테고리가 5개인지 먼저 확인
            const categoryCount = await sql`
                SELECT COUNT(*)::int AS count
                FROM living_categories
                WHERE user_id = ${user.id}
                  AND is_active = TRUE
            `;

            const subscription = await sql`
                SELECT
                    p.code AS plan_code
                FROM subscriptions s
                JOIN plans p
                    ON p.id = s.plan_id
                WHERE s.user_id = ${user.id}
                LIMIT 1
            `;

            if (subscription.length === 0) {
                return NextResponse.json(
                    {
                        error: "구독 정보를 찾을 수 없습니다.",
                    },
                    { status: 403 },
                );
            }

            const planCode = subscription[0].plan_code;

            if (planCode === "free" && categoryCount[0].count >= 5) {
                return NextResponse.json(
                    {
                        error: "무료 플랜에서는 생활 카테고리를 최대 5개까지 만들 수 있어요.",
                        code: "LIVING_CATEGORY_LIMIT_REACHED",
                    },
                    { status: 403 },
                );
            }

            const sortResult = await sql`
                SELECT COALESCE(MAX(sort_order), -1) + 1 AS next_sort_order
                FROM living_categories
                WHERE user_id = ${user.id}
                  AND kind = ${kind}
            `;

            const nextSortOrder = Number(sortResult[0]?.next_sort_order ?? 0);

            const result = await sql`
                UPDATE living_categories
                SET
                    is_active = TRUE,
                    sort_order = ${nextSortOrder}
                WHERE id = ${existing[0].id}
                  AND user_id = ${user.id}
                RETURNING
                    id,
                    name,
                    kind,
                    sort_order
            `;

            const category = result[0] as CategoryRow;

            return NextResponse.json({
                success: true,
                category: {
                    id: category.id,
                    name: category.name,
                    kind: category.kind,
                    sortOrder: category.sort_order,
                },
            });
        }

        // 새로운 카테고리 추가
        const subscription = await sql`
            SELECT
                p.code AS plan_code
            FROM subscriptions s
            JOIN plans p
                ON p.id = s.plan_id
            WHERE s.user_id = ${user.id}
            LIMIT 1
        `;

        if (subscription.length === 0) {
            return NextResponse.json(
                {
                    error: "구독 정보를 찾을 수 없습니다.",
                },
                { status: 403 },
            );
        }

        const planCode = subscription[0].plan_code;

        if (planCode === "free") {
            const categoryCount = await sql`
                SELECT COUNT(*)::int AS count
                FROM living_categories
                WHERE user_id = ${user.id}
                  AND is_active = TRUE
            `;

            if (categoryCount[0].count >= 5) {
                return NextResponse.json(
                    {
                        error: "무료 플랜에서는 생활 카테고리를 최대 5개까지 만들 수 있어요.",
                        code: "LIVING_CATEGORY_LIMIT_REACHED",
                    },
                    { status: 403 },
                );
            }
        }

        const sortResult = await sql`
            SELECT COALESCE(MAX(sort_order), -1) + 1 AS next_sort_order
            FROM living_categories
            WHERE user_id = ${user.id}
              AND kind = ${kind}
        `;

        const nextSortOrder = Number(sortResult[0]?.next_sort_order ?? 0);

        const result = await sql`
            INSERT INTO living_categories (
                user_id,
                name,
                kind,
                sort_order,
                is_active
            )
            VALUES (
                ${user.id},
                ${trimmedName},
                ${kind},
                ${nextSortOrder},
                TRUE
            )
            RETURNING
                id,
                name,
                kind,
                sort_order
        `;

        const category = result[0] as CategoryRow;

        return NextResponse.json(
            {
                success: true,
                category: {
                    id: category.id,
                    name: category.name,
                    kind: category.kind,
                    sortOrder: category.sort_order,
                },
            },
            { status: 201 },
        );
    } catch (error) {
        console.error("POST /api/living/categories error:", error);

        return NextResponse.json(
            {
                error: "생활 카테고리를 추가하지 못했어요.",
            },
            { status: 500 },
        );
    }
}

export async function PATCH(request: Request) {
    try {
        const user = await getCurrentUser();

        if (!user) {
            return NextResponse.json({ error: "로그인이 필요해요." }, { status: 401 });
        }

        const body = await request.json();

        const { id, name } = body as {
            id?: number;
            name?: string;
        };

        const categoryId = Number(id);
        const trimmedName = name?.trim();

        if (!categoryId || !trimmedName) {
            return NextResponse.json(
                {
                    error: "카테고리 정보를 확인해주세요.",
                },
                { status: 400 },
            );
        }

        const existing = await sql`
            SELECT
                id,
                kind
            FROM living_categories
            WHERE id = ${categoryId}
              AND user_id = ${user.id}
            LIMIT 1
        `;

        if (existing.length === 0) {
            return NextResponse.json(
                {
                    error: "카테고리를 찾을 수 없어요.",
                },
                { status: 404 },
            );
        }

        const duplicate = await sql`
            SELECT id
            FROM living_categories
            WHERE user_id = ${user.id}
              AND name = ${trimmedName}
              AND kind = ${existing[0].kind}
              AND id <> ${categoryId}
              AND is_active = TRUE
            LIMIT 1
        `;

        if (duplicate.length > 0) {
            return NextResponse.json(
                {
                    error: "이미 존재하는 카테고리예요.",
                },
                { status: 409 },
            );
        }

        const result = await sql`
            UPDATE living_categories
            SET name = ${trimmedName}
            WHERE id = ${categoryId}
              AND user_id = ${user.id}
            RETURNING
                id,
                name,
                kind,
                sort_order
        `;

        const category = result[0] as CategoryRow;

        return NextResponse.json({
            success: true,
            category: {
                id: category.id,
                name: category.name,
                kind: category.kind,
                sortOrder: category.sort_order,
            },
        });
    } catch (error) {
        console.error("PATCH /api/living/categories error:", error);

        return NextResponse.json(
            {
                error: "카테고리를 수정하지 못했어요.",
            },
            { status: 500 },
        );
    }
}

export async function DELETE(request: Request) {
    try {
        const user = await getCurrentUser();

        if (!user) {
            return NextResponse.json({ error: "로그인이 필요해요." }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const id = Number(searchParams.get("id"));

        if (!id) {
            return NextResponse.json(
                {
                    error: "카테고리를 확인해주세요.",
                },
                { status: 400 },
            );
        }

        const result = await sql`
            UPDATE living_categories
            SET is_active = FALSE
            WHERE id = ${id}
              AND user_id = ${user.id}
            RETURNING id
        `;

        if (result.length === 0) {
            return NextResponse.json(
                {
                    error: "카테고리를 찾을 수 없어요.",
                },
                { status: 404 },
            );
        }

        return NextResponse.json({
            success: true,
        });
    } catch (error) {
        console.error("DELETE /api/living/categories error:", error);

        return NextResponse.json(
            {
                error: "카테고리를 삭제하지 못했어요.",
            },
            { status: 500 },
        );
    }
}
