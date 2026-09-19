import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/user";
import { sql } from "@/lib/db";

export async function GET() {
    const user = await getCurrentUser();

    if (!user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const [subscription] = await sql`
        SELECT
            p.code AS plan_code
        FROM subscriptions s
        JOIN plans p
            ON p.id = s.plan_id
        WHERE s.user_id = ${user.id}
        LIMIT 1
    `;

    return NextResponse.json({
        id: user.id,
        name: user.name,
        email: user.email,
        planCode: subscription?.plan_code ?? "free",
    });
}
