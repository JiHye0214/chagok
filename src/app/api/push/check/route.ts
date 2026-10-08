import { sql } from "@/lib/db";
import webpush from "web-push";

webpush.setVapidDetails(
    "mailto:qkrwlgp1526@gmail.com",
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
    process.env.VAPID_PRIVATE_KEY!,
);

export async function GET(request: Request) {
    // 크론 호출만 허용. CRON_SECRET이 설정돼 있으면 Authorization: Bearer <CRON_SECRET> 이 필요하다.
    // (Vercel Cron은 CRON_SECRET 환경변수가 있으면 이 헤더를 자동으로 붙여준다.)
    const cronSecret = process.env.CRON_SECRET;

    if (cronSecret && request.headers.get("authorization") !== `Bearer ${cronSecret}`) {
        return Response.json({ success: false, error: "권한이 없어요." }, { status: 401 });
    }

    try {
        const now = new Date();

        console.log("🔔 Push Cron 실행:", now.toISOString());

        // 알림이 켜진 근무 가져오기
        // 근무 시각은 사용자의 현지 시각이므로, 프로필의 시간대로 해석해 실제 시각(UTC 기준)으로 바꾼다.
        // 프로필이 없으면 UTC로 본다.
        const schedules = await sql`
            SELECT
                ws.id,
                ws.user_id,
                ws.start_time,
                (
                    (ws.work_date + ws.start_time) AT TIME ZONE COALESCE(up.timezone, 'UTC')
                    - make_interval(mins => COALESCE(ws.alarm_minutes_before, 60))
                ) AS notify_at
            FROM work_schedules ws
            LEFT JOIN user_profiles up
                ON up.user_id = ws.user_id
            WHERE ws.alarm_enabled = true
        `;

        // Push 구독 가져오기
        const subscriptions = await sql`
            SELECT
                user_id,
                endpoint,
                subscription
            FROM push_subscriptions
        `;

        let sentCount = 0;

        for (const schedule of schedules) {
            const startTime = String(schedule.start_time).slice(0, 5);

            const notificationTime = new Date(schedule.notify_at as string | Date);

            // 알림 시간이 됐는지 확인
            const difference = Math.abs(now.getTime() - notificationTime.getTime());

            // Cron이 하루에 한 번이라도 정확한 시간에 실행된다는 보장은 없기 때문에
            // 10분 이내면 알림 전송
            if (!Number.isFinite(difference) || difference > 10 * 60 * 1000) {
                continue;
            }

            // 근무 주인의 기기에만 보낸다.
            for (const subscription of subscriptions.filter((item) => item.user_id === schedule.user_id)) {
                try {
                    // /api/push/subscribe 는 구독 전체를 subscription 컬럼(JSON)에 저장한다.
                    const pushSubscription =
                        typeof subscription.subscription === "string"
                            ? JSON.parse(subscription.subscription)
                            : subscription.subscription;

                    await webpush.sendNotification(
                        pushSubscription,
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