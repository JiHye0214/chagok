// 내 데이터 CSV 내보내기. URL: /api/export?type=pay | schedule | living
import { getCurrentUser } from "@/lib/auth/user";
import { sql } from "@/lib/db";
import { handleRouteError, unauthorized } from "@/lib/api/response";

type Cell = string | number | boolean | null | undefined;

// 엑셀에서 수식으로 실행되지 않도록 문자열이 = + - @ 로 시작하면 ' 를 붙인다
const escapeCell = (value: Cell) => {
    if (value === null || value === undefined) {
        return "";
    }

    let text = String(value);

    if (typeof value === "string" && /^[=+\-@\t\r]/.test(text)) {
        text = `'${text}`;
    }

    return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

const toCsv = (header: string[], rows: Cell[][]) =>
    // 맨 앞 BOM: 엑셀에서 한글이 깨지지 않게
    "﻿" + [header, ...rows].map((row) => row.map(escapeCell).join(",")).join("\r\n") + "\r\n";

export async function GET(request: Request) {
    try {
        const user = await getCurrentUser();

        if (!user) {
            return unauthorized();
        }

        const type = new URL(request.url).searchParams.get("type");

        let header: string[];
        let rows: Cell[][];

        if (type === "pay") {
            const result = await sql`
                SELECT
                    TO_CHAR(pay_period_start_date, 'YYYY-MM-DD') AS start_date,
                    TO_CHAR(pay_period_end_date, 'YYYY-MM-DD') AS end_date,
                    TO_CHAR(pay_date, 'YYYY-MM-DD') AS pay_date,
                    actual_hours, actual_pay, actual_tips, actual_deductions,
                    adjustments, actual_net_pay, currency_code, country_code, province_code
                FROM pay_period_actuals
                WHERE user_id = ${user.id}
                ORDER BY pay_period_start_date DESC
            `;

            header = ["start_date", "end_date", "pay_date", "hours", "gross_pay", "tips", "deductions", "adjustments", "net_pay", "currency", "country", "region"];
            rows = (result as Record<string, Cell>[]).map((r) => [
                r.start_date, r.end_date, r.pay_date, r.actual_hours, r.actual_pay, r.actual_tips,
                r.actual_deductions, r.adjustments, r.actual_net_pay, r.currency_code, r.country_code, r.province_code,
            ]);
        } else if (type === "schedule") {
            const result = await sql`
                SELECT
                    TO_CHAR(work_date, 'YYYY-MM-DD') AS work_date,
                    LEFT(start_time::text, 5) AS start_time,
                    LEFT(end_time::text, 5) AS end_time,
                    has_break, break_minutes
                FROM work_schedules
                WHERE user_id = ${user.id}
                ORDER BY work_date DESC, start_time ASC
            `;

            header = ["date", "start", "end", "has_break", "break_minutes"];
            rows = (result as Record<string, Cell>[]).map((r) => [r.work_date, r.start_time, r.end_time, r.has_break, r.break_minutes]);
        } else if (type === "living") {
            const result = await sql`
                SELECT
                    TO_CHAR(lt.transaction_date, 'YYYY-MM-DD') AS transaction_date,
                    lt.type, lt.amount, lc.name AS category_name, lt.memo
                FROM living_transactions lt
                LEFT JOIN living_categories lc
                    ON lc.id = lt.category_id AND lc.user_id = ${user.id}
                WHERE lt.user_id = ${user.id}
                ORDER BY lt.transaction_date DESC, lt.id DESC
            `;

            header = ["date", "type", "amount", "category", "memo"];
            rows = (result as Record<string, Cell>[]).map((r) => [r.transaction_date, r.type, r.amount, r.category_name, r.memo]);
        } else {
            return new Response("type must be pay, schedule or living", { status: 400 });
        }

        return new Response(toCsv(header, rows), {
            headers: {
                "Content-Type": "text/csv; charset=utf-8",
                "Content-Disposition": `attachment; filename="chagok-${type}.csv"`,
                "Cache-Control": "no-store",
            },
        });
    } catch (error) {
        return handleRouteError("Export GET error:", error, "데이터를 내보내지 못했어요.");
    }
}
