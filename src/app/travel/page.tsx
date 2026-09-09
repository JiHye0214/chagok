"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Plane, CheckCircle2, Star, StarHalf } from "lucide-react";
import { formatDate } from "@/lib/payPeriod";
import TravelGlobe from "./TravelGlobe";

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
    totalExpense?: number;

    // 🌍 지도용 좌표
    latitude: number;
    longitude: number;
};

// 도시 검색
type CitySearchResult = {
    name: string;
    countryCode: string;
    latitude: number;
    longitude: number;
};

// 카테고리 통계
type ExpenseCategoryStat = {
    category: string;
    amount: number;
    percentage: number;
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

const formatCityName = (value: string) => {
    return value
        .trim()
        .toLowerCase()
        .split(/\s+/)
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(" ");
};

export default function TravelPage() {
    const typeRef = useRef<HTMLDivElement>(null);
    const formRef = useRef<HTMLDivElement>(null);
    const isSelectingCityRef = useRef(false);

    const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);

    const [isAddCityModalOpen, setIsAddCityModalOpen] = useState(false);
    const [newCityCountryCode, setNewCityCountryCode] = useState("");

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

    // 지구본
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

    // 화면에 들어왔을 때 애니메이션 시작
    const [isExpenseInView, setIsExpenseInView] = useState(false);
    const expenseSectionRef = useRef<HTMLElement | null>(null);

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

            const countries = Array.from(
                new Map(
                    completedTrips.map((trip) => [
                        trip.countryCode,
                        {
                            name: trip.country,
                            countryCode: trip.countryCode,
                        },
                    ]),
                ).values(),
            );

            if (countries.length === 0) {
                setCategoryData([]);
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

        setLatitude(result.latitude);
        setLongitude(result.longitude);

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
        setLatitude(null);
        setLongitude(null);

        setCitySearchResults([]);
        setShowCityResults(false);
    };

    // 여행 유형
    const upcomingTrips = trips
        .filter((trip) => trip.tripType === "upcoming")
        .sort((a, b) => {
            return new Date(a.startDate).getTime() - new Date(b.startDate).getTime();
        });
    const completedTrips = trips.filter((trip) => trip.tripType === "completed");

    const travelCountries = Array.from(
        completedTrips
            .reduce(
                (map, trip) => {
                    const existing = map.get(trip.countryCode);

                    if (existing) {
                        existing.count += 1;

                        if (!existing.cities.includes(trip.city)) {
                            existing.cities.push(trip.city);
                        }
                    } else {
                        map.set(trip.countryCode, {
                            countryCode: trip.countryCode,
                            name: trip.country,
                            cities: [trip.city],
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

    const worldTravelPercent = Math.round((traveledCountryCount / 195) * 100);

    const getNights = (startDate: string, endDate: string) => {
        const start = new Date(startDate);
        const end = new Date(endDate);

        return Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    };

    // 카테고리 통계
    const totalCompletedExpense = completedTrips.reduce((sum, trip) => sum + Number(trip.totalExpense ?? 0), 0);

    const averageTripExpense = completedTrips.length > 0 ? totalCompletedExpense / completedTrips.length : 0;

    // 최근 여행
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

    return (
        <div className="mx-auto max-w-md">
            {" "}
            {/* Header */}
            <header className="mt-5 mb-10">
                <p className="text-sm text-gray-500">차곡</p>

                <div className="mt-2 flex items-center justify-between">
                    <h1 className="text-3xl font-bold">여행</h1>

                    {/* 나중에 v2에서 하든지 말든지 */}
                    {/* <Link
                        href="/travel/settings"
                        className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-gray-500 shadow-sm"
                        aria-label="여행 설정"
                    >
                        ⚙
                    </Link> */}
                </div>

                <p className="mt-2 text-sm text-gray-500">여행을 위한 돈을 모으고, 여행 소비를 기록해보세요.</p>
            </header>
            {/* Travel Budget */}
            <section className="mt-8">
                <div className="relative overflow-hidden rounded-3xl bg-[#F3F0E8] p-5 transition-transform hover:-translate-y-0.5">
                    <div className="relative z-10">
                        <p className="text-sm text-gray-500">다음 여행까지</p>

                        <div className="mt-4 flex items-end justify-between">
                            <div>
                                <p className="text-3xl font-bold">$1,280</p>
                                <p className="mt-1 text-sm text-gray-400">$2,000 목표</p>
                            </div>

                            <p className="text-sm font-medium text-gray-500">64%</p>
                        </div>

                        <div className="mt-4 h-2 overflow-hidden rounded-full bg-black/5">
                            <div className="h-full rounded-full bg-gray-900" style={{ width: "64%" }} />
                        </div>

                        <p className="mt-4 text-sm text-gray-500">
                            $720 더 모으면 <span className="font-medium text-gray-900">New York</span>
                            으로 떠나요 ✈️
                        </p>
                    </div>

                    <div className="pointer-events-none absolute -bottom-8 -right-3 rotate-[-8deg] text-[100px] font-bold leading-none text-black/[0.04]">
                        ✈
                    </div>
                </div>
            </section>
            {/* Coming Soon */}
            {upcomingTrips.length > 0 &&
                (() => {
                    const upcomingTrip = [...upcomingTrips].sort(
                        (a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime(),
                    )[0];

                    return (
                        <section className="mt-6">
                            <Link href={`/travel/list/${upcomingTrip.id}`} className="group block">
                                <div className="relative overflow-hidden rounded-3xl bg-gray-900 p-5 text-white transition active:scale-[0.99]">
                                    <div className="relative z-10">
                                        <div className="flex items-center justify-between">
                                            <p className="text-sm text-gray-400">다음 여행</p>

                                            <span className="shrink-0 rounded-full bg-white/10 px-3 py-1 text-xs text-gray-400">
                                                D-
                                                {Math.max(
                                                    0,
                                                    Math.ceil(
                                                        (new Date(upcomingTrip.startDate).getTime() - Date.now()) /
                                                            (1000 * 60 * 60 * 24),
                                                    ),
                                                )}
                                            </span>
                                        </div>

                                        <div className="mt-4">
                                            <p className="text-3xl font-semibold tracking-tight">{upcomingTrip.city}</p>

                                            <p className="mt-2 text-sm text-gray-400">{upcomingTrip.country}</p>
                                        </div>

                                        <div className="mt-5 flex items-end justify-between gap-4">
                                            <p className="text-xs text-gray-500 sm:text-sm">
                                                {formatDate(new Date(upcomingTrip.startDate))} —{" "}
                                                {formatDate(new Date(upcomingTrip.endDate))}
                                            </p>
                                        </div>
                                    </div>

                                    <div className="pointer-events-none absolute -bottom-8 -right-4 text-[110px] leading-none opacity-10 sm:-bottom-10 sm:-right-5 sm:text-[140px]">
                                        {upcomingTrip.countryCode}
                                    </div>
                                </div>
                            </Link>
                        </section>
                    );
                })()}
            {/* Travel Statistics */}
            <section className="mt-6">
                {/* <h2 className="text-lg font-semibold">여행 통계</h2> */}

                {/* Travel Globe */}
                <div className="mt-4">
                    <TravelGlobe
                        trips={completedTrips
                            .filter((trip) => trip.latitude !== undefined && trip.longitude !== undefined)
                            .map((trip) => ({
                                city: trip.city,
                                country: trip.country,
                                countryCode: trip.countryCode,
                                latitude: trip.latitude as number,
                                longitude: trip.longitude as number,
                            }))}
                    />
                </div>
            </section>
            {/* Country Insight------------------------------------------------------------------------------------------- */}
            <section ref={expenseSectionRef} className="mt-6">
                <div className="block rounded-3xl bg-gray-900 p-5 text-white transition-transform hover:-translate-y-0.5">
                    <p className="text-sm text-gray-400">여행 소비 분석</p>

                    <p className="mt-4 text-xl font-semibold leading-relaxed">
                        나는 {expenseCountry.name || "여행"}에 가면
                        <br />
                        어디에 얼마나 쓸까?
                    </p>

                    {categoryData.length > 0 ? (
                        <div className="mt-7">
                            <div className="flex h-32 items-end gap-2">
                                {categoryData.map((item) => {
                                    const maxAmount = Math.max(...categoryData.map((category) => Number(category.amount)), 1);

                                    const height = Math.max(8, (Number(item.amount) / maxAmount) * 100);

                                    return (
                                        <div key={item.name} className="flex min-w-0 flex-1 flex-col items-center">
                                            <div className="flex h-24 w-full items-end justify-center">
                                                <div
                                                    className="w-full max-w-8 origin-bottom rounded-t-md bg-white/80 transition-transform duration-700 ease-out"
                                                    style={{
                                                        height: `${height}%`,
                                                        transform: isExpenseInView ? "scaleY(1)" : "scaleY(0)",
                                                    }}
                                                />
                                            </div>

                                            <p className="mt-2 w-full truncate text-center text-[11px] text-gray-400">
                                                {item.name}
                                            </p>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    ) : (
                        <div className="mt-7 flex h-32 items-center justify-center">
                            <p className="text-sm text-gray-500">아직 소비 기록이 없어요</p>
                        </div>
                    )}

                    <div className="mt-7">
                        <p className="text-sm text-gray-400">1박 평균</p>

                        <p className="mt-1 text-3xl font-semibold tracking-tight">
                            {expenseAnalysis.averagePerNight > 0
                                ? `$${Math.round(expenseAnalysis.averagePerNight).toLocaleString()}`
                                : "-"}
                            <span className="ml-1 text-base font-normal text-gray-400">{expenseAnalysis.currency}</span>
                        </p>
                    </div>

                    {categoryData.length > 0 ? (
                        <p className="mt-4 text-sm leading-relaxed text-gray-300">
                            나는 <span className="font-medium text-white">{categoryData[0].name}</span>
                            에 가장 많이 쓰는
                            <br />
                            여행자예요.
                        </p>
                    ) : (
                        <p className="mt-4 text-sm leading-relaxed text-gray-400">
                            여행 소비를 기록하면
                            <br />
                            나만의 소비 패턴을 알려드릴게요.
                        </p>
                    )}

                    {/* <div className="mt-5 flex items-center justify-between">
                        <span className="text-xs text-gray-500">전체 여행 소비 분석</span>

                        <span className="text-sm text-gray-300">→</span>
                    </div> */}
                </div>
            </section>
        </div>
    );
}
