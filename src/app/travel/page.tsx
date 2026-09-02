"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";
import { Plane, CheckCircle2, Star, StarHalf } from "lucide-react";

const upcomingTrips = [
    {
        id: 1,
        country: "🇯🇵",
        city: "Tokyo",
        startDate: "2026.10.12",
        endDate: "2026.10.16",
        nights: 4,
        people: 2,
        budget: 1500,
    },
];

const trips = [
    {
        id: 1,
        country: "🇺🇸",
        city: "New York",
        startDate: "2026.08.12",
        endDate: "2026.08.15",
        nights: 3,
        people: 2,
        status: "여행 완료",
        rating: 92,
    },
    {
        id: 2,
        country: "🇺🇸",
        city: "Boston",
        startDate: "2026.07.13",
        endDate: "2026.07.14",
        nights: 1,
        people: 1,
        status: "여행 완료",
        rating: 100,
    },
];

const countries = [
    {
        country: "🇺🇸",
        name: "미국",
        cities: ["New York", "Boston"],
        count: 3,
    },
    {
        country: "🇨🇦",
        name: "캐나다",
        cities: ["Toronto", "Niagara Falls"],
        count: 4,
    },
    {
        country: "🇯🇵",
        name: "일본",
        cities: ["Tokyo"],
        count: 1,
    },
];

const categoryData = [
    { name: "항공", value: 30, amount: 300 },
    { name: "숙소", value: 25, amount: 250 },
    { name: "식비", value: 20, amount: 200 },
    { name: "교통", value: 10, amount: 100 },
    { name: "택시", value: 5, amount: 50 },
    { name: "기타", value: 10, amount: 100 },
];

const categoryColors = ["#D9E2EC", "#E8E1D9", "#E2E8D9", "#E6DDE8", "#DDE7E8", "#E8E8E8"];
const categoryActiveColors = ["#8FA6BA", "#B5A18D", "#A8B895", "#B19BB5", "#A5BABC", "#AFAFAF"];

