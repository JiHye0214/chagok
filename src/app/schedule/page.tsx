"use client";

import { useEffect, useState } from "react";

type WorkSchedule = {
    id: number;
    date: string;
    startTime: string;
    endTime: string;
    breakMinutes: number;
};

type SalarySettings = {
    province?: string;
    payType?: string;
    payFrequency?: string;
    hasTips?: boolean;
    tipType?: string;
    hourlyWage?: number;
    monthlySalary?: number;
    nextPayDate?: string;
};

const weekDays = [
    "일",
    "월",
    "화",
    "수",
    "목",
    "금",
    "토",
];

export default function SchedulePage() {
    // -----------------------------
    // Schedule
    // -----------------------------

    const [schedules, setSchedules] = useState<WorkSchedule[]>(
    () => {
        if (typeof window === "undefined") {
            return [];
        }

        const saved =
            localStorage.getItem(
                "chagok-schedules",
            );

        if (!saved) {
            return [];
        }

        try {
            const parsed = JSON.parse(saved);

            return Array.isArray(parsed)
                ? parsed
                : [];
        } catch {
            return [];
        }
    },
);

    // -----------------------------
    // Salary Settings
    // -----------------------------

    const [salarySettings] =
        useState<SalarySettings | null>(() => {
            if (typeof window === "undefined") {
                return null;
            }

            const savedSalary =
                localStorage.getItem(
                    "chagok-salary-settings",
                );

            if (!savedSalary) {
                return null;
            }

            try {
                return JSON.parse(savedSalary);
            } catch {
                return null;
            }
        });

    const hourlyWage =
        salarySettings?.payType === "hourly" &&
        salarySettings.hourlyWage !== undefined
            ? Number(salarySettings.hourlyWage)
            : null;

    const nextPayDate =
        salarySettings?.nextPayDate || null;

    // -----------------------------
    // Calendar
    // -----------------------------

    const [currentDate, setCurrentDate] =
        useState(() => {
            return new Date(
                new Date().getFullYear(),
                new Date().getMonth(),
                1,
            );
        });

    const [selectedDate, setSelectedDate] =
        useState("");

    // -----------------------------
    // Work Form
    // -----------------------------

    const [startTime, setStartTime] =
        useState("09:00");

    const [endTime, setEndTime] =
        useState("17:00");

    const [breakMinutes, setBreakMinutes] =
        useState("30");

    // -----------------------------
    // Save schedules
    // -----------------------------

    useEffect(() => {
        localStorage.setItem(
            "chagok-schedules",
            JSON.stringify(schedules),
        );
    }, [schedules]);

    // -----------------------------
    // Calendar Data
    // -----------------------------

    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();

    const firstDay = new Date(
        year,
        month,
        1,
    ).getDay();

    const daysInMonth = new Date(
        year,
        month + 1,
        0,
    ).getDate();

    const calendarDays: (
        | number
        | null
    )[] = [];

    for (
        let i = 0;
        i < firstDay;
        i++
    ) {
        calendarDays.push(null);
    }

    for (
        let day = 1;
        day <= daysInMonth;
        day++
    ) {
        calendarDays.push(day);
    }

    // -----------------------------
    // Date Format
    // -----------------------------

    const formatDate = (
        day: number,
    ) => {
        const monthString = String(
            month + 1,
        ).padStart(2, "0");

        const dayString = String(
            day,
        ).padStart(2, "0");

        return `${year}-${monthString}-${dayString}`;
    };

    // -----------------------------
    // Month Navigation
    // -----------------------------

    const goToPreviousMonth = () => {
        setCurrentDate(
            new Date(
                year,
                month - 1,
                1,
            ),
        );

        setSelectedDate("");
    };

    const goToNextMonth = () => {
        setCurrentDate(
            new Date(
                year,
                month + 1,
                1,
            ),
        );

        setSelectedDate("");
    };

    // -----------------------------
    // Calculate Work Hours
    // -----------------------------

    const calculateWorkHours = (
        startTime: string,
        endTime: string,
        breakMinutes: number,
    ) => {
        const [
            startHour,
            startMinute,
        ] = startTime
            .split(":")
            .map(Number);

        const [
            endHour,
            endMinute,
        ] = endTime
            .split(":")
            .map(Number);

        const startTotalMinutes =
            startHour * 60 +
            startMinute;

        const endTotalMinutes =
            endHour * 60 +
            endMinute;

        let totalMinutes =
            endTotalMinutes -
            startTotalMinutes;

        // 밤을 넘기는 근무
        if (totalMinutes < 0) {
            totalMinutes +=
                24 * 60;
        }

        totalMinutes -=
            breakMinutes;

        return Math.max(
            totalMinutes / 60,
            0,
        );
    };

    // -----------------------------
    // Calculate Expected Pay
    // -----------------------------

    const calculateExpectedPay = (
        startTime: string,
        endTime: string,
        breakMinutes: number,
    ) => {
        if (hourlyWage === null) {
            return null;
        }

        const hours =
            calculateWorkHours(
                startTime,
                endTime,
                breakMinutes,
            );

        return hours * hourlyWage;
    };

    // -----------------------------
    // Add Schedule
    // -----------------------------

    const handleAddSchedule = () => {
        if (!selectedDate) {
            alert(
                "날짜를 선택해주세요.",
            );

            return;
        }

        if (!startTime || !endTime) {
            alert(
                "근무 시작 시간과 종료 시간을 입력해주세요.",
            );

            return;
        }

        const breakValue =
            Number(breakMinutes);

        if (
            Number.isNaN(breakValue) ||
            breakValue < 0
        ) {
            alert(
                "휴게시간을 올바르게 입력해주세요.",
            );

            return;
        }

        const newSchedule: WorkSchedule =
            {
                id: Date.now(),
                date: selectedDate,
                startTime,
                endTime,
                breakMinutes:
                    breakValue,
            };

        setSchedules(
            (prev) => [
                ...prev,
                newSchedule,
            ],
        );
    };

    // -----------------------------
    // Delete Schedule
    // -----------------------------

    const handleDeleteSchedule = (
        id: number,
    ) => {
        setSchedules(
            (prev) =>
                prev.filter(
                    (schedule) =>
                        schedule.id !==
                        id,
                ),
        );
    };

    // -----------------------------
    // Selected Date Schedules
    // -----------------------------

    const selectedSchedules =
        schedules.filter(
            (schedule) =>
                schedule.date ===
                selectedDate,
        );

    // -----------------------------
    // Current Pay Period
    // -----------------------------

    const getPayPeriodStart =
        () => {
            if (!nextPayDate) {
                return null;
            }

            const payDate =
                new Date(
                    `${nextPayDate}T00:00:00`,
                );

            if (
                Number.isNaN(
                    payDate.getTime(),
                )
            ) {
                return null;
            }

            const startDate =
                new Date(payDate);

            startDate.setDate(
                startDate.getDate() -
                    14,
            );

            startDate.setHours(
                0,
                0,
                0,
                0,
            );

            return startDate;
        };

    const payPeriodStart =
        getPayPeriodStart();

    // -----------------------------
    // Schedules in Pay Period
    // -----------------------------

    const payPeriodSchedules =
        schedules.filter(
            (schedule) => {
                if (
                    !payPeriodStart ||
                    !nextPayDate
                ) {
                    return false;
                }

                const scheduleDate =
                    new Date(
                        `${schedule.date}T00:00:00`,
                    );

                const payDate =
                    new Date(
                        `${nextPayDate}T00:00:00`,
                    );

                return (
                    scheduleDate >=
                        payPeriodStart &&
                    scheduleDate <
                        payDate
                );
            },
        );

    // -----------------------------
    // Total Pay Period Hours
    // -----------------------------

    const totalPayPeriodHours =
        payPeriodSchedules.reduce(
            (
                total,
                schedule,
            ) => {
                return (
                    total +
                    calculateWorkHours(
                        schedule.startTime,
                        schedule.endTime,
                        schedule.breakMinutes,
                    )
                );
            },
            0,
        );

    // -----------------------------
    // Total Expected Pay
    // -----------------------------

    const totalPayPeriodPay =
        hourlyWage !== null
            ? totalPayPeriodHours *
              hourlyWage
            : null;

    return (
        <main className="min-h-screen bg-gray-50 px-5 py-8">
            <div className="mx-auto max-w-md pb-20">

                {/* Header */}

                <header>
                    <p className="text-sm text-gray-500">
                        차곡
                    </p>

                    <h1 className="mt-2 text-3xl font-bold">
                        스케줄
                    </h1>

                    <p className="mt-2 text-sm text-gray-500">
                        언제 일하는지 한눈에 관리해보세요.
                    </p>
                </header>

                {/* Pay Period Summary */}

                <section className="mt-6 rounded-3xl bg-black p-6 text-white">
                    <p className="text-sm text-gray-400">
                        이번 Pay Period
                    </p>

                    <p className="mt-2 text-3xl font-bold">
                        {totalPayPeriodPay !==
                        null
                            ? `$${totalPayPeriodPay.toFixed(
                                  2,
                              )}`
                            : "시급을 설정해주세요"}
                    </p>

                    <div className="mt-5 flex justify-between border-t border-white/10 pt-4">
                        <div>
                            <p className="text-xs text-gray-400">
                                근무시간
                            </p>

                            <p className="mt-1 font-medium">
                                {totalPayPeriodHours.toFixed(
                                    1,
                                )}
                                시간
                            </p>
                        </div>

                        <div className="text-right">
                            <p className="text-xs text-gray-400">
                                근무일
                            </p>

                            <p className="mt-1 font-medium">
                                {
                                    payPeriodSchedules.length
                                }
                                일
                            </p>
                        </div>
                    </div>

                    {nextPayDate && (
                        <p className="mt-4 text-xs text-gray-400">
                            다음 급여일{" "}
                            {nextPayDate}
                        </p>
                    )}
                </section>

                {/* Calendar */}

                <section className="mt-5 rounded-3xl bg-white p-6 shadow-sm">

                    <div className="flex items-center justify-between">
                        <button
                            onClick={
                                goToPreviousMonth
                            }
                            className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-100 text-lg"
                        >
                            ‹
                        </button>

                        <h2 className="text-lg font-semibold">
                            {year}년{" "}
                            {month + 1}월
                        </h2>

                        <button
                            onClick={
                                goToNextMonth
                            }
                            className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-100 text-lg"
                        >
                            ›
                        </button>
                    </div>

                    {/* Week Days */}

                    <div className="mt-6 grid grid-cols-7 text-center">
                        {weekDays.map(
                            (day) => (
                                <div
                                    key={day}
                                    className="pb-3 text-xs font-medium text-gray-400"
                                >
                                    {day}
                                </div>
                            ),
                        )}

                        {/* Calendar Days */}

                        {calendarDays.map(
                            (
                                day,
                                index,
                            ) => {
                                if (
                                    day ===
                                    null
                                ) {
                                    return (
                                        <div
                                            key={`empty-${index}`}
                                        />
                                    );
                                }

                                const date =
                                    formatDate(
                                        day,
                                    );

                                const hasSchedule =
                                    schedules.some(
                                        (
                                            schedule,
                                        ) =>
                                            schedule.date ===
                                            date,
                                    );

                                const isSelected =
                                    selectedDate ===
                                    date;

                                return (
                                    <button
                                        key={
                                            date
                                        }
                                        onClick={() =>
                                            setSelectedDate(
                                                date,
                                            )
                                        }
                                        className="relative flex h-11 items-center justify-center"
                                    >
                                        <span
                                            className={`flex h-9 w-9 items-center justify-center rounded-full text-sm ${
                                                isSelected
                                                    ? "bg-black text-white"
                                                    : "text-gray-700"
                                            }`}
                                        >
                                            {
                                                day
                                            }
                                        </span>

                                        {hasSchedule && (
                                            <span className="absolute bottom-0 h-1 w-1 rounded-full bg-black" />
                                        )}
                                    </button>
                                );
                            },
                        )}
                    </div>
                </section>

                {/* Selected Date */}

                {selectedDate && (
                    <section className="mt-5 rounded-3xl bg-white p-6 shadow-sm">

                        <h2 className="text-lg font-semibold">
                            {
                                selectedDate
                            }
                        </h2>

                        {/* Existing Schedules */}

                        {selectedSchedules.length >
                            0 && (
                            <div className="mt-4 space-y-3">
                                {selectedSchedules.map(
                                    (
                                        schedule,
                                    ) => {
                                        const hours =
                                            calculateWorkHours(
                                                schedule.startTime,
                                                schedule.endTime,
                                                schedule.breakMinutes,
                                            );

                                        const expectedPay =
                                            calculateExpectedPay(
                                                schedule.startTime,
                                                schedule.endTime,
                                                schedule.breakMinutes,
                                            );

                                        return (
                                            <div
                                                key={
                                                    schedule.id
                                                }
                                                className="flex items-center justify-between rounded-2xl bg-gray-50 p-4"
                                            >
                                                <div>
                                                    <p className="font-medium">
                                                        {
                                                            schedule.startTime
                                                        }{" "}
                                                        ~{" "}
                                                        {
                                                            schedule.endTime
                                                        }
                                                    </p>

                                                    <p className="mt-1 text-xs text-gray-400">
                                                        휴게{" "}
                                                        {
                                                            schedule.breakMinutes
                                                        }
                                                        분
                                                    </p>

                                                    <p className="mt-2 text-sm font-medium">
                                                        {hours.toFixed(
                                                            1,
                                                        )}
                                                        시간
                                                    </p>

                                                    {expectedPay !==
                                                        null && (
                                                        <p className="mt-1 text-sm text-gray-500">
                                                            예상 급여 $
                                                            {expectedPay.toFixed(
                                                                2,
                                                            )}
                                                        </p>
                                                    )}
                                                </div>

                                                <button
                                                    onClick={() =>
                                                        handleDeleteSchedule(
                                                            schedule.id,
                                                        )
                                                    }
                                                    className="text-sm text-red-500"
                                                >
                                                    삭제
                                                </button>
                                            </div>
                                        );
                                    },
                                )}
                            </div>
                        )}

                        {/* Add Schedule */}

                        <div className="mt-5 border-t border-gray-100 pt-5">

                            <p className="text-sm font-medium">
                                근무 추가
                            </p>

                            <div className="mt-4 grid grid-cols-2 gap-3">

                                <div>
                                    <p className="mb-2 text-sm text-gray-500">
                                        시작
                                    </p>

                                    <input
                                        type="time"
                                        value={
                                            startTime
                                        }
                                        onChange={(
                                            e,
                                        ) =>
                                            setStartTime(
                                                e
                                                    .target
                                                    .value,
                                            )
                                        }
                                        className="w-full rounded-2xl bg-gray-100 px-4 py-4 outline-none"
                                    />
                                </div>

                                <div>
                                    <p className="mb-2 text-sm text-gray-500">
                                        종료
                                    </p>

                                    <input
                                        type="time"
                                        value={
                                            endTime
                                        }
                                        onChange={(
                                            e,
                                        ) =>
                                            setEndTime(
                                                e
                                                    .target
                                                    .value,
                                            )
                                        }
                                        className="w-full rounded-2xl bg-gray-100 px-4 py-4 outline-none"
                                    />
                                </div>

                            </div>

                            <div className="mt-4">

                                <p className="mb-2 text-sm text-gray-500">
                                    휴게시간
                                </p>

                                <input
                                    type="number"
                                    min="0"
                                    value={
                                        breakMinutes
                                    }
                                    onChange={(
                                        e,
                                    ) =>
                                        setBreakMinutes(
                                            e
                                                .target
                                                .value,
                                        )
                                    }
                                    className="w-full rounded-2xl bg-gray-100 px-4 py-4 outline-none"
                                />

                                <p className="mt-2 text-xs text-gray-400">
                                    분 단위로 입력해주세요.
                                </p>

                            </div>

                            <button
                                onClick={
                                    handleAddSchedule
                                }
                                className="mt-5 w-full rounded-2xl bg-black py-4 text-sm font-semibold text-white"
                            >
                                근무 등록
                            </button>

                        </div>
                    </section>
                )}

            </div>
        </main>
    );
}
