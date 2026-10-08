import { NextResponse } from "next/server";
import { Pool } from "pg";
import { auth } from "@/lib/auth/auth";
import { DEFAULT_LANGUAGE, isSupportedLanguage, resolveLocation } from "@/lib/countries";

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
});

const nicknameRegex = /^[가-힣a-z0-9._]{3,20}$/;

const DEFAULT_LIVING_CATEGORIES = [
    { name: "주거", kind: "variable", sortOrder: 1 },
    { name: "통신", kind: "variable", sortOrder: 2 },
    { name: "식비", kind: "variable", sortOrder: 3 },
    { name: "교통", kind: "variable", sortOrder: 4 },
    { name: "쇼핑", kind: "variable", sortOrder: 5 },
    { name: "여행", kind: "variable", sortOrder: 6 },
    { name: "생활", kind: "variable", sortOrder: 7 },
    { name: "기타", kind: "variable", sortOrder: 8 },

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
                timezone,
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
            timezone: profile?.timezone ?? null,
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

        const existingResult = await client.query(
            `
            SELECT nickname, language, country_code, province_code, timezone, currency
            FROM user_profiles
            WHERE user_id = $1
            LIMIT 1
            `,
            [session.user.id],
        );

        const existing = existingResult.rows[0];

        /*
         * 이미 프로필이 있으면 보내지 않은 항목은 기존 값을 유지한다.
         * (닉네임만 바꾸는 화면 등) 최초 가입에서는 모든 항목이 필요하다.
         */
        const nickname = body.nickname !== undefined ? (typeof body.nickname === "string" ? body.nickname.trim() : "") : (existing?.nickname ?? "");

        const hasLanguageInput = body.language !== undefined && body.language !== null && body.language !== "";

        const language = hasLanguageInput ? body.language : (existing?.language ?? DEFAULT_LANGUAGE);

        // 닉네임 검증
        if (!nicknameRegex.test(nickname)) {
            return NextResponse.json(
                {
                    error: "닉네임은 3~20자의 한글, 영문 소문자, 숫자, ., _만 사용할 수 있어요.",
                },
                { status: 400 },
            );
        }

        if (!isSupportedLanguage(language)) {
            return NextResponse.json({ error: "지원하지 않는 언어예요." }, { status: 400 });
        }

        /*
         * 국가·지역 검증.
         * 통화와 시간대는 화면이 보낸 값을 믿지 않고 국가·지역(lib/countries)에서 정한다.
         * (한국인데 USD, 맞지 않는 시간대 같은 조합 방지)
         *
         * 국가·지역을 보내지 않은 수정(닉네임만 바꾸기 등)은 기존 값을 그대로 둔다.
         */
        const hasLocationInput = body.countryCode !== undefined || body.provinceCode !== undefined;

        let countryCode: string;
        let normalizedProvinceCode: string | null;
        let currency: string;
        let timezone: string;

        if (existing && !hasLocationInput) {
            countryCode = existing.country_code;
            normalizedProvinceCode = existing.province_code ?? null;
            currency = existing.currency;
            timezone = existing.timezone;
        } else {
            // 국가 없이 지역만 보내면 기존 국가의 지역을 바꾸는 것으로 본다
            const countryInput = body.countryCode !== undefined ? body.countryCode : existing?.country_code;

            const location = resolveLocation(countryInput, body.provinceCode);

            if (!location.ok) {
                return NextResponse.json({ error: location.error }, { status: 400 });
            }

            ({ countryCode, provinceCode: normalizedProvinceCode, currency, timezone } = location.value);
        }

        const hasCountryChanged = Boolean(existing) && existing.country_code !== countryCode;

        // 국가 변경은 데이터를 모두 지우므로, 화면에서 명시적으로 확인한 요청만 허용한다.
        if (hasCountryChanged && body.confirmReset !== true) {
            return NextResponse.json(
                { error: "국가를 바꾸면 금액 관련 데이터가 모두 삭제돼요. 확인 후 다시 시도해 주세요." },
                { status: 409 },
            );
        }

        await client.query("BEGIN");

        if (existing) {
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
                [language, countryCode, normalizedProvinceCode, timezone, currency, nickname, session.user.id],
            );

            /*
             * 국가가 바뀌면 금액과 관련된 데이터를 모두 지운다. (통화가 바뀌어 기존 금액을 해석할 수 없기 때문)
             * 삭제: 생활 내역 / 고정지출 / 저축 목표 / 생활 시작 금액, 급여 설정 / 근무 일정 / 급여 기록 / 팁, 여행(경비 포함)
             * 유지: 프로필, 닉네임, 구독, 생활 카테고리
             * 모두 하나의 트랜잭션이라 중간에 실패하면 프로필 변경도 함께 취소된다.
             */
            if (hasCountryChanged) {
                const userId = session.user.id;

                const statements = [
                    "DELETE FROM living_pending_imports WHERE user_id = $1",
                    "DELETE FROM living_transactions WHERE user_id = $1",
                    "DELETE FROM living_fixed_expenses WHERE user_id = $1",
                    "DELETE FROM savings_goals WHERE user_id = $1",
                    "DELETE FROM living_settings WHERE user_id = $1",
                    "DELETE FROM pay_period_tips WHERE user_id = $1",
                    "DELETE FROM pay_period_actuals WHERE user_id = $1",
                    "DELETE FROM work_schedules WHERE user_id = $1",
                    "DELETE FROM salary_settings WHERE user_id = $1",
                    "DELETE FROM trip_expenses WHERE trip_id IN (SELECT id FROM trips WHERE user_id = $1)",
                    "DELETE FROM trip_expense_categories WHERE trip_id IN (SELECT id FROM trips WHERE user_id = $1)",
                    "DELETE FROM trip_destinations WHERE trip_id IN (SELECT id FROM trips WHERE user_id = $1)",
                    "DELETE FROM trips WHERE user_id = $1",
                ];

                for (const statement of statements) {
                    await client.query(statement, [userId]);
                }
            }
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
                [session.user.id, language, countryCode, normalizedProvinceCode, timezone, currency, nickname],
            );

            // 최초 구독 생성
            await client.query(
                `
                INSERT INTO subscriptions (
                    user_id,
                    plan_id
                )
                SELECT $1, id
                FROM plans
                WHERE code = 'free'
                LIMIT 1
                `,
                [session.user.id],
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
            language,
            countryCode,
            provinceCode: normalizedProvinceCode,
            timezone,
            currency,
            hasCountryChanged,
        });
    } catch (error) {
        await client.query("ROLLBACK");

        console.error("PATCH /api/user/profile error:", error);

        return NextResponse.json({ error: "프로필을 저장하지 못했어요." }, { status: 500 });
    } finally {
        client.release();
    }
}