export default function TravelPage() {
    const formRef = useRef<HTMLDivElement>(null);

    const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);

    const [tripType, setTripType] = useState<"upcoming" | "completed">("upcoming");
    const [addStep, setAddStep] = useState<"type" | "form">("type");

    const [city, setCity] = useState("");
    const [country, setCountry] = useState("");
    const [startDate, setStartDate] = useState("");
    const [endDate, setEndDate] = useState("");
    const [people, setPeople] = useState("1");
    const [budget, setBudget] = useState("");
    const [rating, setRating] = useState(0);

    return (
        <div className="mx-auto max-w-md px-5 py-8">
            {/* Header */}
            <header>
                <p className="text-sm text-gray-500">차곡</p>

                <div className="mt-2 flex items-center justify-between">
                    <h1 className="text-3xl font-bold">여행</h1>

                    <Link
                        href="/travel/settings"
                        className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-gray-500 shadow-sm"
                        aria-label="여행 설정"
                    >
                        ⚙
                    </Link>
                </div>

                <p className="mt-2 text-sm text-gray-500">여행을 위한 돈을 모으고, 여행 소비를 기록해보세요.</p>
            </header>
            {/* Travel Budget */}
            <section className="mt-8">
                <div className="rounded-3xl bg-white p-6 shadow-sm">
                    <p className="text-sm text-gray-500">✈️ 다음 여행까지</p>

                    <div className="mt-4 flex items-end justify-between">
                        <div>
                            <p className="text-3xl font-bold">$1,280</p>
                            <p className="mt-1 text-sm text-gray-400">$2,000 목표</p>
                        </div>

                        <p className="text-sm font-medium text-gray-500">64%</p>
                    </div>

                    <div className="mt-4 h-2 overflow-hidden rounded-full bg-gray-100">
                        <div className="h-full rounded-full bg-black" style={{ width: "64%" }} />
                    </div>

                    <p className="mt-4 text-sm text-gray-500">
                        $720 더 모으면 <span className="font-medium text-gray-900">New York</span>
                        으로 떠나요 ✈️
                    </p>
                </div>
            </section>
            {/* Coming Soon */}
            <section className="mt-10">
                <div className="flex items-center justify-between">
                    <h2 className="text-lg font-semibold">Coming Soon</h2>

                    <Link href="/travel/list" className="text-sm text-gray-400">
                        전체 보기
                    </Link>
                </div>

                <div className="mt-4 space-y-3">
                    {upcomingTrips.map((trip) => (
                        <Link
                            key={trip.id}
                            href={`/travel/${trip.id}`}
                            className="block rounded-3xl bg-white p-5 shadow-sm transition active:scale-[0.99]"
                        >
                            <div className="flex items-start justify-between">
                                <div>
                                    <p className="text-lg font-semibold">
                                        {trip.country} {trip.city}
                                    </p>

                                    <p className="mt-2 text-sm text-gray-500">
                                        {trip.startDate} — {trip.endDate}
                                    </p>

                                    <p className="mt-1 text-sm text-gray-400">
                                        {trip.nights}박 {trip.nights + 1}일 · {trip.people}명
                                    </p>
                                </div>

                                <span className="rounded-full bg-gray-100 px-3 py-1 text-xs text-gray-500">예정</span>
                            </div>
                        </Link>
                    ))}
                </div>
            </section>
            {/* Travel Statistics */}
            <section className="mt-10">
                <h2 className="text-lg font-semibold">여행 통계</h2>

                {/* Countries */}
                <div className="mt-4">
                    <div className="flex items-end justify-between">
                        <div>
                            <p className="text-sm text-gray-500">🌎 여행한 나라</p>
                            <p className="mt-1 text-2xl font-bold">{countries.length}개국</p>
                        </div>

                        <p className="text-sm text-gray-400">세계일주 18% 완성</p>
                    </div>

                    <div className="mt-4 flex gap-3 overflow-x-auto pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                        {" "}
                        {countries.map((country) => (
                            <div key={country.name} className="min-w-[150px] rounded-3xl bg-white p-5 shadow-sm">
                                <p className="text-2xl">{country.country}</p>

                                <p className="mt-3 font-semibold">{country.name}</p>

                                <p className="mt-1 text-xs text-gray-400">{country.count}회 여행</p>

                                <div className="mt-3 space-y-1">
                                    {country.cities.map((city) => (
                                        <p key={city} className="truncate text-xs text-gray-500">
                                            {city}
                                        </p>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Category Statistics */}
                <div className="mt-8 rounded-3xl bg-white p-6 shadow-sm">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-gray-500">평균 여행 지출</p>
                            <p className="mt-1 text-lg font-semibold">카테고리별 소비</p>
                        </div>

                        <span className="text-xs text-gray-400">눌러서 확인</span>
                    </div>

                    <div className="mb-7 h-70 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={categoryData}
                                    dataKey="value"
                                    nameKey="name"
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={65}
                                    outerRadius={100}
                                    paddingAngle={2}
                                    isAnimationActive={false}
                                    onClick={(_, index) => {
                                        setSelectedIndex(index);
                                    }}
                                    label={({ name, value, cx, cy, midAngle }) => {
                                        const RADIAN = Math.PI / 180;
                                        const radius = 130;

                                        const x = Number(cx) + radius * Math.cos(-Number(midAngle) * RADIAN);

                                        const y = Number(cy) + radius * Math.sin(-Number(midAngle) * RADIAN);

                                        const index = categoryData.findIndex((item) => item.name === name);

                                        const isSelected = selectedIndex === index;

                                        return (
                                            <text
                                                x={x}
                                                y={y}
                                                fill={isSelected ? categoryActiveColors[index] : "#666"}
                                                textAnchor="middle"
                                                dominantBaseline="central"
                                                fontSize={11}
                                            >
                                                <tspan x={x} dy={isSelected ? "-5" : "0"}>
                                                    {name} {value}%
                                                </tspan>

                                                {isSelected && (
                                                    <tspan x={x} dy="16" fontWeight="600">
                                                        ${categoryData[index].amount}
                                                    </tspan>
                                                )}
                                            </text>
                                        );
                                    }}
                                    labelLine={false}
                                >
                                    {categoryData.map((entry, index) => (
                                        <Cell
                                            key={`cell-${index}`}
                                            fill={selectedIndex === index ? categoryActiveColors[index] : categoryColors[index]}
                                        />
                                    ))}
                                </Pie>
                            </PieChart>
                        </ResponsiveContainer>

                        <div className="-mt-41 pointer-events-none text-center">
                            <p className="text-xs text-gray-400">여행 1회당</p>
                            <p className="mt-1 text-lg font-bold">평균 $667</p>
                        </div>
                    </div>

                    <p className="mt-5 text-center text-xs text-gray-400">그래프를 누르면 카테고리별 평균 지출을 볼 수 있어요.</p>
                </div>
            </section>
            {/* Country Insight */}
            <section className="mt-8">
                <div className="rounded-3xl bg-gray-900 p-6 text-white">
                    <p className="text-sm text-gray-400">🇺🇸 미국 여행 소비 분석</p>

                    <p className="mt-4 text-xl font-semibold leading-relaxed">
                        나는 미국 여행하면
                        <br />
                        1박 평균 얼마를 쓸까?
                    </p>

                    <Link href="/travel/statistics" className="mt-6 inline-block text-sm text-gray-300">
                        확인하러 가기 →
                    </Link>
                </div>
            </section>
            {/* My Trips */}
            <section className="mt-10">
                <div className="flex items-center justify-between">
                    <h2 className="text-lg font-semibold">내 여행</h2>

                    <Link href="/travel/list" className="text-sm text-gray-400">
                        전체 보기 →
                    </Link>
                </div>

                <div className="mt-4 space-y-3">
                    {trips.map((trip) => (
                        <Link
                            key={trip.id}
                            href={`/travel/${trip.id}`}
                            className="block rounded-3xl bg-white p-5 shadow-sm transition active:scale-[0.99]"
                        >
                            <div className="flex items-start justify-between">
                                <div>
                                    <p className="text-xs text-gray-400">
                                        {trip.country} · {trip.status}
                                    </p>

                                    <p className="mt-1 text-lg font-semibold">{trip.city}</p>

                                    <p className="mt-2 text-sm text-gray-500">
                                        {trip.startDate} — {trip.endDate}
                                    </p>

                                    <p className="mt-1 text-sm text-gray-400">
                                        {trip.nights}박 {trip.nights + 1}일 · {trip.people}명
                                    </p>
                                </div>

                                <p className="text-sm tracking-tight">
                                    {"★".repeat(Math.round(trip.rating / 20))}
                                    <span className="text-gray-300">{"★".repeat(5 - Math.round(trip.rating / 20))}</span>
                                </p>
                            </div>
                        </Link>
                    ))}
                </div>
            </section>
            {/* Add Travel */}
            <section className="mt-6 pb-8">
                <button
                    type="button"
                    onClick={() => {
                        setAddStep("type");
                        setIsAddModalOpen(true);
                    }}
                    className="flex w-full items-center justify-center rounded-3xl bg-black py-4 text-sm font-medium text-white"
                >
                    ＋ 여행 추가
                </button>
            </section>
            {/* Add Travel Modal */}
            {isAddModalOpen && (
                <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/30 px-4 pb-4 modal-overlay">
                    <div className="modal-content w-full max-w-md overflow-hidden rounded-3xl bg-white p-6 shadow-xl">
                        {/* 헤더 */}
                        <div className="flex items-center justify-between">
                            <h2 className="text-xl font-bold">여행 추가</h2>

                            <button
                                type="button"
                                onClick={() => setIsAddModalOpen(false)}
                                className="flex h-9 w-9 items-center justify-center rounded-full bg-gray-100 text-gray-500"
                            >
                                ×
                            </button>
                        </div>

                        {/* 화면 영역 */}
                        <div
                            className={`relative mt-5 overflow-hidden transition-all duration-500 ease-out ${
                                addStep === "type" ? "h-[180px]" : "min-h-[650px]"
                            }`}
                        >
                            {/* 여행 종류 선택 */}
                            <div
                                ref={formRef}
                                onScroll={() => {
                                    if (addStep !== "form" && formRef.current) {
                                        formRef.current.scrollTop = 0;
                                    }
                                }}
                                className={`absolute inset-0 px-1 transition-all duration-500 ease-out ${
                                    addStep === "type"
                                        ? "translate-x-0 opacity-100"
                                        : "-translate-x-5 opacity-0 pointer-events-none"
                                }`}
                            >
                                <div className="flex flex-col gap-5">
                                    <p className="text-center text-lg font-semibold">어떤 여행인가요?</p>

                                    <div className="flex gap-3">
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setTripType("upcoming");

                                                if (formRef.current) {
                                                    formRef.current.scrollTop = 0;
                                                }

                                                setAddStep("form");
                                            }}
                                            className="flex flex-1 flex-col items-center rounded-3xl border border-gray-200 py-6 transition-transform active:scale-[0.98]"
                                        >
                                            <Plane size={25} strokeWidth={1.7} className="mb-2" />

                                            <span className="text-sm font-medium">예정된 여행</span>
                                        </button>

                                        <button
                                            type="button"
                                            onClick={() => {
                                                setTripType("completed");

                                                if (formRef.current) {
                                                    formRef.current.scrollTop = 0;
                                                }

                                                setAddStep("form");
                                            }}
                                            className="flex flex-1 flex-col items-center rounded-3xl border border-gray-200 py-6 transition-transform active:scale-[0.98]"
                                        >
                                            <CheckCircle2 size={25} strokeWidth={1.7} className="mb-2" />

                                            <span className="text-sm font-medium">다녀온 여행</span>
                                        </button>
                                    </div>
                                </div>
                            </div>

                            {/* 입력 폼 */}
                            <div
                                ref={formRef}
                                className={`absolute inset-0 [scrollbar-width:none] overflow-y-auto px-1 transition-[opacity,transform] duration-500 ease-out ${
                                    addStep === "form"
                                        ? "translate-x-0 opacity-100"
                                        : "translate-x-3 opacity-0 pointer-events-none"
                                }`}
                            >
                                <div className="space-y-5">
                                    {/* 선택한 여행 종류 */}
                                    <div className="mb-7 rounded-2xl bg-gray-50 p-4">
                                        <div className="flex items-center gap-2">
                                            {tripType === "upcoming" ? (
                                                <Plane size={18} strokeWidth={1.8} />
                                            ) : (
                                                <CheckCircle2 size={18} strokeWidth={1.8} />
                                            )}

                                            <p className="text-sm font-medium">
                                                {tripType === "upcoming" ? "예정된 여행" : "다녀온 여행"}
                                            </p>
                                        </div>

                                        <p className="mt-1 text-xs text-gray-400">
                                            {tripType === "upcoming"
                                                ? "앞으로 떠날 여행 정보를 입력해주세요."
                                                : "이미 다녀온 여행 정보를 입력해주세요."}
                                        </p>
                                    </div>

                                    {/* 도시 */}
                                    <div>
                                        <p className="text-sm font-medium text-gray-700">도시</p>

                                        <input
                                            type="text"
                                            value={city}
                                            onChange={(e) => setCity(e.target.value)}
                                            placeholder="예: New York"
                                            className="mt-2 w-full rounded-2xl bg-gray-100 px-4 py-4 text-sm outline-none"
                                        />
                                    </div>

                                    {/* 국가 */}
                                    <div>
                                        <p className="text-sm font-medium text-gray-700">국가</p>

                                        <input
                                            type="text"
                                            value={country}
                                            onChange={(e) => setCountry(e.target.value)}
                                            placeholder="예: United States"
                                            className="mt-2 w-full rounded-2xl bg-gray-100 px-4 py-4 text-sm outline-none"
                                        />
                                    </div>

                                    {/* 날짜 */}
                                    <div>
                                        <p className="text-sm font-medium text-gray-700">여행 날짜</p>

                                        <div className="mt-2 grid grid-cols-2 gap-3">
                                            <input
                                                type="date"
                                                value={startDate}
                                                onChange={(e) => setStartDate(e.target.value)}
                                                min={tripType === "upcoming" ? new Date().toISOString().split("T")[0] : undefined}
                                                max={
                                                    tripType === "completed"
                                                        ? new Date(Date.now() - 86400000).toISOString().split("T")[0]
                                                        : undefined
                                                }
                                                className="w-full rounded-2xl bg-gray-100 px-4 py-4 text-sm outline-none"
                                            />

                                            <input
                                                type="date"
                                                value={endDate}
                                                onChange={(e) => setEndDate(e.target.value)}
                                                min={tripType === "upcoming" ? new Date().toISOString().split("T")[0] : undefined}
                                                max={
                                                    tripType === "completed"
                                                        ? new Date(Date.now() - 86400000).toISOString().split("T")[0]
                                                        : undefined
                                                }
                                                className="w-full rounded-2xl bg-gray-100 px-4 py-4 text-sm outline-none"
                                            />
                                        </div>
                                    </div>

                                    {/* 인원 */}
                                    <div>
                                        <p className="text-sm font-medium text-gray-700">인원</p>

                                        <input
                                            type="number"
                                            min="1"
                                            value={people}
                                            onChange={(e) => {
                                                setPeople(e.target.value.replace(/^0+(?=\d)/, ""));
                                            }}
                                            className="mt-2 w-full rounded-2xl bg-gray-100 px-4 py-4 text-sm outline-none"
                                        />
                                    </div>

                                    {/* 예산 */}
                                    <div>
                                        <p className="text-sm font-medium text-gray-700">여행 예산</p>

                                        <input
                                            type="number"
                                            min="0"
                                            value={budget}
                                            onChange={(e) => {
                                                setBudget(e.target.value.replace(/^0+(?=\d)/, ""));
                                            }}
                                            placeholder="예: 2000"
                                            className="mt-2 w-full rounded-2xl bg-gray-100 px-4 py-4 text-sm outline-none"
                                        />
                                    </div>

                                    {/* 평점 */}
                                    {tripType === "completed" && (
                                        <div>
                                            <p className="text-sm font-medium text-gray-700">여행 평점</p>

                                            <div className="mt-3 flex items-center gap-1">
                                                <div className="flex items-center gap-2">
                                                    {[1, 2, 3, 4, 5].map((star) => {
                                                        const isFull = rating >= star;
                                                        const isHalf = rating === star - 0.5;

                                                        return (
                                                            <div key={star} className="relative h-9 w-9">
                                                                <Star
                                                                    size={30}
                                                                    strokeWidth={1.7}
                                                                    className="absolute inset-0 text-gray-200"
                                                                />

                                                                {isHalf && (
                                                                    <div className="absolute inset-0 w-1/2 overflow-hidden">
                                                                        <Star
                                                                            size={30}
                                                                            strokeWidth={1.7}
                                                                            className="fill-gray-900 text-gray-900"
                                                                        />
                                                                    </div>
                                                                )}

                                                                {isFull && (
                                                                    <Star
                                                                        size={30}
                                                                        strokeWidth={1.7}
                                                                        className="absolute inset-0 fill-gray-900 text-gray-900"
                                                                    />
                                                                )}

                                                                <button
                                                                    type="button"
                                                                    onClick={() => setRating(star - 0.5)}
                                                                    className="absolute left-0 top-0 z-10 h-full w-1/2"
                                                                    aria-label={`${star - 0.5}점`}
                                                                />

                                                                <button
                                                                    type="button"
                                                                    onClick={() => setRating(star)}
                                                                    className="absolute right-0 top-0 z-10 h-full w-1/2"
                                                                    aria-label={`${star}점`}
                                                                />
                                                            </div>
                                                        );
                                                    })}
                                                </div>

                                                <span className="ml-2 text-sm text-gray-400">{rating.toFixed(1)}</span>
                                            </div>
                                        </div>
                                    )}

                                    {/* 뒤로가기 / 저장 */}
                                    <div className="mt-8 flex gap-3 pb-4">
                                        <button
                                            type="button"
                                            onClick={() => {
                                                if (formRef.current) {
                                                    formRef.current.scrollTop = 0;
                                                }

                                                setAddStep("type");
                                            }}
                                            className="flex-1 rounded-2xl border border-gray-200 py-4 text-sm font-medium text-gray-700"
                                        >
                                            ← 돌아가기
                                        </button>

                                        <button
                                            type="button"
                                            className="flex-1 rounded-2xl bg-black py-4 text-sm font-medium text-white"
                                        >
                                            저장
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
