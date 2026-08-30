"use client";

import { useState, useSyncExternalStore } from "react";

const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

function urlBase64ToUint8Array(base64String: string) {
    const padding = "=".repeat((4 - (base64String.length % 4)) % 4);

    const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");

    const rawData = window.atob(base64);

    return Uint8Array.from([...rawData].map((char) => char.charCodeAt(0)));
}

type WorkSchedule = {
    id: number;
    date: string;
    startTime: string;
    endTime: string;
    breakMinutes: number;
    alarmEnabled: boolean;
    alarmMinutesBefore: number;
};

const emptySchedules = "[]";

const getSchedulesSnapshot = () => {
    if (typeof window === "undefined") {
        return emptySchedules;
    }

    return localStorage.getItem("chagok-schedules") ?? emptySchedules;
};

const getServerSchedulesSnapshot = () => {
    return emptySchedules;
};

const subscribeToSchedules = (callback: () => void) => {
    window.addEventListener("storage", callback);

    return () => {
        window.removeEventListener("storage", callback);
    };
};

const weekDays = ["일", "월", "화", "수", "목", "금", "토"];

const formatDate = (year: number, month: number, day: number) => {
    return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
};

const calculateWorkHours = (startTime: string, endTime: string, breakMinutes: number) => {
    const [startHour, startMinute] = startTime.split(":").map(Number);

    const [endHour, endMinute] = endTime.split(":").map(Number);

    const startTotal = startHour * 60 + startMinute;

    let endTotal = endHour * 60 + endMinute;

    // 야간 근무처럼 종료 시간이 다음 날인 경우
    if (endTotal < startTotal) {
        endTotal += 24 * 60;
    }

    const totalMinutes = endTotal - startTotal - breakMinutes;

    return Math.max(totalMinutes, 0) / 60;
};

const getAlarmDateTime = (schedule: WorkSchedule) => {
    if (!schedule.alarmEnabled) {
        return null;
    }

    const workDateTime = new Date(`${schedule.date}T${schedule.startTime}:00`);

    workDateTime.setMinutes(workDateTime.getMinutes() - schedule.alarmMinutesBefore);

    return workDateTime;
};

const getPushSubscription = async () => {
    const registration = await navigator.serviceWorker.ready;

    return registration.pushManager.getSubscription();
};

const schedulePushNotification = async (schedule: WorkSchedule) => {
    if (!schedule.alarmEnabled) {
        return;
    }

    const alarmDateTime = getAlarmDateTime(schedule);

    if (!alarmDateTime) {
        return;
    }

    const subscription = await getPushSubscription();

    if (!subscription) {
        console.log("Push subscription이 없습니다.");
        return;
    }

    const response = await fetch("/api/push/schedule", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            id: schedule.id,
            sendAt: alarmDateTime.toISOString(),
            title: "차곡",
            body: `${schedule.startTime}에 근무가 있어요.`,
            subscription,
        }),
    });

    const result = await response.json();

    console.log("알림 예약 결과:", result);

    console.log("근무 시간:", schedule.date, schedule.startTime);

    console.log("알림 시간:", alarmDateTime.toString());

    console.log("UTC:", alarmDateTime.toISOString());
};

const getUpcomingAlarm = (schedules: WorkSchedule[]) => {
    const now = new Date();

    return (
        schedules
            .filter((schedule) => {
                if (!schedule.alarmEnabled) {
                    return false;
                }

                const alarmDateTime = getAlarmDateTime(schedule);

                if (!alarmDateTime) {
                    return false;
                }

                return alarmDateTime > now;
            })
            .sort((a, b) => {
                const aTime = getAlarmDateTime(a)?.getTime() ?? 0;

                const bTime = getAlarmDateTime(b)?.getTime() ?? 0;

                return aTime - bTime;
            })[0] ?? null
    );
};

const scheduleNotification = (schedule: WorkSchedule) => {
    if (!schedule.alarmEnabled) {
        return;
    }

    const alarmDateTime = getAlarmDateTime(schedule);

    if (!alarmDateTime) {
        return;
    }

    const delay = alarmDateTime.getTime() - Date.now();

    if (delay <= 0) {
        return;
    }

    setTimeout(() => {
        if (Notification.permission !== "granted") {
            return;
        }

        new Notification("차곡", {
            body: `${schedule.startTime}에 근무가 있어요.`,
        });
    }, delay);
};

