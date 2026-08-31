import { NextResponse } from "next/server";

export async function GET() {
    console.log("🔔 Push Cron 실행됨:", new Date().toISOString());

    return NextResponse.json({
        success: true,
        message: "Push Cron이 실행됐어요!",
        time: new Date().toISOString(),
    });
}