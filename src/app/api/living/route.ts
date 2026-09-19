import { NextResponse } from "next/server";
import { sql } from "@/lib/db";

type LivingTransactionType = "income" | "expense" | "transfer";

type TransferDirection = "living_to_savings" | "savings_to_living";

type LivingTransactionRow = {
    id: number;
    transaction_date: string;
    type: LivingTransactionType;
    amount: number | string;
    category_id: number | null;
    category_name: string | null;
    category_kind: "fixed" | "variable" | "income" | null;
    memo: string | null;
    transfer_direction: TransferDirection | null;
    source_type?: string | null;
    source_id?: number | null;
};

const getMonthRange = (month?: string) => {
    const now = new Date();

    if (month && /^\d{4}-\d{2}$/.test(month)) {
        const [year, monthNumber] = month.split("-").map(Number);

        const start = new Date(year, monthNumber - 1, 1);
        const end = new Date(year, monthNumber, 1);

        return {
            start: `${year}-${String(monthNumber).padStart(2, "0")}-01`,
            end: `${end.getFullYear()}-${String(end.getMonth() + 1).padStart(2, "0")}-01`,
        };
    }

    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 1);

    return {
        start: `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, "0")}-01`,
        end: `${end.getFullYear()}-${String(end.getMonth() + 1).padStart(2, "0")}-01`,
    };
};

const toNumber = (value: unknown) => Number(value ?? 0);

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const month = searchParams.get("month") ?? undefined;

        const currentMonth = getMonthRange(month);

        const [currentTransactions, fixedExpenseResult, savingsGoalResult] = await Promise.all([
            sql`
                    SELECT
                        lt.id,
                        TO_CHAR(lt.transaction_date, 'YYYY-MM-DD') AS transaction_date,
                        lt.type,
                        lt.amount,
                        lt.category_id,
                        lc.name AS category_name,
                        lc.kind AS category_kind,
                        lt.memo,
                        lt.transfer_direction,
                        lt.source_type,
                        lt.source_id
                    FROM living_transactions lt
                    LEFT JOIN living_categories lc
                        ON lc.id = lt.category_id
                    WHERE lt.transaction_date >= ${currentMonth.start}::date
                      AND lt.transaction_date < ${currentMonth.end}::date
                    ORDER BY
                        lt.transaction_date DESC,
                        lt.id DESC
                `,

            sql`
                    SELECT
                        COALESCE(SUM(amount), 0) AS total
                    FROM living_fixed_expenses
                    WHERE is_active = TRUE
                `,

            sql`
                    SELECT
                        id,
                        name,
                        target_amount
                    FROM savings_goals
                    ORDER BY id
                    LIMIT 1
                `,
        ]);

        const current = currentTransactions as LivingTransactionRow[];

        const currentIncome = current
            .filter((item) => item.type === "income")
            .reduce((sum, item) => sum + toNumber(item.amount), 0);

        const currentTransactionExpenses = current
            .filter((item) => item.type === "expense")
            .reduce((sum, item) => sum + toNumber(item.amount), 0);

        const fixedExpense = toNumber(fixedExpenseResult[0]?.total);

        const currentVariableByCategory = new Map<string, number>();

        current
            .filter((item) => item.type === "expense" && item.category_kind === "variable")
            .forEach((item) => {
                const name = item.category_name ?? "기타";

                currentVariableByCategory.set(name, (currentVariableByCategory.get(name) ?? 0) + toNumber(item.amount));
            });

        const variableSpending = Array.from(currentVariableByCategory.entries())
            .map(([name, amount]) => ({
                name,
                amount,
            }))
            .sort((a, b) => b.amount - a.amount);

        const variableSpendingTotal = variableSpending.reduce((sum, item) => sum + item.amount, 0);

        const expense = fixedExpense + variableSpendingTotal;

        const livingToSavings = current
            .filter((item) => item.type === "transfer" && item.transfer_direction === "living_to_savings")
            .reduce((sum, item) => sum + toNumber(item.amount), 0);

        const savingsToLiving = current
            .filter((item) => item.type === "transfer" && item.transfer_direction === "savings_to_living")
            .reduce((sum, item) => sum + toNumber(item.amount), 0);

        const balance = currentIncome - expense - livingToSavings + savingsToLiving;

        const savingsResult = await sql`
            SELECT
                COALESCE(
                    SUM(
                        CASE
                            WHEN type = 'transfer'
                                AND transfer_direction = 'living_to_savings'
                            THEN amount

                            WHEN type = 'transfer'
                                AND transfer_direction = 'savings_to_living'
                            THEN -amount

                            ELSE 0
                        END
                    ),
                    0
                ) AS current_amount
            FROM living_transactions
        `;

        const savingsCurrent = toNumber(savingsResult[0]?.current_amount);

        const savingsGoal = savingsGoalResult[0]
            ? {
                  current: savingsCurrent,
                  goal: toNumber(savingsGoalResult[0].target_amount),
              }
            : {
                  current: savingsCurrent,
                  goal: 10000,
              };

        return NextResponse.json({
            balance,
            income: currentIncome,
            expense,
            fixedExpense,
            livingToSavings,
            savingsToLiving,

            variableSpending: variableSpending.map((item) => ({
                name: item.name,
                amount: item.amount,
            })),

            savings: savingsGoal,
        });
    } catch (error) {
        console.error("GET /api/living error:", error);

        return NextResponse.json(
            {
                error: "생활 데이터를 불러오지 못했어요.",
            },
            {
                status: 500,
            },
        );
    }
}
