"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { formatDate } from "@/lib/payPeriod";
import TravelGlobe from "./TravelGlobe";
import { Lock, NotebookTabs } from "lucide-react";

type TripCity = {
    id?: number;
    city: string;
    latitude?: number | null;
    longitude?: number | null;
};

type TripDestination = {
    id?: number;
    country: string;
    countryCode: string;
    cities: TripCity[];
};

type SavedTrip = {
    id: number;
    tripType: "upcoming" | "completed";
    title: string | null;

    // 기존 필드
    city: string;
    country: string;
    countryCode: string;

    // 다중 국가 / 다중 도시
    destinations?: TripDestination[];

    startDate: string;
    endDate: string;
    people: number;
    budget?: number;
    currency?: string;
    rating: number;
    totalExpense?: number;

    // 기존 지도용 좌표
    latitude?: number | null;
    longitude?: number | null;
};

// 도시 검색
type CitySearchResult = {
    name: string;
    countryCode: string;
    latitude: number;
    longitude: number;
};

// --------------------------------------------------
// Destination helpers
// --------------------------------------------------

const normalizeDestinations = (trip: SavedTrip): TripDestination[] => {
    if (trip.destinations?.length) {
        return trip.destinations.map((destination) => ({
            ...destination,
            cities: destination.cities ?? [],
        }));
    }

    // 기존 데이터 호환
    if (trip.city && trip.countryCode) {
        return [
            {
                country: trip.country,
                countryCode: trip.countryCode,
                cities: [
                    {
                        city: trip.city,
                        latitude: trip.latitude ?? null,
                        longitude: trip.longitude ?? null,
                    },
                ],
            },
        ];
    }

    return [];
};

const getFirstCity = (trip: SavedTrip) => {
    return trip.destinations?.[0]?.cities?.[0]?.city ?? trip.city;
};

const getDestinationLabel = (trip: SavedTrip) => {
    const destinations = normalizeDestinations(trip);

    if (destinations.length === 0) {
        return trip.city;
    }

    return destinations
        .map((destination) => {
            const cities = destination.cities.map((city) => city.city).join(", ");

            if (!cities) {
                return destination.country;
            }

            return cities;
        })
        .join(" · ");
};

const formatCityName = (value: string) => {
    return value
        .trim()
        .toLowerCase()
        .split(/\s+/)
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(" ");
};

