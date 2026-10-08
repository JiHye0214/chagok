import { sql } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/user";

export async function DELETE(request: Request) {
    try {
        const user = await getCurrentUser();

        if (!user) {
            return Response.json({ success: false, message: "로그인이 필요해요." }, { status: 401 });
        }

        const { id } = await request.json();

        if (!id) {
            return Response.json(
                {
                    success: false,
                    message: "스케줄 ID가 없습니다.",
                },
                {
                    status: 400,
                },
            );
        }

        const result = await sql`
            DELETE FROM push_schedules
            WHERE id = ${id}
              AND user_id = ${user.id}
            RETURNING id
        `;

        return Response.json({
            success: true,
            deleted:
                result.length > 0,
        });
    } catch (error) {
        console.error(
            "알림 예약 삭제 오류:",
            error,
        );

        return Response.json(
            {
                success: false,
                message:
                    "알림 예약 삭제에 실패했습니다.",
            },
            {
                status: 500,
            },
        );
    }
}