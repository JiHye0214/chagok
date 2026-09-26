import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { Pool } from "pg";

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
});

export async function DELETE(request: Request) {
    try {
        const session = await auth.api.getSession({
            headers: request.headers,
        });

        if (!session?.user?.id) {
            return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
        }

        await pool.query(
            `
                DELETE FROM users
                WHERE id = $1
            `,
            [session.user.id],
        );

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("회원탈퇴 오류:", error);

        return NextResponse.json({ error: "회원탈퇴에 실패했어요." }, { status: 500 });
    }
}