export default function TravelPage() {
    const isSelectingCityRef = useRef(false);

    const [isAddModalOpen] = useState(false);
    const [isAddCityModalOpen] = useState(false);

    const [tripType] = useState<"upcoming" | "completed">("upcoming");
    const [addStep] = useState<"type" | "form">("type");

    const [city, setCity] = useState("");

    const [title, setTitle] = useState("");
    const [startDate, setStartDate] = useState("");
    const [endDate, setEndDate] = useState("");
    const [people, setPeople] = useState("1");
    const [budget, setBudget] = useState("");
    const [rating, setRating] = useState(0);

    const [savedTrip] = useState<SavedTrip | null>(null);

    const [citySearchResults, setCitySearchResults] = useState<CitySearchResult[]>([]);
    const [isCitySearching, setIsCitySearching] = useState(false);
    const [showCityResults, setShowCityResults] = useState(false);

    const [trips, setTrips] = useState<SavedTrip[]>([]);
    const [isTripsLoading, setIsTripsLoading] = useState(true);

    const [planCode, setPlanCode] = useState<"free" | "pro">("free");

    const [latitude, setLatitude] = useState<number | null>(null);
    const [longitude, setLongitude] = useState<number | null>(null);

    // 카테고리 통계
    const [categoryData, setCategoryData] = useState<
        {
            name: string;
            value: number;
            amount: number;
        }[]
    >([]);

    const [expenseCountry, setExpenseCountry] = useState<{
        name: string;
        countryCode: string;
    }>({
        name: "",
        countryCode: "",
    });

    const [expenseAnalysis, setExpenseAnalysis] = useState<{
        averagePerNight: number;
        currency: string;
    }>({
        averagePerNight: 0,
        currency: "CAD",
    });

    const [isExpenseInView, setIsExpenseInView] = useState(false);
    const expenseSectionRef = useRef<HTMLElement | null>(null);

    // --------------------------------------------------
    // 소비 분석 영역 진입 애니메이션
    // --------------------------------------------------

    useEffect(() => {
        if (categoryData.length === 0) return;

        const element = expenseSectionRef.current;

        if (!element) return;

        const observer = new IntersectionObserver(
            ([entry]) => {
                if (entry.isIntersecting) {
                    setIsExpenseInView(true);
                    observer.disconnect();
                }
            },
            {
                threshold: 0.2,
            },
        );

        observer.observe(element);

        return () => observer.disconnect();
    }, [categoryData.length]);

    // --------------------------------------------------
    // 도시 검색 API
    // --------------------------------------------------

    useEffect(() => {
        const keyword = city.trim();

        if (isSelectingCityRef.current) {
            isSelectingCityRef.current = false;
            return;
        }

        if (keyword.length < 2) {
            setCitySearchResults([]);
            setShowCityResults(false);
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

    // --------------------------------------------------
    // 여행 목록
    // --------------------------------------------------

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

    // --------------------------------------------------
    // premium user
    // --------------------------------------------------

    useEffect(() => {
        const fetchPlan = async () => {
            try {
                const response = await fetch("/api/auth/me");

                if (!response.ok) {
                    return;
                }

                const data = await response.json();

                setPlanCode(data.planCode === "pro" ? "pro" : "free");
            } catch (error) {
                console.error("플랜 정보 조회 실패:", error);
            }
        };

        fetchPlan();
    }, []);

    // --------------------------------------------------
    // 국가별 소비 통계
    // --------------------------------------------------

    useEffect(() => {
        const fetchCategoryStats = async () => {
            const completedTrips = trips.filter((trip) => trip.tripType === "completed");

            if (completedTrips.length === 0) {
                setCategoryData([]);
                setExpenseCountry({
                    name: "",
                    countryCode: "",
                });
                return;
            }

            // 다중 destination에서 국가를 모두 수집
            const countries = Array.from(
                completedTrips
                    .flatMap((trip) => normalizeDestinations(trip))
                    .reduce(
                        (map, destination) => {
                            if (!map.has(destination.countryCode)) {
                                map.set(destination.countryCode, {
                                    name: destination.country,
                                    countryCode: destination.countryCode,
                                });
                            }

                            return map;
                        },
                        new Map<
                            string,
                            {
                                name: string;
                                countryCode: string;
                            }
                        >(),
                    )
                    .values(),
            );

            if (countries.length === 0) {
                setCategoryData([]);
                setExpenseCountry({
                    name: "",
                    countryCode: "",
                });
                return;
            }

            const randomCountry = countries[Math.floor(Math.random() * countries.length)];

            setExpenseCountry(randomCountry);

            try {
                const response = await fetch(
                    `/api/trips/stats/expense-country?countryCode=${encodeURIComponent(randomCountry.countryCode)}`,
                );

                if (!response.ok) {
                    throw new Error("국가별 소비 통계를 불러오지 못했습니다.");
                }

                const data = await response.json();

                setCategoryData(
                    (data.categories ?? []).map((item: { category: string; amount: number; percentage: number }) => ({
                        name: item.category,
                        value: Number(item.percentage),
                        amount: Number(item.amount),
                    })),
                );

                setExpenseAnalysis({
                    averagePerNight: Number(data.summary?.averagePerNight ?? 0),
                    currency: data.currency || "CAD",
                });
            } catch (error) {
                console.error("국가별 소비 통계 조회 실패:", error);

                setCategoryData([]);
            }
        };

        fetchCategoryStats();
    }, [trips]);

    // --------------------------------------------------
    // 국가 정보
    // --------------------------------------------------

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

    // --------------------------------------------------
    // 도시 선택
    // --------------------------------------------------

    const handleCitySelect = async (result: CitySearchResult) => {
        isSelectingCityRef.current = true;

        setCity(result.name);
        setCountryCode(result.countryCode);

        setLatitude(result.latitude);
        setLongitude(result.longitude);

        setShowCityResults(false);
        setCitySearchResults([]);

        const countryInfo = await getCountryInfo(result.countryCode);

        setCountry(countryInfo.name);
    };

    // --------------------------------------------------
    // 폼 초기화
    // --------------------------------------------------

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
        setLatitude(null);
        setLongitude(null);

        setCitySearchResults([]);
        setShowCityResults(false);
    };

    // --------------------------------------------------
    // 여행 유형
    // --------------------------------------------------

    const upcomingTrips = trips
        .filter((trip) => trip.tripType === "upcoming")
        .sort((a, b) => {
            return new Date(a.startDate).getTime() - new Date(b.startDate).getTime();
        });

    const completedTrips = trips.filter((trip) => trip.tripType === "completed");

    // --------------------------------------------------
    // 방문 국가 / 도시 통계
    // --------------------------------------------------

    const travelCountries = Array.from(
        completedTrips
            .flatMap((trip) => normalizeDestinations(trip))
            .reduce(
                (map, destination) => {
                    const existing = map.get(destination.countryCode);

                    const cities = destination.cities.map((city) => city.city).filter(Boolean);

                    if (existing) {
                        existing.count += 1;

                        cities.forEach((city) => {
                            if (!existing.cities.includes(city)) {
                                existing.cities.push(city);
                            }
                        });
                    } else {
                        map.set(destination.countryCode, {
                            countryCode: destination.countryCode,
                            name: destination.country,
                            cities,
                            count: 1,
                        });
                    }

                    return map;
                },
                new Map<
                    string,
                    {
                        countryCode: string;
                        name: string;
                        cities: string[];
                        count: number;
                    }
                >(),
            )
            .values(),
    );

    const traveledCountryCount = travelCountries.length;

    const traveledCityCount = Array.from(
        new Set(
            completedTrips.flatMap((trip) =>
                normalizeDestinations(trip).flatMap((destination) =>
                    destination.cities.map((city) => `${destination.countryCode}:${city.city}`),
                ),
            ),
        ),
    ).length;

    const worldTravelPercent = Math.round((traveledCountryCount / 195) * 100);

    // --------------------------------------------------
    // 여행 비용 통계
    // --------------------------------------------------

    const totalCompletedExpense = completedTrips.reduce((sum, trip) => sum + Number(trip.totalExpense ?? 0), 0);

    const averageTripExpense = completedTrips.length > 0 ? totalCompletedExpense / completedTrips.length : 0;

    // --------------------------------------------------
    // 최근 여행
    // --------------------------------------------------

    const recentCompletedTrips = [...completedTrips]
        .sort((a, b) => {
            return new Date(b.endDate).getTime() - new Date(a.endDate).getTime();
        })
        .slice(0, 3);

    if (isTripsLoading) {
        return (
            <div className="flex h-[calc(100vh-152px)] items-center justify-center">
                <p className="text-sm text-gray-400">여행 기록을 불러오는 중...</p>
            </div>
        );
    }

    // --------------------------------------------------
    // 지구본용 도시 데이터
    // --------------------------------------------------

    const globeTrips = completedTrips.flatMap((trip) => {
        const destinations = normalizeDestinations(trip);

        return destinations.flatMap((destination) =>
            destination.cities
                .filter((city) => city.latitude != null && city.longitude != null)
                .map((city) => ({
                    city: city.city,
                    country: destination.country,
                    countryCode: destination.countryCode,
                    latitude: Number(city.latitude),
                    longitude: Number(city.longitude),
                })),
        );
    });

    return (
        <div className="mx-auto max-w-md">
            {/* Header */}
            <header className="mt-5 mb-8">
                <p className="text-sm text-gray-500">Chagok</p>

                <div className="mt-2 flex items-center justify-between">
                    <h1 className="text-3xl font-bold tracking-tight text-gray-900">Travel</h1>

                    <Link
                        href="/travel/list"
                        className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-gray-500 shadow-sm transition hover:bg-gray-50"
                        aria-label="Travel records"
                    >
                        <NotebookTabs size={18} strokeWidth={1.8} />
                    </Link>
                </div>

                <p className="mt-2 text-sm leading-relaxed text-gray-500">
                    Save money for your trips and track your travel spending.
                </p>
            </header>

            {/* --------------------------------------------------
        Travel Budget 
        -------------------------------------------------- */}
            <section>
                <div className="rounded-3xl bg-white p-5 shadow-sm">
                    <div className="flex items-start justify-between">
                        <div>
                            <p className="text-xs text-gray-400">Travel Fund</p>

                            <p className="mt-1 text-lg font-bold text-gray-900">Until Your Next Trip</p>
                        </div>

                        <span className="rounded-full bg-gray-100 px-3 py-2 text-xs font-medium text-gray-600">64%</span>
                    </div>

                    <div className="mt-5">
                        <p className="text-3xl font-bold tracking-tight text-gray-900">$1,280</p>

                        <p className="mt-1 text-sm text-gray-400">$2,000 goal</p>
                    </div>

                    <div className="mt-4 h-2 overflow-hidden rounded-full bg-gray-100">
                        <div className="h-full rounded-full bg-gray-900" style={{ width: "64%" }} />
                    </div>

                    <div className="mt-4 flex items-center justify-between">
                        <p className="text-xs text-gray-400">$720 to go</p>

                        <p className="text-xs font-medium text-gray-700">New York ✈️</p>
                    </div>
                </div>
            </section>

            {/* Next Trip */}
            {upcomingTrips.length > 0 &&
                (() => {
                    const upcomingTrip = [...upcomingTrips].sort(
                        (a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime(),
                    )[0];

                    return (
                        <section className="mt-7">
                            <Link href={`/travel/list/${upcomingTrip.id}`} className="block">
                                <div className="group overflow-hidden rounded-3xl bg-white shadow-sm transition">
                                    <div className="flex items-center justify-between px-5 py-4">
                                        <div className="min-w-0">
                                            <div className="flex items-center gap-2">
                                                <p className="text-xs font-medium text-blue-500">NEXT TRIP</p>

                                                <span className="h-1 w-1 rounded-full bg-gray-300" />

                                                <p className="text-xs text-gray-400">
                                                    {formatDate(new Date(upcomingTrip.startDate))}
                                                </p>
                                            </div>

                                            <p className="mt-2 truncate text-lg font-bold text-gray-950">
                                                {getDestinationLabel(upcomingTrip)}
                                            </p>

                                            <p className="mt-0.5 text-sm text-gray-500">
                                                {normalizeDestinations(upcomingTrip)
                                                    .map((destination) => destination.country)
                                                    .filter((value, index, array) => array.indexOf(value) === index)
                                                    .join(" · ")}
                                            </p>
                                        </div>

                                        <div className="ml-4 flex shrink-0 flex-col items-end">
                                            <span className="text-2xl font-bold tracking-tight text-gray-950">
                                                D-
                                                {Math.max(
                                                    0,
                                                    Math.ceil(
                                                        (new Date(upcomingTrip.startDate).getTime() - Date.now()) /
                                                            (1000 * 60 * 60 * 24),
                                                    ),
                                                )}
                                            </span>

                                            <span className="mt-1 text-[11px] text-gray-400">Until departure</span>
                                        </div>
                                    </div>

                                    <div className="flex items-center justify-between border-t border-gray-100 bg-gray-50/70 px-5 py-3">
                                        <p className="text-xs text-gray-500">
                                            {formatDate(new Date(upcomingTrip.startDate))} —{" "}
                                            {formatDate(new Date(upcomingTrip.endDate))}
                                        </p>

                                        <span className="text-xs font-medium text-gray-400 transition group-hover:text-gray-700">
                                            View →
                                        </span>
                                    </div>
                                </div>
                            </Link>
                        </section>
                    );
                })()}

            {/* --------------------------------------------------
        Travel Statistics
        -------------------------------------------------- */}
            <section className="mt-6">
                <div className="mt-4">
                    {planCode === "pro" ? (
                        <TravelGlobe trips={globeTrips} />
                    ) : (
                        <div className="relative overflow-hidden rounded-3xl bg-white shadow-sm">
                            <div className="h-[360px] opacity-20 blur-[2px]">
                                <TravelGlobe trips={globeTrips} />
                            </div>

                            <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/70">
                                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gray-100">
                                    <Lock size={20} strokeWidth={2} className="text-gray-500" />
                                </div>

                                <p className="mt-4 text-sm font-semibold text-gray-900">Travel Statistics</p>

                                <p className="mt-1 text-xs text-gray-500">Pro에서 여행 통계를 확인할 수 있어요.</p>
                            </div>
                        </div>
                    )}
                </div>
            </section>

            {/* --------------------------------------------------
    Travel Spending
    -------------------------------------------------- */}
            <section ref={expenseSectionRef} className="mt-6">
                {planCode === "pro" ? (
                    <div className="rounded-3xl bg-white p-5 shadow-sm">
                        <div className="flex items-start justify-between">
                            <div>
                                <p className="text-xs text-gray-400">Travel Spending Analysis</p>

                                <h2 className="mt-1 text-lg font-bold text-gray-900">Spending Patterns</h2>
                            </div>

                            {expenseCountry.name && (
                                <span className="rounded-full bg-gray-100 px-3 py-2 text-xs font-medium text-gray-500">
                                    {expenseCountry.name}
                                </span>
                            )}
                        </div>

                        <p className="mt-5 text-base font-medium leading-relaxed text-gray-700">
                            When I travel to {expenseCountry.name || "a destination"},
                            <br />
                            where do I spend the most?
                        </p>

                        {categoryData.length > 0 ? (
                            <div className="mt-7">
                                <div className="flex h-40 items-end gap-3">
                                    {categoryData.map((item) => {
                                        const maxAmount = Math.max(...categoryData.map((category) => Number(category.amount)), 1);

                                        const height = Math.max(8, (Number(item.amount) / maxAmount) * 100);

                                        return (
                                            <div key={item.name} className="flex min-w-0 flex-1 flex-col items-center">
                                                <div className="flex h-32 w-full flex-col items-center justify-end">
                                                    <div className="flex h-24 w-full items-end justify-center">
                                                        <div
                                                            className="w-full max-w-9 origin-bottom rounded-t-lg bg-gray-900 transition-transform duration-700 ease-out"
                                                            style={{
                                                                height: `${height}%`,
                                                                transform: isExpenseInView ? "scaleY(1)" : "scaleY(0)",
                                                            }}
                                                        />
                                                    </div>
                                                </div>

                                                <p className="mt-3 w-full truncate text-center text-[11px] font-medium text-gray-500">
                                                    {item.name}
                                                </p>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        ) : (
                            <div className="mt-7 flex h-32 items-center justify-center rounded-2xl bg-gray-50">
                                <p className="text-sm text-gray-400">No spending records yet</p>
                            </div>
                        )}

                        <div className="mt-7 border-t border-gray-100 pt-5">
                            <p className="text-xs text-gray-400">Average per night</p>

                            <p className="mt-1 text-3xl font-bold tracking-tight text-gray-900">
                                {expenseAnalysis.averagePerNight > 0
                                    ? `$${Math.round(expenseAnalysis.averagePerNight).toLocaleString()}`
                                    : "-"}
                                <span className="ml-1 text-base font-normal text-gray-400">{expenseAnalysis.currency}</span>
                            </p>
                        </div>

                        {categoryData.length > 0 ? (
                            <p className="mt-4 text-sm leading-relaxed text-gray-500">
                                I spend the most on <span className="font-medium text-gray-900">{categoryData[0].name}</span>
                                <br />
                                when I travel.
                            </p>
                        ) : (
                            <p className="mt-4 text-sm leading-relaxed text-gray-400">
                                Record your travel spending
                                <br />
                                to discover your spending patterns.
                            </p>
                        )}
                    </div>
                ) : (
                    <div className="relative overflow-hidden rounded-3xl bg-white shadow-sm">
                        {/* 잠긴 통계 미리보기 */}
                        <div className="pointer-events-none select-none blur-[2px] opacity-30">
                            <div className="p-5">
                                <div className="flex items-start justify-between">
                                    <div>
                                        <p className="text-xs text-gray-400">Travel Spending Analysis</p>

                                        <h2 className="mt-1 text-lg font-bold text-gray-900">Spending Patterns</h2>
                                    </div>

                                    <span className="rounded-full bg-gray-100 px-3 py-2 text-xs font-medium text-gray-500">
                                        United States
                                    </span>
                                </div>

                                <p className="mt-5 text-base font-medium leading-relaxed text-gray-700">
                                    When I travel to a destination,
                                    <br />
                                    where do I spend the most?
                                </p>

                                <div className="mt-7">
                                    <div className="flex h-40 items-end gap-3">
                                        {[45, 70, 55, 85, 60].map((height, index) => (
                                            <div key={index} className="flex min-w-0 flex-1 flex-col items-center">
                                                <div className="flex h-32 w-full flex-col items-center justify-end">
                                                    <div className="flex h-24 w-full items-end justify-center">
                                                        <div
                                                            className="w-full max-w-9 rounded-t-lg bg-gray-900"
                                                            style={{
                                                                height: `${height}%`,
                                                            }}
                                                        />
                                                    </div>
                                                </div>

                                                <p className="mt-3 w-full truncate text-center text-[11px] font-medium text-gray-500">
                                                    Category
                                                </p>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                <div className="mt-7 border-t border-gray-100 pt-5">
                                    <p className="text-xs text-gray-400">Average per night</p>

                                    <p className="mt-1 text-3xl font-bold tracking-tight text-gray-900">
                                        $120
                                        <span className="ml-1 text-base font-normal text-gray-400">USD</span>
                                    </p>
                                </div>

                                <p className="mt-4 text-sm leading-relaxed text-gray-500">
                                    I spend the most on Category
                                    <br />
                                    when I travel.
                                </p>
                            </div>
                        </div>

                        {/* 잠금 안내 */}
                        <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/65">
                            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gray-100">
                                <Lock size={20} strokeWidth={2} className="text-gray-500" />
                            </div>

                            <p className="mt-4 text-sm font-semibold text-gray-900">Travel Spending Analysis</p>

                            <p className="mt-1 text-xs text-gray-500">Pro에서 여행 지출 통계를 확인할 수 있어요.</p>
                        </div>
                    </div>
                )}
            </section>
        </div>
    );
}
