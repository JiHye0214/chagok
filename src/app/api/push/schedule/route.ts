import { sql } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/user";

export async function POST(request: Request) {
    try {
        const user = await getCurrentUser();

        if (!user) {
            return Response.json({ success: false, message: "로그인이 필요해요." }, { status: 401 });
        }

        const data = await request.json();

        const {
            id,
            sendAt,
            title,
            body,
            subscription,
        } = data;

        if (
            !id ||
            !sendAt ||
            !title ||
            !body ||
            !subscription
        ) {
            return Response.json(
                {
                    success: false,
                    message:
                        "필수 정보가 없습니다.",
                },
                {
                    status: 400,
                },
            );
        }

        await sql`
            INSERT INTO push_schedules (
                user_id,
                id,
                send_at,
                title,
                body,
                subscription
            )
            VALUES (
                ${user.id},
                ${id},
                ${sendAt},
                ${title},
                ${body},
                ${JSON.stringify(subscription)}
            )
            ON CONFLICT (id)
            DO UPDATE SET
                send_at = EXCLUDED.send_at,
                title = EXCLUDED.title,
                body = EXCLUDED.body,
                subscription = EXCLUDED.subscription,
                sent = FALSE
            WHERE push_schedules.user_id = EXCLUDED.user_id
        `;

        return Response.json({
            success: true,
            message:
                "알림 예약이 저장되었습니다.",
        });
    } catch (error) {
        console.error(
            "알림 예약 저장 오류:",
            error,
        );

        return Response.json(
            {
                success: false,
                message:
                    "알림 예약 저장에 실패했습니다.",
            },
            {
                status: 500,
            },
        );
    }
}