import { sql } from "@/lib/db";

/* ============================================================
   GET
   실제 저장된 급여 기록 조회
   ============================================================ */

export async function GET() {
    try {
        const result = await sql`
            SELECT
                id,
                TO_CHAR(
                    pay_period_start_date,
                    'YYYY-MM-DD'
                ) AS start_date,
                TO_CHAR(
                    pay_period_end_date,
                    'YYYY-MM-DD'
                ) AS end_date,
                TO_CHAR(
                    pay_date,
                    'YYYY-MM-DD'
                ) AS pay_date,

                actual_hours,
                actual_cash_tips,
                actual_paycheque_tips,

                actual_pay,
                actual_tips,
                actual_deductions,
                adjustments,
                actual_net_pay,

                created_at,
                updated_at

            FROM pay_period_actuals

            ORDER BY
                pay_period_start_date DESC
        `;

        const histories = result.map((row) => {
            const actualHours = Number(row.actual_hours) || 0;

            const actualCashTips = Number(row.actual_cash_tips) || 0;

            const actualPaychequeTips = Number(row.actual_paycheque_tips) || 0;

            const actualPay = Number(row.actual_pay) || 0;

            const actualTips = Number(row.actual_tips) || 0;

            const actualDeductions = Number(row.actual_deductions) || 0;

            const actualNetPay = row.actual_net_pay !== null && row.actual_net_pay !== undefined ? Number(row.actual_net_pay) : 0;

            const adjustments = Array.isArray(row.adjustments) ? row.adjustments : [];

            return {
                id: Number(row.id),

                startDate: String(row.start_date),

                endDate: String(row.end_date),

                payDate: row.pay_date ? String(row.pay_date) : null,

                hours: actualHours,

                pay: actualPay,
                actualPay,

                tips: actualTips,
                actualTips,

                cashTips: actualCashTips,

                paychequeTips: actualPaychequeTips,

                deductions: actualDeductions,
                actualDeductions,

                adjustments,

                netPay: actualNetPay,
                actualNetPay,

                totalIncome: actualNetPay + actualCashTips,

                // 기존 화면과의 호환을 위해 유지.
                // 실제 급여에서는 세금을 다시 계산하지 않는다.
                calculatedNetPay: actualNetPay,

                createdAt: row.created_at,

                updatedAt: row.updated_at,
            };
        });

        return Response.json(histories);
    } catch (error) {
        console.error("Pay history GET error:", error);

        return Response.json(
            {
                error: "급여 기록을 불러오지 못했습니다.",
                detail: error instanceof Error ? error.message : String(error),
            },
            { status: 500 },
        );
    }
}

/* ============================================================
   POST
   새로운 실제 급여 기록 저장
   ============================================================ */

