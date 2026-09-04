import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> },
) {
    try {
        const { id } = await params;
        const tripId = Number(id);

        if (!Number.isInteger(tripId)) {
            return NextResponse.json(
                { error: "잘못된 여행 ID입니다." },
                { status: 400 },
            );
        }

        const categories = await sql`
            SELECT
                id,
                trip_id,
                name,
                sort_order
            FROM trip_expense_categories
            WHERE trip_id = ${tripId}
            ORDER BY sort_order ASC, id ASC
        `;

        return NextResponse.json(categories);
    } catch (error) {
        console.error("여행 경비 카테고리 조회 실패:", error);

        return NextResponse.json(
            { error: "여행 경비 카테고리 조회에 실패했습니다." },
            { status: 500 },
        );
    }
}

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> },
) {
    try {
        const { id } = await params;
        const tripId = Number(id);

        if (!Number.isInteger(tripId)) {
            return NextResponse.json(
                { error: "잘못된 여행 ID입니다." },
                { status: 400 },
            );
        }

        const body = await request.json();
        const name = String(body.name ?? "").trim();

        if (!name) {
            return NextResponse.json(
                { error: "카테고리 이름을 입력해주세요." },
                { status: 400 },
            );
        }

        const [lastCategory] = await sql`
            SELECT sort_order
            FROM trip_expense_categories
            WHERE trip_id = ${tripId}
            ORDER BY sort_order DESC
            LIMIT 1
        `;

        const sortOrder = lastCategory
            ? Number(lastCategory.sort_order) + 1
            : 0;

        const [category] = await sql`
            INSERT INTO trip_expense_categories (
                trip_id,
                name,
                sort_order
            )
            VALUES (
                ${tripId},
                ${name},
                ${sortOrder}
            )
            RETURNING
                id,
                trip_id,
                name,
                sort_order
        `;

        return NextResponse.json(category, { status: 201 });
    } catch (error) {
        console.error("여행 경비 카테고리 추가 실패:", error);

        return NextResponse.json(
            { error: "여행 경비 카테고리 추가에 실패했습니다." },
            { status: 500 },
        );
    }
}

export async function PUT(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> },
) {
    try {
        const { id } = await params;
        const tripId = Number(id);

        if (!Number.isInteger(tripId)) {
            return NextResponse.json(
                { error: "잘못된 여행 ID입니다." },
                { status: 400 },
            );
        }

        const body = await request.json();
        const categoryId = Number(body.categoryId);
        const name = body.name !== undefined
            ? String(body.name).trim()
            : undefined;
        const sortOrder = body.sortOrder !== undefined
            ? Number(body.sortOrder)
            : undefined;

        if (!Number.isInteger(categoryId)) {
            return NextResponse.json(
                { error: "잘못된 카테고리 ID입니다." },
                { status: 400 },
            );
        }

        if (name !== undefined && !name) {
            return NextResponse.json(
                { error: "카테고리 이름을 입력해주세요." },
                { status: 400 },
            );
        }

        if (sortOrder !== undefined && !Number.isInteger(sortOrder)) {
            return NextResponse.json(
                { error: "잘못된 순서입니다." },
                { status: 400 },
            );
        }

        const [category] = await sql`
            UPDATE trip_expense_categories
            SET
                name = COALESCE(${name ?? null}, name),
                sort_order = COALESCE(${sortOrder ?? null}, sort_order)
            WHERE id = ${categoryId}
              AND trip_id = ${tripId}
            RETURNING
                id,
                trip_id,
                name,
                sort_order
        `;

        if (!category) {
            return NextResponse.json(
                { error: "카테고리를 찾을 수 없습니다." },
                { status: 404 },
            );
        }

        return NextResponse.json(category);
    } catch (error) {
        console.error("여행 경비 카테고리 수정 실패:", error);

        return NextResponse.json(
            { error: "여행 경비 카테고리 수정에 실패했습니다." },
            { status: 500 },
        );
    }
}

export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> },
) {
    try {
        const { id } = await params;
        const tripId = Number(id);

        if (!Number.isInteger(tripId)) {
            return NextResponse.json(
                { error: "잘못된 여행 ID입니다." },
                { status: 400 },
            );
        }

        const categoryId = Number(request.nextUrl.searchParams.get("categoryId"));

        if (!Number.isInteger(categoryId)) {
            return NextResponse.json(
                { error: "잘못된 카테고리 ID입니다." },
                { status: 400 },
            );
        }

        await sql`
            DELETE FROM trip_expense_categories
            WHERE id = ${categoryId}
              AND trip_id = ${tripId}
        `;

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("여행 경비 카테고리 삭제 실패:", error);

        return NextResponse.json(
            { error: "여행 경비 카테고리 삭제에 실패했습니다." },
            { status: 500 },
        );
    }
}