import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/user";

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
        const user = await getCurrentUser();

        if (!user) {
            return NextResponse.json(
                {
                    error: "로그인이 필요해요.",
                },
                { status: 401 },
            );
        }

        const { searchParams } = new URL(request.url);
        const month = searchParams.get("month") ?? undefined;

        const currentMonth = getMonthRange(month);

        const [
            currentTransactions,
            fixedExpenseResult,
            savingsGoalResult,
            pendingTravelResult,
            pendingPayrollResult,
            profileResult,
            livingSettingsResult,
        ] = await Promise.all([
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
                   AND lc.user_id = ${user.id}
                WHERE lt.user_id = ${user.id}
                  AND lt.transaction_date >= ${currentMonth.start}::date
                  AND lt.transaction_date < ${currentMonth.end}::date
                ORDER BY
                    lt.transaction_date DESC,
                    lt.id DESC
            `,

            sql`
                SELECT
                    COALESCE(SUM(amount), 0) AS total
                FROM living_fixed_expenses
                WHERE user_id = ${user.id}
                  AND is_active = TRUE
            `,

            sql`
                SELECT
                    id,
                    name,
                    target_amount
                FROM savings_goals
                WHERE user_id = ${user.id}
                ORDER BY id
                LIMIT 1
            `,

            /*
             * 이번 달에 종료된 완료 여행 중
             * 아직 생활비에 반영되지 않은 현재 사용자의 여행.
             *
             * 지출 합계가 0이면 아직 입력된 여행 지출이 없는 것으로 본다.
             */
            sql`
                SELECT
                    t.id,
                    t.title,
                    t.city,
                    TO_CHAR(t.start_date, 'YYYY-MM-DD') AS start_date,
                    TO_CHAR(t.end_date, 'YYYY-MM-DD') AS end_date,
                    COALESCE(SUM(te.amount), 0) AS total_expense
                FROM trips t
                LEFT JOIN trip_expenses te
                    ON te.trip_id = t.id
                WHERE t.user_id = ${user.id}
                  AND t.trip_type = 'completed'
                  AND t.end_date >= ${currentMonth.start}::date
                  AND t.end_date < ${currentMonth.end}::date
                  AND t.end_date <= CURRENT_DATE
                  AND NOT EXISTS (
                      SELECT 1
                      FROM living_transactions lt
                      WHERE lt.user_id = ${user.id}
                        AND lt.source_type = 'trip'
                        AND lt.source_id = t.id
                  )
                GROUP BY
                    t.id,
                    t.title,
                    t.city,
                    t.start_date,
                    t.end_date
                ORDER BY
                    t.end_date ASC,
                    t.id ASC
            `,

            /*
             * 지급일 다음 날이 이번 달에 해당하는 현재 사용자의 급여.
             *
             * actual_net_pay가 없으면 missing_actual.
             * 실제 수령액이 있으면 ready.
             *
             * 실제 급여가 입력된 경우에는 pay_period_actuals.id를
             * source_id로 사용한다.
             */
            sql`
                SELECT 
                    ppa.id AS actual_id,
                    TO_CHAR(ppa.pay_period_start_date, 'YYYY-MM-DD') AS start_date,
                    TO_CHAR(ppa.pay_period_end_date, 'YYYY-MM-DD') AS end_date,
                    TO_CHAR(ppa.pay_date, 'YYYY-MM-DD') AS pay_date,
                    ppa.actual_net_pay
                FROM pay_period_actuals ppa
                WHERE ppa.user_id = ${user.id}
                  AND ppa.pay_date + INTERVAL '1 day' >= ${currentMonth.start}::date
                  AND ppa.pay_date + INTERVAL '1 day' < ${currentMonth.end}::date
                  AND ppa.pay_date + INTERVAL '1 day' <= CURRENT_DATE
                  AND ppa.actual_net_pay IS NOT NULL
                  AND NOT EXISTS (
                      SELECT 1
                      FROM living_transactions lt
                      WHERE lt.user_id = ${user.id}
                        AND lt.source_type = 'payroll'
                        AND lt.source_id = ppa.id
                  )
                ORDER BY
                    ppa.pay_date ASC,
                    ppa.id ASC
            `,

            sql`
                SELECT currency
                FROM user_profiles
                WHERE user_id = ${user.id}
                LIMIT 1
            `,

            sql`
                SELECT
                    initial_living_money,
                    initial_savings_money
                FROM living_settings
                WHERE user_id = ${user.id}
                LIMIT 1
            `,
        ]);

        const current = currentTransactions as LivingTransactionRow[];

        const initialLivingMoney = toNumber(livingSettingsResult[0]?.initial_living_money);

        const initialSavingsMoney = toNumber(livingSettingsResult[0]?.initial_savings_money);

        const currentIncome = current
            .filter((item) => item.type === "income")
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

        const balance = initialLivingMoney + currentIncome - expense - livingToSavings + savingsToLiving;

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
            WHERE user_id = ${user.id}
        `;

        const savingsTransactionAmount = toNumber(savingsResult[0]?.current_amount);

        const savingsCurrent = initialSavingsMoney + savingsTransactionAmount;

        const savingsGoal = savingsGoalResult[0]
            ? {
                  current: savingsCurrent,
                  goal: toNumber(savingsGoalResult[0].target_amount),
              }
            : {
                  current: savingsCurrent,
                  goal: 10000,
              };

        const pendingTravel = (
            pendingTravelResult as Array<{
                id: number;
                title: string | null;
                city: string;
                start_date: string;
                end_date: string;
                total_expense: number | string;
            }>
        ).map((item) => {
            const amount = toNumber(item.total_expense);

            return {
                sourceType: "trip" as const,
                sourceId: item.id,
                title: item.title || item.city,
                startDate: item.start_date,
                endDate: item.end_date,
                amount,
                status: amount > 0 ? ("ready" as const) : ("missing_expense" as const),
            };
        });

        const pendingPayroll = (
            pendingPayrollResult as Array<{
                actual_id: number;
                start_date: string;
                end_date: string;
                pay_date: string;
                actual_net_pay: number | string | null;
            }>
        ).map((item) => ({
            sourceType: "payroll" as const,
            sourceId: item.actual_id,
            payrollRecordId: item.actual_id,
            actualId: item.actual_id,
            startDate: item.start_date,
            endDate: item.end_date,
            payDate: item.pay_date,
            amount: item.actual_net_pay === null ? null : toNumber(item.actual_net_pay),
            status: item.actual_net_pay === null ? ("missing_actual" as const) : ("ready" as const),
        }));

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

            pendingIntegrations: {
                travel: pendingTravel,
                payroll: pendingPayroll,
            },

            currency: profileResult[0]?.currency ?? "CAD",
        });
    } catch (error) {
        console.error("GET /api/living error:", error);

        return NextResponse.json(
            {
                error: error instanceof Error ? error.message : String(error),
            },
            {
                status: 500,
            },
        );
    }
}
