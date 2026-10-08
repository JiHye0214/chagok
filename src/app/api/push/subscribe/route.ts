import { sql } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/user";

export async function POST(request: Request) {
    try {
        const user = await getCurrentUser();

        if (!user) {
            return Response.json({ success: false, message: "로그인이 필요해요." }, { status: 401 });
        }

        const { subscription } = await request.json();

        if (!subscription?.endpoint) {
            return Response.json(
                { error: "Push subscription이 없습니다." },
                { status: 400 },
            );
        }

        await sql`
            INSERT INTO push_subscriptions (
                user_id,
                endpoint,
                subscription
            )
            VALUES (
                ${user.id},
                ${subscription.endpoint},
                ${JSON.stringify(subscription)}
            )
            ON CONFLICT (endpoint)
            DO UPDATE SET
                user_id = EXCLUDED.user_id,
                subscription = EXCLUDED.subscription,
                updated_at = NOW()
        `;

        return Response.json({
            success: true,
        });
    } catch (error) {
        console.error("Push subscription 저장 오류:", error);

        return Response.json(
            { error: "Push subscription 저장에 실패했습니다." },
            { status: 500 },
        );
    }
}