import { sql } from "@/lib/db";

export async function PUT(request: Request) {
    try {
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
                id,
                send_at,
                title,
                body,
                subscription,
                sent
            )
            VALUES (
                ${id},
                ${sendAt},
                ${title},
                ${body},
                ${JSON.stringify(subscription)},
                FALSE
            )
            ON CONFLICT (id)
            DO UPDATE SET
                send_at = EXCLUDED.send_at,
                title = EXCLUDED.title,
                body = EXCLUDED.body,
                subscription = EXCLUDED.subscription,
                sent = FALSE
        `;

        return Response.json({
            success: true,
            message:
                "알림 예약이 저장되었습니다.",
        });
    } catch (error) {
        console.error(
            "알림 예약 수정 오류:",
            error,
        );

        return Response.json(
            {
                success: false,
                message:
                    "알림 예약 수정에 실패했습니다.",
            },
            {
                status: 500,
            },
        );
    }
}