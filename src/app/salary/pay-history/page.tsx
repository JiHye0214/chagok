"use client";

import { useEffect, useMemo, useState } from "react";
import BackButtonHeader from "@/components/BackButtonHeader";
import { getPayPeriodEndDate } from "@/lib/payPeriod";
import { calculateExpectedSalary } from "@/lib/payroll/calculateExpectedSalary";

type AdjustmentType = "add" | "subtract";

type Adjustment = {
    type: AdjustmentType;
    name: string;
    amount: number;
};

type PayHistory = {
    id: number;

    startDate: string;
    endDate: string;
    payDate: string | null;

    hours: number;
    pay: number;
    tips: number;
    deductions: number;

    adjustments: Adjustment[];
    hourlyWage: number | null;

    calculatedNetPay: number;
    netPay: number;
    totalIncome: number;
};

type SalarySettings = {
    country?: string;
    province?: string;

    payType?: "hourly" | "salary" | "commission" | "other";

    payFrequency: "weekly" | "biweekly" | "semi-monthly" | "monthly" | "custom";

    hourlyWage: number | null;
    monthlySalary?: number | null;

    hasTips?: boolean;
    tipType?: "cash" | "paycheque" | "both" | null;

    payPeriodStartDate: string | null;
    payDate: string | null;
    payDateOffset: number | null;

    semiMonthlyType?: "first-fifteenth" | "fifteenth-end";
    customPayDays?: number;

    vacationPayRate?: number;
};

type WorkSchedule = {
    id: number;
    date: string;
    startTime: string;
    endTime: string;
    hasBreak: boolean;
    breakMinutes: number;
    alarmEnabled: boolean;
    alarmMinutesBefore: number;
};

type Holiday = {
    date: string;
    name: string;
    global: boolean;
};

type FormState = {
    startDate: string;
    endDate: string;
    payDate: string;

    hours: string;
    pay: string;
    tips: string;
    deductions: string;

    adjustments: Adjustment[];

    netPay: string;
};

const emptyForm: FormState = {
    startDate: "",
    endDate: "",
    payDate: "",

    hours: "",
    pay: "",
    tips: "",
    deductions: "",

    adjustments: [],

    netPay: "",
};

const formatDisplayDate = (dateValue: string | Date) => {
    if (!dateValue) {
        return "";
    }

    const date = dateValue instanceof Date ? dateValue : new Date(`${dateValue}T00:00:00`);

    if (Number.isNaN(date.getTime())) {
        return String(dateValue);
    }

    return `${date.getFullYear()}. ${date.getMonth() + 1}. ${date.getDate()}.`;
};

const formatMoney = (value: number | null | undefined) => {
    const amount = Number(value);

    if (!Number.isFinite(amount)) {
        return "$0.00";
    }

    return `$${amount.toFixed(2)}`;
};

const normalizeNumberInput = (value: string) => {
    if (value === "") {
        return "";
    }

    return value.replace(/^0+(?=\d)/, "");
};

/*
 * 오늘 날짜를 YYYY-MM-DD로 반환
 */
const getTodayString = () => {
    const today = new Date();

    return [today.getFullYear(), String(today.getMonth() + 1).padStart(2, "0"), String(today.getDate()).padStart(2, "0")].join(
        "-",
    );
};

const calculateHours = (startTime: string, endTime: string, breakMinutes: number = 0) => {
    if (!startTime || !endTime) {
        return 0;
    }

    const [startHour, startMinute] = startTime.split(":").map(Number);
    const [endHour, endMinute] = endTime.split(":").map(Number);

    const start = startHour * 60 + startMinute;

    let end = endHour * 60 + endMinute;

    if (end < start) {
        end += 24 * 60;
    }

    const totalMinutes = Math.max(0, end - start - Math.max(0, breakMinutes));

    return totalMinutes / 60;
};

