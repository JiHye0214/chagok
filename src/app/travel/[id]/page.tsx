"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { Star, Plane, Hotel, Utensils, TrainFront, ShoppingBag, MoreHorizontal } from "lucide-react";

type SavedTrip = {
    id: number;
    tripType: "upcoming" | "completed";
    title?: string;
    city: string;
    country: string;
    countryCode: string;
    startDate: string;
    endDate: string;
    people: number;
    budget?: number;
    currency?: string;
    rating: number;
};

const getTrip = (id: string | string[] | undefined): SavedTrip | null => {
    if (typeof window === "undefined" || !id) {
        return null;
    }

    const saved = localStorage.getItem("chagok-trips");

    if (!saved) {
        return null;
    }

    try {
        const allTrips: SavedTrip[] = JSON.parse(saved);

        return allTrips.find((trip) => String(trip.id) === String(id)) ?? null;
    } catch (error) {
        console.error("여행 데이터를 불러오지 못했습니다.", error);
        return null;
    }
};

const formatDate = (dateString: string) => {
    const date = new Date(`${dateString}T00:00:00`);

    return new Intl.DateTimeFormat("ko-KR", {
        year: "numeric",
        month: "long",
        day: "numeric",
    }).format(date);
};

const getNights = (startDate: string, endDate: string) => {
    const start = new Date(`${startDate}T00:00:00`);
    const end = new Date(`${endDate}T00:00:00`);

    return Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
};

