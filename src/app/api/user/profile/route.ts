import { NextResponse } from "next/server";
import { Pool } from "pg";
import { auth } from "@/lib/auth/auth";

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
});

const nicknameRegex = /^[가-힣a-z0-9._]{3,20}$/;

const DEFAULT_LIVING_CATEGORIES = [
    { name: "주거", kind: "variable", sortOrder: 1 },
    { name: "식비", kind: "variable", sortOrder: 2 },
    { name: "교통", kind: "variable", sortOrder: 3 },
    { name: "쇼핑", kind: "variable", sortOrder: 4 },
    { name: "여행", kind: "variable", sortOrder: 5 },
    { name: "기타", kind: "variable", sortOrder: 6 },

    { name: "급여", kind: "income", sortOrder: 1 },
    { name: "용돈", kind: "income", sortOrder: 2 },
    { name: "부수입", kind: "income", sortOrder: 3 },
    { name: "환급", kind: "income", sortOrder: 4 },
    { name: "이자/배당", kind: "income", sortOrder: 5 },
    { name: "기타", kind: "income", sortOrder: 6 },
];

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
            SELECT
                nickname,
                language,
                country_code,
                province_code,
                currency
            FROM user_profiles
            WHERE user_id = $1
            LIMIT 1
            `,
            [session.user.id],
        );

        const profile = result.rows[0];

        return NextResponse.json({
            nickname: profile?.nickname ?? null,
            language: profile?.language ?? null,
            countryCode: profile?.country_code ?? null,
            provinceCode: profile?.province_code ?? null,
            currency: profile?.currency ?? null,
        });
    } catch (error) {
        console.error("GET /api/user/profile error:", error);

        return NextResponse.json({ error: "프로필을 불러오지 못했어요." }, { status: 500 });
    }
}

export async function PATCH(request: Request) {
    const client = await pool.connect();

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

        await client.query("BEGIN");

        const existingProfile = await client.query(
            `
            SELECT user_id
            FROM user_profiles
            WHERE user_id = $1
            LIMIT 1
            `,
            [session.user.id],
        );

        if (existingProfile.rows.length > 0) {
            await client.query(
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
            // 최초 프로필 생성
            await client.query(
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

            // 최초 계정 연동 시 생활 기본 카테고리 생성
            for (const category of DEFAULT_LIVING_CATEGORIES) {
                await client.query(
                    `
                    INSERT INTO living_categories (
                        name,
                        kind,
                        sort_order,
                        is_active,
                        created_at,
                        user_id
                    )
                    VALUES ($1, $2, $3, true, NOW(), $4)
                    `,
                    [category.name, category.kind, category.sortOrder, session.user.id],
                );
            }
        }

        await client.query("COMMIT");

        return NextResponse.json({
            success: true,
            nickname,
        });
    } catch (error) {
        await client.query("ROLLBACK");

        console.error("PATCH /api/user/profile error:", error);

        return NextResponse.json({ error: "프로필을 저장하지 못했어요." }, { status: 500 });
    } finally {
        client.release();
    }
}
