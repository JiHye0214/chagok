import { betterAuth } from "better-auth";
import { Pool } from "pg";

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
});

export const auth = betterAuth({
    database: pool,

    user: {
        modelName: "users",
        fields: {
            name: "name",
            email: "email",
            emailVerified: "email_verified",
            image: "image",
            createdAt: "created_at",
            updatedAt: "updated_at",
        },
    },

    /*
     * 로그인 시도 제한 (IP 기준).
     * 메모리 저장이라 서버리스 인스턴스마다 따로 센다. 완벽한 차단은 아니지만
     * 한 인스턴스에서 반복되는 무차별 시도는 막는다.
     */
    rateLimit: {
        enabled: true,
        window: 60,
        max: 100,
        customRules: {
            "/sign-in/social": { window: 60, max: 10 },
            "/callback/*": { window: 60, max: 20 },
        },
    },

    advanced: {
        database: {
            generateId: "uuid",
        },
    },

    socialProviders: {
        google: {
            clientId: process.env.AUTH_GOOGLE_ID as string,
            clientSecret: process.env.AUTH_GOOGLE_SECRET as string,
        },
        kakao: {
            clientId: process.env.AUTH_KAKAO_ID as string,
            clientSecret: process.env.AUTH_KAKAO_SECRET as string,

            disableDefaultScope: true,
            scope: [],

            mapProfileToUser: (profile) => ({
                email: `kakao_${profile.id}@users.chagok.invalid`,
                name: "",
                emailVerified: false,
            }),
        },
    },
});