export default function PayHistoryPage() {
    const [payHistory, setPayHistory] = useState<PayHistory[]>([]);

    const [isLoading, setIsLoading] = useState(true);

    const [selectedHistory, setSelectedHistory] = useState<PayHistory | null>(null);

    const [isFormOpen, setIsFormOpen] = useState(false);

    const [isSaving, setIsSaving] = useState(false);

    const [hourlyWage, setHourlyWage] = useState<number | null>(null);

    const [form, setForm] = useState<FormState>(emptyForm);

    const [salarySettings, setSalarySettings] = useState<SalarySettings | null>(null);

    const [schedules, setSchedules] = useState<WorkSchedule[]>([]);

    const [holidays, setHolidays] = useState<Holiday[]>([]);

    const [isExpectedSalaryOpen, setIsExpectedSalaryOpen] = useState(false);

    const [pendingPeriod, setPendingPeriod] = useState<{
        startDate: string;
        endDate: string;
        payDate: string | null;
    } | null>(null);

    const [isPendingPeriod, setIsPendingPeriod] = useState(false);

    const loadPayHistory = async () => {
        try {
            const response = await fetch("/api/pay-history");

            if (!response.ok) {
                throw new Error("급여 기록 조회 실패");
            }

            const data = (await response.json()) as Array<{
                id: number;

                startDate: string;
                endDate: string;
                payDate: string | null;

                hours?: number;
                basePay?: number;
                pay?: number;

                cashTips?: number;
                paychequeTips?: number;
                tips?: number;

                deductions?: number;

                actualPay?: number;
                actualTips?: number;
                actualDeductions?: number;
                actualNetPay?: number | null;

                netPay?: number;
                totalIncome?: number;

                calculatedNetPay?: number;

                adjustments?: Adjustment[];

                hourlyWage?: number | null;
            }>;

            const normalizedData: PayHistory[] = data.map((item) => {
                const basePay = Number(item.basePay ?? item.pay ?? 0);

                const cashTips = Number(item.cashTips ?? 0);

                const paychequeTips = Number(item.paychequeTips ?? 0);

                const calculatedTips = Number(item.tips ?? cashTips + paychequeTips);

                const actualPay = Number(item.actualPay ?? 0);

                const actualTips = Number(item.actualTips ?? calculatedTips);

                const calculatedDeductions = Number(item.deductions ?? 0);

                const actualDeductions = Number(item.actualDeductions ?? calculatedDeductions);

                const calculatedNetPay = Number(
                    item.netPay ?? item.calculatedNetPay ?? basePay + calculatedTips - calculatedDeductions,
                );

                const actualNetPay =
                    item.actualNetPay !== null && item.actualNetPay !== undefined ? Number(item.actualNetPay) : calculatedNetPay;

                return {
                    id: Number(item.id),

                    startDate: String(item.startDate),

                    endDate: String(item.endDate),

                    payDate: item.payDate ? String(item.payDate) : null,

                    hours: Number(item.hours ?? 0),

                    /*
                     * 실제 급여가 저장되어 있으면
                     * 실제 급여를 사용하고,
                     * 없으면 API에서 계산한 기본급 사용
                     */
                    pay: actualPay > 0 ? actualPay : basePay,

                    /*
                     * cash + paycheque 팁을
                     * 화면에서는 하나의 팁 금액으로 표시
                     */
                    tips: actualTips,

                    deductions: actualDeductions,

                    adjustments: Array.isArray(item.adjustments) ? item.adjustments : [],

                    hourlyWage: item.hourlyWage !== null && item.hourlyWage !== undefined ? Number(item.hourlyWage) : null,

                    calculatedNetPay,

                    netPay: actualNetPay,

                    totalIncome: Number(item.totalIncome ?? actualNetPay + actualTips),
                };
            });

            setPayHistory(normalizedData);

            return normalizedData;
        } catch (error) {
            console.error(error);

            return [];
        } finally {
            setIsLoading(false);
        }
    };

    const loadSalarySettings = async () => {
        try {
            const response = await fetch("/api/salary-settings");

            if (!response.ok) {
                throw new Error("급여 설정 조회 실패");
            }

            const settings = (await response.json()) as SalarySettings | null;

            setSalarySettings(settings);
            setHourlyWage(settings?.hourlyWage ?? null);

            return settings;
        } catch (error) {
            console.error(error);

            return null;
        }
    };

    const loadSchedules = async () => {
        try {
            const response = await fetch("/api/work-schedules");

            if (!response.ok) {
                throw new Error("근무 일정 조회 실패");
            }

            const data = (await response.json()) as WorkSchedule[];

            setSchedules(data);

            return data;
        } catch (error) {
            console.error(error);

            return [];
        }
    };

    const loadHolidays = async (year: number, province?: string) => {
        try {
            const params = new URLSearchParams({
                year: String(year),
            });

            if (province) {
                params.set("province", province);
            }

            const response = await fetch(`/api/holidays?${params.toString()}`);

            if (!response.ok) {
                throw new Error("공휴일 조회 실패");
            }

            const data = (await response.json()) as Holiday[];

            setHolidays(data);

            return data;
        } catch (error) {
            console.error(error);

            setHolidays([]);

            return [];
        }
    };

    useEffect(() => {
        const load = async () => {
            const [, salarySettingsData] = await Promise.all([loadPayHistory(), loadSalarySettings(), loadSchedules()]);

            if (salarySettingsData) {
                await loadHolidays(new Date().getFullYear(), salarySettingsData.province);
            }
        };

        void load();
    }, []);

    /*
     * salary 페이지에서 전달한
     * 미기록 급여기간
     */
    useEffect(() => {
        const params = new URLSearchParams(window.location.search);

        const startDate = params.get("startDate");
        const endDate = params.get("endDate");
        const payDate = params.get("payDate");

        if (!startDate || !endDate) {
            return;
        }

        setPendingPeriod({
            startDate,
            endDate,
            payDate,
        });
    }, []);

    /*
     * 실제 데이터가 로드된 뒤
     * pending 기간이 아직 없는지 확인
     */
    useEffect(() => {
        if (!pendingPeriod) {
            setIsPendingPeriod(false);
            return;
        }

        const exists = payHistory.some(
            (history) => history.startDate === pendingPeriod.startDate && history.endDate === pendingPeriod.endDate,
        );

        setIsPendingPeriod(!exists);
    }, [payHistory, pendingPeriod]);

    /*
     * 지급일이 오늘 이후인 급여는
     * 아직 실제 지급된 급여가 아니므로 리스트에서 숨김
     *
     * 지급일이 없는 수동 기록은 그대로 표시
     */
    const visiblePayHistory = useMemo(() => {
        const today = getTodayString();

        return payHistory.filter((history) => {
            if (!history.payDate) {
                return true;
            }

            return history.payDate <= today;
        });
    }, [payHistory]);

    /*
     * 급여 기간을 다음 기간으로 이동
     */
    const shiftPayPeriod = (
        startDate: string,
        payDate: string,
        frequency: SalarySettings["payFrequency"],
        semiMonthlyType?: SalarySettings["semiMonthlyType"],
        customPayDays?: number,
    ) => {
        const start = new Date(`${startDate}T00:00:00`);
        const payment = new Date(`${payDate}T00:00:00`);

        const shiftDate = (date: Date) => {
            switch (frequency) {
                case "weekly":
                    date.setDate(date.getDate() + 7);
                    break;

                case "biweekly":
                    date.setDate(date.getDate() + 14);
                    break;

                case "monthly":
                    date.setMonth(date.getMonth() + 1);
                    break;

                case "semi-monthly":
                    if (semiMonthlyType === "first-fifteenth") {
                        if (date.getDate() === 1) {
                            date.setDate(16);
                        } else {
                            date.setMonth(date.getMonth() + 1);
                            date.setDate(1);
                        }
                    } else {
                        if (date.getDate() === 16) {
                            date.setDate(1);
                            date.setMonth(date.getMonth() + 1);
                        } else {
                            date.setDate(16);
                        }
                    }
                    break;

                case "custom":
                    date.setDate(date.getDate() + (customPayDays || 14));
                    break;
            }
        };

        shiftDate(start);
        shiftDate(payment);

        const nextStartDate = [
            start.getFullYear(),
            String(start.getMonth() + 1).padStart(2, "0"),
            String(start.getDate()).padStart(2, "0"),
        ].join("-");

        const nextPayDate = [
            payment.getFullYear(),
            String(payment.getMonth() + 1).padStart(2, "0"),
            String(payment.getDate()).padStart(2, "0"),
        ].join("-");

        return {
            startDate: nextStartDate,
            endDate: getPayPeriodEndDate(nextStartDate, frequency, semiMonthlyType, customPayDays),
            payDate: nextPayDate,
        };
    };

    /*
     * 현재 날짜 기준으로 현재/다음 급여기간 찾기
     */
    const salaryStatus = useMemo(() => {
        if (!salarySettings || !salarySettings.payPeriodStartDate) {
            return null;
        }

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const DAY = 1000 * 60 * 60 * 24;

        const parseDate = (value: string) => {
            const date = new Date(`${value}T00:00:00`);
            date.setHours(0, 0, 0, 0);
            return date;
        };

        const formatDateString = (date: Date) => {
            return [
                date.getFullYear(),
                String(date.getMonth() + 1).padStart(2, "0"),
                String(date.getDate()).padStart(2, "0"),
            ].join("-");
        };

        const getDaysDifference = (from: Date, to: Date) => {
            return Math.round((to.getTime() - from.getTime()) / DAY);
        };

        /*
         * ---------------------------------------------------------
         * 지급일 offset 계산
         * ---------------------------------------------------------
         *
         * 예:
         * 급여기간 종료일 9/4
         * 지급일          9/11
         *
         * => +7일
         */
        const anchorStartDate = salarySettings.payPeriodStartDate;

        const anchorEndDateString = getPayPeriodEndDate(
            anchorStartDate,
            salarySettings.payFrequency,
            salarySettings.semiMonthlyType,
            salarySettings.customPayDays,
        );

        const anchorEndDate = parseDate(anchorEndDateString);

        let paymentOffset: number | null = null;

        if (salarySettings.payDateOffset !== null && salarySettings.payDateOffset !== undefined) {
            paymentOffset = Number(salarySettings.payDateOffset);
        } else if (salarySettings.payDate) {
            const configuredPayDate = parseDate(salarySettings.payDate);

            paymentOffset = Math.round((configuredPayDate.getTime() - anchorEndDate.getTime()) / DAY);
        }

        if (paymentOffset === null || !Number.isFinite(paymentOffset)) {
            return null;
        }

        /*
         * ---------------------------------------------------------
         * 급여기간 이동
         * ---------------------------------------------------------
         */
        const shiftPeriodStart = (date: Date, direction: 1 | -1) => {
            const next = new Date(date);

            switch (salarySettings.payFrequency) {
                case "weekly":
                    next.setDate(next.getDate() + direction * 7);
                    break;

                case "biweekly":
                    next.setDate(next.getDate() + direction * 14);
                    break;

                case "monthly":
                    next.setMonth(next.getMonth() + direction);
                    break;

                case "custom":
                    next.setDate(next.getDate() + direction * (Number(salarySettings.customPayDays) || 14));
                    break;

                case "semi-monthly":
                    /*
                     * 1~15 / 16~말일
                     *
                     * 시작일만 1 또는 16으로 이동시킨다.
                     */
                    if (next.getDate() <= 15) {
                        if (direction === 1) {
                            next.setDate(16);
                        } else {
                            next.setMonth(next.getMonth() - 1);
                            next.setDate(16);
                        }
                    } else {
                        if (direction === 1) {
                            next.setMonth(next.getMonth() + 1);
                            next.setDate(1);
                        } else {
                            next.setDate(1);
                        }
                    }
                    break;
            }

            return next;
        };

        /*
         * ---------------------------------------------------------
         * 모든 급여기간 생성
         * ---------------------------------------------------------
         *
         * 기준일 이전 52개 + 이후 52개
         *
         * 중요:
         * 급여기간이 오늘 이전이어도 지급일이 미래라면
         * 3번 카드의 후보가 된다.
         */
        const periods: {
            startDate: string;
            endDate: string;
            payDate: string;
        }[] = [];

        const addPeriod = (startDate: Date) => {
            const startString = formatDateString(startDate);

            const endString = getPayPeriodEndDate(
                startString,
                salarySettings.payFrequency,
                salarySettings.semiMonthlyType,
                salarySettings.customPayDays,
            );

            if (!endString) {
                return;
            }

            const endDate = parseDate(endString);

            const payDate = new Date(endDate);

            payDate.setDate(payDate.getDate() + paymentOffset);

            periods.push({
                startDate: startString,
                endDate: endString,
                payDate: formatDateString(payDate),
            });
        };

        /*
         * 과거 기간
         */
        let startDate = new Date(`${anchorStartDate}T00:00:00`);

        for (let i = 0; i < 52; i++) {
            addPeriod(startDate);

            startDate = shiftPeriodStart(startDate, -1);
        }

        /*
         * 미래 기간
         */
        startDate = new Date(`${anchorStartDate}T00:00:00`);

        for (let i = 0; i < 52; i++) {
            startDate = shiftPeriodStart(startDate, 1);

            addPeriod(startDate);
        }

        /*
         * ---------------------------------------------------------
         * 중복 기간 제거
         * ---------------------------------------------------------
         */
        const uniquePeriods = Array.from(
            new Map(periods.map((period) => [`${period.startDate}-${period.endDate}`, period])).values(),
        );

        /*
         * ---------------------------------------------------------
         * 3번
         *
         * 유효기간은 이미 끝났지만
         * 지급일은 아직 지나지 않은 급여
         *
         * 여기서는 DB를 절대로 확인하지 않는다.
         * ---------------------------------------------------------
         */
        const upcomingPeriods = uniquePeriods
            .filter((period) => {
                const endDate = parseDate(period.endDate);

                const payDate = parseDate(period.payDate);

                return endDate <= today && payDate > today;
            })
            .sort((a, b) => parseDate(a.payDate).getTime() - parseDate(b.payDate).getTime());

        /*
         * 3번이 있으면 무조건 이것을 먼저 보여준다.
         *
         * 예:
         *
         * 8/22 ~ 9/4  → 9/11
         * 오늘 9/6
         *
         * => 5일 뒤 받을 예정
         */
        const upcomingPeriod = upcomingPeriods[0];

        if (upcomingPeriod) {
            const payDate = parseDate(upcomingPeriod.payDate);

            const periodSchedules = schedules.filter(
                (schedule) =>
                    schedule.date.slice(0, 10) >= upcomingPeriod.startDate &&
                    schedule.date.slice(0, 10) <= upcomingPeriod.endDate,
            );

            const expectedSalary = calculateExpectedSalary({
                settings: {
                    country: salarySettings.country ?? "CA",
                    province: salarySettings.province ?? "",
                    payType: salarySettings.payType ?? "hourly",
                    payFrequency: salarySettings.payFrequency,
                    hourlyWage: salarySettings.hourlyWage ?? undefined,
                    monthlySalary: salarySettings.monthlySalary ?? undefined,
                    hasTips: salarySettings.hasTips ?? false,
                    tipType: salarySettings.tipType ?? undefined,
                    vacationPayRate: salarySettings.vacationPayRate,
                },
                schedules: periodSchedules,
                holidays,
                cashTips: 0,
                paychequeTips: 0,
            });

            return {
                type: "upcoming" as const,

                daysUntil: getDaysDifference(today, payDate),

                payDate: upcomingPeriod.payDate,

                startDate: upcomingPeriod.startDate,

                endDate: upcomingPeriod.endDate,

                expectedPay: expectedSalary.finalEstimatedIncome,

                expectedBasePay: expectedSalary.basePay,

                expectedDeductions: expectedSalary.totalDeductions,

                expectedNetPay: expectedSalary.estimatedNetPay,
            };
        }

        /*
         * ---------------------------------------------------------
         * 1번
         *
         * 유효기간도 지났고 지급일도 지난 급여
         *
         * 여기서만 DB 기록 여부를 확인한다.
         *
         * 그리고 "가장 최근에 지난 급여기간" 하나만 본다.
         * ---------------------------------------------------------
         */
        const latestPastPeriod = uniquePeriods
            .filter((period) => {
                const endDate = parseDate(period.endDate);

                const payDate = parseDate(period.payDate);

                return endDate <= today && payDate <= today;
            })
            .sort((a, b) => parseDate(b.endDate).getTime() - parseDate(a.endDate).getTime())[0];

        /*
         * 지난 급여기간 자체가 없다면 끝
         */
        if (!latestPastPeriod) {
            return null;
        }

        /*
         * 여기서 처음으로 DB 확인
         */
        const recorded = payHistory.some(
            (history) => history.startDate === latestPastPeriod.startDate && history.endDate === latestPastPeriod.endDate,
        );

        /*
         * 가장 최근에 지난 급여가 이미 기록되어 있으면
         * 오래된 다른 미기록 급여를 찾지 않는다.
         */
        if (recorded) {
            return null;
        }

        /*
         * 가장 최근에 지난 급여 하나만
         * 기록 유도 카드로 표시
         */
        return {
            type: "overdue" as const,

            payDate: latestPastPeriod.payDate,

            startDate: latestPastPeriod.startDate,

            endDate: latestPastPeriod.endDate,
        };
    }, [salarySettings, payHistory, schedules, holidays]);

    /*
     * URL에서 넘어온 미기록 급여 입력
     */
    const openPendingForm = () => {
        if (!pendingPeriod) {
            return;
        }

        setSelectedHistory(null);

        setForm({
            ...emptyForm,

            startDate: pendingPeriod.startDate,

            endDate: pendingPeriod.endDate,

            payDate: pendingPeriod.payDate ?? "",
        });

        setIsFormOpen(true);
    };

    /*
     * 새 급여 기록
     */
    const openCreateForm = () => {
        setSelectedHistory(null);

        if (!salarySettings?.payPeriodStartDate) {
            setForm({
                ...emptyForm,

                pay: hourlyWage !== null ? "0.00" : "",
            });

            setIsFormOpen(true);

            return;
        }

        const startDate = salarySettings.payPeriodStartDate;

        const endDate = getPayPeriodEndDate(
            startDate,
            salarySettings.payFrequency,
            salarySettings.semiMonthlyType,
            salarySettings.customPayDays,
        );

        let expectedPayDate = salarySettings.payDate ?? "";

        if (salarySettings.payDateOffset !== null) {
            const end = new Date(`${endDate}T00:00:00`);

            end.setDate(end.getDate() + salarySettings.payDateOffset);

            expectedPayDate = [
                end.getFullYear(),
                String(end.getMonth() + 1).padStart(2, "0"),
                String(end.getDate()).padStart(2, "0"),
            ].join("-");
        }

        setForm({
            ...emptyForm,

            startDate,

            endDate,

            payDate: expectedPayDate,

            pay: hourlyWage !== null ? "0.00" : "",
        });

        setIsFormOpen(true);
    };

    /*
     * 기존 급여 수정
     */
    const openEditForm = (history: PayHistory) => {
        setSelectedHistory(history);

        setForm({
            startDate: history.startDate,
            endDate: history.endDate,
            payDate: history.payDate ?? "",

            hours: history.hours.toString(),

            pay: history.pay.toString(),

            tips: history.tips.toString(),

            deductions: history.deductions.toString(),

            adjustments: history.adjustments.map((adjustment) => ({
                type: adjustment.type,

                name: adjustment.name,

                amount: adjustment.amount,
            })),

            netPay: history.netPay.toString(),
        });

        setIsFormOpen(true);
    };

    const closeForm = () => {
        if (isSaving) {
            return;
        }

        setIsFormOpen(false);
        setSelectedHistory(null);
        setForm(emptyForm);
    };

    /*
     * 폼 값 변경
     */
    const updateForm = <K extends keyof FormState>(key: K, value: FormState[K]) => {
        setForm((current) => ({
            ...current,
            [key]: value,
        }));
    };

    /*
     * 추가/차감 항목 변경
     */
    const updateAdjustment = (index: number, field: "type" | "name" | "amount", value: AdjustmentType | string) => {
        setForm((current) => {
            const adjustments = [...current.adjustments];

            const currentItem = adjustments[index];

            if (!currentItem) {
                return current;
            }

            adjustments[index] = {
                ...currentItem,

                [field]: field === "amount" ? Number(value) : value,
            };

            return {
                ...current,
                adjustments,
            };
        });
    };

    const addAdjustment = (type: AdjustmentType) => {
        setForm((current) => ({
            ...current,

            adjustments: [
                ...current.adjustments,
                {
                    type,
                    name: "",
                    amount: 0,
                },
            ],
        }));
    };

    const removeAdjustment = (index: number) => {
        setForm((current) => ({
            ...current,

            adjustments: current.adjustments.filter((_, itemIndex) => itemIndex !== index),
        }));
    };

    /*
     * 현재 입력값으로 계산되는 실수령액
     *
     * 급여 + 팁 - 공제 + 추가/차감
     */
    const calculatedNetPay = useMemo(() => {
        const pay = Number(form.pay) || 0;

        const tips = Number(form.tips) || 0;

        const deductions = Number(form.deductions) || 0;

        const adjustmentTotal = form.adjustments.reduce((total, adjustment) => {
            const amount = Number(adjustment.amount) || 0;

            if (adjustment.type === "add") {
                return total + amount;
            }

            return total - amount;
        }, 0);

        return pay + tips - deductions + adjustmentTotal;
    }, [form.pay, form.tips, form.deductions, form.adjustments]);

    /*
     * 계산된 금액을 실제 실수령액 입력값에 적용
     */
    const useCalculatedNetPay = () => {
        setForm((current) => ({
            ...current,

            netPay: calculatedNetPay.toFixed(2),
        }));
    };

    /*
     * 저장
     */
    const savePayHistory = async () => {
        const hours = Number(form.hours);

        const pay = Number(form.pay);

        const tips = Number(form.tips || 0);

        const deductions = Number(form.deductions || 0);

        const netPay = Number(form.netPay);

        if (!form.startDate || !form.endDate) {
            alert("급여 기간을 입력해주세요.");

            return;
        }

        if (!Number.isFinite(hours) || hours < 0) {
            alert("근무시간을 확인해주세요.");

            return;
        }

        if (!Number.isFinite(pay) || pay < 0) {
            alert("급여를 확인해주세요.");

            return;
        }

        if (!Number.isFinite(tips) || tips < 0) {
            alert("팁을 확인해주세요.");

            return;
        }

        if (!Number.isFinite(deductions) || deductions < 0) {
            alert("공제액을 확인해주세요.");

            return;
        }

        if (!Number.isFinite(netPay) || netPay < 0) {
            alert("실수령액을 확인해주세요.");

            return;
        }

        const validAdjustments = form.adjustments.filter(
            (adjustment) => adjustment.name.trim() !== "" && Number.isFinite(adjustment.amount) && adjustment.amount > 0,
        );

        try {
            setIsSaving(true);

            const payload = {
                payPeriodStart: form.startDate,

                payPeriodEnd: form.endDate,

                payDate: form.payDate || null,

                actualHours: hours,

                actualPay: pay,

                actualTips: tips,

                actualDeductions: deductions,

                adjustments: validAdjustments,

                actualNetPay: netPay,
            };

            const response = await fetch("/api/pay-history", {
                method: selectedHistory ? "PUT" : "POST",

                headers: {
                    "Content-Type": "application/json",
                },

                body: JSON.stringify({
                    ...payload,

                    ...(selectedHistory
                        ? {
                              id: selectedHistory.id,
                          }
                        : {}),
                }),
            });

            const result = (await response.json()) as {
                error?: string;
            };

            if (!response.ok) {
                throw new Error(result.error || "급여 기록 저장 실패");
            }

            await loadPayHistory();

            /*
             * pending 급여를 저장한 경우
             * URL과 pending 상태 제거
             */
            if (pendingPeriod && pendingPeriod.startDate === form.startDate && pendingPeriod.endDate === form.endDate) {
                setPendingPeriod(null);
                setIsPendingPeriod(false);

                window.history.replaceState({}, "", "/salary/pay-history");
            }

            closeForm();
        } catch (error) {
            console.error(error);

            alert("급여 기록을 저장하지 못했습니다.");
        } finally {
            setIsSaving(false);
        }
    };

    /*
     * 삭제
     */
    const deletePayHistory = async (history: PayHistory) => {
        const confirmed = window.confirm(
            `${formatDisplayDate(history.startDate)} ~ ${formatDisplayDate(history.endDate)} 급여 기록을 삭제할까요?`,
        );

        if (!confirmed) {
            return;
        }

        try {
            const response = await fetch(`/api/pay-history?id=${history.id}`, {
                method: "DELETE",
            });

            const result = (await response.json()) as {
                error?: string;
            };

            if (!response.ok) {
                throw new Error(result.error || "급여 기록 삭제 실패");
            }

            setSelectedHistory(null);

            await loadPayHistory();
        } catch (error) {
            console.error(error);

            alert("급여 기록을 삭제하지 못했습니다.");
        }
    };

    if (isLoading) {
        return (
            <div className="mx-auto max-w-md">
                <BackButtonHeader
                    href="/salary"
                    title="급여 기록"
                    description="지난 급여 기간과 실제 수령 금액을 확인해보세요."
                />

                <p className="mt-6 text-sm text-gray-400">급여 기록을 불러오는 중...</p>
            </div>
        );
    }

    return (
        <>
            <div className="mx-auto max-w-md pb-10">
                <BackButtonHeader
                    href="/salary"
                    title="급여 기록"
                    description="지난 급여 기간과 실제 수령 금액을 확인해보세요."
                />

                {/* 급여 상태 */}
                {salaryStatus?.type === "overdue" && (
                    <section className="mt-6 rounded-3xl bg-gray-900 p-5 text-white shadow-sm">
                        <p className="text-xs text-gray-400">급여 기록</p>

                        <p className="mt-1 text-lg font-bold">지급일이 지났어요</p>

                        <p className="mt-2 text-sm text-gray-400">
                            {formatDisplayDate(salaryStatus.startDate)}
                            {" ~ "}
                            {formatDisplayDate(salaryStatus.endDate)}
                        </p>

                        <p className="mt-1 text-xs text-gray-500">지급일 {formatDisplayDate(salaryStatus.payDate)}</p>

                        <button
                            type="button"
                            onClick={() => {
                                setPendingPeriod({
                                    startDate: salaryStatus.startDate,

                                    endDate: salaryStatus.endDate,

                                    payDate: salaryStatus.payDate,
                                });

                                setIsPendingPeriod(true);

                                setSelectedHistory(null);

                                setForm({
                                    ...emptyForm,

                                    startDate: salaryStatus.startDate,

                                    endDate: salaryStatus.endDate,

                                    payDate: salaryStatus.payDate,
                                });

                                setIsFormOpen(true);
                            }}
                            className="mt-5 flex w-full items-center justify-between rounded-2xl bg-white px-4 py-3 text-left text-sm font-medium text-black transition hover:bg-gray-100"
                        >
                            <span>실제 급여 기록하기</span>

                            <span>→</span>
                        </button>
                    </section>
                )}

                {salaryStatus?.type === "upcoming" && (
                    <button
                        type="button"
                        onClick={() => setIsExpectedSalaryOpen(true)}
                        className="mt-6 block w-full rounded-3xl bg-black p-5 text-left text-white shadow-sm transition"
                    >
                        <p className="text-xs text-gray-400">급여 예정</p>

                        <p className="mt-1 text-lg font-bold">{salaryStatus.daysUntil}일 뒤에 받을 예정</p>

                        <p className="mt-2 text-2xl font-bold">{formatMoney(salaryStatus.expectedPay)}</p>

                        <p className="mt-1 text-xs text-gray-500">지급일 {formatDisplayDate(salaryStatus.payDate)}</p>
                    </button>
                )}

                {/* 기록 추가 */}
                <button
                    type="button"
                    onClick={openCreateForm}
                    className="mt-6 flex w-full items-center justify-between rounded-3xl bg-white p-5 text-left shadow-sm transition hover:shadow-md"
                >
                    <div>
                        <p className="font-semibold">급여 기록 추가</p>

                        <p className="mt-1 text-sm text-gray-400">지난 급여를 직접 기록할 수 있어요.</p>
                    </div>

                    <span className="text-xl">+</span>
                </button>

                {visiblePayHistory.length === 0 ? (
                    <section className="mt-3 rounded-3xl bg-white p-6 shadow-sm">
                        <p className="text-sm text-gray-400">아직 급여 기록이 없어요.</p>
                    </section>
                ) : (
                    <div className="mt-3 space-y-3">
                        {visiblePayHistory.map((history, index) => (
                            <button
                                type="button"
                                key={history.id}
                                onClick={() => setSelectedHistory(history)}
                                className="w-full rounded-3xl bg-white p-5 text-left shadow-sm transition hover:shadow-md"
                            >
                                <div className="flex items-start justify-between">
                                    <div>
                                        {index === 0 && <p className="text-xs text-gray-400">최근 급여</p>}

                                        <p className="mt-1 font-semibold">
                                            {formatDisplayDate(history.startDate)}
                                            {" ~ "}
                                            {formatDisplayDate(history.endDate)}
                                        </p>

                                        {history.payDate && (
                                            <p className="mt-1 text-xs text-gray-400">
                                                지급일 {formatDisplayDate(history.payDate)}
                                            </p>
                                        )}
                                    </div>

                                    <span className="text-gray-300">→</span>
                                </div>

                                <div className="mt-5 grid grid-cols-2 gap-y-4 text-sm">
                                    <div>
                                        <p className="text-xs text-gray-400">일한 시간</p>

                                        <p className="mt-1 font-medium">
                                            {history.hours.toFixed(2)}
                                            시간
                                        </p>
                                    </div>

                                    <div>
                                        <p className="text-xs text-gray-400">급여</p>

                                        <p className="mt-1 font-medium">{formatMoney(history.pay)}</p>
                                    </div>

                                    <div>
                                        <p className="text-xs text-gray-400">팁</p>

                                        <p className="mt-1 font-medium">{formatMoney(history.tips)}</p>
                                    </div>

                                    <div>
                                        <p className="text-xs text-gray-400">실수령액</p>

                                        <p className="mt-1 text-lg font-bold">{formatMoney(history.netPay)}</p>
                                    </div>
                                </div>
                            </button>
                        ))}
                    </div>
                )}
            </div>

            {/* 상세 모달 */}
            {selectedHistory && !isFormOpen && (
                <div
                    className="fixed inset-0 z-80 flex items-end justify-center bg-black/40 p-4 sm:items-center"
                    onClick={() => setSelectedHistory(null)}
                >
                    <div
                        className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-3xl"
                        onClick={(event) => event.stopPropagation()}
                    >
                        <section className="rounded-3xl bg-black p-6 text-white shadow-sm">
                            <div className="flex items-start justify-between">
                                <div>
                                    <p className="text-xs text-gray-500">
                                        {formatDisplayDate(selectedHistory.startDate)}
                                        {" ~ "}
                                        {formatDisplayDate(selectedHistory.endDate)}
                                    </p>

                                    {selectedHistory.payDate && (
                                        <p className="mt-1 text-xs text-gray-500">
                                            지급일 {formatDisplayDate(selectedHistory.payDate)}
                                        </p>
                                    )}
                                </div>

                                <button type="button" onClick={() => setSelectedHistory(null)} className="text-xl text-gray-400">
                                    ×
                                </button>
                            </div>

                            <p className="mt-5 text-4xl font-bold">{formatMoney(selectedHistory.netPay)}</p>

                            <div className="mt-6 space-y-3 text-sm">
                                <div className="flex justify-between">
                                    <span className="text-gray-400">근무시간</span>

                                    <span>
                                        {selectedHistory.hours.toFixed(2)}
                                        시간
                                    </span>
                                </div>

                                <div className="flex justify-between">
                                    <span className="text-gray-400">급여</span>

                                    <span>{formatMoney(selectedHistory.pay)}</span>
                                </div>

                                <div className="flex justify-between">
                                    <span className="text-gray-400">팁</span>

                                    <span>{formatMoney(selectedHistory.tips)}</span>
                                </div>

                                {selectedHistory.deductions > 0 && (
                                    <div className="flex justify-between">
                                        <span className="text-gray-400">공제</span>

                                        <span>-{formatMoney(selectedHistory.deductions)}</span>
                                    </div>
                                )}

                                {selectedHistory.adjustments.length > 0 && (
                                    <div className="border-t border-gray-800 pt-4">
                                        <p className="mb-3 text-xs text-gray-500">추가 / 차감</p>

                                        <div className="space-y-2">
                                            {selectedHistory.adjustments.map((adjustment, index) => (
                                                <div key={`${adjustment.name}-${index}`} className="flex justify-between">
                                                    <span className="text-gray-400">{adjustment.name}</span>

                                                    <span className={adjustment.type === "add" ? "text-white" : "text-gray-400"}>
                                                        {adjustment.type === "add" ? "+" : "-"}
                                                        {formatMoney(adjustment.amount)}
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>

                            <div className="mt-6 rounded-2xl bg-white p-4 text-black">
                                <div className="flex items-center justify-between">
                                    <span className="text-sm font-medium">실제 수령액</span>

                                    <span className="text-xl font-bold">{formatMoney(selectedHistory.netPay)}</span>
                                </div>
                            </div>

                            <div className="mt-5 flex gap-3">
                                <button
                                    type="button"
                                    onClick={() => openEditForm(selectedHistory)}
                                    className="flex-1 rounded-2xl border border-white/10 py-3 text-sm font-medium transition hover:bg-white/10"
                                >
                                    수정
                                </button>

                                <button
                                    type="button"
                                    onClick={() => void deletePayHistory(selectedHistory)}
                                    className="flex-1 rounded-2xl border border-red-500/30 py-3 text-sm font-medium text-red-400 transition hover:bg-red-500/10"
                                >
                                    삭제
                                </button>
                            </div>
                        </section>
                    </div>
                </div>
            )}

            {/* 예상 급여 모달 */}
            {isExpectedSalaryOpen && salaryStatus?.type === "upcoming" && (
                <div
                    className="fixed inset-0 z-[70] flex items-end justify-center bg-black/40 p-4 sm:items-center"
                    onClick={() => setIsExpectedSalaryOpen(false)}
                >
                    <div className="w-full max-w-md overflow-hidden rounded-3xl" onClick={(event) => event.stopPropagation()}>
                        <section className="rounded-3xl bg-black p-6 text-white shadow-sm">
                            <div className="flex items-start justify-between">
                                <div>
                                    <p className="text-xs text-gray-500">{salaryStatus.daysUntil}일 뒤 지급 예정</p>

                                    <p className="mt-1 text-sm text-gray-400">
                                        {formatDisplayDate(salaryStatus.startDate)}
                                        {" ~ "}
                                        {formatDisplayDate(salaryStatus.endDate)}
                                    </p>
                                </div>

                                <button
                                    type="button"
                                    onClick={() => setIsExpectedSalaryOpen(false)}
                                    className="text-xl text-gray-400"
                                >
                                    ×
                                </button>
                            </div>

                            <p className="mt-1 text-4xl font-bold">{formatMoney(salaryStatus.expectedPay)}</p>

                            <p className="mt-2 text-xs text-gray-500">지급일 {formatDisplayDate(salaryStatus.payDate)}</p>

                            <div className="mt-6 space-y-3 text-sm">
                                <div className="flex justify-between">
                                    <span className="text-gray-400">예상 급여</span>

                                    <span>{formatMoney(salaryStatus.expectedBasePay)}</span>
                                </div>

                                <div className="flex justify-between">
                                    <span className="text-gray-400">예상 공제</span>

                                    <span>-{formatMoney(salaryStatus.expectedDeductions)}</span>
                                </div>

                                <div className="flex justify-between">
                                    <span className="text-gray-400">예상 실수령액</span>

                                    <span>{formatMoney(salaryStatus.expectedNetPay)}</span>
                                </div>
                            </div>

                            <div className="mt-6 rounded-2xl bg-white p-4 text-black">
                                <div className="flex items-center justify-between">
                                    <span className="text-sm font-medium">예상 수령액</span>

                                    <span className="text-xl font-bold">{formatMoney(salaryStatus.expectedPay)}</span>
                                </div>
                            </div>
                        </section>
                    </div>
                </div>
            )}

            {/* 입력 / 수정 모달 */}
            {isFormOpen && (
                <div
                    className="fixed inset-0 z-[60] flex items-end justify-center bg-gray-900/40 p-4 sm:items-center"
                    onClick={closeForm}
                >
                    <div
                        className="max-h-[92vh] w-full max-w-md scrollbar-hide overflow-y-auto rounded-3xl bg-white p-6 shadow-xl"
                        onClick={(event) => event.stopPropagation()}
                    >
                        <div className="flex items-start justify-between">
                            <div>
                                <h2 className="text-xl font-bold">{selectedHistory ? "급여 기록 수정" : "실제 급여 기록"}</h2>

                                <p className="mt-1 text-sm text-gray-400">실제로 받은 급여를 기록해주세요.</p>
                            </div>

                            <button type="button" onClick={closeForm} className="text-xl text-gray-400">
                                ×
                            </button>
                        </div>

                        <div className="mt-6 space-y-5">
                            {/* 급여 기간 */}
                            <div>
                                <label className="text-sm font-medium">급여 기간</label>

                                <div className="mt-2 grid grid-cols-2 gap-2">
                                    <input
                                        type="date"
                                        value={form.startDate}
                                        onChange={(event) => updateForm("startDate", event.target.value)}
                                        className="rounded-2xl border border-gray-200 px-3 py-3 text-sm outline-none "
                                    />

                                    <input
                                        type="date"
                                        value={form.endDate}
                                        onChange={(event) => updateForm("endDate", event.target.value)}
                                        className="rounded-2xl border border-gray-200 px-3 py-3 text-sm outline-none "
                                    />
                                </div>
                            </div>

                            {/* 지급일 */}
                            <div>
                                <label className="text-sm font-medium">지급일</label>

                                <input
                                    type="date"
                                    value={form.payDate}
                                    onChange={(event) => updateForm("payDate", event.target.value)}
                                    className="mt-2 w-full rounded-2xl border border-gray-200 px-4 py-3 outline-none "
                                />
                            </div>

                            {/* 근무시간 */}
                            <div>
                                <label className="text-sm font-medium">총 근무시간</label>

                                <div className="mt-2 flex items-center gap-2">
                                    <input
                                        type="number"
                                        min="0"
                                        step="0.1"
                                        value={form.hours}
                                        onChange={(event) => {
                                            const hours = normalizeNumberInput(event.target.value);

                                            setForm((current) => ({
                                                ...current,

                                                hours,

                                                ...(selectedHistory
                                                    ? {}
                                                    : {
                                                          pay:
                                                              hourlyWage !== null && hours !== ""
                                                                  ? (Number(hours) * hourlyWage).toFixed(2)
                                                                  : current.pay,
                                                      }),
                                            }));
                                        }}
                                        className="w-full rounded-2xl border border-gray-200 px-4 py-3 outline-none "
                                    />

                                    <span className="text-sm text-gray-400">시간</span>
                                </div>
                            </div>

                            {/* 급여 */}
                            <div>
                                <label className="text-sm font-medium">급여</label>

                                <div className="mt-2 flex items-center gap-2">
                                    <span className="text-gray-400">$</span>

                                    <input
                                        type="number"
                                        min="0"
                                        step="0.01"
                                        value={form.pay}
                                        onChange={(event) => updateForm("pay", normalizeNumberInput(event.target.value))}
                                        className="w-full rounded-2xl border border-gray-200 px-4 py-3 outline-none "
                                    />
                                </div>
                            </div>

                            {/* 팁 */}
                            <div>
                                <label className="text-sm font-medium">팁</label>

                                <div className="mt-2 flex items-center gap-2">
                                    <span className="text-gray-400">$</span>

                                    <input
                                        type="number"
                                        min="0"
                                        step="0.01"
                                        value={form.tips}
                                        onChange={(event) => updateForm("tips", normalizeNumberInput(event.target.value))}
                                        className="w-full rounded-2xl border border-gray-200 px-4 py-3 outline-none "
                                    />
                                </div>
                            </div>

                            {/* 공제 */}
                            <div>
                                <label className="text-sm font-medium">공제</label>

                                <div className="mt-2 flex items-center gap-2">
                                    <span className="text-gray-400">$</span>

                                    <input
                                        type="number"
                                        min="0"
                                        step="0.01"
                                        value={form.deductions}
                                        onChange={(event) => updateForm("deductions", normalizeNumberInput(event.target.value))}
                                        className="w-full rounded-2xl border border-gray-200 px-4 py-3 outline-none "
                                    />
                                </div>
                            </div>

                            {/* 추가 / 차감 */}
                            <div>
                                <div className="flex items-center justify-between">
                                    <div>
                                        <label className="text-sm font-medium">추가 / 차감</label>

                                        <p className="mt-1 text-xs text-gray-400">
                                            Holiday Pay 등의 금액을 추가하거나 차감할 수 있어요.
                                        </p>
                                    </div>
                                </div>

                                {form.adjustments.length > 0 && (
                                    <div className="mt-3 space-y-3">
                                        {form.adjustments.map((adjustment, index) => (
                                            <div key={index} className="rounded-2xl bg-gray-50 p-3">
                                                <div className="flex gap-2">
                                                    <select
                                                        value={adjustment.type}
                                                        onChange={(event) =>
                                                            updateAdjustment(index, "type", event.target.value as AdjustmentType)
                                                        }
                                                        className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm outline-none"
                                                    >
                                                        <option value="add">+ 추가</option>

                                                        <option value="subtract">− 차감</option>
                                                    </select>

                                                    <input
                                                        type="text"
                                                        value={adjustment.name}
                                                        onChange={(event) => updateAdjustment(index, "name", event.target.value)}
                                                        placeholder="예: Holiday Pay"
                                                        className="min-w-0 flex-1 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm outline-none "
                                                    />

                                                    <button
                                                        type="button"
                                                        onClick={() => removeAdjustment(index)}
                                                        className="px-2 text-gray-400"
                                                    >
                                                        ×
                                                    </button>
                                                </div>

                                                <div className="mt-2 flex items-center gap-2">
                                                    <span className="text-gray-400">$</span>

                                                    <input
                                                        type="number"
                                                        min="0"
                                                        step="0.01"
                                                        value={adjustment.amount === 0 ? "" : adjustment.amount}
                                                        onChange={(event) =>
                                                            updateAdjustment(index, "amount", event.target.value)
                                                        }
                                                        placeholder="0.00"
                                                        className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm outline-none "
                                                    />
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}

                                <div className="mt-3 grid grid-cols-2 gap-2">
                                    <button
                                        type="button"
                                        onClick={() => addAdjustment("add")}
                                        className="rounded-2xl border border-gray-200 py-3 text-sm font-medium"
                                    >
                                        + 금액 추가
                                    </button>

                                    <button
                                        type="button"
                                        onClick={() => addAdjustment("subtract")}
                                        className="rounded-2xl border border-gray-200 py-3 text-sm font-medium"
                                    >
                                        − 금액 차감
                                    </button>
                                </div>
                            </div>

                            {/* 계산된 실수령액 */}
                            <div className="rounded-3xl bg-gray-50 p-5">
                                <p className="text-xs text-gray-400">계산된 실수령액</p>

                                <p className="mt-1 text-2xl font-bold">{formatMoney(calculatedNetPay)}</p>

                                <button
                                    type="button"
                                    onClick={useCalculatedNetPay}
                                    className="mt-4 w-full rounded-2xl bg-white px-4 py-3 text-sm font-medium shadow-sm"
                                >
                                    이 금액이 맞나요?
                                </button>
                            </div>

                            {/* 실제 실수령액 */}
                            <div>
                                <label className="text-sm font-medium">실제 실수령액</label>

                                <div className="mt-2 flex items-center gap-2">
                                    <span className="text-gray-400">$</span>

                                    <input
                                        type="number"
                                        min="0"
                                        step="0.01"
                                        value={form.netPay}
                                        onChange={(event) => updateForm("netPay", normalizeNumberInput(event.target.value))}
                                        placeholder={calculatedNetPay.toFixed(2)}
                                        className="w-full rounded-2xl border border-gray-200 px-4 py-3 text-lg font-semibold outline-none "
                                    />
                                </div>

                                <p className="mt-2 text-xs text-gray-400">실제 급여명세서나 통장에 입금된 금액을 입력해주세요.</p>
                            </div>
                        </div>

                        <div className="mt-6 flex gap-3">
                            <button
                                type="button"
                                onClick={closeForm}
                                disabled={isSaving}
                                className="flex-1 rounded-2xl bg-gray-100 py-3 text-sm font-medium disabled:opacity-50"
                            >
                                취소
                            </button>

                            <button
                                type="button"
                                onClick={() => void savePayHistory()}
                                disabled={isSaving}
                                className="flex-1 rounded-2xl bg-gray-900 py-3 text-sm font-medium text-white disabled:opacity-50"
                            >
                                {isSaving ? "저장 중..." : "저장하기"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
