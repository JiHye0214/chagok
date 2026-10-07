// lib/api/plan.ts
import { sql } from "@/lib/db";

export const FREE_LIMITS = {
    payHistory: 5,
    workSchedules: 100,
} as const;

// 요금제와 상관없이 한 사용자가 저장할 수 있는 팁 기간 수 (무한히 쌓이는 것 방지)
export const MAX_TIP_PERIODS_PER_USER = 1000;

/*
 * 현재 사용자의 요금제 코드. 활성(active) 구독이고 만료되지 않은 것만 인정한다.
 * (활성 구독은 사용자당 1개만 존재하도록 DB 유니크 인덱스가 보장함)
 */
export const getPlanCode = async (userId: string): Promise<string> => {
    const [subscription] = await sql`
        SELECT p.code AS plan_code
        FROM subscriptions s
        JOIN plans p
            ON p.id = s.plan_id
        WHERE s.user_id = ${userId}
          AND s.status = 'active'
          AND (s.expires_at IS NULL OR s.expires_at > NOW())
        LIMIT 1
    `;

    return (subscription?.plan_code as string | undefined) ?? "free";
};
