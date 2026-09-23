import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/user";

export async function GET() {
    try {
        const user = await getCurrentUser();

        if (!user) {
            return NextResponse.json({ error: "로그인이 필요해요." }, { status: 401 });
        }

        const result = await sql`
            SELECT
                initial_living_money,
                initial_savings_money
            FROM living_settings
            WHERE user_id = ${user.id}
            LIMIT 1
        `;

        if (!result[0]) {
            return NextResponse.json(null);
        }

        return NextResponse.json({
            initialLivingMoney: Number(result[0].initial_living_money ?? 0),
            initialSavingsMoney: Number(result[0].initial_savings_money ?? 0),
        });
    } catch (error) {
        console.error("GET /api/living/settings error:", error);

        return NextResponse.json({ error: "생활 설정을 불러오지 못했습니다." }, { status: 500 });
    }
}

export async function PUT(request: Request) {
    try {
        const user = await getCurrentUser();

        if (!user) {
            return NextResponse.json({ error: "로그인이 필요해요." }, { status: 401 });
        }

        const body = await request.json();

        const initialLivingMoney = Number(body.initialLivingMoney ?? 0);
        const initialSavingsMoney = Number(body.initialSavingsMoney ?? 0);

        if (
            !Number.isFinite(initialLivingMoney) ||
            initialLivingMoney < 0 ||
            !Number.isFinite(initialSavingsMoney) ||
            initialSavingsMoney < 0
        ) {
            return NextResponse.json({ error: "금액을 확인해주세요." }, { status: 400 });
        }

        const result = await sql`
            INSERT INTO living_settings (
                user_id,
                initial_living_money,
                initial_savings_money
            )
            VALUES (
                ${user.id},
                ${initialLivingMoney},
                ${initialSavingsMoney}
            )
            ON CONFLICT (user_id)
            DO UPDATE SET
                initial_living_money = EXCLUDED.initial_living_money,
                initial_savings_money = EXCLUDED.initial_savings_money,
                updated_at = CURRENT_TIMESTAMP
            RETURNING
                initial_living_money,
                initial_savings_money
        `;

        return NextResponse.json({
            initialLivingMoney: Number(result[0].initial_living_money ?? 0),
            initialSavingsMoney: Number(result[0].initial_savings_money ?? 0),
        });
    } catch (error) {
        console.error("PUT /api/living/settings error:", error);

        return NextResponse.json({ error: "생활 설정 저장에 실패했습니다." }, { status: 500 });
    }
}
