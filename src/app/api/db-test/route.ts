import { sql } from "@/lib/db";

export async function GET() {
    try {
        const result =
            await sql`SELECT NOW() AS now`;

        return Response.json({
            success: true,
            time: result[0].now,
        });
    } catch (error) {
        console.error(
            "DB 연결 오류:",
            error,
        );

        return Response.json(
            {
                success: false,
                message: "DB 연결 실패",
            },
            {
                status: 500,
            },
        );
    }
}