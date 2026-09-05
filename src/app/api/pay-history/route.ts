import { sql } from "@/lib/db";
import {
    getPayPeriodEndDate,
    getPeriodsPerYear,
} from "@/lib/payPeriod";
import { calculateTaxes } from "@/lib/tax";

type PayFrequency =
    | "weekly"
    | "biweekly"
    | "semi-monthly"
    | "monthly"
    | "custom";

type SemiMonthlyType =
    | "first-fifteenth"
    | "fifteenth-end";

/**
 * Date -> YYYY-MM-DD
 */
const formatISO = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");

    return `${year}-${month}-${day}`;
};

/**
 * 어떤 형태의 날짜가 들어와도 YYYY-MM-DD로 변환
 */
const toDateString = (value: string | Date) => {
    if (value instanceof Date) {
        return formatISO(value);
    }

    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
        return value;
    }

    const parsed = new Date(value);

    if (Number.isNaN(parsed.getTime())) {
        throw new Error(`Invalid date value: ${value}`);
    }

    return formatISO(parsed);
};

/**
 * 다음 급여기간 계산
 */
const shiftPayPeriod = (
    startDate: string,
    payDate: string,
    frequency: PayFrequency,
    semiMonthlyType?: SemiMonthlyType,
    customPayDays?: number,
) => {
    const currentEndDate = toDateString(
        getPayPeriodEndDate(
            startDate,
            frequency,
            semiMonthlyType,
            customPayDays,
        ) as string | Date,
    );

    const nextStart = new Date(
        `${currentEndDate}T00:00:00`,
    );

    nextStart.setDate(nextStart.getDate() + 1);

    const nextStartDate = formatISO(nextStart);

    const nextPayDate = new Date(
        `${payDate}T00:00:00`,
    );

    switch (frequency) {
        case "weekly":
            nextPayDate.setDate(
                nextPayDate.getDate() + 7,
            );
            break;

        case "biweekly":
            nextPayDate.setDate(
                nextPayDate.getDate() + 14,
            );
            break;

        case "monthly":
            nextPayDate.setMonth(
                nextPayDate.getMonth() + 1,
            );
            break;

        case "semi-monthly":
            if (semiMonthlyType === "first-fifteenth") {
                if (nextPayDate.getDate() === 1) {
                    nextPayDate.setDate(16);
                } else {
                    nextPayDate.setMonth(
                        nextPayDate.getMonth() + 1,
                    );
                    nextPayDate.setDate(1);
                }
            } else {
                if (nextPayDate.getDate() === 16) {
                    nextPayDate.setMonth(
                        nextPayDate.getMonth() + 1,
                    );
                    nextPayDate.setDate(1);
                } else {
                    nextPayDate.setDate(16);
                }
            }
            break;

        case "custom":
            nextPayDate.setDate(
                nextPayDate.getDate() +
                    (Number(customPayDays) || 14),
            );
            break;
    }

    const nextEndDate = toDateString(
        getPayPeriodEndDate(
            nextStartDate,
            frequency,
            semiMonthlyType,
            customPayDays,
        ) as string | Date,
    );

    return {
        startDate: nextStartDate,
        endDate: nextEndDate,
        payDate: formatISO(nextPayDate),
    };
};

/**
 * 근무시간 계산
 */
const calculateHours = (
    startTime: string,
    endTime: string,
    breakMinutes: number,
) => {
    if (!startTime || !endTime) {
        return 0;
    }

    const [startHour, startMinute] = startTime
        .split(":")
        .map(Number);

    const [endHour, endMinute] = endTime
        .split(":")
        .map(Number);

    const start = startHour * 60 + startMinute;

    let end = endHour * 60 + endMinute;

    if (end < start) {
        end += 24 * 60;
    }

    const totalMinutes = Math.max(
        0,
        end -
            start -
            (Number(breakMinutes) || 0),
    );

    return totalMinutes / 60;
};

