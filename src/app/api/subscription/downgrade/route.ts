// URL: /api/subscription/downgrade
//  GET    : 해지 상태(+ ?preview=1 이면 무료 한도 대비 사용량과 삭제 예정 개수)
//  POST   : 해지 신청 (확인 문구를 서버에서도 다시 확인)
//  DELETE : 해지 신청 취소 (결제 기간이 끝나기 전까지)
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/user";
import {
    cancelDowngradeRequest,
    getActiveProSubscription,
    getDowngradePreview,
    isDowngradeConfirmPhrase,
    requestDowngrade,
} from "@/lib/api/downgrade";

export async function GET(request: Request) {
    try {
        const user = await getCurrentUser();

        if (!user) {
            return NextResponse.json({ error: "로그인이 필요해요." }, { status: 401 });
        }

        const subscription = await getActiveProSubscription(user.id);

        if (!subscription) {
            return NextResponse.json({ isPro: false });
        }

        const wantsPreview = new URL(request.url).searchParams.get("preview") === "1";

        return NextResponse.json({
            isPro: true,
            expiresAt: subscription.expiresAt,
            cancelRequestedAt: subscription.cancelRequestedAt,
            preview: wantsPreview ? await getDowngradePreview(user.id) : undefined,
        });
    } catch (error) {
        console.error("GET /api/subscription/downgrade error:", error);

        return NextResponse.json({ error: "해지 정보를 불러오지 못했어요." }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const user = await getCurrentUser();

        if (!user) {
            return NextResponse.json({ error: "로그인이 필요해요." }, { status: 401 });
        }

        const body = await request.json().catch(() => null);

        if (!body || !isDowngradeConfirmPhrase(body.confirmation)) {
            return NextResponse.json({ error: "확인 문구가 올바르지 않아요." }, { status: 400 });
        }

        const result = await requestDowngrade(user.id);

        if (result === "not-pro") {
            return NextResponse.json({ error: "이용 중인 Pro 요금제가 없어요." }, { status: 400 });
        }

        return NextResponse.json({ success: true, result });
    } catch (error) {
        console.error("POST /api/subscription/downgrade error:", error);

        return NextResponse.json({ error: "Pro 해지에 실패했어요." }, { status: 500 });
    }
}

export async function DELETE() {
    try {
        const user = await getCurrentUser();

        if (!user) {
            return NextResponse.json({ error: "로그인이 필요해요." }, { status: 401 });
        }

        const canceled = await cancelDowngradeRequest(user.id);

        if (!canceled) {
            return NextResponse.json({ error: "취소할 해지 신청이 없어요." }, { status: 400 });
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("DELETE /api/subscription/downgrade error:", error);

        return NextResponse.json({ error: "해지 취소에 실패했어요." }, { status: 500 });
    }
}