const getDDay = (startDate: string) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const start = new Date(`${startDate}T00:00:00`);
    start.setHours(0, 0, 0, 0);

    const diff = Math.ceil((start.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

    if (diff === 0) {
        return "D-DAY";
    }

    if (diff < 0) {
        return "여행 중";
    }

    return `D-${diff}`;
};

const getStatus = (trip: SavedTrip) => {
    if (trip.tripType === "upcoming") {
        return "COMING SOON";
    }

    if (!trip.rating || trip.rating === 0) {
        return "NOT REVIEWED";
    }

    return "COMPLETED";
};

// [Todo]
// 아이콘 수정부터 ------

const categoryList = [
    {
        name: "항공",
        icon: Plane,
    },
    {
        name: "숙소",
        icon: Hotel,
    },
    {
        name: "식비",
        icon: Utensils,
    },
    {
        name: "교통",
        icon: TrainFront,
    },
    {
        name: "쇼핑",
        icon: ShoppingBag,
    },
    {
        name: "기타",
        icon: MoreHorizontal,
    },
];

export default function TravelDetailPage() {
    const params = useParams();

    const trip = getTrip(params.id);

    if (!trip) {
        return (
            <main className="min-h-screen bg-gray-50 px-5 py-8">
                <div className="mx-auto max-w-md">
                    <Link href="/travel/list" className="text-sm text-gray-500">
                        ← 여행 목록
                    </Link>

                    <div className="flex min-h-[70vh] flex-col items-center justify-center text-center">
                        <p className="text-base font-semibold text-gray-900">여행을 찾을 수 없어요</p>

                        <p className="mt-2 text-sm leading-6 text-gray-400">
                            존재하지 않는 여행이거나
                            <br />
                            삭제된 여행일 수 있어요.
                        </p>

                        <Link
                            href="/travel/list"
                            className="mt-6 rounded-2xl bg-white px-5 py-3 text-sm font-medium text-gray-700 shadow-sm"
                        >
                            여행 목록으로
                        </Link>
                    </div>
                </div>
            </main>
        );
    }

    const status = getStatus(trip);
    const nights = getNights(trip.startDate, trip.endDate);

    const displayTitle = trip.title?.trim() || trip.city;

    return (
        <div className="mx-auto max-w-md">
            {/* Trip Header */}
            <section>
                <div className=" rounded-3xl bg-white p-6 shadow-sm">
                    <div className="flex gap-3 items-center">
                        {/* Flag */}
                        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white shadow-sm">
                            <img
                                src={`https://flagcdn.com/w40/${trip.countryCode.toLowerCase()}.png`}
                                alt={trip.country}
                                className="h-3 object-cover"
                            />
                        </div>
                    </div>
                    {/* Title */}
                    <h1 className="mt-6 text-4xl font-bold tracking-tight text-gray-950">{displayTitle}</h1>

                    {/* Location */}
                    <p className="mt-2 text-sm text-gray-500">
                        {trip.city} · {trip.country}
                    </p>

                    {/* Date / Duration */}
                    <div className="mt-5">
                        <p className="text-sm text-gray-500">
                            {formatDate(trip.startDate)}
                            <span className="mx-2 text-gray-300">—</span>
                            {formatDate(trip.endDate)}
                        </p>

                        <p className="mt-1 text-sm text-gray-400">
                            {nights === 0 ? `당일치기 · ${trip.people}명` : `${nights}박 ${nights + 1}일 · ${trip.people}명`}
                        </p>
                    </div>

                    {/* Status */}
                    <span className="mt-5 inline-flex rounded-full bg-white px-3 py-1.5 text-[11px] font-semibold tracking-wide text-gray-500 shadow-sm">
                        {status}
                    </span>
                </div>
            </section>

            {/* Coming Soon */}
            {trip.tripType === "upcoming" && (
                <section className="mt-8">
                    <div className="rounded-3xl bg-white p-6 shadow-sm">
                        <div className="flex items-center justify-between">
                            <p className="text-sm text-gray-400">여행까지</p>

                            <p className="text-sm font-semibold text-gray-900">{getDDay(trip.startDate)}</p>
                        </div>

                        <div className="mt-6">
                            <p className="text-sm text-gray-400">여행 예산</p>

                            <p className="mt-1 text-3xl font-bold tracking-tight text-gray-950">
                                ${(trip.budget ?? 0).toLocaleString()}
                            </p>
                        </div>
                    </div>
                </section>
            )}

            {/* Completed Expense Summary */}
            {trip.tripType === "completed" && (
                <section className="mt-8">
                    <div className="rounded-3xl bg-white p-6 shadow-sm">
                        <p className="text-sm text-gray-400">총 지출</p>

                        <p className="mt-1 text-3xl font-bold tracking-tight text-gray-950">$0</p>

                        {nights > 0 && (
                            <p className="mt-4 text-sm text-gray-400">
                                1박당 <span className="font-bold text-gray-900">$0</span>을 썼어요
                            </p>
                        )}
                    </div>
                </section>
            )}

            {/* Review */}
            {trip.tripType === "completed" && (
                <section className="mt-8">
                    <div className="rounded-3xl bg-white p-6 shadow-sm">
                        <p className="text-base font-semibold text-gray-900">여행은 어땠나요?</p>

                        {trip.rating > 0 ? (
                            <div className="mt-5 flex items-center gap-2">
                                <div className="flex gap-0.5">
                                    {Array.from({
                                        length: 5,
                                    }).map((_, index) => (
                                        <Star
                                            key={index}
                                            size={18}
                                            strokeWidth={1.8}
                                            className={trip.rating >= index + 1 ? "fill-gray-900 text-gray-900" : "text-gray-200"}
                                        />
                                    ))}
                                </div>

                                <span className="text-sm font-medium text-gray-500">{trip.rating.toFixed(1)}</span>
                            </div>
                        ) : (
                            <>
                                <p className="mt-2 text-sm leading-6 text-gray-400">
                                    아직 이 여행에 별점을
                                    <br />
                                    남기지 않았어요.
                                </p>

                                <button
                                    type="button"
                                    className="mt-5 w-full rounded-2xl bg-gray-900 py-4 text-sm font-medium text-white"
                                >
                                    별점 남기기
                                </button>
                            </>
                        )}
                    </div>
                </section>
            )}

            {/* Expenses */}
            <section className="mt-8">
                <div className="flex items-end justify-between">
                    <div>
                        <h2 className="text-lg font-semibold text-gray-900">여행 지출</h2>

                        <p className="mt-1 text-sm text-gray-400">카테고리별로 기록해보세요.</p>
                    </div>
                </div>

                {/* Categories */}
                <div className="mt-4 grid grid-cols-2 gap-3">
                    {categoryList.map((category) => (
                        <button
                            key={category.name}
                            type="button"
                            className="flex h-[110px] flex-col justify-end gap-2 rounded-3xl bg-white p-5 text-left shadow-sm transition active:scale-[0.98]"
                        >
                            <category.icon size={20} strokeWidth={1.8} className="text-gray-500" />

                            <div className="flex items-center justify-between">
                                <p className="text-sm font-medium text-gray-700">{category.name}</p>

                                <p className="text-sm font-semibold text-gray-900">$0</p>
                            </div>
                        </button>
                    ))}
                </div>

                {/* Add Expense */}
                <button type="button" className="mt-3 w-full rounded-3xl bg-gray-900 py-4 text-sm font-medium text-white">
                    ＋ 지출 기록
                </button>
            </section>
        </div>
    );
}
