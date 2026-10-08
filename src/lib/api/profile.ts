// lib/api/profile.ts
// 국가·지역·통화의 기준은 salary_settings가 아니라 user_profiles 입니다.
import { sql } from "@/lib/db";

export type UserProfileSummary = {
    countryCode: string | null;
    provinceCode: string | null;
    currency: string | null;
};

export const getUserProfile = async (userId: string): Promise<UserProfileSummary | null> => {
    const [row] = await sql`
        SELECT country_code, province_code, currency
        FROM user_profiles
        WHERE user_id = ${userId}
        LIMIT 1
    `;

    if (!row) {
        return null;
    }

    return {
        countryCode: (row.country_code as string | null) ?? null,
        provinceCode: (row.province_code as string | null) ?? null,
        currency: (row.currency as string | null) ?? null,
    };
};
