// lib/payroll/overtime.ts
// 연장근무 가산분 추정. 사용자가 설정에서 켠 경우에만 쓴다. (연장수당을 안 주는 직장도 있음)
// 기본급에는 이미 모든 시간이 1배로 들어가 있으므로, 여기서는 "추가로 붙는 분"만 계산한다.
//
// 규칙(일반 근로자 기준, 업종·계약에 따른 예외는 반영하지 않음)
// - 온타리오: 주 44시간 초과분 1.5배
// - BC: 하루 8시간 초과 1.5배, 12시간 초과 2배, 주 40시간 초과(일 단위 연장 제외) 1.5배
// - 한국: 하루 8시간 초과 1.5배, 주 40시간 초과(일 8시간 이내분 합계) 1.5배 (5인 이상 사업장)
// 주 구분은 일요일~토요일로 가정한다.

export type OvertimeRule = {
    dailyThreshold?: number; // 하루 기준 시간
    dailyDoubleThreshold?: number; // 이 시간을 넘으면 2배
    weeklyThreshold: number; // 주 기준 시간
};

export const getOvertimeRule = (country: string, region?: string): OvertimeRule | null => {
    const c = country.toUpperCase();
    const r = region?.toUpperCase();

    if (c === "KR") {
        return { dailyThreshold: 8, weeklyThreshold: 40 };
    }

    if (c === "CA" && r === "ON") {
        return { weeklyThreshold: 44 };
    }

    if (c === "CA" && r === "BC") {
        return { dailyThreshold: 8, dailyDoubleThreshold: 12, weeklyThreshold: 40 };
    }

    return null;
};

const weekKey = (date: string) => {
    const d = new Date(`${date}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() - d.getUTCDay());
    return d.toISOString().slice(0, 10);
};

export const calculateOvertime = ({
    country,
    region,
    hoursByDate,
    wageOn,
}: {
    country: string;
    region?: string;
    hoursByDate: Record<string, number>;
    wageOn: (date: string) => number;
}): { premiumPay: number; overtimeHours: number; supported: boolean } => {
    const rule = getOvertimeRule(country, region);

    if (!rule) {
        return { premiumPay: 0, overtimeHours: 0, supported: false };
    }

    let premiumPay = 0;
    let overtimeHours = 0;
    const weekRegular: Record<string, number> = {};

    for (const date of Object.keys(hoursByDate).sort()) {
        const hours = hoursByDate[date];
        const wage = wageOn(date);
        const week = weekKey(date);

        let regular = hours;

        if (rule.dailyThreshold !== undefined && hours > rule.dailyThreshold) {
            const doubleAt = rule.dailyDoubleThreshold ?? Infinity;
            const time1 = Math.min(hours, doubleAt) - rule.dailyThreshold;
            const time2 = Math.max(0, hours - doubleAt);

            premiumPay += time1 * wage * 0.5 + time2 * wage * 1.0;
            overtimeHours += time1 + time2;
            regular = rule.dailyThreshold;
        }

        const before = weekRegular[week] ?? 0;
        const after = before + regular;
        weekRegular[week] = after;

        const over = Math.max(0, after - Math.max(before, rule.weeklyThreshold));

        if (over > 0) {
            premiumPay += over * wage * 0.5;
            overtimeHours += over;
        }
    }

    return { premiumPay, overtimeHours, supported: true };
};