const requestNotificationPermission = async () => {
    if (!("Notification" in window)) {
        alert("이 브라우저에서는 알림을 지원하지 않아요.");
        return false;
    }

    if (Notification.permission === "granted") {
        return true;
    }

    const permission = await Notification.requestPermission();

    if (permission !== "granted") {
        alert("알림 권한이 허용되지 않았어요.");
        return false;
    }

    return true;
};

const sendTestNotification = async () => {
    const allowed = await requestNotificationPermission();

    if (!allowed) {
        return;
    }

    new Notification("차곡", {
        body: "알림이 정상적으로 작동하고 있어요!",
    });
};

export default function SchedulePage() {
    const schedules = (
        JSON.parse(
            useSyncExternalStore(subscribeToSchedules, getSchedulesSnapshot, getServerSchedulesSnapshot),
        ) as Partial<WorkSchedule>[]
    ).map((schedule) => ({
        ...schedule,
        alarmEnabled: schedule.alarmEnabled ?? false,
        alarmMinutesBefore: schedule.alarmMinutesBefore ?? 60,
    })) as WorkSchedule[];

    const [currentDate, setCurrentDate] = useState(new Date(2026, 7, 1));

    const [isAddModalOpen, setIsAddModalOpen] = useState(false);

    const [editingSchedule, setEditingSchedule] = useState<WorkSchedule | null>(null);

    const [selectedDate, setSelectedDate] = useState<string | null>(null);

    const [startTime, setStartTime] = useState("09:00");

    const [endTime, setEndTime] = useState("17:00");

    const [breakMinutes, setBreakMinutes] = useState("30");

    const [alarmEnabled, setAlarmEnabled] = useState(false);

    const [alarmMinutesBefore, setAlarmMinutesBefore] = useState(60);

    const [notificationPermission, setNotificationPermission] = useState<NotificationPermission>("default");

    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();

    const firstDay = new Date(year, month, 1).getDay();

    const daysInMonth = new Date(year, month + 1, 0).getDate();

    const calendarDays = [];

    for (let i = 0; i < firstDay; i++) {
        calendarDays.push(null);
    }

    for (let day = 1; day <= daysInMonth; day++) {
        calendarDays.push(day);
    }

    const currentMonthSchedules = schedules.filter((schedule) => {
        const scheduleDate = new Date(schedule.date);

        return scheduleDate.getFullYear() === year && scheduleDate.getMonth() === month;
    });

    const currentMonthTotalHours = currentMonthSchedules.reduce(
        (total, schedule) => total + calculateWorkHours(schedule.startTime, schedule.endTime, schedule.breakMinutes),
        0,
    );

    const upcomingAlarm = getUpcomingAlarm(schedules);

    const handlePreviousMonth = () => {
        setCurrentDate(new Date(year, month - 1, 1));
    };

    const handleNextMonth = () => {
        setCurrentDate(new Date(year, month + 1, 1));
    };

    const requestNotificationPermission = async () => {
        if (!("Notification" in window)) {
            alert("이 브라우저에서는 알림을 지원하지 않아요.");
            return false;
        }

        if (Notification.permission === "granted") {
            setNotificationPermission("granted");
            return true;
        }

        const permission = await Notification.requestPermission();

        setNotificationPermission(permission);

        if (permission !== "granted") {
            alert("근무 알림을 사용하려면 브라우저 알림 권한을 허용해주세요.");

            return false;
        }

        return true;
    };

    const subscribeToPush = async () => {
        try {
            if (!vapidPublicKey) {
                alert("VAPID 공개 키가 설정되지 않았어요.");
                return;
            }

            const registration = await navigator.serviceWorker.ready;

            const subscription = await registration.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
            });

            console.log("Push Subscription:", subscription);

            const response = await fetch("/api/push", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    subscription,
                }),
            });

            const result = await response.json();

            console.log("Push result:", result);
        } catch (error) {
            console.error("Push Subscription 실패:", error);
        }
    };

    const handleAddSchedule = async () => {
        if (!selectedDate) {
            return;
        }

        const breakValue = Number(breakMinutes);

        const newSchedule: WorkSchedule = {
            id: Date.now(),
            date: selectedDate,
            startTime,
            endTime,
            breakMinutes: breakValue,
            alarmEnabled,
            alarmMinutesBefore,
        };

        const updatedSchedules = [...schedules, newSchedule];

        localStorage.setItem("chagok-schedules", JSON.stringify(updatedSchedules));

        window.dispatchEvent(new StorageEvent("storage"));

        await schedulePushNotification(newSchedule);

        setIsAddModalOpen(false);
        setSelectedDate(null);
    };

    const handleDeleteSchedule = async (id: number) => {
        const updatedSchedules = schedules.filter((schedule) => schedule.id !== id);

        localStorage.setItem("chagok-schedules", JSON.stringify(updatedSchedules));

        window.dispatchEvent(new StorageEvent("storage"));

        try {
            await fetch("/api/push/schedule/delete", {
                method: "DELETE",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    id,
                }),
            });
        } catch (error) {
            console.error("알림 예약 삭제 실패:", error);
        }

        setEditingSchedule(null);
    };

    const handleUpdateSchedule = async (updatedSchedule: WorkSchedule) => {
        const updatedSchedules = schedules.map((schedule) => (schedule.id === updatedSchedule.id ? updatedSchedule : schedule));

        localStorage.setItem("chagok-schedules", JSON.stringify(updatedSchedules));

        window.dispatchEvent(new StorageEvent("storage"));

        if (updatedSchedule.alarmEnabled) {
            const alarmDateTime = getAlarmDateTime(updatedSchedule);

            const subscription = await getPushSubscription();

            if (alarmDateTime && subscription) {
                try {
                    await fetch("/api/push/schedule/update", {
                        method: "PUT",
                        headers: {
                            "Content-Type": "application/json",
                        },
                        body: JSON.stringify({
                            id: updatedSchedule.id,
                            sendAt: alarmDateTime.toISOString(),
                            title: "차곡",
                            body: `${updatedSchedule.startTime}에 근무가 있어요.`,
                            subscription,
                        }),
                    });
                } catch (error) {
                    console.error("알림 예약 수정 실패:", error);
                }
            }
        } else {
            try {
                const response = await fetch("/api/push/schedule/delete", {
                    method: "DELETE",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                        id: updatedSchedule.id,
                    }),
                });

                const result = await response.json();

                console.log("알림 예약 삭제 결과:", result);
            } catch (error) {
                console.error("알림 예약 삭제 실패:", error);
            }
        }

        setEditingSchedule(null);
    };

    const openAddModal = (date: string) => {
        setSelectedDate(date);

        setStartTime("09:00");
        setEndTime("17:00");
        setBreakMinutes("30");

        setAlarmEnabled(false);
        setAlarmMinutesBefore(60);

        setIsAddModalOpen(true);
    };

    return (
        <main className="min-h-screen bg-gray-50 px-5 pb-28">
            <div className="mx-auto max-w-md pt-8">
                {/* Header */}

                <header className="mb-6 flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-bold">스케줄</h1>

                        <p className="mt-1 text-sm text-gray-400">내 근무 일정을 관리해요</p>
                    </div>
                </header>

                {/* Monthly Summary */}

                <section className="mb-5 rounded-3xl bg-white p-6 shadow-sm">
                    <p className="text-sm text-gray-500">이번 달 근무</p>

                    <p className="mt-2 text-3xl font-bold">
                        {currentMonthTotalHours.toFixed(1)}
                        시간
                    </p>

                    <p className="mt-1 text-xs text-gray-500">{currentMonthSchedules.length}일 근무 예정</p>
                </section>

                <button
                    onClick={sendTestNotification}
                    className="mt-4 w-full rounded-2xl bg-black py-4 text-sm font-semibold text-white"
                >
                    알림 테스트
                </button>

                {upcomingAlarm && (
                    <div className="mt-4 rounded-2xl bg-gray-50 p-4">
                        <p className="text-xs text-gray-400">다음 근무 알림</p>

                        <p className="mt-1 font-medium">
                            {upcomingAlarm.date} {upcomingAlarm.startTime}
                        </p>

                        <p className="mt-1 text-sm text-gray-500">
                            🔔{" "}
                            {upcomingAlarm.alarmMinutesBefore >= 1440
                                ? "하루 전"
                                : upcomingAlarm.alarmMinutesBefore >= 60
                                  ? `${upcomingAlarm.alarmMinutesBefore / 60}시간 전`
                                  : `${upcomingAlarm.alarmMinutesBefore}분 전`}
                        </p>
                    </div>
                )}

                {/* Calendar */}

                <section className="rounded-3xl bg-white p-5 shadow-sm">
                    {/* Month Navigation */}

                    <div className="mb-5 flex items-center justify-between">
                        <button
                            onClick={handlePreviousMonth}
                            className="flex h-9 w-9 items-center justify-center rounded-full bg-gray-100"
                        >
                            ‹
                        </button>

                        <h2 className="text-lg font-semibold">
                            {year}년 {month + 1}월
                        </h2>

                        <button
                            onClick={handleNextMonth}
                            className="flex h-9 w-9 items-center justify-center rounded-full bg-gray-100"
                        >
                            ›
                        </button>
                    </div>

                    {/* Week */}

                    <div className="mb-2 grid grid-cols-7 text-center text-xs text-gray-400">
                        {weekDays.map((day) => (
                            <div key={day}>{day}</div>
                        ))}
                    </div>

                    {/* Calendar */}

                    <div className="grid grid-cols-7 gap-y-2">
                        {calendarDays.map((day, index) => {
                            if (day === null) {
                                return <div key={index} />;
                            }

                            const date = formatDate(year, month, day);

                            const daySchedules = schedules.filter((schedule) => schedule.date === date);

                            const hasSchedule = daySchedules.length > 0;

                            return (
                                <button
                                    key={date}
                                    onClick={() => openAddModal(date)}
                                    className="relative flex h-12 flex-col items-center justify-center rounded-xl"
                                >
                                    <span
                                        className={
                                            hasSchedule
                                                ? "flex h-8 w-8 items-center justify-center rounded-full bg-black text-sm font-medium text-white"
                                                : "text-sm"
                                        }
                                    >
                                        {day}
                                    </span>

                                    {hasSchedule && <span className="absolute bottom-0 h-1 w-1 rounded-full bg-black" />}
                                </button>
                            );
                        })}
                    </div>
                </section>

                {/* Schedule List */}

                <section className="mt-5 rounded-3xl bg-white p-6 shadow-sm">
                    <div className="mb-5 flex items-center justify-between">
                        <div>
                            <h2 className="text-lg font-semibold">이번 달 근무</h2>

                            <p className="mt-1 text-xs text-gray-400">근무를 눌러 수정할 수 있어요</p>
                        </div>
                    </div>

                    {currentMonthSchedules.length === 0 ? (
                        <p className="py-8 text-center text-sm text-gray-400">아직 등록된 근무가 없어요.</p>
                    ) : (
                        <div className="space-y-3">
                            {currentMonthSchedules
                                .sort((a, b) => a.date.localeCompare(b.date))
                                .map((schedule) => {
                                    const hours = calculateWorkHours(schedule.startTime, schedule.endTime, schedule.breakMinutes);

                                    return (
                                        <div
                                            key={schedule.id}
                                            onClick={() => setEditingSchedule(schedule)}
                                            className="flex cursor-pointer items-center justify-between rounded-2xl bg-gray-50 p-4"
                                        >
                                            <div>
                                                <p className="font-medium">
                                                    {new Date(schedule.date).getMonth() + 1}월 {new Date(schedule.date).getDate()}
                                                    일
                                                </p>

                                                <p className="mt-1 text-sm text-gray-500">
                                                    {schedule.startTime} ~ {schedule.endTime}
                                                </p>

                                                {schedule.alarmEnabled && (
                                                    <p className="mt-1 text-xs text-gray-400">
                                                        🔔{" "}
                                                        {schedule.alarmMinutesBefore >= 1440
                                                            ? "하루 전"
                                                            : schedule.alarmMinutesBefore >= 60
                                                              ? `${schedule.alarmMinutesBefore / 60}시간 전`
                                                              : `${schedule.alarmMinutesBefore}분 전`}{" "}
                                                        알림
                                                    </p>
                                                )}
                                            </div>

                                            <div className="text-right">
                                                <p className="font-semibold">
                                                    {hours.toFixed(1)}
                                                    시간
                                                </p>

                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();

                                                        handleDeleteSchedule(schedule.id);
                                                    }}
                                                    className="mt-1 text-xs text-gray-400"
                                                >
                                                    삭제
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })}
                        </div>
                    )}
                </section>
            </div>

            {/* Add Schedule Modal */}

            {isAddModalOpen && (
                <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-5">
                    <div className="w-full max-w-md rounded-3xl bg-white p-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <h2 className="text-xl font-bold">근무 추가</h2>

                                <p className="mt-1 text-sm text-gray-400">{selectedDate}</p>
                            </div>

                            <button onClick={() => setIsAddModalOpen(false)} className="text-gray-400">
                                ✕
                            </button>
                        </div>

                        {/* Time */}

                        <div className="mt-6 grid grid-cols-2 gap-3">
                            <div>
                                <p className="mb-2 text-sm text-gray-500">시작</p>

                                <input
                                    type="time"
                                    value={startTime}
                                    onChange={(e) => setStartTime(e.target.value)}
                                    className="w-full rounded-2xl bg-gray-100 px-4 py-4 outline-none"
                                />
                            </div>

                            <div>
                                <p className="mb-2 text-sm text-gray-500">종료</p>

                                <input
                                    type="time"
                                    value={endTime}
                                    onChange={(e) => setEndTime(e.target.value)}
                                    className="w-full rounded-2xl bg-gray-100 px-4 py-4 outline-none"
                                />
                            </div>
                        </div>

                        {/* Break */}

                        <div className="mt-4">
                            <p className="mb-2 text-sm text-gray-500">휴게시간</p>

                            <input
                                type="number"
                                min="0"
                                value={breakMinutes}
                                onChange={(e) => setBreakMinutes(e.target.value)}
                                className="w-full rounded-2xl bg-gray-100 px-4 py-4 outline-none"
                            />
                        </div>

                        {/* Alarm */}

                        <div className="mt-5 rounded-2xl bg-gray-50 p-4">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="font-medium">🔔 근무 알림</p>

                                    <p className="mt-1 text-xs text-gray-400">근무 전에 미리 알려드려요.</p>
                                </div>

                                <button
                                    type="button"
                                    onClick={async () => {
                                        if (!alarmEnabled) {
                                            const allowed = await requestNotificationPermission();

                                            if (!allowed) {
                                                return;
                                            }
                                        }

                                        setAlarmEnabled((prev) => !prev);
                                    }}
                                    className={`relative h-7 w-12 rounded-full transition ${
                                        alarmEnabled ? "bg-black" : "bg-gray-300"
                                    }`}
                                >
                                    <span
                                        className={`absolute top-1 h-5 w-5 rounded-full bg-white transition ${
                                            alarmEnabled ? "left-6" : "left-1"
                                        }`}
                                    />
                                </button>
                            </div>

                            {alarmEnabled && (
                                <div className="mt-4">
                                    <p className="mb-2 text-sm text-gray-500">몇 분 전에 알려드릴까요?</p>

                                    <select
                                        value={alarmMinutesBefore}
                                        onChange={(e) => setAlarmMinutesBefore(Number(e.target.value))}
                                        className="w-full rounded-2xl bg-white px-4 py-4 outline-none"
                                    >
                                        <option value={15}>15분 전</option>

                                        <option value={30}>30분 전</option>

                                        <option value={60}>1시간 전</option>

                                        <option value={120}>2시간 전</option>

                                        <option value={1440}>하루 전</option>
                                    </select>
                                </div>
                            )}
                        </div>

                        <button
                            onClick={handleAddSchedule}
                            className="mt-5 w-full rounded-2xl bg-black py-4 font-semibold text-white"
                        >
                            근무 등록
                        </button>
                    </div>
                </div>
            )}

            {/* Edit Schedule Modal */}

            {editingSchedule && (
                <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-5">
                    <div className="w-full max-w-md rounded-3xl bg-white p-6">
                        <div className="flex items-center justify-between">
                            <h2 className="text-xl font-bold">근무 수정</h2>

                            <button onClick={() => setEditingSchedule(null)} className="text-gray-400">
                                ✕
                            </button>
                        </div>

                        {/* Time */}

                        <div className="mt-6 grid grid-cols-2 gap-3">
                            <div>
                                <p className="mb-2 text-sm text-gray-500">시작</p>

                                <input
                                    type="time"
                                    value={editingSchedule.startTime}
                                    onChange={(e) =>
                                        setEditingSchedule({
                                            ...editingSchedule,
                                            startTime: e.target.value,
                                        })
                                    }
                                    className="w-full rounded-2xl bg-gray-100 px-4 py-4 outline-none"
                                />
                            </div>

                            <div>
                                <p className="mb-2 text-sm text-gray-500">종료</p>

                                <input
                                    type="time"
                                    value={editingSchedule.endTime}
                                    onChange={(e) =>
                                        setEditingSchedule({
                                            ...editingSchedule,
                                            endTime: e.target.value,
                                        })
                                    }
                                    className="w-full rounded-2xl bg-gray-100 px-4 py-4 outline-none"
                                />
                            </div>
                        </div>

                        {/* Break */}

                        <div className="mt-4">
                            <p className="mb-2 text-sm text-gray-500">휴게시간</p>

                            <input
                                type="number"
                                min="0"
                                value={editingSchedule.breakMinutes}
                                onChange={(e) =>
                                    setEditingSchedule({
                                        ...editingSchedule,
                                        breakMinutes: Number(e.target.value),
                                    })
                                }
                                className="w-full rounded-2xl bg-gray-100 px-4 py-4 outline-none"
                            />
                        </div>

                        {/* Alarm */}

                        <div className="mt-5 rounded-2xl bg-gray-50 p-4">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="font-medium">🔔 근무 알림</p>

                                    <p className="mt-1 text-xs text-gray-400">근무 전에 미리 알려드려요.</p>
                                </div>

                                <button
                                    type="button"
                                    onClick={() =>
                                        setEditingSchedule({
                                            ...editingSchedule,
                                            alarmEnabled: !editingSchedule.alarmEnabled,
                                        })
                                    }
                                    className={`relative h-7 w-12 rounded-full transition ${
                                        editingSchedule.alarmEnabled ? "bg-black" : "bg-gray-300"
                                    }`}
                                >
                                    <span
                                        className={`absolute top-1 h-5 w-5 rounded-full bg-white transition ${
                                            editingSchedule.alarmEnabled ? "left-6" : "left-1"
                                        }`}
                                    />
                                </button>
                            </div>

                            {editingSchedule.alarmEnabled && (
                                <div className="mt-4">
                                    <p className="mb-2 text-sm text-gray-500">몇 분 전에 알려드릴까요?</p>

                                    <select
                                        value={editingSchedule.alarmMinutesBefore}
                                        onChange={(e) =>
                                            setEditingSchedule({
                                                ...editingSchedule,
                                                alarmMinutesBefore: Number(e.target.value),
                                            })
                                        }
                                        className="w-full rounded-2xl bg-white px-4 py-4 outline-none"
                                    >
                                        <option value={15}>15분 전</option>

                                        <option value={30}>30분 전</option>

                                        <option value={60}>1시간 전</option>

                                        <option value={120}>2시간 전</option>

                                        <option value={1440}>하루 전</option>
                                    </select>
                                </div>
                            )}
                        </div>

                        <button
                            onClick={() => handleUpdateSchedule(editingSchedule)}
                            className="mt-5 w-full rounded-2xl bg-black py-4 font-semibold text-white"
                        >
                            수정 완료
                        </button>

                        <button
                            onClick={() => handleDeleteSchedule(editingSchedule.id)}
                            className="mt-3 w-full py-3 text-sm text-red-500"
                        >
                            근무 삭제
                        </button>
                    </div>
                </div>
            )}

            <button onClick={subscribeToPush} className="mt-4 rounded-2xl bg-black px-4 py-3 text-sm font-semibold text-white">
                Push 알림 등록 테스트
            </button>
        </main>
    );
}
