import { sql } from "@/lib/db";
import webpush from "web-push";

webpush.setVapidDetails(
    "mailto:qkrwlgp1526@gmail.com",
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
    process.env.VAPID_PRIVATE_KEY!,
);

export async function GET() {
    try {
        const now = new Date();

        console.log("🔔 Push Cron 실행:", now.toISOString());

        // 알림이 켜진 근무 가져오기
        const schedules = await sql`
            SELECT
                id,
                work_date,
                start_time,
                alarm_minutes_before
            FROM work_schedules
            WHERE alarm_enabled = true
        `;

        // Push 구독 가져오기
        const subscriptions = await sql`
            SELECT
                endpoint,
                p256dh,
                auth
            FROM push_subscriptions
        `;

        let sentCount = 0;

        for (const schedule of schedules) {
            const workDate = String(schedule.work_date);
            const startTime = String(schedule.start_time).slice(0, 5);

            const [year, month, day] = workDate.split("-").map(Number);
            const [hour, minute] = startTime.split(":").map(Number);

            const notificationTime = new Date(
                year,
                month - 1,
                day,
                hour,
                minute,
                0,
                0,
            );

            notificationTime.setMinutes(
                notificationTime.getMinutes() -
                    Number(schedule.alarm_minutes_before ?? 60),
            );

            // 알림 시간이 됐는지 확인
            const difference = Math.abs(
                now.getTime() - notificationTime.getTime(),
            );

            // Cron이 하루에 한 번이라도 정확한 시간에 실행된다는 보장은 없기 때문에
            // 10분 이내면 알림 전송
            if (difference > 10 * 60 * 1000) {
                continue;
            }

            for (const subscription of subscriptions) {
                try {
                    await webpush.sendNotification(
                        {
                            endpoint: subscription.endpoint,
                            keys: {
                                p256dh: subscription.p256dh,
                                auth: subscription.auth,
                            },
                        },
                        JSON.stringify({
                            title: "차곡 🔔",
                            body: `${startTime}에 근무가 시작돼요!`,
                        }),
                    );

                    sentCount++;
                } catch (error) {
                    console.error(
                        "Push 전송 실패:",
                        error,
                    );
                }
            }
        }

        return Response.json({
            success: true,
            sentCount,
            checkedSchedules: schedules.length,
            time: now.toISOString(),
        });
    } catch (error) {
        console.error(
            "Push Cron error:",
            error,
        );

        return Response.json(
            {
                success: false,
                error: "Push 알림 확인에 실패했어요.",
            },
            { status: 500 },
        );
    }
}