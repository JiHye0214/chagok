import { NextResponse } from "next/server";
import webpush from "web-push";

webpush.setVapidDetails(
    "mailto:qkrwlgp1526@gmail.com",
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
    process.env.VAPID_PRIVATE_KEY!,
);

export async function POST(request: Request) {
    try {
        const { subscription } =
            await request.json();

        await webpush.sendNotification(
            subscription,
            JSON.stringify({
                title: "차곡",
                body: "Push 알림이 정상적으로 도착했어요!",
            }),
        );

        return NextResponse.json({
            success: true,
        });
    } catch (error) {
        console.error(
            "Push notification error:",
            error,
        );

        return NextResponse.json(
            {
                success: false,
            },
            { status: 500 },
        );
    }
}