// (기존 auth/me/route.ts 자리에 그대로 교체)  URL: /api/auth/me
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/user";
import { getPlanCode } from "@/lib/api/plan";
import { processPendingDowngrade } from "@/lib/api/downgrade";

export async function GET() {
    const user = await getCurrentUser();

    if (!user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 해지를 신청했고 결제 기간이 끝났다면, 여기서 한 번만 무료 한도에 맞춰 정리한다 (실패해도 던지지 않음)
    await processPendingDowngrade(user.id);

    return NextResponse.json({
        id: user.id,
        name: user.name,
        email: user.email,
        // 활성(active)이고 만료되지 않은 구독만 인정 (취소·만료된 유료 구독이 계속 유료로 보이던 문제 수정)
        planCode: await getPlanCode(user.id),
    });
}
