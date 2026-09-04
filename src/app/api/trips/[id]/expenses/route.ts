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

        const expenses = await sql`
            SELECT
                te.id,
                te.trip_id,
                te.expense_date,
                te.category_id,
                te.expression,
                te.amount,
                tec.name AS category
            FROM trip_expenses te
            JOIN trip_expense_categories tec
                ON te.category_id = tec.id
            WHERE te.trip_id = ${tripId}
            ORDER BY te.expense_date ASC, tec.sort_order ASC, tec.id ASC
        `;

        return NextResponse.json(expenses);
    } catch (error) {
        console.error("여행 경비 조회 실패:", error);

        return NextResponse.json(
            { error: "여행 경비 조회에 실패했습니다." },
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

        const expenseDate = String(body.expenseDate ?? "");
        const categoryId = Number(body.categoryId);
        const expression = String(body.expression ?? "");
        const amount = Number(body.amount);

        if (!expenseDate) {
            return NextResponse.json(
                { error: "날짜가 필요합니다." },
                { status: 400 },
            );
        }

        if (!Number.isInteger(categoryId)) {
            return NextResponse.json(
                { error: "잘못된 카테고리 ID입니다." },
                { status: 400 },
            );
        }

        if (!Number.isFinite(amount) || amount < 0) {
            return NextResponse.json(
                { error: "올바른 금액이 아닙니다." },
                { status: 400 },
            );
        }

        // 카테고리가 해당 여행에 속하는지 확인
        const [category] = await sql`
            SELECT id
            FROM trip_expense_categories
            WHERE id = ${categoryId}
              AND trip_id = ${tripId}
        `;

        if (!category) {
            return NextResponse.json(
                { error: "해당 여행의 카테고리가 아닙니다." },
                { status: 400 },
            );
        }

        // 입력값이 없거나 금액이 0이면 삭제
        if (!expression.trim() || amount === 0) {
            await sql`
                DELETE FROM trip_expenses
                WHERE trip_id = ${tripId}
                  AND expense_date = ${expenseDate}
                  AND category_id = ${categoryId}
            `;

            return NextResponse.json({
                deleted: true,
                expenseDate,
                categoryId,
            });
        }

        const [saved] = await sql`
            INSERT INTO trip_expenses (
                trip_id,
                expense_date,
                category_id,
                expression,
                amount
            )
            VALUES (
                ${tripId},
                ${expenseDate},
                ${categoryId},
                ${expression},
                ${amount}
            )
            ON CONFLICT (trip_id, expense_date, category_id)
            DO UPDATE SET
                expression = EXCLUDED.expression,
                amount = EXCLUDED.amount,
                updated_at = CURRENT_TIMESTAMP
            RETURNING
                id,
                trip_id,
                expense_date,
                category_id,
                expression,
                amount
        `;

        return NextResponse.json(saved);
    } catch (error) {
        console.error("여행 경비 저장 실패:", error);

        return NextResponse.json(
            { error: "여행 경비 저장에 실패했습니다." },
            { status: 500 },
        );
    }
}