import { sql } from "@/lib/db";

export async function POST(request: Request) {
    try {
        const { subscription } = await request.json();

        if (!subscription?.endpoint) {
            return Response.json(
                { error: "Push subscription이 없습니다." },
                { status: 400 },
            );
        }

        await sql`
            INSERT INTO push_subscriptions (
                endpoint,
                subscription
            )
            VALUES (
                ${subscription.endpoint},
                ${JSON.stringify(subscription)}
            )
            ON CONFLICT (endpoint)
            DO UPDATE SET
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