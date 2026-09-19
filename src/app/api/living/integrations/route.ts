import { NextResponse } from "next/server";
import { sql } from "@/lib/db";

type SourceType = "trip" | "payroll";

const toNumber = (value: unknown) => Number(value ?? 0);

export async function POST(request: Request) {
    try {
        const body = await request.json();

        const sourceType = body.sourceType as SourceType;
        const sourceId = Number(body.sourceId);

        if (sourceType !== "trip" && sourceType !== "payroll") {
            return NextResponse.json({ error: "잘못된 연동 유형이에요." }, { status: 400 });
        }

        if (!Number.isInteger(sourceId) || sourceId <= 0) {
            return NextResponse.json({ error: "잘못된 연동 ID예요." }, { status: 400 });
        }

        /*
         * 이미 반영된 데이터라면 다시 만들지 않는다.
         */
        const existing = await sql`
            SELECT
                id,
                TO_CHAR(transaction_date, 'YYYY-MM-DD') AS transaction_date,
                type,
                amount,
                category_id,
                memo,
                source_type,
                source_id
            FROM living_transactions
            WHERE source_type = ${sourceType}
              AND source_id = ${sourceId}
            LIMIT 1
        `;

        if (existing.length > 0) {
            return NextResponse.json({
                transaction: existing[0],
                alreadyExists: true,
            });
        }

        if (sourceType === "trip") {
            const tripResult = await sql`
                SELECT
                    t.id,
                    t.title,
                    t.city,
                    TO_CHAR(t.end_date, 'YYYY-MM-DD') AS end_date,
                    COALESCE(SUM(te.amount), 0) AS total_expense
                FROM trips t
                LEFT JOIN trip_expenses te
                    ON te.trip_id = t.id
                WHERE t.id = ${sourceId}
                GROUP BY
                    t.id,
                    t.title,
                    t.city,
                    t.end_date
                LIMIT 1
            `;

            if (tripResult.length === 0) {
                return NextResponse.json({ error: "여행을 찾을 수 없어요." }, { status: 404 });
            }

            const trip = tripResult[0];
            const amount = toNumber(trip.total_expense);

            if (amount <= 0) {
                return NextResponse.json({ error: "아직 입력된 여행 지출이 없어요." }, { status: 400 });
            }

            /*
             * 여행 카테고리가 없으면 variable 카테고리로 생성한다.
             */
            await sql`
                INSERT INTO living_categories (
                    name,
                    kind,
                    sort_order
                )
                VALUES (
                    '여행',
                    'variable',
                    999
                )
                ON CONFLICT (name, kind) DO NOTHING
            `;

            const categoryResult = await sql`
                SELECT id
                FROM living_categories
                WHERE name = '여행'
                  AND kind = 'variable'
                LIMIT 1
            `;

            if (categoryResult.length === 0) {
                return NextResponse.json({ error: "여행 카테고리를 찾을 수 없어요." }, { status: 500 });
            }

            const categoryId = categoryResult[0].id;

            const inserted = await sql`
                INSERT INTO living_transactions (
                    transaction_date,
                    type,
                    amount,
                    category_id,
                    memo,
                    transfer_direction,
                    source_type,
                    source_id
                )
                VALUES (
                    ${trip.end_date}::date,
                    'expense',
                    ${amount},
                    ${categoryId},
                    ${`${trip.title || trip.city} 여행`},
                    NULL,
                    'trip',
                    ${sourceId}
                )
                RETURNING
                    id,
                    TO_CHAR(transaction_date, 'YYYY-MM-DD') AS transaction_date,
                    type,
                    amount,
                    category_id,
                    memo,
                    source_type,
                    source_id
            `;

            return NextResponse.json({
                transaction: inserted[0],
                alreadyExists: false,
            });
        }

        /*
         * payroll
         *
         * sourceId는 pay_period_actuals.id여야 한다.
         */
        const payrollResult = await sql`
            SELECT
                id,
                TO_CHAR(pay_date, 'YYYY-MM-DD') AS pay_date,
                actual_net_pay
            FROM pay_period_actuals
            WHERE id = ${sourceId}
            LIMIT 1
        `;

        if (payrollResult.length === 0) {
            return NextResponse.json({ error: "실제 급여 기록을 찾을 수 없어요." }, { status: 404 });
        }

        const payroll = payrollResult[0];

        if (payroll.actual_net_pay === null) {
            return NextResponse.json({ error: "실제 수령액을 먼저 입력해주세요." }, { status: 400 });
        }

        const amount = toNumber(payroll.actual_net_pay);

        if (amount <= 0) {
            return NextResponse.json({ error: "실제 수령액을 확인해주세요." }, { status: 400 });
        }

        const categoryResult = await sql`
            SELECT id
            FROM living_categories
            WHERE name = '급여'
              AND kind = 'income'
            LIMIT 1
        `;

        if (categoryResult.length === 0) {
            return NextResponse.json({ error: "급여 카테고리를 찾을 수 없어요." }, { status: 500 });
        }

        const categoryId = categoryResult[0].id;

        const inserted = await sql`
            INSERT INTO living_transactions (
                transaction_date,
                type,
                amount,
                category_id,
                memo,
                transfer_direction,
                source_type,
                source_id
            )
            VALUES (
                (${payroll.pay_date}::date + INTERVAL '1 day')::date,
                'income',
                ${amount},
                ${categoryId},
                '급여',
                NULL,
                'payroll',
                ${sourceId}
            )
            RETURNING
                id,
                TO_CHAR(transaction_date, 'YYYY-MM-DD') AS transaction_date,
                type,
                amount,
                category_id,
                memo,
                source_type,
                source_id
        `;

        return NextResponse.json({
            transaction: inserted[0],
            alreadyExists: false,
        });
    } catch (error) {
        console.error("POST /api/living/integrations error:", error);

        return NextResponse.json(
            {
                error: "생활비에 반영하지 못했어요.",
            },
            {
                status: 500,
            },
        );
    }
}
