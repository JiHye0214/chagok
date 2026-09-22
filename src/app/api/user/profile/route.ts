import { NextResponse } from "next/server";
import { Pool } from "pg";
import { auth } from "@/lib/auth/auth";

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
});

const nicknameRegex = /^[가-힣a-z0-9._]{3,20}$/;

export async function GET(request: Request) {
    try {
        const session = await auth.api.getSession({
            headers: request.headers,
        });

        if (!session?.user) {
            return NextResponse.json({ error: "로그인이 필요해요." }, { status: 401 });
        }

        const result = await pool.query(
            `
            SELECT nickname
            FROM user_profiles
            WHERE user_id = $1
            LIMIT 1
            `,
            [session.user.id],
        );

        return NextResponse.json({
            nickname: result.rows[0]?.nickname ?? null,
        });
    } catch (error) {
        console.error("GET /api/user/profile error:", error);

        return NextResponse.json({ error: "프로필을 불러오지 못했어요." }, { status: 500 });
    }
}

export async function PATCH(request: Request) {
    try {
        const session = await auth.api.getSession({
            headers: request.headers,
        });

        if (!session?.user) {
            return NextResponse.json({ error: "로그인이 필요해요." }, { status: 401 });
        }

        const body = await request.json();

        const nickname = typeof body.nickname === "string" ? body.nickname.trim() : "";

        const language = typeof body.language === "string" ? body.language : "ko";

        const countryCode = typeof body.countryCode === "string" ? body.countryCode : "";

        const provinceCode =
            countryCode === "CA" && typeof body.provinceCode === "string" && body.provinceCode ? body.provinceCode : null;
            
        const timezone = typeof body.timezone === "string" ? body.timezone : "";

        const currency = typeof body.currency === "string" ? body.currency : "";

        // 닉네임 검증
        if (!nicknameRegex.test(nickname)) {
            return NextResponse.json(
                {
                    error: "닉네임은 3~20자의 한글, 영문 소문자, 숫자, ., _만 사용할 수 있어요.",
                },
                { status: 400 },
            );
        }

        // 필수 프로필 정보 검증
        if (!countryCode || !timezone || !currency) {
            return NextResponse.json(
                {
                    error: "사용자 정보를 확인할 수 없어요. 처음부터 다시 진행해 주세요.",
                },
                { status: 400 },
            );
        }

        const existingProfile = await pool.query(
            `
            SELECT user_id
            FROM user_profiles
            WHERE user_id = $1
            LIMIT 1
            `,
            [session.user.id],
        );

        if (existingProfile.rows.length > 0) {
            await pool.query(
                `
                UPDATE user_profiles
                SET
                    language = $1,
                    country_code = $2,
                    province_code = $3,
                    timezone = $4,
                    currency = $5,
                    nickname = $6,
                    updated_at = NOW()
                WHERE user_id = $7
                `,
                [language, countryCode, provinceCode, timezone, currency, nickname, session.user.id],
            );
        } else {
            await pool.query(
                `
                INSERT INTO user_profiles (
                    user_id,
                    language,
                    country_code,
                    province_code,
                    timezone,
                    currency,
                    nickname,
                    created_at,
                    updated_at
                )
                VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
                `,
                [session.user.id, language, countryCode, provinceCode, timezone, currency, nickname],
            );
        }

        return NextResponse.json({
            success: true,
            nickname,
        });
    } catch (error) {
        console.error("PATCH /api/user/profile error:", error);

        return NextResponse.json({ error: "프로필을 저장하지 못했어요." }, { status: 500 });
    }
}
