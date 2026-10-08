"use client";
// lib/salary/hooks.ts
// 화면에서 쓰는 React 훅. 계산은 estimate.ts, 데이터 가져오기는 loaders.ts가 하고 여기서는 연결만 한다.
import { useCallback, useEffect, useMemo, useState } from "react";
import { buildPeriodEstimate } from "@/lib/salary/estimate";
import {
    fetchHolidays,
    fetchPeriodTips,
    fetchProfile,
    fetchSalarySettings,
    fetchWorkSchedules,
} from "@/lib/salary/loaders";
import type {
    HolidayData,
    PayPeriodData,
    PeriodEstimateOutcome,
    PeriodTipsData,
    SalaryProfile,
    SalarySettingsData,
    WorkScheduleData,
} from "@/lib/salary/types";

/*
 * 프로필 · 급여 설정 · 근무 일정을 한 번에 불러온다.
 * 화면마다 따로 fetch하지 않고 이 훅을 쓰면 세 화면의 데이터와 계산이 같아진다.
 */
export function useSalaryData() {
    const [profile, setProfile] = useState<SalaryProfile | null>(null);
    const [settings, setSettings] = useState<SalarySettingsData | null>(null);
    const [schedules, setSchedules] = useState<WorkScheduleData[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;

        const load = async () => {
            try {
                const [nextProfile, nextSettings, nextSchedules] = await Promise.all([
                    fetchProfile(),
                    fetchSalarySettings(),
                    fetchWorkSchedules(),
                ]);

                if (cancelled) {
                    return;
                }

                setProfile(nextProfile);
                setSettings(nextSettings);
                setSchedules(nextSchedules);
            } catch (loadError) {
                console.error("급여 데이터 조회 실패:", loadError);

                if (!cancelled) {
                    setError("급여 정보를 불러오지 못했어요.");
                }
            } finally {
                if (!cancelled) {
                    setIsLoading(false);
                }
            }
        };

        void load();

        return () => {
            cancelled = true;
        };
    }, []);

    // 설정을 저장한 뒤 등 다시 불러와야 할 때
    const reloadSettings = useCallback(async () => {
        try {
            setSettings(await fetchSalarySettings());
        } catch (reloadError) {
            console.error("급여 설정 조회 실패:", reloadError);
        }
    }, []);

    const reloadSchedules = useCallback(async () => {
        try {
            setSchedules(await fetchWorkSchedules());
        } catch (reloadError) {
            console.error("근무 일정 조회 실패:", reloadError);
        }
    }, []);

    return { profile, settings, schedules, isLoading, error, setSchedules, reloadSettings, reloadSchedules };
}

/*
 * 한 급여 기간의 팁 · 공휴일을 불러와 예상 급여를 계산한다.
 * 현재 기간과 지난 기간을 함께 보여주는 화면은 이 훅을 기간별로 두 번 쓰면 된다.
 */
export function usePeriodEstimate(
    data: { profile: SalaryProfile | null; settings: SalarySettingsData | null; schedules: WorkScheduleData[] },
    period: PayPeriodData | null,
) {
    const [tips, setTips] = useState<PeriodTipsData | null>(null);
    const [holidays, setHolidays] = useState<HolidayData[]>([]);
    const [holidaysUnavailable, setHolidaysUnavailable] = useState(false);

    const startDate = period?.startDate;
    const endDate = period?.endDate;
    const countryCode = data.profile?.countryCode ?? null;
    const provinceCode = data.profile?.provinceCode ?? null;

    const reloadTips = useCallback(async () => {
        if (!startDate || !endDate) {
            setTips(null);
            return;
        }

        try {
            setTips(await fetchPeriodTips({ startDate, endDate }));
        } catch (tipsError) {
            console.error("팁 조회 실패:", tipsError);
            setTips(null);
        }
    }, [startDate, endDate]);

    useEffect(() => {
        void reloadTips();
    }, [reloadTips]);

    useEffect(() => {
        if (!startDate || !endDate || !countryCode) {
            setHolidays([]);
            setHolidaysUnavailable(false);
            return;
        }

        let cancelled = false;

        const load = async () => {
            try {
                const result = await fetchHolidays({ country: countryCode, province: provinceCode, period: { startDate, endDate } });

                if (!cancelled) {
                    setHolidays(result.holidays);
                    setHolidaysUnavailable(result.unavailable);
                }
            } catch (holidayError) {
                console.error("공휴일 조회 실패:", holidayError);

                if (!cancelled) {
                    setHolidays([]);
                    setHolidaysUnavailable(true);
                }
            }
        };

        void load();

        return () => {
            cancelled = true;
        };
    }, [startDate, endDate, countryCode, provinceCode]);

    const outcome: PeriodEstimateOutcome | null = useMemo(
        () =>
            period
                ? buildPeriodEstimate({ profile: data.profile, settings: data.settings, schedules: data.schedules, holidays, tips, period })
                : null,
        [period, data.profile, data.settings, data.schedules, holidays, tips],
    );

    return { outcome, tips, setTips, reloadTips, holidays, holidaysUnavailable };
}

/*
 * 금액이 0에서 목표값까지 올라가는 숫자 애니메이션.
 * 목표값이 같으면 다시 시작하지 않는다. (계산 결과 객체를 의존성으로 쓰면 렌더링마다 처음부터 다시 시작해 0 근처에서 멈춤)
 */
export function useCountUp(target: number, enabled: boolean = true, duration: number = 1000) {
    const [value, setValue] = useState(0);

    useEffect(() => {
        if (!enabled || !Number.isFinite(target)) {
            setValue(0);
            return;
        }

        let startTime: number | null = null;
        let frame = 0;

        const animate = (timestamp: number) => {
            if (startTime === null) {
                startTime = timestamp;
            }

            const progress = Math.min((timestamp - startTime) / duration, 1);
            const eased = 1 - Math.pow(1 - progress, 3);

            setValue(target * eased);

            if (progress < 1) {
                frame = requestAnimationFrame(animate);
            } else {
                setValue(target);
            }
        };

        frame = requestAnimationFrame(animate);

        return () => cancelAnimationFrame(frame);
    }, [target, enabled, duration]);

    return value;
}
