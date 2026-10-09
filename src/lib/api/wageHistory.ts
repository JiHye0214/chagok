// lib/api/wageHistory.ts
// 시급 이력(hourly_wage_history) 읽기·쓰기. 004 SQL을 먼저 실행해야 한다.
import { sql } from "@/lib/db";
import { WAGE_BASELINE_DATE, getHourlyWageOn, normalizeWageHistory } from "@/lib/salary/wage";
import type { HourlyWageEntry } from "@/lib/salary/wage";

// 사용자 시간대 기준 오늘 (YYYY-MM-DD). 서버는 UTC라서 그냥 new Date()를 쓰면 저녁에 하루 밀린다.
export const getTodayInTimeZone = async (userId: string): Promise<string> => {
    const [row] = await sql`
        SELECT timezone FROM user_profiles WHERE user_id = ${userId} LIMIT 1
    `;

    const timeZone = (row?.timezone as string | null) || "UTC";

    try {
        return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
    } catch {
        return new Date().toISOString().slice(0, 10);
    }
};

export const getWageHistory = async (userId: string): Promise<HourlyWageEntry[]> => {
    let rows;

    try {
        rows = await sql`
            SELECT TO_CHAR(effective_date, 'YYYY-MM-DD') AS effective_date, hourly_wage
            FROM hourly_wage_history
            WHERE user_id = ${userId}
            ORDER BY effective_date ASC
        `;
    } catch (error) {
        // 004 SQL 을 아직 안 돌려 테이블이 없는 경우: 읽기는 빈 이력으로 넘어가 급여 화면이 깨지지 않게 한다.
        if ((error as { code?: string })?.code === "42P01") {
            console.warn("hourly_wage_history 테이블이 없습니다. 004_hourly_wage_history.sql 을 실행하세요.");

            return [];
        }

        throw error;
    }

    return normalizeWageHistory(
        rows.map((row) => ({ effectiveDate: String(row.effective_date), hourlyWage: Number(row.hourly_wage) })),
    );
};

/**
 * 화면에 내려줄 시급 이력.
 * 이력이 아직 없는 기존 사용자는 salary_settings.hourly_wage 를 "처음부터 적용" 한 줄로 보여준다. (DB 이전 작업 불필요)
 */
export const getWageHistoryWithLegacy = async (userId: string, legacyHourlyWage: number | null): Promise<HourlyWageEntry[]> => {
    const history = await getWageHistory(userId);

    if (history.length > 0 || legacyHourlyWage === null || !(legacyHourlyWage > 0)) {
        return history;
    }

    return [{ effectiveDate: WAGE_BASELINE_DATE, hourlyWage: legacyHourlyWage }];
};

/**
 * 시급 저장.
 * - applyFrom === "all": 이력을 모두 지우고 새 시급 하나로 (오타 수정, 처음부터 이 시급)
 * - applyFrom === 날짜: 그 날부터 새 시급. 그 전은 그대로.
 * 이미 같은 시급이면 아무것도 하지 않는다.
 * 돌려주는 값은 "오늘 적용되는 시급".
 */
export const saveHourlyWage = async ({
    userId,
    hourlyWage,
    applyFrom,
    legacyHourlyWage,
    today,
}: {
    userId: string;
    hourlyWage: number;
    // "all" = 처음부터, 날짜 = 그 날부터, null = 지정 안 함(시급이 달라졌으면 "all"처럼, 같으면 아무것도 안 함)
    applyFrom: "all" | string | null;
    legacyHourlyWage: number | null;
    today: string;
}): Promise<{ currentWage: number; history: HourlyWageEntry[] }> => {
    let history = await getWageHistoryWithLegacy(userId, legacyHourlyWage);

    const isFirstTime = history.length === 0;

    if (!isFirstTime && applyFrom === null && getHourlyWageOn(today, history) === hourlyWage) {
        return { currentWage: hourlyWage, history };
    }

    if (isFirstTime || applyFrom === "all" || applyFrom === null) {
        await sql`DELETE FROM hourly_wage_history WHERE user_id = ${userId}`;
        await sql`
            INSERT INTO hourly_wage_history (user_id, effective_date, hourly_wage)
            VALUES (${userId}, ${WAGE_BASELINE_DATE}, ${hourlyWage})
        `;
    } else if (!isUnchanged(history, applyFrom, hourlyWage)) {
        // 기존 사용자의 가상 첫 줄(설정 테이블의 시급)을 실제 이력으로 먼저 저장
        if (!(await hasStoredHistory(userId))) {
            await sql`
                INSERT INTO hourly_wage_history (user_id, effective_date, hourly_wage)
                VALUES (${userId}, ${WAGE_BASELINE_DATE}, ${history[0].hourlyWage})
                ON CONFLICT (user_id, effective_date) DO NOTHING
            `;
        }

        await sql`
            INSERT INTO hourly_wage_history (user_id, effective_date, hourly_wage)
            VALUES (${userId}, ${applyFrom}, ${hourlyWage})
            ON CONFLICT (user_id, effective_date) DO UPDATE SET hourly_wage = EXCLUDED.hourly_wage
        `;
    }

    history = await getWageHistory(userId);

    return { currentWage: getHourlyWageOn(today, history, hourlyWage), history };
};

// 그 날부터 이미 같은 시급이고 그 뒤에 따로 바뀐 이력도 없으면 저장할 게 없다.
const isUnchanged = (history: HourlyWageEntry[], applyFrom: string, hourlyWage: number) =>
    getHourlyWageOn(applyFrom, history) === hourlyWage && history.every((entry) => entry.effectiveDate <= applyFrom);

const hasStoredHistory = async (userId: string) => {
    const [row] = await sql`SELECT 1 AS found FROM hourly_wage_history WHERE user_id = ${userId} LIMIT 1`;

    return Boolean(row);
};
