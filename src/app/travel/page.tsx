"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts";
import { Plane, CheckCircle2, Star } from "lucide-react";
import { formatDate } from "@/lib/payPeriod";

type SavedTrip = {
    id: number;
    tripType: "upcoming" | "completed";
    title: string | null;
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

type CitySearchResult = {
    name: string;
    countryCode: string;
};

const getCountryName = (countryCode: string) => {
    try {
        return (
            new Intl.DisplayNames(["en"], {
                type: "region",
            }).of(countryCode) || countryCode
        );
    } catch {
        return countryCode;
    }
};

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
    const typeRef = useRef<HTMLDivElement>(null);
    const formRef = useRef<HTMLDivElement>(null);
    const isSelectingCityRef = useRef(false);

    const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);

    const [tripType, setTripType] = useState<"upcoming" | "completed">("upcoming");

    const [addStep, setAddStep] = useState<"type" | "form">("type");

    const [city, setCity] = useState("");
    const [country, setCountry] = useState("");
    const [countryCode, setCountryCode] = useState("");

    const [title, setTitle] = useState("");
    const [startDate, setStartDate] = useState("");
    const [endDate, setEndDate] = useState("");
    const [people, setPeople] = useState("1");
    const [budget, setBudget] = useState("");
    const [rating, setRating] = useState(0);

    const [savedTrip, setSavedTrip] = useState<SavedTrip | null>(null);

    // 위치 검색
    const [citySearchResults, setCitySearchResults] = useState<CitySearchResult[]>([]);

    const [isCitySearching, setIsCitySearching] = useState(false);
    const [showCityResults, setShowCityResults] = useState(false);

    // 여행 저장
    const [trips, setTrips] = useState<SavedTrip[]>([]);
    const [isTripsLoading, setIsTripsLoading] = useState(true);

    // 위치 검색 API
    useEffect(() => {
        const keyword = city.trim();

        if (isSelectingCityRef.current) {
            isSelectingCityRef.current = false;
            return;
        }

        if (keyword.length < 2) {
            return;
        }

        const timer = window.setTimeout(async () => {
            try {
                setIsCitySearching(true);

                const response = await fetch(`https://countries.dev/cities?q=${encodeURIComponent(keyword)}&limit=8`);

                if (!response.ok) {
                    throw new Error("도시 검색에 실패했습니다.");
                }

                const data: CitySearchResult[] = await response.json();

                setCitySearchResults(data);
                setShowCityResults(true);
            } catch (error) {
                console.error("도시 검색 오류:", error);
            } finally {
                setIsCitySearching(false);
            }
        }, 400);

        return () => {
            window.clearTimeout(timer);
        };
    }, [city]);

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

    // 국가 코드로 국가 정보 가져오기
    const getCountryInfo = async (code: string) => {
        try {
            const response = await fetch(`https://countries.dev/alpha/${encodeURIComponent(code)}?fields=name,flag`);

            if (!response.ok) {
                throw new Error("국가 정보를 가져오지 못했습니다.");
            }

            const data = await response.json();

            return {
                name: data.name || "",
                flag: data.flag || "",
            };
        } catch (error) {
            console.error("국가 정보 오류:", error);

            return {
                name: "",
                flag: "",
            };
        }
    };

    // 도시 선택
    const handleCitySelect = async (result: CitySearchResult) => {
        isSelectingCityRef.current = true;

        setCity(result.name);
        setCountryCode(result.countryCode);
        setShowCityResults(false);
        setCitySearchResults([]);

        const countryInfo = await getCountryInfo(result.countryCode);

        setCountry(countryInfo.name);
    };

    // 인풋 초기화
    const resetTripForm = () => {
        setTitle("");
        setCity("");
        setCountry("");
        setCountryCode("");
        setStartDate("");
        setEndDate("");
        setPeople("1");
        setBudget("");
        setRating(0);

        setCitySearchResults([]);
        setShowCityResults(false);
    };

    // 있을 때만
    const upcomingTrips = trips.filter((trip) => trip.tripType === "upcoming");
    const completedTrips = trips.filter((trip) => trip.tripType === "completed");

    const getNights = (startDate: string, endDate: string) => {
        const start = new Date(startDate);
        const end = new Date(endDate);

        return Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    };

    if (isTripsLoading) {
        return (
            <div className="flex h-[calc(100vh-152px)] items-center justify-center">
                <p className="text-sm text-gray-400">여행 기록을 불러오는 중...</p>
            </div>
        );
    }

    return (
        <div className="mx-auto max-w-md">
            {" "}
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
            {upcomingTrips.length > 0 && (
                <section className="mt-10">
                    <div className="flex items-center justify-between">
                        <h2 className="text-lg font-semibold">Coming Soon</h2>

                        <Link href="/travel/list" className="text-sm text-gray-400">
                            전체 보기
                        </Link>
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
                                                    <p className="truncate text-lg font-semibold text-gray-900">{trip.title}</p>

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

                                                    <p className="truncate text-lg font-semibold text-gray-900">{trip.city}</p>
                                                </div>
                                            )}

                                            <p className="mt-4 text-xs text-gray-500">
                                                {formatDate(new Date(trip.startDate))} ~ {formatDate(new Date(trip.endDate))}
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
                                                    (new Date(trip.startDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24),
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

                {completedTrips.length > 0 ? (
                    <div className="mt-4 space-y-3">
                        {completedTrips.map((trip) => {
                            const nights = getNights(trip.startDate, trip.endDate);

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
                                                                    star <= trip.rating
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
                                                {formatDate(new Date(trip.startDate))} ~ {formatDate(new Date(trip.endDate))}
                                            </p>

                                            <p className="mt-1 text-xs text-gray-400">
                                                {nights === 0
                                                    ? `당일치기 · ${trip.people}명`
                                                    : `${nights}박 ${nights + 1}일 · ${trip.people}명`}
                                            </p>
                                        </div>
                                    </div>
                                </Link>
                            );
                        })}
                    </div>
                ) : (
                    <div className="mt-4 rounded-3xl bg-white px-5 py-8 text-center shadow-sm">
                        <p className="text-sm font-medium text-gray-900">아직 다녀온 여행이 없어요</p>

                        <p className="mt-1 text-xs text-gray-400">여행을 추가하고 나만의 여행 기록을 남겨보세요</p>

                        <button
                            type="button"
                            onClick={() => {
                                resetTripForm();
                                setTripType("upcoming");
                                setAddStep("type");
                                setIsAddModalOpen(true);
                            }}
                            className="mt-5 rounded-full bg-gray-900 px-5 py-2.5 text-sm font-medium text-white"
                        >
                            여행 추가하기
                        </button>
                    </div>
                )}
            </section>
            {/* Add Travel */}
            <section className="mt-6">
                <button
                    type="button"
                    onClick={() => {
                        resetTripForm();
                        setTripType("upcoming");
                        setAddStep("type");
                        setIsAddModalOpen(true);
                    }}
                    className="flex w-full items-center justify-center rounded-3xl bg-black py-4 text-sm font-medium text-white"
                >
                    ＋ 여행 추가
                </button>
            </section>
            {/* Trip Saved Popup */}
            {savedTrip && (
                <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/30 px-5">
                    <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-xl">
                        <p className="text-lg font-bold">여행이 추가됐어요 ✈️</p>

                        {savedTrip.title ? (
                            <p className="mt-4 text-2xl font-bold">{savedTrip.title}</p>
                        ) : (
                            <p className="mt-4 text-2xl font-bold">{savedTrip.city}</p>
                        )}

                        <p className="mt-2 text-sm text-gray-500">
                            {savedTrip.city} · {savedTrip.countryCode}
                        </p>

                        <p className="mt-1 text-sm text-gray-500">
                            {(() => {
                                const start = new Date(savedTrip.startDate);
                                const end = new Date(savedTrip.endDate);

                                const nights = Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));

                                return nights === 0
                                    ? `당일치기 · ${savedTrip.people}명`
                                    : `${nights}박 ${nights + 1}일 · ${savedTrip.people}명`;
                            })()}
                        </p>

                        <p className="mt-6 text-sm text-gray-500">여행 지출도 기록할까요?</p>

                        <div className="mt-5 space-y-2">
                            <button
                                type="button"
                                onClick={() => {
                                    window.location.href = `/travel/${savedTrip.id}`;
                                }}
                                className="w-full rounded-2xl bg-black py-4 text-sm font-medium text-white"
                            >
                                지출 기록하기
                            </button>

                            <button
                                type="button"
                                onClick={() => {
                                    setSavedTrip(null);
                                }}
                                className="w-full rounded-2xl bg-gray-100 py-4 text-sm font-medium text-gray-700"
                            >
                                나중에 할게요
                            </button>
                        </div>
                    </div>
                </div>
            )}
            {/* Add Travel Modal */}
            {isAddModalOpen && (
                <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/30 px-4 pb-4 modal-overlay">
                    <div className="modal-content w-full max-w-md overflow-hidden rounded-3xl bg-white p-6 shadow-xl">
                        {/* 헤더 */}
                        <div className="flex items-center justify-between">
                            <h2 className="text-xl font-bold">여행 추가</h2>

                            <button
                                type="button"
                                onClick={() => {
                                    resetTripForm();
                                    setAddStep("type");
                                    setIsAddModalOpen(false);
                                }}
                                className="flex h-9 w-9 items-center justify-center rounded-full bg-gray-100 text-gray-500"
                            >
                                ×
                            </button>
                        </div>

                        {/* 화면 영역 */}
                        <div
                            className={`relative mt-5 overflow-hidden transition-[height] duration-500 ease-in-out ${
                                addStep === "form" && tripType === "upcoming"
                                    ? "h-[666px]"
                                    : addStep === "form" && tripType === "completed"
                                      ? "h-[650px]"
                                      : "h-[210px]"
                            }`}
                        >
                            {/* 여행 종류 선택 */}
                            <div
                                ref={typeRef}
                                onScroll={() => {
                                    if (addStep !== "form" && typeRef.current) {
                                        typeRef.current.scrollTop = 0;
                                    }
                                }}
                                className={`absolute inset-0 px-1 transition-[height] duration-500 ease-in-out duration-500 ease-out ${
                                    addStep === "type"
                                        ? "translate-x-0 opacity-100"
                                        : "-translate-x-5 pointer-events-none opacity-0"
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
                                            className="flex flex-1 flex-col items-center rounded-3xl border border-gray-200 py-12 transition-transform active:scale-[0.98]"
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
                                            className="flex flex-1 flex-col items-center rounded-3xl border border-gray-200 py-12 transition-transform active:scale-[0.98]"
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
                                className={`absolute inset-0 scrollbar-hide px-1 transition-[opacity,transform] duration-500 ease-out ${
                                    addStep === "form"
                                        ? "translate-x-0 opacity-100"
                                        : "translate-x-3 pointer-events-none opacity-0"
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

                                    {/* 여행 제목 */}
                                    <div>
                                        <p className="text-sm font-medium text-gray-700">여행 제목</p>

                                        <input
                                            type="text"
                                            value={title}
                                            onChange={(e) => setTitle(e.target.value)}
                                            placeholder="이 여행을 한마디로 남겨보세요"
                                            maxLength={50}
                                            className="mt-2 w-full rounded-2xl bg-gray-100 px-4 py-4 text-sm outline-none"
                                        />
                                    </div>

                                    {/* 위치 */}
                                    <div className="relative">
                                        <p className="text-sm font-medium text-gray-700">위치</p>

                                        {countryCode ? (
                                            <div className="mt-2 flex h-[52px] w-full items-center gap-3 rounded-2xl bg-gray-50 px-4">
                                                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white text-base">
                                                    <img
                                                        src={`https://flagcdn.com/w40/${countryCode.toLowerCase()}.png`}
                                                        alt={country}
                                                        className="h-3 object-cover"
                                                    />
                                                </span>

                                                <div className="min-w-0 flex-1">
                                                    <p className="truncate text-sm font-medium leading-4 text-gray-900">{city}</p>
                                                    <p className="mt-0.5 truncate text-xs leading-3 text-gray-400">{country}</p>
                                                </div>

                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        setCity("");
                                                        setCountry("");
                                                        setCountryCode("");
                                                        setCitySearchResults([]);
                                                        setShowCityResults(false);
                                                    }}
                                                    className="shrink-0 text-xs text-gray-400"
                                                >
                                                    변경
                                                </button>
                                            </div>
                                        ) : (
                                            <input
                                                type="text"
                                                value={city}
                                                onChange={(e) => {
                                                    const value = e.target.value;

                                                    setCity(value);
                                                    setCountry("");
                                                    setCountryCode("");
                                                    setCitySearchResults([]);
                                                    setShowCityResults(value.trim().length >= 2);
                                                }}
                                                onFocus={() => {
                                                    if (city.trim().length >= 2 && citySearchResults.length > 0) {
                                                        setShowCityResults(true);
                                                    }
                                                }}
                                                placeholder="도시를 입력해주세요 (예: New York)"
                                                className="mt-2 h-[52px] w-full rounded-2xl bg-gray-100 px-4 text-sm outline-none"
                                            />
                                        )}

                                        {/* 검색 결과 */}
                                        {showCityResults && (
                                            <div className="absolute left-0 right-0 top-full z-30 mt-2 overflow-hidden rounded-2xl bg-white shadow-lg ring-1 ring-black/5">
                                                {isCitySearching ? (
                                                    <div className="px-4 py-4 text-sm text-gray-400">도시를 찾고 있어요...</div>
                                                ) : citySearchResults.length > 0 ? (
                                                    <div className="max-h-64 overflow-y-auto scrollbar-hide">
                                                        {citySearchResults.map((result) => (
                                                            <button
                                                                key={`${result.name}-${result.countryCode}`}
                                                                type="button"
                                                                onClick={() => handleCitySelect(result)}
                                                                className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition hover:bg-gray-50 active:bg-gray-100"
                                                            >
                                                                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gray-50 text-lg">
                                                                    {/* {countryCodeToFlag(result.countryCode)} */}
                                                                    <img
                                                                        src={`https://flagcdn.com/w40/${result.countryCode.toLowerCase()}.png`}
                                                                        alt={country}
                                                                        className="h-3 object-cover"
                                                                    />
                                                                </span>

                                                                <div className="min-w-0 flex-1">
                                                                    <p className="truncate text-sm font-medium text-gray-900">
                                                                        {result.name}
                                                                    </p>

                                                                    <p className="mt-0.5 truncate text-xs text-gray-400">
                                                                        {getCountryName(result.countryCode)}
                                                                    </p>
                                                                </div>

                                                                <span className="text-xs text-gray-300">→</span>
                                                            </button>
                                                        ))}
                                                    </div>
                                                ) : (
                                                    <div className="px-4 py-4 text-sm text-gray-400">
                                                        일치하는 도시를 찾지 못했어요.
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>

                                    {/* 날짜 */}
                                    <div>
                                        <p className="text-sm font-medium text-gray-700">여행 날짜</p>

                                        <div className="mt-2 grid grid-cols-2 gap-3">
                                            <input
                                                type="date"
                                                value={startDate}
                                                onChange={(e) => {
                                                    const value = e.target.value;

                                                    setStartDate(value);

                                                    // 기존 종료일이 새 시작일보다 빠르면 초기화
                                                    if (endDate && value > endDate) {
                                                        setEndDate("");
                                                    }
                                                }}
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
                                                min={
                                                    startDate ||
                                                    (tripType === "upcoming" ? new Date().toISOString().split("T")[0] : undefined)
                                                }
                                                max={
                                                    tripType === "completed"
                                                        ? new Date(Date.now() - 86400000).toISOString().split("T")[0]
                                                        : undefined
                                                }
                                                disabled={!startDate}
                                                className="w-full rounded-2xl bg-gray-100 px-4 py-4 text-sm outline-none disabled:cursor-not-allowed disabled:opacity-50"
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
                                    {tripType === "upcoming" && (
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
                                    )}

                                    {/* 평점 */}
                                    {tripType === "completed" && (
                                        <div>
                                            <p className="text-sm font-medium text-gray-700">여행 평점</p>

                                            <div className="mt-3 flex items-center gap-1">
                                                <div className="flex items-center">
                                                    {[1, 2, 3, 4, 5].map((star) => {
                                                        const isFull = rating >= star;
                                                        const isHalf = rating === star - 0.5;

                                                        return (
                                                            <div key={star} className="relative h-8 w-8">
                                                                {/* 기본 별 */}
                                                                <Star
                                                                    size={25}
                                                                    strokeWidth={1.7}
                                                                    className="absolute left-0 top-0 text-gray-200"
                                                                />

                                                                {/* 꽉 찬 별 */}
                                                                {isFull && (
                                                                    <Star
                                                                        size={25}
                                                                        strokeWidth={1.7}
                                                                        className="absolute left-0 top-0 fill-gray-900 text-gray-900"
                                                                    />
                                                                )}

                                                                {/* 0.5 별 */}
                                                                {isHalf && (
                                                                    <svg
                                                                        className="absolute left-0 top-0"
                                                                        width="25"
                                                                        height="25"
                                                                        viewBox="0 0 24 24"
                                                                    >
                                                                        <defs>
                                                                            <clipPath id={`half-star-${star}`}>
                                                                                <rect x="0" y="0" width="12" height="24" />
                                                                            </clipPath>
                                                                        </defs>

                                                                        <Star
                                                                            size={25}
                                                                            strokeWidth={1.7}
                                                                            className="fill-gray-900 text-gray-900"
                                                                            clipPath={`url(#half-star-${star})`}
                                                                        />
                                                                    </svg>
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

                                                resetTripForm();
                                                setAddStep("type");
                                            }}
                                            className="flex-1 rounded-2xl border border-gray-200 py-4 text-sm font-medium text-gray-700"
                                        >
                                            ← 돌아가기
                                        </button>

                                        <button
                                            type="button"
                                            onClick={async () => {
                                                if (!city || !country || !countryCode || !startDate || !endDate) {
                                                    alert("위치와 여행 정보를 모두 입력해주세요.");
                                                    return;
                                                }

                                                if (new Date(endDate) < new Date(startDate)) {
                                                    alert("여행 종료일은 시작일보다 빠를 수 없어요.");
                                                    return;
                                                }

                                                const newTrip = {
                                                    tripType,
                                                    title,
                                                    city,
                                                    country,
                                                    countryCode,
                                                    startDate,
                                                    endDate,
                                                    people: Number(people) || 1,
                                                    ...(tripType === "upcoming" ? { budget: Number(budget) || 0 } : {}),
                                                    rating: tripType === "completed" ? rating : 0,
                                                };

                                                try {
                                                    const response = await fetch("/api/trips", {
                                                        method: "POST",
                                                        headers: {
                                                            "Content-Type": "application/json",
                                                        },
                                                        body: JSON.stringify(newTrip),
                                                    });

                                                    if (!response.ok) {
                                                        throw new Error("여행 저장에 실패했습니다.");
                                                    }

                                                    const savedTrip: SavedTrip = await response.json();

                                                    setTrips((prev) => [...prev, savedTrip]);

                                                    resetTripForm();
                                                    setAddStep("type");
                                                    setSavedTrip(savedTrip);
                                                    setIsAddModalOpen(false);
                                                } catch (error) {
                                                    console.error(error);
                                                    alert("여행을 저장하지 못했어요.");
                                                }
                                            }}
                                            className="flex-1 rounded-2xl bg-black py-4 text-sm font-medium text-white"
                                        >
                                            저장하기
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