export async function POST(request: Request) {
    try {
        const body = await request.json();

        const {
            payPeriodStart,
            payPeriodEnd,
            payDate,
            actualHours,
            actualPay,
            actualTips,
            actualDeductions,
            adjustments,
            actualNetPay,
        } = body;

        // --------------------------------------------------------
        // 필수값
        // --------------------------------------------------------

        if (!payPeriodStart || !payPeriodEnd) {
            return Response.json(
                {
                    error: "급여 기간이 없습니다.",
                },
                { status: 400 },
            );
        }

        // --------------------------------------------------------
        // 숫자 검증
        // --------------------------------------------------------

        const hours = Number(actualHours);

        const pay = Number(actualPay);

        const tips = Number(actualTips);

        const deductions = Number(actualDeductions);

        const netPay = Number(actualNetPay);

        if (!Number.isFinite(hours) || hours < 0) {
            return Response.json(
                {
                    error: "근무시간이 올바르지 않습니다.",
                },
                { status: 400 },
            );
        }

        if (!Number.isFinite(pay) || pay < 0) {
            return Response.json(
                {
                    error: "실제 급여가 올바르지 않습니다.",
                },
                { status: 400 },
            );
        }

        if (!Number.isFinite(tips) || tips < 0) {
            return Response.json(
                {
                    error: "실제 팁이 올바르지 않습니다.",
                },
                { status: 400 },
            );
        }

        if (!Number.isFinite(deductions) || deductions < 0) {
            return Response.json(
                {
                    error: "공제액이 올바르지 않습니다.",
                },
                { status: 400 },
            );
        }

        if (!Number.isFinite(netPay)) {
            return Response.json(
                {
                    error: "실제 실수령액이 올바르지 않습니다.",
                },
                { status: 400 },
            );
        }

        // --------------------------------------------------------
        // adjustments
        // --------------------------------------------------------

        const validAdjustments = Array.isArray(adjustments)
            ? adjustments
                  .filter(
                      (item) =>
                          item &&
                          (item.type === "add" || item.type === "subtract") &&
                          typeof item.name === "string" &&
                          Number.isFinite(Number(item.amount)) &&
                          Number(item.amount) >= 0,
                  )
                  .map((item) => ({
                      type: item.type,
                      name: item.name.trim(),
                      amount: Number(item.amount),
                  }))
                  .filter((item) => item.name.length > 0)
            : [];

        // --------------------------------------------------------
        // cash / paycheque tip 분리
        //
        // 실제 입력한 actualTips를 총 팁으로 저장하고,
        // 현재 설정에 따라 cash/paycheque 값을 분리한다.
        //
        // 만약 화면에서 별도로 전달한다면 그 값을 우선한다.
        // --------------------------------------------------------

        const actualCashTips = Number(body.actualCashTips);

        const actualPaychequeTips = Number(body.actualPaychequeTips);

        let cashTips = 0;
        let paychequeTips = 0;

        if (Number.isFinite(actualCashTips) && actualCashTips >= 0) {
            cashTips = actualCashTips;
        }

        if (Number.isFinite(actualPaychequeTips) && actualPaychequeTips >= 0) {
            paychequeTips = actualPaychequeTips;
        }

        // --------------------------------------------------------
        // 저장
        //
        // 같은 기간이 이미 있으면 UPDATE
        // --------------------------------------------------------

        const result = await sql`
            INSERT INTO pay_period_actuals (
                pay_period_start_date,
                pay_period_end_date,
                pay_date,

                actual_hours,
                actual_cash_tips,
                actual_paycheque_tips,

                actual_pay,
                actual_tips,
                actual_deductions,
                adjustments,
                actual_net_pay,

                updated_at
            )
            VALUES (
                ${payPeriodStart},
                ${payPeriodEnd},
                ${payDate || null},

                ${hours},
                ${cashTips},
                ${paychequeTips},

                ${pay},
                ${tips},
                ${deductions},
                ${JSON.stringify(validAdjustments)},
                ${netPay},

                CURRENT_TIMESTAMP
            )

            ON CONFLICT (
                pay_period_start_date,
                pay_period_end_date
            )

            DO UPDATE SET
                pay_date =
                    EXCLUDED.pay_date,

                actual_hours =
                    EXCLUDED.actual_hours,

                actual_cash_tips =
                    EXCLUDED.actual_cash_tips,

                actual_paycheque_tips =
                    EXCLUDED.actual_paycheque_tips,

                actual_pay =
                    EXCLUDED.actual_pay,

                actual_tips =
                    EXCLUDED.actual_tips,

                actual_deductions =
                    EXCLUDED.actual_deductions,

                adjustments =
                    EXCLUDED.adjustments,

                actual_net_pay =
                    EXCLUDED.actual_net_pay,

                updated_at =
                    CURRENT_TIMESTAMP

            RETURNING
                id,
                TO_CHAR(
                    pay_period_start_date,
                    'YYYY-MM-DD'
                ) AS start_date,
                TO_CHAR(
                    pay_period_end_date,
                    'YYYY-MM-DD'
                ) AS end_date,
                TO_CHAR(
                    pay_date,
                    'YYYY-MM-DD'
                ) AS pay_date,

                actual_hours,
                actual_cash_tips,
                actual_paycheque_tips,

                actual_pay,
                actual_tips,
                actual_deductions,
                adjustments,
                actual_net_pay,

                created_at,
                updated_at
        `;

        const row = result[0];

        return Response.json(
            {
                success: true,
                data: {
                    id: Number(row.id),

                    startDate: String(row.start_date),

                    endDate: String(row.end_date),

                    payDate: row.pay_date ? String(row.pay_date) : null,

                    hours: Number(row.actual_hours) || 0,

                    pay: Number(row.actual_pay) || 0,

                    actualPay: Number(row.actual_pay) || 0,

                    tips: Number(row.actual_tips) || 0,

                    actualTips: Number(row.actual_tips) || 0,

                    cashTips: Number(row.actual_cash_tips) || 0,

                    paychequeTips: Number(row.actual_paycheque_tips) || 0,

                    deductions: Number(row.actual_deductions) || 0,

                    actualDeductions: Number(row.actual_deductions) || 0,

                    adjustments: Array.isArray(row.adjustments) ? row.adjustments : [],

                    netPay: Number(row.actual_net_pay) || 0,

                    actualNetPay: Number(row.actual_net_pay) || 0,

                    totalIncome: (Number(row.actual_net_pay) || 0) + (Number(row.actual_cash_tips) || 0),
                },
            },
            { status: 201 },
        );
    } catch (error) {
        console.error("Pay history POST error:", error);

        return Response.json(
            {
                error: "급여 기록을 저장하지 못했습니다.",
                detail: error instanceof Error ? error.message : String(error),
            },
            { status: 500 },
        );
    }
}

