import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/user";

type SourceType = "trip" | "payroll";

const FREE_LIVING_TRANSACTION_LIMIT = 300;

const toNumber = (value: unknown) => Number(value ?? 0);

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

export async function POST(request: Request) {
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

        const sourceType = body.sourceType as SourceType;
        const sourceId = Number(body.sourceId);

        if (sourceType !== "trip" && sourceType !== "payroll") {
            return NextResponse.json(
                {
                    error: "잘못된 연동 유형이에요.",
                },
                { status: 400 },
            );
        }

        if (!Number.isInteger(sourceId) || sourceId <= 0) {
            return NextResponse.json(
                {
                    error: "잘못된 연동 ID예요.",
                },
                { status: 400 },
            );
        }

        /*
         * 이미 반영된 데이터라면 다시 만들지 않는다.
         * 반드시 현재 사용자 데이터만 확인한다.
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
            WHERE user_id = ${user.id}
              AND source_type = ${sourceType}
              AND source_id = ${sourceId}
            LIMIT 1
        `;

        if (existing.length > 0) {
            return NextResponse.json({
                transaction: existing[0],
                alreadyExists: true,
            });
        }

        /*
         * Free 플랜은 생활 기록 300개까지 저장 가능.
         * 이미 존재하는 연동 데이터는 위에서 return 되었으므로
         * 실제 새 transaction을 만들 때만 제한을 확인한다.
         */
        const planCode = await getPlanCode(user.id);

        if (planCode === "free") {
            const [countResult] = await sql`
                SELECT COUNT(*)::int AS count
                FROM living_transactions
                WHERE user_id = ${user.id}
            `;

            const count = Number(countResult?.count ?? 0);

            if (count >= FREE_LIVING_TRANSACTION_LIMIT) {
                return NextResponse.json(
                    {
                        error: "무료 플랜에서는 생활 기록을 최대 300개까지 저장할 수 있어요.",
                        code: "LIVING_TRANSACTION_LIMIT_REACHED",
                    },
                    { status: 403 },
                );
            }
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
                  AND t.user_id = ${user.id}
                GROUP BY
                    t.id,
                    t.title,
                    t.city,
                    t.end_date
                LIMIT 1
            `;

            if (tripResult.length === 0) {
                return NextResponse.json(
                    {
                        error: "여행을 찾을 수 없어요.",
                    },
                    { status: 404 },
                );
            }

            const trip = tripResult[0];
            const amount = toNumber(trip.total_expense);

            if (amount <= 0) {
                return NextResponse.json(
                    {
                        error: "아직 입력된 여행 지출이 없어요.",
                    },
                    { status: 400 },
                );
            }

            /*
             * 여행 카테고리가 없으면 현재 사용자에게 생성한다.
             */
            const categoryResult = await sql`
                SELECT id
                FROM living_categories
                WHERE user_id = ${user.id}
                  AND name = '여행'
                  AND kind = 'variable'
                LIMIT 1
            `;

            let categoryId: number;

            if (categoryResult.length > 0) {
                categoryId = categoryResult[0].id;
            } else {
                const insertedCategory = await sql`
                    INSERT INTO living_categories (
                        user_id,
                        name,
                        kind,
                        sort_order
                    )
                    VALUES (
                        ${user.id},
                        '여행',
                        'variable',
                        999
                    )
                    RETURNING id
                `;

                if (insertedCategory.length === 0) {
                    return NextResponse.json(
                        {
                            error: "여행 카테고리를 찾을 수 없어요.",
                        },
                        { status: 500 },
                    );
                }

                categoryId = insertedCategory[0].id;
            }

            const inserted = await sql`
                INSERT INTO living_transactions (
                    user_id,
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
                    ${user.id},
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
              AND user_id = ${user.id}
            LIMIT 1
        `;

        if (payrollResult.length === 0) {
            return NextResponse.json(
                {
                    error: "실제 급여 기록을 찾을 수 없어요.",
                },
                { status: 404 },
            );
        }

        const payroll = payrollResult[0];

        if (payroll.actual_net_pay === null) {
            return NextResponse.json(
                {
                    error: "실제 수령액을 먼저 입력해주세요.",
                },
                { status: 400 },
            );
        }

        const amount = toNumber(payroll.actual_net_pay);

        if (amount <= 0) {
            return NextResponse.json(
                {
                    error: "실제 수령액을 확인해주세요.",
                },
                { status: 400 },
            );
        }

        const categoryResult = await sql`
            SELECT id
            FROM living_categories
            WHERE user_id = ${user.id}
              AND name = '급여'
              AND kind = 'income'
            LIMIT 1
        `;

        if (categoryResult.length === 0) {
            return NextResponse.json(
                {
                    error: "급여 카테고리를 찾을 수 없어요.",
                },
                { status: 500 },
            );
        }

        const categoryId = categoryResult[0].id;

        const inserted = await sql`
            INSERT INTO living_transactions (
                user_id,
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
                ${user.id},
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
