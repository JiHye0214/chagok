import { sql } from "@/lib/db";
import webpush from "web-push";

webpush.setVapidDetails(
    "mailto:네이메일@example.com",
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
    process.env.VAPID_PRIVATE_KEY!,
);

export async function GET(request: Request) {
    const authHeader =
        request.headers.get("authorization");

    if (
        authHeader !==
        `Bearer ${process.env.CRON_SECRET}`
    ) {
        return Response.json(
            {
                success: false,
                message: "Unauthorized",
            },
            {
                status: 401,
            },
        );
    }

    try {
        const schedules = await sql`
            SELECT *
            FROM push_schedules
            WHERE sent = FALSE
            AND send_at <= NOW()
        `;

        let sentCount = 0;

        for (const schedule of schedules) {
            try {
                await webpush.sendNotification(
                    schedule.subscription,
                    JSON.stringify({
                        title: schedule.title,
                        body: schedule.body,
                    }),
                );

                await sql`
                    UPDATE push_schedules
                    SET sent = TRUE
                    WHERE id = ${schedule.id}
                `;

                sentCount++;
            } catch (error) {
                console.error(
                    `Push 전송 실패 (${schedule.id}):`,
                    error,
                );
            }
        }

        return Response.json({
            success: true,
            sentCount,
        });
    } catch (error) {
        console.error(
            "Push 확인 오류:",
            error,
        );

        return Response.json(
            {
                success: false,
            },
            {
                status: 500,
            },
        );
    }
}