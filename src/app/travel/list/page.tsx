"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowLeft, Star } from "lucide-react";
import { formatDate } from "@/lib/payPeriod";

type SavedTrip = {
    id: number;
    tripType: "upcoming" | "completed";
    title?: string | null;
    city: string;
    country: string;
    countryCode: string;
    startDate: string;
    endDate: string;
    people: number;
    budget?: number;
    currency?: string;
    rating: number;
    totalExpense?: number;
};

const getNights = (startDate: string, endDate: string) => {
    const start = new Date(startDate);
    const end = new Date(endDate);

    return Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
};

export default function TravelListPage() {
    const [trips, setTrips] = useState<SavedTrip[]>([]);
    const [isTripsLoading, setIsTripsLoading] = useState(true);

    useEffect(() => {
        const fetchTrips = async () => {
            try {
                const response = await fetch("/api/trips");

                if (!response.ok) {
                    throw new Error("여행 목록 조회 실패");
                }

                const data: SavedTrip[] = await response.json();

                setTrips(data);
            } catch (error) {
                console.error("여행 목록 조회 실패:", error);
                setTrips([]);
            } finally {
                setIsTripsLoading(false);
            }
        };

        fetchTrips();
    }, []);

    const upcomingTrips = trips
        .filter((trip) => trip.tripType === "upcoming")
        .sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime());

    const completedTrips = trips
        .filter((trip) => trip.tripType === "completed")
        .sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime());

    // Loading
    if (isTripsLoading) {
        return (
            <div className="flex h-[calc(100vh-152px)] items-center justify-center">
                <p className="text-sm text-gray-400">여행 기록 리스트를 불러오는 중...</p>
            </div>
        );
    }

    return (
        <div className="mx-auto max-w-md">
            {/* Header */}
            <header>
                <div className="flex flex-col gap-8">
                    <Link
                        href="/travel"
                        className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-gray-500 shadow-sm"
                        aria-label="여행으로 돌아가기"
                    >
                        <ArrowLeft size={19} strokeWidth={1.8} />
                    </Link>

                    <div>
                        <p className="text-xs text-gray-400">차곡</p>

                        <h1 className="mt-0.5 text-2xl font-bold">내 여행</h1>
                    </div>
                </div>

                <p className="mt-3 text-sm text-gray-500">내가 다녀온 여행과 앞으로의 여행을 한곳에서 확인해보세요.</p>
            </header>

            {trips.length === 0 ? (
                /* No Trips */
                <div className="mt-10 rounded-3xl bg-white px-5 py-10 text-center shadow-sm">
                    <p className="text-sm font-medium text-gray-900">아직 여행 기록이 없어요</p>

                    <p className="mt-1 text-xs text-gray-400">첫 여행을 추가해보세요.</p>

                    <Link
                        href="/travel"
                        className="mt-5 inline-flex rounded-full bg-gray-900 px-5 py-2.5 text-sm font-medium text-white"
                    >
                        여행 추가하기
                    </Link>
                </div>
            ) : (
                <>
                    {/* Upcoming Trips */}
                    {upcomingTrips.length > 0 && (
                        <section className="mt-10">
                            <div className="flex items-center justify-between">
                                <h2 className="text-lg font-semibold">예정된 여행</h2>

                                <span className="text-xs text-gray-400">{upcomingTrips.length}개</span>
                            </div>

                            <div className="mt-4 space-y-3">
                                {upcomingTrips.map((trip) => {
                                    const nights = getNights(trip.startDate, trip.endDate);

                                    return (
                                        <Link
                                            key={trip.id}
                                            href={`/travel/list/${trip.id}`}
                                            className="block rounded-3xl bg-white p-6 shadow-sm transition active:scale-[0.99]"
                                        >
                                            <div className="flex items-start justify-between gap-4">
                                                <div className="min-w-0">
                                                    {trip.title ? (
                                                        <>
                                                            <p className="truncate text-lg font-semibold text-gray-900">
                                                                {trip.title}
                                                            </p>

                                                            <div className="mt-1 flex items-center gap-1.5">
                                                                <img
                                                                    src={`https://flagcdn.com/w40/${trip.countryCode.toLowerCase()}.png`}
                                                                    alt={trip.country}
                                                                    className="h-3 w-auto object-cover"
                                                                />

                                                                <p className="truncate text-sm text-gray-400">
                                                                    {trip.city} · {trip.countryCode}
                                                                </p>
                                                            </div>
                                                        </>
                                                    ) : (
                                                        <div className="flex items-center gap-2">
                                                            <img
                                                                src={`https://flagcdn.com/w40/${trip.countryCode.toLowerCase()}.png`}
                                                                alt={trip.country}
                                                                className="h-3 w-auto object-cover"
                                                            />

                                                            <p className="truncate text-lg font-semibold text-gray-900">
                                                                {trip.city}
                                                            </p>
                                                        </div>
                                                    )}

                                                    <p className="mt-4 text-xs text-gray-500">
                                                        {formatDate(new Date(trip.startDate))} ~{" "}
                                                        {formatDate(new Date(trip.endDate))}
                                                    </p>

                                                    <p className="mt-1 text-xs text-gray-400">
                                                        {nights === 0
                                                            ? `당일치기 · ${trip.people}명`
                                                            : `${nights}박 ${nights + 1}일 · ${trip.people}명`}
                                                    </p>
                                                </div>

                                                <span className="shrink-0 rounded-full bg-gray-100 px-3 py-1 text-xs text-gray-500">
                                                    D-
                                                    {Math.max(
                                                        0,
                                                        Math.ceil(
                                                            (new Date(trip.startDate).getTime() - Date.now()) /
                                                                (1000 * 60 * 60 * 24),
                                                        ),
                                                    )}
                                                </span>
                                            </div>
                                        </Link>
                                    );
                                })}
                            </div>
                        </section>
                    )}

                    {/* Completed Trips */}
                    <section className={upcomingTrips.length > 0 ? "mt-10" : "mt-8"}>
                        <div className="flex items-center justify-between">
                            <h2 className="text-lg font-semibold">다녀온 여행</h2>

                            {completedTrips.length > 0 && (
                                <span className="text-xs text-gray-400">{completedTrips.length}개</span>
                            )}
                        </div>

                        {completedTrips.length > 0 ? (
                            <div className="mt-4 space-y-3">
                                {completedTrips.map((trip) => {
                                    const nights = getNights(trip.startDate, trip.endDate);

                                    const filledStars = Math.round(trip.rating);

                                    return (
                                        <Link
                                            key={trip.id}
                                            href={`/travel/list/${trip.id}`}
                                            className="block rounded-3xl bg-white p-6 shadow-sm transition active:scale-[0.99]"
                                        >
                                            <div className="flex items-start justify-between gap-4">
                                                <div className="min-w-0 flex-1">
                                                    <div className="flex items-center justify-between gap-3">
                                                        <p className="truncate text-lg font-semibold text-gray-900">
                                                            {trip.title || trip.city}
                                                        </p>

                                                        {trip.rating > 0 && (
                                                            <div className="flex shrink-0 items-center">
                                                                {[1, 2, 3, 4, 5].map((star) => (
                                                                    <Star
                                                                        key={star}
                                                                        size={13}
                                                                        strokeWidth={1.7}
                                                                        className={
                                                                            star <= filledStars
                                                                                ? "fill-gray-900 text-gray-900"
                                                                                : "text-gray-200"
                                                                        }
                                                                    />
                                                                ))}
                                                            </div>
                                                        )}
                                                    </div>

                                                    <div className="mt-1 flex items-center gap-1.5">
                                                        <img
                                                            src={`https://flagcdn.com/w40/${trip.countryCode.toLowerCase()}.png`}
                                                            alt={trip.country}
                                                            className="h-3 w-auto object-cover"
                                                        />

                                                        <p className="truncate text-sm text-gray-400">
                                                            {trip.city} · {trip.countryCode}
                                                        </p>
                                                    </div>

                                                    <p className="mt-4 text-xs text-gray-500">
                                                        {formatDate(new Date(trip.startDate))} ~{" "}
                                                        {formatDate(new Date(trip.endDate))}
                                                    </p>

                                                    <div className="mt-1 flex items-end justify-between">
                                                        <p className="text-xs text-gray-400">
                                                            {nights === 0
                                                                ? `당일치기 · ${trip.people}명`
                                                                : `${nights}박 ${nights + 1}일 · ${trip.people}명`}
                                                        </p>

                                                        {trip.tripType === "completed" && (
                                                            <p className="text-xs text-gray-400">
                                                                ${Number(trip.totalExpense ?? 0).toLocaleString()}
                                                            </p>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        </Link>
                                    );
                                })}
                            </div>
                        ) : (
                            /* Has trips, but no completed trips */
                            <div className="mt-4 rounded-3xl bg-white px-5 py-10 text-center shadow-sm">
                                <p className="text-sm font-medium text-gray-900">아직 다녀온 여행이 없어요</p>

                                <p className="mt-1 text-xs text-gray-400">여행을 추가하면 이곳에 기록이 남아요.</p>
                            </div>
                        )}
                    </section>
                </>
            )}
        </div>
    );
}