export async function GET() {
    try {
        // ============================================================
        // 1. 급여 설정 조회
        // ============================================================

        const settingsResult = await sql`
            SELECT
                country,
                province,
                pay_type,
                pay_frequency,
                hourly_wage,
                monthly_salary,
                has_tips,
                tip_type,
                pay_period_start_date,
                pay_date,
                semi_monthly_type,
                custom_pay_days
            FROM salary_settings
            WHERE id = 1
            LIMIT 1
        `;

        const settings = settingsResult[0];

        if (!settings) {
            return Response.json([]);
        }

        if (
            !settings.pay_period_start_date ||
            !settings.pay_date
        ) {
            return Response.json([]);
        }

        const frequency =
            settings.pay_frequency as PayFrequency;

        const semiMonthlyType =
            settings.semi_monthly_type as
                | SemiMonthlyType
                | undefined;

        const customPayDays =
            Number(settings.custom_pay_days) || 14;

        const originalStartDate = toDateString(
            settings.pay_period_start_date as
                | string
                | Date,
        );

        const originalPayDate = toDateString(
            settings.pay_date as string | Date,
        );

        // ============================================================
        // 2. 현재 급여기간 계산
        // ============================================================

        let currentPeriod = {
            startDate: originalStartDate,

            endDate: toDateString(
                getPayPeriodEndDate(
                    originalStartDate,
                    frequency,
                    semiMonthlyType,
                    customPayDays,
                ) as string | Date,
            ),

            payDate: originalPayDate,
        };

        const today = new Date();

        const todayOnly = new Date(
            today.getFullYear(),
            today.getMonth(),
            today.getDate(),
        );

        let currentEnd = new Date(
            `${currentPeriod.endDate}T00:00:00`,
        );

        while (currentEnd < todayOnly) {
            currentPeriod = shiftPayPeriod(
                currentPeriod.startDate,
                currentPeriod.payDate,
                frequency,
                semiMonthlyType,
                customPayDays,
            );

            currentEnd = new Date(
                `${currentPeriod.endDate}T00:00:00`,
            );
        }

        // ============================================================
        // 3. 이미 저장된 실제 급여기간 확인
        // ============================================================

        const existingActuals = await sql`
            SELECT
                TO_CHAR(
                    pay_period_start_date,
                    'YYYY-MM-DD'
                ) AS start_date,

                TO_CHAR(
                    pay_period_end_date,
                    'YYYY-MM-DD'
                ) AS end_date
            FROM pay_period_actuals
        `;

        const existingPeriods = new Set(
            existingActuals.map(
                (row) =>
                    `${row.start_date}|${row.end_date}`,
            ),
        );

        // ============================================================
        // 4. 모든 근무 스케줄 조회
        // ============================================================

        const schedules = await sql`
            SELECT
                work_date,
                start_time,
                end_time,
                has_break,
                break_minutes
            FROM work_schedules
        `;

        // ============================================================
        // 5. 급여기간별 팁 조회
        // ============================================================

        const tips = await sql`
            SELECT
                TO_CHAR(
                    pay_period_start_date,
                    'YYYY-MM-DD'
                ) AS start_date,

                TO_CHAR(
                    pay_period_end_date,
                    'YYYY-MM-DD'
                ) AS end_date,

                cash_tips,
                paycheque_tips
            FROM pay_period_tips
        `;

        // ============================================================
        // 6. 완료된 급여기간 자동 저장
        //
        // 현재 급여기간보다 이전인 기간만 저장
        // 이미 저장된 기간은 절대 덮어쓰지 않음
        // ============================================================

        let period = {
            startDate: originalStartDate,

            endDate: toDateString(
                getPayPeriodEndDate(
                    originalStartDate,
                    frequency,
                    semiMonthlyType,
                    customPayDays,
                ) as string | Date,
            ),

            payDate: originalPayDate,
        };

        while (
            period.endDate <
            currentPeriod.startDate
        ) {
            const startDate = toDateString(
                period.startDate,
            );

            const endDate = toDateString(
                period.endDate,
            );

            const periodKey =
                `${startDate}|${endDate}`;

            // 이미 저장된 기간이면 건너뜀
            if (!existingPeriods.has(periodKey)) {
                // --------------------------------------------
                // 해당 기간의 근무 스케줄
                // --------------------------------------------

                const periodSchedules =
                    schedules.filter((schedule) => {
                        const workDate =
                            toDateString(
                                schedule.work_date as
                                    | string
                                    | Date,
                            );

                        return (
                            workDate >= startDate &&
                            workDate <= endDate
                        );
                    });

                // --------------------------------------------
                // 실제 근무시간 계산
                // --------------------------------------------

                const actualHours =
                    periodSchedules.reduce(
                        (
                            total,
                            schedule,
                        ) => {
                            return (
                                total +
                                calculateHours(
                                    String(
                                        schedule.start_time,
                                    ),
                                    String(
                                        schedule.end_time,
                                    ),
                                    schedule.has_break
                                        ? Number(
                                              schedule.break_minutes,
                                          )
                                        : 0,
                                )
                            );
                        },
                        0,
                    );

                // --------------------------------------------
                // 해당 기간 팁
                // --------------------------------------------

                const periodTip = tips.find(
                    (tip) =>
                        String(
                            tip.start_date,
                        ) === startDate &&
                        String(
                            tip.end_date,
                        ) === endDate,
                );

                const actualCashTips =
                    Number(
                        periodTip?.cash_tips,
                    ) || 0;

                const actualPaychequeTips =
                    Number(
                        periodTip?.paycheque_tips,
                    ) || 0;

                // --------------------------------------------
                // 실제 급여기간 자동 저장
                // --------------------------------------------

                await sql`
                    INSERT INTO pay_period_actuals (
                        pay_period_start_date,
                        pay_period_end_date,
                        actual_hours,
                        actual_cash_tips,
                        actual_paycheque_tips,
                        is_confirmed
                    )
                    VALUES (
                        ${startDate},
                        ${endDate},
                        ${actualHours.toFixed(2)},
                        ${actualCashTips.toFixed(2)},
                        ${actualPaychequeTips.toFixed(2)},
                        FALSE
                    )
                    ON CONFLICT (
                        pay_period_start_date,
                        pay_period_end_date
                    )
                    DO NOTHING
                `;

                existingPeriods.add(
                    periodKey,
                );
            }

            // --------------------------------------------
            // 다음 급여기간
            // --------------------------------------------

            period = shiftPayPeriod(
                period.startDate,
                period.payDate,
                frequency,
                semiMonthlyType,
                customPayDays,
            );
        }

        // ============================================================
        // 7. 저장된 급여기간 다시 조회
        // ============================================================

        const actualsResult = await sql`
            SELECT
                TO_CHAR(
                    pay_period_start_date,
                    'YYYY-MM-DD'
                ) AS pay_period_start_date,

                TO_CHAR(
                    pay_period_end_date,
                    'YYYY-MM-DD'
                ) AS pay_period_end_date,

                actual_hours,
                actual_cash_tips,
                actual_paycheque_tips,
                is_confirmed
            FROM pay_period_actuals
            ORDER BY pay_period_start_date DESC
        `;

        // ============================================================
        // 8. 급여 계산
        // ============================================================

        const histories = [];

        const periodsPerYear =
            getPeriodsPerYear(frequency);

        // salary_settings에 vacation_pay_rate가 없으므로
        // 기존 로직과 동일하게 4.15% 사용
        const vacationPayRate = 4.15;

        for (const row of actualsResult) {
            const periodStart =
                String(
                    row.pay_period_start_date,
                );

            const periodEnd =
                String(
                    row.pay_period_end_date,
                );

            const hours =
                Number(row.actual_hours) || 0;

            const actualCashTips =
                Number(
                    row.actual_cash_tips,
                ) || 0;

            const actualPaychequeTips =
                Number(
                    row.actual_paycheque_tips,
                ) || 0;

            // --------------------------------------------
            // 기본급
            // --------------------------------------------

            const basePay =
                settings.pay_type === "hourly"
                    ? hours *
                      Number(
                          settings.hourly_wage || 0,
                      )
                    : settings.pay_type ===
                        "salary"
                      ? Number(
                            settings.monthly_salary ||
                                0,
                        )
                      : 0;

            // --------------------------------------------
            // 팁 종류
            // --------------------------------------------

            const hasPaychequeTips =
                Boolean(
                    settings.has_tips,
                ) &&
                (
                    settings.tip_type ===
                        "paycheque" ||
                    settings.tip_type ===
                        "both"
                );

            const hasCashTips =
                Boolean(
                    settings.has_tips,
                ) &&
                (
                    settings.tip_type ===
                        "cash" ||
                    settings.tip_type ===
                        "both"
                );

            const paychequeTips =
                hasPaychequeTips
                    ? actualPaychequeTips
                    : 0;

            const cashTips =
                hasCashTips
                    ? actualCashTips
                    : 0;

            // --------------------------------------------
            // Vacation Pay
            // --------------------------------------------

            const vacationPay =
                basePay *
                (vacationPayRate / 100);

            // --------------------------------------------
            // 과세 총액
            // --------------------------------------------

            const taxableGrossPay =
                basePay +
                paychequeTips +
                vacationPay;

            // --------------------------------------------
            // 연간 환산
            // --------------------------------------------

            const annualGross =
                taxableGrossPay *
                periodsPerYear;

            // --------------------------------------------
            // 세금 계산
            // --------------------------------------------

            const taxes = calculateTaxes({
                country: String(
                    settings.country || "CA",
                ),

                province: String(
                    settings.province || "",
                ),

                annualGross,
            });

            const province =
                taxes.provinceName;

            const cpp =
                taxes.cpp /
                periodsPerYear;

            const cpp2 =
                taxes.cpp2 /
                periodsPerYear;

            const ei =
                taxes.ei /
                periodsPerYear;

            const federalTax =
                taxes.federalTax /
                periodsPerYear;

            const provincialTax =
                taxes.provincialTax /
                periodsPerYear;

            const deductions =
                taxes.totalDeductions /
                periodsPerYear;

            // --------------------------------------------
            // 실수령액
            // --------------------------------------------

            const netPay =
                taxableGrossPay -
                deductions;

            const totalIncome =
                netPay +
                cashTips;

            // --------------------------------------------
            // History
            // --------------------------------------------

            histories.push({
                startDate: periodStart,
                endDate: periodEnd,

                hours,

                basePay,

                paychequeTips,
                cashTips,

                grossPay:
                    taxableGrossPay,

                deductions,

                cpp,
                cpp2,
                ei,

                federalTax,
                provincialTax,

                netPay,
                totalIncome,

                province:
                    String(
                        province || "",
                    ),

                tipType:
                    settings.has_tips
                        ? settings.tip_type
                        : null,

                hasTips:
                    Boolean(
                        settings.has_tips,
                    ),

                isConfirmed:
                    Boolean(
                        row.is_confirmed,
                    ),

                vacationPay,
            });
        }

        // ============================================================
        // 9. 결과 반환
        // ============================================================

        return Response.json(
            histories,
        );
    } catch (error) {
        console.error(
            "Pay history error:",
            error,
        );

        return Response.json(
            {
                error:
                    "급여 기록을 불러오지 못했습니다.",
            },
            {
                status: 500,
            },
        );
    }
}