/* ============================================================
   PUT
   기존 실제 급여 기록 수정
   ============================================================ */

export async function PUT(request: Request) {
    try {
        const body = await request.json();

        const { id, payPeriodStart, payPeriodEnd, payDate, actualHours, actualPay, actualTips, actualDeductions, adjustments } =
            body;

        if (!id) {
            return Response.json(
                {
                    error: "급여 기록 ID가 없습니다.",
                },
                { status: 400 },
            );
        }

        if (!payPeriodStart || !payPeriodEnd) {
            return Response.json(
                {
                    error: "급여 기간이 없습니다.",
                },
                { status: 400 },
            );
        }

        const hours = Number(actualHours);

        const pay = Number(actualPay);

        const tips = Number(actualTips);

        const deductions = Number(actualDeductions);

        if (!Number.isFinite(hours) || hours < 0) {
            return Response.json(
                {
                    error: "근무시간이 올바르지 않습니다.",
                },
                { status: 400 },
            );
        }

        if (!Number.isFinite(pay) || pay < 0) {
            return Response.json(
                {
                    error: "실제 급여가 올바르지 않습니다.",
                },
                { status: 400 },
            );
        }

        if (!Number.isFinite(tips) || tips < 0) {
            return Response.json(
                {
                    error: "실제 팁이 올바르지 않습니다.",
                },
                { status: 400 },
            );
        }

        if (!Number.isFinite(deductions) || deductions < 0) {
            return Response.json(
                {
                    error: "공제액이 올바르지 않습니다.",
                },
                { status: 400 },
            );
        }

        // --------------------------------------------------------
        // adjustment 정리
        // --------------------------------------------------------

        const validAdjustments = Array.isArray(adjustments)
            ? adjustments
                  .filter(
                      (item) =>
                          item &&
                          (item.type === "add" || item.type === "subtract") &&
                          typeof item.name === "string" &&
                          Number.isFinite(Number(item.amount)) &&
                          Number(item.amount) >= 0,
                  )
                  .map((item) => ({
                      type: item.type,
                      name: item.name.trim(),
                      amount: Number(item.amount),
                  }))
                  .filter((item) => item.name.length > 0)
            : [];

        // --------------------------------------------------------
        // 실제 실수령액
        //
        // 수정할 때도 사용자가 입력한 actualNetPay를
        // 그대로 저장한다.
        // --------------------------------------------------------

        const actualNetPay = Number(body.actualNetPay);

        if (!Number.isFinite(actualNetPay)) {
            return Response.json(
                {
                    error: "실제 실수령액이 올바르지 않습니다.",
                },
                { status: 400 },
            );
        }

        // --------------------------------------------------------
        // cash / paycheque tip
        // --------------------------------------------------------

        const actualCashTips = Number(body.actualCashTips);

        const actualPaychequeTips = Number(body.actualPaychequeTips);

        const cashTips = Number.isFinite(actualCashTips) && actualCashTips >= 0 ? actualCashTips : 0;

        const paychequeTips = Number.isFinite(actualPaychequeTips) && actualPaychequeTips >= 0 ? actualPaychequeTips : 0;

        // --------------------------------------------------------
        // UPDATE
        // --------------------------------------------------------

        const result = await sql`
            UPDATE pay_period_actuals

            SET
                pay_period_start_date =
                    ${payPeriodStart},

                pay_period_end_date =
                    ${payPeriodEnd},

                pay_date =
                    ${payDate || null},

                actual_hours =
                    ${hours},

                actual_cash_tips =
                    ${cashTips},

                actual_paycheque_tips =
                    ${paychequeTips},

                actual_pay =
                    ${pay},

                actual_tips =
                    ${tips},

                actual_deductions =
                    ${deductions},

                adjustments =
                    ${JSON.stringify(validAdjustments)},

                actual_net_pay =
                    ${actualNetPay},

                updated_at =
                    CURRENT_TIMESTAMP

            WHERE id = ${Number(id)}

            RETURNING
                id,
                TO_CHAR(
                    pay_period_start_date,
                    'YYYY-MM-DD'
                ) AS start_date,
                TO_CHAR(
                    pay_period_end_date,
                    'YYYY-MM-DD'
                ) AS end_date,
                TO_CHAR(
                    pay_date,
                    'YYYY-MM-DD'
                ) AS pay_date,

                actual_hours,
                actual_cash_tips,
                actual_paycheque_tips,

                actual_pay,
                actual_tips,
                actual_deductions,
                adjustments,
                actual_net_pay,

                created_at,
                updated_at
        `;

        if (result.length === 0) {
            return Response.json(
                {
                    error: "해당 급여 기록을 찾을 수 없습니다.",
                },
                { status: 404 },
            );
        }

        const row = result[0];

        return Response.json({
            success: true,
            data: {
                id: Number(row.id),

                startDate: String(row.start_date),

                endDate: String(row.end_date),

                payDate: row.pay_date ? String(row.pay_date) : null,

                hours: Number(row.actual_hours) || 0,

                pay: Number(row.actual_pay) || 0,

                actualPay: Number(row.actual_pay) || 0,

                tips: Number(row.actual_tips) || 0,

                actualTips: Number(row.actual_tips) || 0,

                cashTips: Number(row.actual_cash_tips) || 0,

                paychequeTips: Number(row.actual_paycheque_tips) || 0,

                deductions: Number(row.actual_deductions) || 0,

                actualDeductions: Number(row.actual_deductions) || 0,

                adjustments: Array.isArray(row.adjustments) ? row.adjustments : [],

                netPay: Number(row.actual_net_pay) || 0,

                actualNetPay: Number(row.actual_net_pay) || 0,

                totalIncome: (Number(row.actual_net_pay) || 0) + (Number(row.actual_cash_tips) || 0),
            },
        });
    } catch (error) {
        console.error("Pay history PUT error:", error);

        return Response.json(
            {
                error: "급여 기록을 수정하지 못했습니다.",
                detail: error instanceof Error ? error.message : String(error),
            },
            { status: 500 },
        );
    }
}

/* ============================================================
   DELETE
   실제 급여 기록 삭제
   ============================================================ */

export async function DELETE(request: Request) {
    try {
        const body = await request.json();

        const id = Number(body.id);

        if (!Number.isFinite(id) || id <= 0) {
            return Response.json(
                {
                    error: "급여 기록 ID가 올바르지 않습니다.",
                },
                { status: 400 },
            );
        }

        const result = await sql`
            DELETE FROM pay_period_actuals

            WHERE id = ${id}

            RETURNING id
        `;

        if (result.length === 0) {
            return Response.json(
                {
                    error: "해당 급여 기록을 찾을 수 없습니다.",
                },
                { status: 404 },
            );
        }

        return Response.json({
            success: true,
            id: Number(result[0].id),
        });
    } catch (error) {
        console.error("Pay history DELETE error:", error);

        return Response.json(
            {
                error: "급여 기록을 삭제하지 못했습니다.",
                detail: error instanceof Error ? error.message : String(error),
            },
            { status: 500 },
        );
    }
}
