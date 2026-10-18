import { sql } from "@/lib/db";
import webpush from "web-push";
import { translate } from "@/lib/i18n";
import { DEFAULT_LANGUAGE } from "@/lib/countries";

webpush.setVapidDetails(
    "mailto:devstudio.hey@gmail.com",
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
    process.env.VAPID_PRIVATE_KEY!,
);

// 크론이 이 주기(5분)마다 이 주소를 호출해야 한다. 주기를 바꾸면 이 값도 같이 바꾼다.
const CHECK_INTERVAL_MS = 5 * 60 * 1000;

export async function GET(request: Request) {
    // 크론 호출만 허용한다. Authorization: Bearer <CRON_SECRET> 이 맞아야 한다.
    // CRON_SECRET 이 설정돼 있지 않으면 아무도 호출하지 못하게 막는다. (비밀번호 없이 열려 있지 않도록)
    // (Vercel Cron은 CRON_SECRET 환경변수가 있으면 이 헤더를 자동으로 붙여준다.)
    const cronSecret = process.env.CRON_SECRET;

    if (!cronSecret || request.headers.get("authorization") !== `Bearer ${cronSecret}`) {
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
                up.language AS language,
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

            // 알림은 근무 주인이 앱에서 고른 언어로 보낸다. (설정이 없으면 기본 언어)
            const language = (schedule.language as string | null) ?? DEFAULT_LANGUAGE;

            const notificationTime = new Date(schedule.notify_at as string | Date);

            // 알림 시간이 됐는지 확인
            // 알림 시각이 지난 뒤 CHECK_INTERVAL_MS 안에 있을 때만 보낸다.
            // 크론을 CHECK_INTERVAL_MS(5분)마다 호출하면 알림 하나가 정확히 한 번만 나간다.
            // (앞뒤로 넓게 보면 크론이 자주 돌 때 같은 알림이 여러 번 간다)
            const elapsed = now.getTime() - notificationTime.getTime();

            if (!Number.isFinite(elapsed) || elapsed < 0 || elapsed >= CHECK_INTERVAL_MS) {
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
                            title: `${translate(language, "common.appName")} 🔔`,
                            body: translate(language, "push.shiftStarts", { time: startTime }),
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