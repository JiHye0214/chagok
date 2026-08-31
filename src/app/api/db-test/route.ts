import { sql } from "@/lib/db";

export async function GET() {
    try {
        const result = await sql`SELECT NOW() AS now`;

        return Response.json({
            success: true,
            result,
        });
    } catch (error) {
        console.error(error);

        return Response.json(
            {
                success: false,
                error: "Database connection failed",
            },
            { status: 500 },
        );
    }
}