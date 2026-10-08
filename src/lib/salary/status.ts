// lib/salary/status.ts
// "곧 받을 급여"와 "아직 기록하지 않은 지난 급여"를 판단하는 규칙. (급여 화면과 급여 기록 화면이 서로 다르게 판단하던 것을 통일)
import { formatDate, getEndedPayPeriods } from "@/lib/payPeriod";
import type { PayPeriodSettings } from "@/lib/payPeriod";
import { getSchedulesInPeriod } from "@/lib/salary/estimate";
import type { PayPeriodData, WorkScheduleData } from "@/lib/salary/types";

// 몇 번째 이전 급여 기간까지 "기록하지 않음"을 찾아볼지
const LOOKBACK_PERIODS = 4;

export type PayPeriodStatus = {
    // 급여 기간은 끝났고 급여일은 아직 안 온 기간 (가장 가까운 급여일 하나)
    upcoming: PayPeriodData | null;
    // 급여일이 지났는데 급여 기록이 없는 가장 최근 기간
    overdue: PayPeriodData | null;
};

export const getPayPeriodStatus = ({
    settings,
    schedules,
    recordedPeriods,
    today = formatDate(new Date()),
}: {
    settings: PayPeriodSettings | null;
    schedules: WorkScheduleData[];
    // 이미 급여 기록이 있는 기간
    recordedPeriods: { startDate: string; endDate: string }[];
    today?: string;
}): PayPeriodStatus => {
    const status: PayPeriodStatus = { upcoming: null, overdue: null };

    if (!settings) {
        return status;
    }

    for (const period of getEndedPayPeriods(settings, LOOKBACK_PERIODS, today)) {
        const isRecorded = recordedPeriods.some(
            (recorded) => recorded.startDate === period.startDate && recorded.endDate === period.endDate,
        );

        // 근무 기록이 없는 기간은 받을 급여도, 기록할 급여도 없다고 본다
        if (isRecorded || getSchedulesInPeriod(schedules, period).length === 0) {
            continue;
        }

        if (period.payDate >= today) {
            if (!status.upcoming || period.payDate < status.upcoming.payDate) {
                status.upcoming = period;
            }
        } else if (!status.overdue) {
            // 최근 기간부터 보므로 처음 찾은 것이 가장 최근
            status.overdue = period;
        }
    }

    return status;
};
