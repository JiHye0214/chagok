import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/user";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const user = await getCurrentUser();

        if (!user) {
            return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
        }

        const { id } = await params;
        const tripId = Number(id);

        if (!Number.isInteger(tripId)) {
            return NextResponse.json({ error: "잘못된 여행 ID입니다." }, { status: 400 });
        }

        // 해당 여행이 현재 사용자의 것인지 확인
        const [trip] = await sql`
            SELECT id
            FROM trips
            WHERE id = ${tripId}
              AND user_id = ${user.id}
        `;

        if (!trip) {
            return NextResponse.json({ error: "해당 여행을 찾을 수 없습니다." }, { status: 404 });
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
               AND tec.trip_id = te.trip_id
            WHERE te.trip_id = ${tripId}
            ORDER BY
                te.expense_date ASC,
                tec.sort_order ASC,
                tec.id ASC
        `;

        return NextResponse.json(expenses);
    } catch (error) {
        console.error("여행 경비 조회 실패:", error);

        return NextResponse.json(
            {
                error: "여행 경비 조회에 실패했습니다.",
            },
            { status: 500 },
        );
    }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const user = await getCurrentUser();

        if (!user) {
            return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
        }

        const { id } = await params;
        const tripId = Number(id);

        if (!Number.isInteger(tripId)) {
            return NextResponse.json({ error: "잘못된 여행 ID입니다." }, { status: 400 });
        }

        // 해당 여행이 현재 사용자의 것인지 확인
        const [trip] = await sql`
            SELECT id
            FROM trips
            WHERE id = ${tripId}
              AND user_id = ${user.id}
        `;

        if (!trip) {
            return NextResponse.json({ error: "해당 여행을 찾을 수 없습니다." }, { status: 404 });
        }

        const body = await request.json();

        const expenseDate = String(body.expenseDate ?? "").trim();

        const categoryId = Number(body.categoryId);

        const expression = String(body.expression ?? "");

        const amount = Number(body.amount);

        if (!expenseDate) {
            return NextResponse.json({ error: "날짜가 필요합니다." }, { status: 400 });
        }

        if (!Number.isInteger(categoryId)) {
            return NextResponse.json({ error: "잘못된 카테고리 ID입니다." }, { status: 400 });
        }

        if (!Number.isFinite(amount) || amount < 0) {
            return NextResponse.json({ error: "올바른 금액이 아닙니다." }, { status: 400 });
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
                {
                    error: "해당 여행의 카테고리가 아닙니다.",
                },
                { status: 400 },
            );
        }

        // 입력값이 없거나 금액이 0이면 삭제
        if (!expression || amount === 0) {
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

        // 이미 존재하는 지출인지 확인
        const [existingExpense] = await sql`
            SELECT id
            FROM trip_expenses
            WHERE trip_id = ${tripId}
              AND expense_date = ${expenseDate}
              AND category_id = ${categoryId}
            LIMIT 1
        `;

        // 새 지출을 추가하는 경우에만
        // Free 플랜 30개 제한 적용
        if (!existingExpense) {
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
                const [expenseCount] = await sql`
                    SELECT COUNT(*)::int AS count
                    FROM trip_expenses
                    WHERE trip_id = ${tripId}
                `;

                const currentCount = Number(expenseCount?.count ?? 0);

                if (currentCount >= 30) {
                    return NextResponse.json(
                        {
                            error: "무료 플랜에서는 여행 하나당 지출을 최대 30개까지 저장할 수 있어요.",
                            code: "TRIP_EXPENSE_LIMIT_REACHED",
                        },
                        { status: 403 },
                    );
                }
            }
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
            ON CONFLICT (
                trip_id,
                expense_date,
                category_id
            )
            DO UPDATE SET
                expression =
                    EXCLUDED.expression,

                amount =
                    EXCLUDED.amount,

                updated_at =
                    CURRENT_TIMESTAMP

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
            {
                error: "여행 경비 저장에 실패했습니다.",
            },
            { status: 500 },
        );
    }
}
