"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
    Star,
    Plane,
    Hotel,
    Utensils,
    TrainFront,
    ShoppingBag,
    MoreHorizontal,
    ArrowLeft,
    Plus,
    GripVertical,
    Pencil,
    Trash2,
    Check,
    X,
} from "lucide-react";
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

type ExpenseCategory = {
    id: number;
    trip_id: number;
    name: string;
    sort_order: number;
};

const getNights = (startDate: string, endDate: string) => {
    const start = new Date(startDate);
    const end = new Date(endDate);

    return Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
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

const formatCityName = (value: string) => {
    return value
        .trim()
        .toLowerCase()
        .split(/\s+/)
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(" ");
};

const getDateKey = (date: Date) => {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
};

const calculateExpression = (value: string) => {
    if (!value.trim()) {
        return 0;
    }

    try {
        const safeExpression = value
            .replace(/×/g, "*")
            .replace(/÷/g, "/")
            .replace(/,/g, "")
            .replace(/[^0-9+\-*/().\s]/g, "");

        if (!safeExpression.trim()) {
            return 0;
        }

        const result = Function(`"use strict"; return (${safeExpression})`)();

        if (typeof result !== "number" || !Number.isFinite(result)) {
            return 0;
        }

        return Math.max(0, Number(result.toFixed(2)));
    } catch {
        return 0;
    }
};

export default function TravelDetailPage() {
    const isCityInputChangedRef = useRef(false);
    const params = useParams();

    const [trip, setTrip] = useState<SavedTrip | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    // 상세 수정
    const [isEditingTrip, setIsEditingTrip] = useState(false);
    const [isSavingTrip, setIsSavingTrip] = useState(false);

    const [editTitle, setEditTitle] = useState("");
    const [editStartDate, setEditStartDate] = useState("");
    const [editEndDate, setEditEndDate] = useState("");
    const [editPeople, setEditPeople] = useState("1");
    const [editCity, setEditCity] = useState("");
    const [editRating, setEditRating] = useState<number>(0);

    const [expenseCells, setExpenseCells] = useState<Record<string, string>>({});
    const [selectedCell, setSelectedCell] = useState<string | null>(null);

    const [categories, setCategories] = useState<ExpenseCategory[]>([]);
    const [isCategoryLoading, setIsCategoryLoading] = useState(false);

    // 도시 검색
    const isSelectingCityRef = useRef(false);

    const [editCountry, setEditCountry] = useState("");
    const [editCountryCode, setEditCountryCode] = useState("");

    const [editCitySearchResults, setEditCitySearchResults] = useState<CitySearchResult[]>([]);
    const [showEditCityResults, setShowEditCityResults] = useState(false);
    const [isEditCitySearching, setIsEditCitySearching] = useState(false);
    const [isAddEditCityModalOpen, setIsAddEditCityModalOpen] = useState(false);
    const [editNewCityCountryCode, setEditNewCityCountryCode] = useState("");

    const [editLatitude, setEditLatitude] = useState<number | null>(null);
    const [editLongitude, setEditLongitude] = useState<number | null>(null);

    // 카테고리 드래그앤드랍
    const [draggedCategoryId, setDraggedCategoryId] = useState<number | null>(null);
    const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(null);
    const [newCategoryId, setNewCategoryId] = useState<number | null>(null);

    // 통계 모션
    const [displayCategoryIndex, setDisplayCategoryIndex] = useState(0);
    const [animatedAmount, setAnimatedAmount] = useState(0);
    const [animatedPercentage, setAnimatedPercentage] = useState(0);

    useEffect(() => {
        const fetchTrip = async () => {
            if (!params.id) {
                setIsLoading(false);
                return;
            }

            try {
                const response = await fetch("/api/trips");

                if (!response.ok) {
                    throw new Error("여행 목록 조회 실패");
                }

                const allTrips: SavedTrip[] = await response.json();

                const foundTrip = allTrips.find((trip) => String(trip.id) === String(params.id));

                setTrip(foundTrip ?? null);

                if (foundTrip) {
                    setEditTitle(foundTrip.title ?? "");
                    setEditStartDate(foundTrip.startDate.slice(0, 10));
                    setEditEndDate(foundTrip.endDate.slice(0, 10));
                    setEditPeople(String(foundTrip.people));
                    setEditRating(Number(foundTrip.rating) || 0);

                    setEditCity(foundTrip.city);
                    setEditCountry(foundTrip.country);
                    setEditCountryCode(foundTrip.countryCode);

                    setEditLatitude(Number(foundTrip.latitude) || null);
                    setEditLongitude(Number(foundTrip.longitude) || null);
                }
            } catch (error) {
                console.error("여행 데이터를 불러오지 못했습니다.", error);
                setTrip(null);
            } finally {
                setIsLoading(false);
            }
        };

        fetchTrip();
    }, [params.id]);

    useEffect(() => {
        const loadExpenses = async () => {
            if (!trip?.id) {
                return;
            }

            try {
                const response = await fetch(`/api/trips/${trip.id}/expenses`);

                if (!response.ok) {
                    throw new Error("여행 경비 조회 실패");
                }

                const expenses = await response.json();

                const cells: Record<string, string> = {};

                expenses.forEach((expense: { expense_date: string; category_id: number; expression: string }) => {
                    const key = `${expense.category_id}_${expense.expense_date.slice(0, 10)}`;

                    cells[key] = expense.expression;
                });

                setExpenseCells(cells);
            } catch (error) {
                console.error("여행 경비를 불러오지 못했습니다.", error);
            }
        };

        loadExpenses();
    }, [trip?.id]);

    useEffect(() => {
        const loadCategories = async () => {
            if (!trip?.id) return;

            setIsCategoryLoading(true);

            try {
                const response = await fetch(`/api/trips/${trip.id}/expense-categories`);

                if (!response.ok) {
                    throw new Error("카테고리 조회 실패");
                }

                const data: ExpenseCategory[] = await response.json();

                // 기존 카테고리가 하나도 없는 여행이면 기본 카테고리 생성
                if (data.length === 0) {
                    const defaultCategories = ["항공", "숙소", "식비", "교통", "쇼핑", "기타"];

                    const createdCategories: ExpenseCategory[] = [];

                    for (const [index, name] of defaultCategories.entries()) {
                        const createResponse = await fetch(`/api/trips/${trip.id}/expense-categories`, {
                            method: "POST",
                            headers: {
                                "Content-Type": "application/json",
                            },
                            body: JSON.stringify({
                                name,
                            }),
                        });

                        if (!createResponse.ok) {
                            throw new Error("기본 카테고리 생성 실패");
                        }

                        const category: ExpenseCategory = await createResponse.json();

                        createdCategories.push({
                            ...category,
                            sort_order: index,
                        });
                    }

                    setCategories(createdCategories);
                } else {
                    setCategories(data);
                }
            } catch (error) {
                console.error("여행 경비 카테고리를 불러오지 못했습니다.", error);
            } finally {
                setIsCategoryLoading(false);
            }
        };

        loadCategories();
    }, [trip?.id]);

    // 위치 검색 API - 여행 정보 수정
    useEffect(() => {
        const keyword = editCity.trim();

        if (!isEditingTrip || isAddEditCityModalOpen || !isCityInputChangedRef.current) {
            setEditCitySearchResults([]);
            setShowEditCityResults(false);
            return;
        }

        if (keyword.length < 2) {
            setEditCitySearchResults([]);
            setShowEditCityResults(false);
            return;
        }

        const timer = window.setTimeout(async () => {
            try {
                setIsEditCitySearching(true);

                const response = await fetch(`https://countries.dev/cities?q=${encodeURIComponent(keyword)}&limit=8`);

                if (!response.ok) {
                    throw new Error("도시 검색에 실패했습니다.");
                }

                const data: CitySearchResult[] = await response.json();

                setEditCitySearchResults(data);
                setShowEditCityResults(true);
            } catch (error) {
                console.error("도시 검색 오류:", error);
                setEditCitySearchResults([]);
            } finally {
                setIsEditCitySearching(false);
            }
        }, 400);

        return () => {
            window.clearTimeout(timer);
        };
    }, [editCity, isEditingTrip, isAddEditCityModalOpen]);

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

    const handleEditCitySelect = async (result: CitySearchResult) => {
        setEditCity(result.name);
        setEditCountryCode(result.countryCode);

        setEditLatitude(result.latitude);
        setEditLongitude(result.longitude);

        setShowEditCityResults(false);
        setEditCitySearchResults([]);

        const countryInfo = await getCountryInfo(result.countryCode);

        setEditCountry(countryInfo.name);
    };

    useEffect(() => {
        if (categories.length <= 1) return;

        const interval = setInterval(() => {
            setDisplayCategoryIndex((prev) => (prev + 1) % categories.length);
        }, 3000);

        return () => clearInterval(interval);
    }, [categories.length]);

    const categoryIcons = {
        항공: Plane,
        숙소: Hotel,
        식비: Utensils,
        교통: TrainFront,
        쇼핑: ShoppingBag,
        기타: MoreHorizontal,
    };

    const tripDates = (() => {
        const dates: Date[] = [];

        const start = new Date(trip?.startDate ?? "");
        const end = new Date(trip?.endDate ?? "");

        if (!trip || Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
            return dates;
        }

        const current = new Date(start);

        while (current <= end) {
            dates.push(new Date(current));
            current.setDate(current.getDate() + 1);
        }

        return dates;
    })();

    const getCellKey = (categoryId: number, date: Date) => {
        return `${categoryId}_${getDateKey(date)}`;
    };

    const getCellAmount = (categoryId: number, date: Date) => {
        const key = getCellKey(categoryId, date);

        return calculateExpression(expenseCells[key] ?? "");
    };

    const getCategoryTotal = (categoryId: number) => {
        return tripDates.reduce((total, date) => {
            return total + getCellAmount(categoryId, date);
        }, 0);
    };

    const getDateTotal = (date: Date) => {
        return categories.reduce((total, category) => {
            return total + getCellAmount(category.id, date);
        }, 0);
    };

    const totalExpense = tripDates.reduce((total, date) => {
        return total + getDateTotal(date);
    }, 0);

    const sortedCategories = [...categories]
        .filter((category) => getCategoryTotal(category.id) > 0)
        .sort((a, b) => getCategoryTotal(b.id) - getCategoryTotal(a.id));

    const displayCategory = sortedCategories[displayCategoryIndex];

    const displayCategoryAmount = displayCategory ? getCategoryTotal(displayCategory.id) : 0;

    const displayCategoryPercentage = totalExpense > 0 ? (displayCategoryAmount / totalExpense) * 100 : 0;

    useEffect(() => {
        const startAmount = animatedAmount;
        const startPercentage = animatedPercentage;

        const targetAmount = displayCategoryAmount;
        const targetPercentage = displayCategoryPercentage;

        const duration = 650;
        const startTime = performance.now();

        let animationFrame: number;

        const animate = (currentTime: number) => {
            const progress = Math.min((currentTime - startTime) / duration, 1);

            const eased = 1 - Math.pow(1 - progress, 3);

            setAnimatedAmount(startAmount + (targetAmount - startAmount) * eased);

            setAnimatedPercentage(startPercentage + (targetPercentage - startPercentage) * eased);

            if (progress < 1) {
                animationFrame = requestAnimationFrame(animate);
            }
        };

        animationFrame = requestAnimationFrame(animate);

        return () => {
            cancelAnimationFrame(animationFrame);
        };
    }, [displayCategoryIndex, displayCategoryAmount, displayCategoryPercentage]);

    if (isLoading) {
        return (
            <div className="flex h-[calc(100vh-152px)] items-center justify-center">
                <p className="text-sm text-gray-400">여행 기록을 불러오는 중...</p>
            </div>
        );
    }

    if (!trip) {
        return (
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
        );
    }

    const nights = getNights(trip.startDate, trip.endDate);

    const displayTitle = trip.title?.trim() || trip.city;

    const handleCellChange = (categoryId: number, date: Date, value: string) => {
        const key = getCellKey(categoryId, date);

        setExpenseCells((prev) => ({
            ...prev,
            [key]: value,
        }));
    };

    const handleStartEditTrip = () => {
        if (!trip) return;

        isCityInputChangedRef.current = false;

        setEditTitle(trip.title ?? "");
        setEditStartDate(trip.startDate.slice(0, 10));
        setEditEndDate(trip.endDate.slice(0, 10));
        setEditPeople(String(trip.people));
        setEditCity(trip.city);
        setEditRating(Number(trip.rating) || 0);

        setIsEditingTrip(true);

        setEditCountry(trip.country);
        setEditCountryCode(trip.countryCode);
        setEditLatitude(Number(trip.latitude) || null);
        setEditLongitude(Number(trip.longitude) || null);
    };

    const handleCancelEditTrip = () => {
        if (!trip) return;

        setEditTitle(trip.title ?? "");
        setEditStartDate(trip.startDate.slice(0, 10));
        setEditEndDate(trip.endDate.slice(0, 10));
        setEditPeople(String(trip.people));
        setEditCity(trip.city);
        setEditRating(Number(trip.rating) || 0);

        setIsEditingTrip(false);

        setEditCountry(trip.country);
        setEditCountryCode(trip.countryCode);
        setEditLatitude(Number(trip.latitude) || null);
        setEditLongitude(Number(trip.longitude) || null);
    };

    const handleSaveTrip = async () => {
        if (!trip) return;

        const title = editTitle.trim();
        const city = editCity.trim();
        const people = Number(editPeople);

        if (!city) {
            alert("여행지를 입력해주세요.");
            return;
        }

        if (!editStartDate || !editEndDate) {
            alert("여행 일정을 입력해주세요.");
            return;
        }

        if (new Date(editEndDate) < new Date(editStartDate)) {
            alert("여행 종료일은 시작일보다 빠를 수 없어요.");
            return;
        }

        if (!Number.isInteger(people) || people < 1) {
            alert("인원은 1명 이상 입력해주세요.");
            return;
        }

        if (
            !editCity.trim() ||
            !editCountry ||
            !editCountryCode ||
            editLatitude === null ||
            editLongitude === null ||
            Number.isNaN(editLatitude) ||
            Number.isNaN(editLongitude)
        ) {
            alert("여행지와 위치 정보를 입력해주세요.");
            return;
        }

        setIsSavingTrip(true);

        try {
            const response = await fetch(`/api/trips/${trip.id}`, {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    title: title || null,

                    city: editCity,
                    country: editCountry,
                    countryCode: editCountryCode,

                    startDate: editStartDate,
                    endDate: editEndDate,
                    people,

                    rating: trip.tripType === "completed" ? Number(editRating) || 0 : 0,

                    latitude: editLatitude,
                    longitude: editLongitude,
                }),
            });

            if (!response.ok) {
                throw new Error("여행 수정 실패");
            }

            const updatedTrip: SavedTrip = await response.json();

            setTrip(updatedTrip);

            setEditTitle(updatedTrip.title ?? "");
            setEditStartDate(updatedTrip.startDate.slice(0, 10));
            setEditEndDate(updatedTrip.endDate.slice(0, 10));
            setEditPeople(String(updatedTrip.people));
            setEditCity(updatedTrip.city);
            setEditRating(Number(updatedTrip.rating) || 0);
            setIsEditingTrip(false);
            setEditLatitude(Number(updatedTrip.latitude) || null);
            setEditLongitude(Number(updatedTrip.longitude) || null);

            setEditCountry(updatedTrip.country);
            setEditCountryCode(updatedTrip.countryCode);
        } catch (error) {
            console.error("여행 수정 실패:", error);
            alert("여행 정보를 수정하지 못했어요.");
        } finally {
            setIsSavingTrip(false);
        }
    };

    const handleCellKeyDown = async (event: React.KeyboardEvent<HTMLInputElement>, categoryId: number, date: Date) => {
        if (event.key !== "Enter") return;

        event.preventDefault();

        const input = event.currentTarget;

        const key = getCellKey(categoryId, date);
        const currentValue = expenseCells[key] ?? "";

        if (!currentValue.trim()) {
            input.blur();
            setSelectedCell(null);

            try {
                await fetch(`/api/trips/${trip.id}/expenses`, {
                    method: "PUT",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                        expenseDate: getDateKey(date),
                        categoryId,
                        expression: "",
                        amount: 0,
                    }),
                });
            } catch (error) {
                console.error("여행 경비 삭제 실패:", error);
            }

            return;
        }

        try {
            const safeExpression = currentValue
                .replace(/×/g, "*")
                .replace(/÷/g, "/")
                .replace(/,/g, "")
                .replace(/[^0-9+\-*/().\s]/g, "");

            if (!safeExpression.trim()) return;

            const result = Function(`"use strict"; return (${safeExpression})`)();

            if (typeof result !== "number" || !Number.isFinite(result) || result < 0) {
                return;
            }

            const calculatedAmount = Number(Number(result).toFixed(2));

            const formattedAmount =
                calculatedAmount === 0
                    ? ""
                    : Number.isInteger(calculatedAmount)
                      ? String(calculatedAmount)
                      : calculatedAmount.toFixed(2);

            setExpenseCells((prev) => ({
                ...prev,
                [key]: formattedAmount,
            }));

            const response = await fetch(`/api/trips/${trip.id}/expenses`, {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    expenseDate: getDateKey(date),
                    categoryId,
                    expression: currentValue,
                    amount: calculatedAmount,
                }),
            });

            if (!response.ok) {
                throw new Error("여행 경비 저장 실패");
            }

            input.blur();
            setSelectedCell(null);
        } catch (error) {
            console.error("여행 경비 저장 실패:", error);
        }
    };

    // ==============================
    // 카테고리 추가
    // ==============================

    const handleAddCategory = async () => {
        if (!trip?.id) return;

        try {
            const response = await fetch(`/api/trips/${trip.id}/expense-categories`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    name: "새 카테고리",
                }),
            });

            if (!response.ok) {
                throw new Error("카테고리 추가 실패");
            }

            const category: ExpenseCategory = await response.json();

            setCategories((prev) => [...prev, category]);
            setNewCategoryId(category.id);
            setSelectedCategoryId(category.id);
        } catch (error) {
            console.error("카테고리 추가 실패:", error);
        }
    };

    // ==============================
    // 카테고리 이름 수정
    // ==============================

    const handleCategoryNameChange = (categoryId: number, name: string) => {
        setCategories((prev) =>
            prev.map((category) =>
                category.id === categoryId
                    ? {
                          ...category,
                          name,
                      }
                    : category,
            ),
        );
    };

    const handleCategoryNameSave = async (categoryId: number) => {
        if (!trip?.id) return;

        const category = categories.find((item) => item.id === categoryId);

        if (!category) return;

        const name = category.name.trim();

        if (!name) {
            setCategories((prev) =>
                prev.map((item) =>
                    item.id === categoryId
                        ? {
                              ...item,
                              name: "새 카테고리",
                          }
                        : item,
                ),
            );

            setNewCategoryId(null);
            return;
        }

        try {
            const response = await fetch(`/api/trips/${trip.id}/expense-categories`, {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    categoryId,
                    name,
                }),
            });

            if (!response.ok) {
                throw new Error("카테고리 이름 저장 실패");
            }

            const updatedCategory: ExpenseCategory = await response.json();

            setCategories((prev) => prev.map((item) => (item.id === categoryId ? updatedCategory : item)));

            setNewCategoryId(null);
        } catch (error) {
            console.error("카테고리 이름 저장 실패:", error);
        }
    };

    // ==============================
    // 카테고리 삭제
    // ==============================

    const handleDeleteCategory = async (categoryId: number) => {
        if (!trip?.id) return;

        const category = categories.find((item) => item.id === categoryId);

        if (!category) return;

        const confirmed = window.confirm(
            `"${category.name}" 카테고리를 삭제할까요?\n이 카테고리에 입력된 경비도 함께 삭제됩니다.`,
        );

        if (!confirmed) return;

        try {
            const response = await fetch(`/api/trips/${trip.id}/expense-categories?categoryId=${categoryId}`, {
                method: "DELETE",
            });

            if (!response.ok) {
                throw new Error("카테고리 삭제 실패");
            }

            setCategories((prev) => prev.filter((item) => item.id !== categoryId));

            setExpenseCells((prev) => {
                const next = { ...prev };

                Object.keys(next).forEach((key) => {
                    if (key.startsWith(`${categoryId}_`)) {
                        delete next[key];
                    }
                });

                return next;
            });

            setSelectedCategoryId(null);
        } catch (error) {
            console.error("카테고리 삭제 실패:", error);
        }
    };

    // ==============================
    // 카테고리 드래그앤드랍
    // ==============================

    const handleCategoryDragStart = (categoryId: number) => {
        setDraggedCategoryId(categoryId);
    };

    const handleCategoryDragEnd = () => {
        setDraggedCategoryId(null);
    };

    const handleCategoryDragOver = (event: React.DragEvent<HTMLTableRowElement>) => {
        event.preventDefault();
    };

    const handleCategoryDrop = async (targetCategoryId: number) => {
        if (draggedCategoryId === null || draggedCategoryId === targetCategoryId || !trip?.id) {
            return;
        }

        const reordered = [...categories];

        const draggedIndex = reordered.findIndex((category) => category.id === draggedCategoryId);

        const targetIndex = reordered.findIndex((category) => category.id === targetCategoryId);

        if (draggedIndex === -1 || targetIndex === -1) {
            setDraggedCategoryId(null);
            return;
        }

        const [draggedCategory] = reordered.splice(draggedIndex, 1);

        reordered.splice(targetIndex, 0, draggedCategory);

        const updatedCategories = reordered.map((category, index) => ({
            ...category,
            sort_order: index,
        }));

        setCategories(updatedCategories);
        setDraggedCategoryId(null);

        try {
            await Promise.all(
                updatedCategories.map((category) =>
                    fetch(`/api/trips/${trip.id}/expense-categories`, {
                        method: "PUT",
                        headers: {
                            "Content-Type": "application/json",
                        },
                        body: JSON.stringify({
                            categoryId: category.id,
                            sortOrder: category.sort_order,
                        }),
                    }).then((response) => {
                        if (!response.ok) {
                            throw new Error("카테고리 순서 저장 실패");
                        }
                    }),
                ),
            );
        } catch (error) {
            console.error("카테고리 순서 저장 실패:", error);

            const response = await fetch(`/api/trips/${trip.id}/expense-categories`);

            if (response.ok) {
                const data: ExpenseCategory[] = await response.json();

                setCategories(data);
            }
        }
    };

    return (
        <div className="mx-auto max-w-md">
            <Link
                href="/travel/list"
                className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-gray-500 shadow-sm"
                aria-label="여행리스트로 돌아가기"
            >
                <ArrowLeft size={19} strokeWidth={1.8} />
            </Link>

            {/* Trip Header */}
            <section>
                <div className="mt-8 rounded-3xl bg-white p-5 shadow-sm">
                    {!isEditingTrip ? (
                        <>
                            <div className="flex items-start justify-between gap-4">
                                <div className="flex items-center gap-3">
                                    {/* Flag */}
                                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white shadow-sm">
                                        <img
                                            src={`https://flagcdn.com/w40/${trip.countryCode.toLowerCase()}.png`}
                                            alt={trip.country}
                                            className="h-3 object-cover"
                                        />
                                    </div>
                                </div>

                                <button
                                    type="button"
                                    onClick={handleStartEditTrip}
                                    className="flex h-9 w-9 items-center justify-center rounded-full bg-gray-50 text-gray-500 transition hover:bg-gray-100"
                                    aria-label="여행 정보 수정"
                                >
                                    <Pencil size={15} strokeWidth={1.8} />
                                </button>
                            </div>

                            {/* Location */}
                            <p className="mt-6 text-sm text-gray-500">
                                {trip.city} · {trip.countryCode}
                            </p>

                            {/* Title */}
                            <h1 className="mt-2 text-3xl font-bold tracking-tight text-gray-950">{displayTitle}</h1>

                            {/* Date / Duration */}
                            <div className="mt-5">
                                <p className="text-sm text-gray-500">
                                    {formatDate(new Date(trip.startDate))} ~ {formatDate(new Date(trip.endDate))}
                                </p>

                                <p className="mt-1 text-sm text-gray-400">
                                    {nights === 0
                                        ? `당일치기 · ${trip.people}명`
                                        : `${nights}박 ${nights + 1}일 · ${trip.people}명`}
                                </p>
                            </div>

                            {/* Status */}
                            {trip.tripType === "completed" ? (
                                <div>
                                    {trip.rating > 0 ? (
                                        <div className="mt-5 flex items-center py-1">
                                            <div className="flex gap-0.5">
                                                {Array.from({ length: 5 }).map((_, index) => (
                                                    <Star
                                                        key={index}
                                                        size={18}
                                                        strokeWidth={1.8}
                                                        className={
                                                            trip.rating >= index + 1
                                                                ? "fill-gray-900 text-gray-900"
                                                                : "text-gray-200"
                                                        }
                                                    />
                                                ))}
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="mt-5 rounded-3xl p-5 shadow-sm">
                                            <p className="text-sm leading-6 text-gray-400">
                                                아직 이 여행에 별점을
                                                <br />
                                                남기지 않았어요.
                                            </p>

                                            <button
                                                type="button"
                                                onClick={handleStartEditTrip}
                                                className="mt-5 w-full rounded-2xl bg-gray-900 py-4 text-sm font-medium text-white"
                                            >
                                                별점 남기기
                                            </button>
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <span className="mt-5 inline-flex rounded-full bg-white px-3 py-1.5 text-[11px] font-semibold tracking-wide text-gray-500 shadow-sm">
                                    D-
                                    {Math.max(
                                        0,
                                        Math.ceil((new Date(trip.startDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)),
                                    )}
                                </span>
                            )}
                        </>
                    ) : (
                        <>
                            {/* 수정 헤더 */}
                            <div className="flex items-center justify-between">
                                <p className="text-sm font-medium text-gray-900">여행 정보 수정</p>

                                <button
                                    type="button"
                                    onClick={handleCancelEditTrip}
                                    className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-50 text-gray-400"
                                    aria-label="수정 취소"
                                >
                                    <X size={16} strokeWidth={1.8} />
                                </button>
                            </div>

                            {/* 제목 */}
                            <div className="mt-6">
                                <label className="text-xs font-medium text-gray-400">제목</label>

                                <input
                                    type="text"
                                    value={editTitle}
                                    onChange={(event) => setEditTitle(event.target.value)}
                                    placeholder={trip.city}
                                    className="mt-2 w-full rounded-2xl border border-gray-100 bg-gray-50 px-4 py-3 text-sm text-gray-900 outline-none transition "
                                />
                            </div>

                            {/* 여행지 */}
                            <div className="relative mt-6">
                                <p className="text-xs font-medium text-gray-400">여행지</p>

                                {editCountryCode ? (
                                    <div className="mt-2 flex h-[52px] w-full items-center gap-3 rounded-2xl bg-gray-50 px-4">
                                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white text-base">
                                            <img
                                                src={`https://flagcdn.com/w40/${editCountryCode.toLowerCase()}.png`}
                                                alt={editCountry}
                                                className="h-3 object-cover"
                                            />
                                        </span>

                                        <div className="min-w-0 flex-1">
                                            <p className="truncate text-sm font-medium leading-4 text-gray-900">{editCity}</p>

                                            <p className="mt-0.5 truncate text-xs leading-3 text-gray-400">{editCountry}</p>
                                        </div>

                                        <button
                                            type="button"
                                            onClick={() => {
                                                setEditCity("");
                                                setEditCountry("");
                                                setEditCountryCode("");
                                                setEditCitySearchResults([]);
                                                setShowEditCityResults(false);
                                                setEditLatitude(null);
                                                setEditLongitude(null);
                                            }}
                                            className="shrink-0 text-xs text-gray-400"
                                        >
                                            변경
                                        </button>
                                    </div>
                                ) : (
                                    <input
                                        type="text"
                                        value={editCity}
                                        onChange={(e) => {
                                            const value = e.target.value;

                                            isCityInputChangedRef.current = true;

                                            setEditCity(value);
                                            setEditCountry("");
                                            setEditCountryCode("");
                                            setEditCitySearchResults([]);
                                            setShowEditCityResults(value.trim().length >= 2);
                                        }}
                                        onFocus={() => {
                                            if (editCity.trim().length >= 2 && editCitySearchResults.length > 0) {
                                                setShowEditCityResults(true);
                                            }
                                        }}
                                        placeholder="도시를 입력해주세요 (예: New York)"
                                        className="mt-2 h-[52px] w-full rounded-2xl bg-gray-100 px-4 text-sm outline-none"
                                    />
                                )}

                                {/* 검색 결과 */}
                                {showEditCityResults && (
                                    <div className="absolute left-0 right-0 top-full z-30 mt-2 overflow-hidden rounded-2xl bg-white shadow-lg ring-1 ring-black/5">
                                        {isEditCitySearching ? (
                                            <div className="px-4 py-4 text-sm text-gray-400">도시를 찾고 있어요...</div>
                                        ) : editCitySearchResults.length > 0 ? (
                                            <div className="max-h-64 overflow-y-auto scrollbar-hide">
                                                {editCitySearchResults.map((result) => (
                                                    <button
                                                        key={`${result.name}-${result.countryCode}`}
                                                        type="button"
                                                        onClick={() => handleEditCitySelect(result)}
                                                        className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition hover:bg-gray-50 active:bg-gray-100"
                                                    >
                                                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gray-50 text-lg">
                                                            <img
                                                                src={`https://flagcdn.com/w40/${result.countryCode.toLowerCase()}.png`}
                                                                alt={getCountryName(result.countryCode)}
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
                                            <div className="px-4 py-4">
                                                <p className="text-sm text-gray-400">일치하는 도시를 찾지 못했어요.</p>

                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        setEditNewCityCountryCode("");
                                                        setIsAddEditCityModalOpen(true);
                                                    }}
                                                    className="mt-3 w-full rounded-2xl bg-gray-50 px-4 py-3 text-sm font-medium text-gray-700 transition active:bg-gray-100"
                                                >
                                                    ＋ 이 도시 추가하기
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>

                            {/* 일정 */}
                            <div className="mt-4">
                                <label className="text-xs font-medium text-gray-400">일정</label>

                                <div className="mt-2 grid grid-cols-2 gap-2">
                                    <input
                                        type="date"
                                        value={editStartDate}
                                        onChange={(event) => setEditStartDate(event.target.value)}
                                        className="w-full rounded-2xl border border-gray-100 bg-gray-50 px-3 py-3 text-sm text-gray-900 outline-none transition "
                                    />

                                    <input
                                        type="date"
                                        value={editEndDate}
                                        onChange={(event) => setEditEndDate(event.target.value)}
                                        className="w-full rounded-2xl border border-gray-100 bg-gray-50 px-3 py-3 text-sm text-gray-900 outline-none transition "
                                    />
                                </div>
                            </div>

                            {/* 인원 */}
                            <div className="mt-4">
                                <label className="text-xs font-medium text-gray-400">인원</label>

                                <div className="mt-2 flex items-center rounded-2xl border border-gray-100 bg-gray-50 px-4">
                                    <input
                                        type="number"
                                        min={1}
                                        value={editPeople}
                                        onChange={(event) => setEditPeople(event.target.value)}
                                        className="w-full bg-transparent py-3 text-sm text-gray-900 outline-none"
                                    />

                                    <span className="text-sm text-gray-400">명</span>
                                </div>
                            </div>

                            {/* 별점 */}
                            {trip.tripType === "completed" && (
                                <div className="mt-4">
                                    <p className="text-xs font-medium text-gray-400">여행 평점</p>

                                    <div className="mt-4 flex items-center gap-1">
                                        <div className="flex items-center">
                                            {[1, 2, 3, 4, 5].map((star) => {
                                                const numericRating = Number(editRating) || 0;

                                                const isFull = numericRating >= star;
                                                const isHalf = numericRating === star - 0.5;

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
                                                                    <clipPath id={`edit-half-star-${star}`}>
                                                                        <rect x="0" y="0" width="12" height="24" />
                                                                    </clipPath>
                                                                </defs>

                                                                <Star
                                                                    size={25}
                                                                    strokeWidth={1.7}
                                                                    className="fill-gray-900 text-gray-900"
                                                                    clipPath={`url(#edit-half-star-${star})`}
                                                                />
                                                            </svg>
                                                        )}

                                                        {/* 왼쪽 = 0.5 */}
                                                        <button
                                                            type="button"
                                                            onClick={() => setEditRating(star - 0.5)}
                                                            className="absolute left-0 top-0 z-10 h-full w-1/2"
                                                            aria-label={`${star - 0.5}점`}
                                                        />

                                                        {/* 오른쪽 = 1 */}
                                                        <button
                                                            type="button"
                                                            onClick={() => setEditRating(star)}
                                                            className="absolute right-0 top-0 z-10 h-full w-1/2"
                                                            aria-label={`${star}점`}
                                                        />
                                                    </div>
                                                );
                                            })}
                                        </div>

                                        <span className="ml-2 text-sm text-gray-400">{Number(editRating).toFixed(1)}</span>
                                    </div>
                                </div>
                            )}

                            {/* 저장 */}
                            <div className="mt-8 flex gap-2">
                                <button
                                    type="button"
                                    onClick={handleCancelEditTrip}
                                    disabled={isSavingTrip}
                                    className="flex-1 rounded-2xl border border-gray-200 py-4 text-sm font-medium text-gray-700 disabled:opacity-50"
                                >
                                    취소
                                </button>

                                <button
                                    type="button"
                                    onClick={handleSaveTrip}
                                    disabled={isSavingTrip}
                                    className="flex-1 rounded-2xl bg-gray-900 py-4 text-sm font-medium text-white disabled:opacity-50"
                                >
                                    {isSavingTrip ? "저장 중..." : "저장하기"}
                                </button>
                            </div>
                        </>
                    )}
                </div>
            </section>

            {/* Coming Soon */}
            {trip.tripType === "upcoming" && (
                <section className=" mt-8">
                    <div className="rounded-3xl bg-white p-5 shadow-sm">
                        <p className="text-sm text-gray-400">여행 예산</p>

                        <p className="mt-1 text-3xl font-bold tracking-tight text-gray-950">
                            ${Number(trip.budget ?? 0).toLocaleString()}
                        </p>

                        <p className="mt-4 text-sm text-gray-400">
                            지금까지{" "}
                            <span className="font-bold text-gray-900">
                                {trip.budget && Number(trip.budget) > 0
                                    ? `${((totalExpense / Number(trip.budget)) * 100).toFixed(1)}%`
                                    : "0%"}
                            </span>
                            을 썼어요
                            <span className="ml-1">
                                ($
                                {totalExpense.toLocaleString(undefined, {
                                    minimumFractionDigits: 2,
                                    maximumFractionDigits: 2,
                                })}
                                )
                            </span>
                        </p>
                    </div>
                </section>
            )}

            {/* Completed Expense Summary */}
            {trip.tripType === "completed" && (
                <section className="mt-8">
                    <div className="rounded-3xl bg-white p-5 shadow-sm">
                        <p className="text-sm text-gray-400">총 지출</p>

                        <p className="mt-1 text-3xl font-bold tracking-tight text-gray-950">${totalExpense.toLocaleString()}</p>

                        {nights > 0 && (
                            <p className="mt-4 text-sm text-gray-400">
                                1박당 평균{" "}
                                <span className="font-bold text-gray-900">${(totalExpense / (nights + 1)).toFixed(2)}</span>을
                                썼어요
                            </p>
                        )}
                    </div>
                </section>
            )}

            {/* Category Spending */}
            {trip.tripType === "completed" && totalExpense > 0 && sortedCategories.length > 0 && (
                <div className="mt-5 overflow-hidden rounded-3xl bg-gray-900 p-5 text-white shadow-sm">
                    <p className="text-sm font-medium">
                        이번 여행에서는 어디에
                        <br />
                        돈을 가장 많이 썼을까요?
                    </p>

                    <div className="relative mt-5 h-[72px] overflow-hidden">
                        <div key={displayCategory?.id} className="category-slide-up">
                            <div className="flex items-end justify-between">
                                <div>
                                    <p className="text-xs text-gray-400">{displayCategory?.name}</p>

                                    <p className="mt-1 text-2xl font-semibold tracking-tight tabular-nums">
                                        $
                                        {animatedAmount.toLocaleString(undefined, {
                                            minimumFractionDigits: 2,
                                            maximumFractionDigits: 2,
                                        })}
                                    </p>
                                </div>

                                <span className="text-xs text-gray-400 tabular-nums">{animatedPercentage.toFixed(1)}%</span>
                            </div>
                        </div>
                    </div>

                    <div className="flex h-2 overflow-hidden rounded-full bg-gray-700">
                        {sortedCategories.map((category, index) => {
                            const categoryAmount = getCategoryTotal(category.id);

                            const percentage = totalExpense > 0 ? (categoryAmount / totalExpense) * 100 : 0;

                            const isActive = category.id === displayCategory?.id;

                            const isTopCategory = index === 0;

                            return (
                                <div
                                    key={category.id}
                                    className={`relative h-full transition-all duration-500 ease-out ${
                                        index !== 0 ? "border-l border-gray-900" : ""
                                    }`}
                                    style={{
                                        width: `${percentage}%`,
                                        backgroundColor: "white",
                                        opacity: isActive ? 1 : 0.2,
                                        transform: isActive ? `scaleY(${isTopCategory ? 1.5 : 1.3})` : "scaleY(1)",
                                        transformOrigin: "center",
                                    }}
                                />
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Expenses */}
            <section className="mt-8">
                <div className="flex items-end justify-between">
                    <div>
                        <h2 className="text-lg font-semibold text-gray-900">여행 경비</h2>

                        <p className="mt-1 text-sm text-gray-400">날짜별로 경비를 기록해보세요.</p>
                    </div>
                </div>

                {/* Expense Table */}
                <div className="mt-4 rounded-3xl bg-white p-5 shadow-sm">
                    <div className="overflow-x-auto scrollbar-hide">
                        <table className="w-max min-w-full border-collapse text-sm">
                            <thead>
                                <tr className="border-b border-gray-100">
                                    {/* 드래그 */}
                                    <th className="sticky left-0 z-20 w-[32px] min-w-[32px] max-w-[32px] bg-white px-0 pb-4 text-center text-xs font-medium text-gray-400">
                                        {""}
                                    </th>

                                    {/* 구분 */}
                                    <th className="sticky left-[32px] z-20 w-[100px] min-w-[100px] max-w-[100px] bg-white px-3 pb-4 text-left text-xs font-medium text-gray-400">
                                        구분
                                    </th>

                                    {tripDates.map((date) => (
                                        <th
                                            key={date.toISOString()}
                                            className="w-[100px] min-w-[100px] max-w-[100px] px-3 pb-4 text-center text-xs font-medium text-gray-400"
                                        >
                                            {`${String(date.getFullYear()).slice(2)}/${String(date.getMonth() + 1).padStart(
                                                2,
                                                "0",
                                            )}/${String(date.getDate()).padStart(2, "0")}`}
                                        </th>
                                    ))}

                                    {/* 합계 */}
                                    <th className="w-[78px] min-w-[78px] max-w-[78px] bg-white pb-4 pl-3 text-center text-xs font-medium text-gray-400">
                                        합계
                                    </th>
                                </tr>
                            </thead>

                            <tbody>
                                {categories.map((category) => {
                                    const Icon = categoryIcons[category.name as keyof typeof categoryIcons] ?? MoreHorizontal;

                                    const categoryTotal = getCategoryTotal(category.id);

                                    const isSelected = selectedCategoryId === category.id;
                                    const isDragging = draggedCategoryId === category.id;

                                    return (
                                        <tr
                                            key={category.id}
                                            draggable={false}
                                            onDragOver={handleCategoryDragOver}
                                            onDrop={() => handleCategoryDrop(category.id)}
                                            onClick={(event) => {
                                                if ((event.target as HTMLElement).closest("input")) {
                                                    return;
                                                }

                                                setSelectedCategoryId(isSelected ? null : category.id);
                                            }}
                                            className={`border-b border-gray-50 last:border-b-0 transition ${
                                                isDragging ? "opacity-40" : ""
                                            }`}
                                        >
                                            {/* 드래그 / 삭제 */}
                                            <td
                                                className={`sticky left-0 z-20 w-[32px] min-w-[32px] max-w-[32px] bg-white py-2 ${
                                                    isSelected ? "bg-gray-50" : ""
                                                }`}
                                                onClick={(event) => event.stopPropagation()}
                                            >
                                                {isSelected ? (
                                                    <button
                                                        type="button"
                                                        onClick={() => handleDeleteCategory(category.id)}
                                                        className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 hover:text-gray-700"
                                                        aria-label="카테고리 삭제"
                                                    >
                                                        <Trash2 size={15} strokeWidth={1.8} />
                                                    </button>
                                                ) : (
                                                    <div
                                                        draggable
                                                        onDragStart={() => handleCategoryDragStart(category.id)}
                                                        onDragEnd={handleCategoryDragEnd}
                                                        className="flex h-8 w-8 cursor-grab items-center justify-center rounded-lg text-gray-300 active:cursor-grabbing"
                                                        aria-label="카테고리 순서 변경"
                                                    >
                                                        ⋮⋮
                                                    </div>
                                                )}
                                            </td>

                                            {/* 카테고리 */}
                                            <th
                                                className={`sticky left-[32px] z-20 w-[100px] min-w-[100px] max-w-[100px] bg-white py-2 px-3 text-left ${
                                                    isSelected ? "bg-gray-50" : ""
                                                }`}
                                            >
                                                <div className="flex w-[76px] items-center gap-2">
                                                    <Icon size={15} strokeWidth={1.8} className="shrink-0 text-gray-400" />

                                                    <input
                                                        type="text"
                                                        value={category.name}
                                                        autoFocus={newCategoryId === category.id}
                                                        onChange={(event) =>
                                                            handleCategoryNameChange(category.id, event.target.value)
                                                        }
                                                        onFocus={() => setSelectedCategoryId(category.id)}
                                                        onBlur={() => handleCategoryNameSave(category.id)}
                                                        onKeyDown={(event) => {
                                                            if (event.key === "Enter") {
                                                                event.currentTarget.blur();
                                                            }

                                                            if (event.key === "Escape") {
                                                                event.currentTarget.blur();
                                                                setSelectedCategoryId(null);
                                                            }
                                                        }}
                                                        onClick={(event) => event.stopPropagation()}
                                                        className="w-[55px] min-w-0 bg-transparent text-xs font-medium text-gray-600 outline-none cursor-pointer"
                                                    />
                                                </div>
                                            </th>

                                            {/* 날짜별 비용 */}
                                            {tripDates.map((date) => {
                                                const key = getCellKey(category.id, date);

                                                return (
                                                    <td
                                                        key={key}
                                                        className={`w-[100px] min-w-[100px] max-w-[100px] px-2 py-2 text-center ${
                                                            isSelected ? "bg-gray-50" : ""
                                                        }`}
                                                        onClick={(event) => event.stopPropagation()}
                                                    >
                                                        <input
                                                            type="text"
                                                            inputMode="decimal"
                                                            value={
                                                                expenseCells[key] === "0.00" || expenseCells[key] === "0"
                                                                    ? ""
                                                                    : (expenseCells[key] ?? "")
                                                            }
                                                            onFocus={() => {
                                                                setSelectedCell(key);
                                                            }}
                                                            onChange={(event) => {
                                                                handleCellChange(category.id, date, event.target.value);
                                                            }}
                                                            onKeyDown={(event) => {
                                                                handleCellKeyDown(event, category.id, date);
                                                            }}
                                                            onBlur={() => {
                                                                setSelectedCell(null);
                                                            }}
                                                            placeholder="-"
                                                            className={`min-h-[48px] w-full rounded-xl bg-transparent px-2 text-center text-xs text-gray-700 outline-none transition cursor-pointer ${
                                                                selectedCell === key ? "ring-1 ring-gray-300 cursor-text" : ""
                                                            }`}
                                                        />
                                                    </td>
                                                );
                                            })}

                                            {/* 카테고리 합계 */}
                                            <td
                                                className={`w-[78px] min-w-[78px] max-w-[78px] py-4 pl-3 text-center text-xs font-medium text-gray-900 ${
                                                    isSelected ? "bg-gray-50" : ""
                                                }`}
                                            >
                                                $
                                                {categoryTotal.toLocaleString(undefined, {
                                                    minimumFractionDigits: 2,
                                                    maximumFractionDigits: 2,
                                                })}
                                            </td>
                                        </tr>
                                    );
                                })}

                                {/* 카테고리 추가 */}
                                <tr className="border-b border-gray-100">
                                    {/* 드래그 영역 */}
                                    <td className="sticky left-0 z-20 w-[32px] min-w-[32px] max-w-[32px] bg-white">{""}</td>

                                    {/* 카테고리 영역 */}
                                    <td
                                        onClick={handleAddCategory}
                                        className="sticky left-[32px] z-20 w-[100px] min-w-[100px] max-w-[100px] cursor-pointer bg-white py-4 px-3"
                                    >
                                        <div className="flex w-[76px] items-center gap-2 text-xs font-medium text-gray-400">
                                            <Plus size={15} strokeWidth={1.8} />
                                            <span>추가</span>
                                        </div>
                                    </td>
                                </tr>
                            </tbody>

                            <tfoot>
                                <tr className="border-t border-gray-100">
                                    {/* 드래그 자리 */}
                                    <th className="sticky left-0 z-20 w-[32px] min-w-[32px] max-w-[32px] bg-white pt-4 px-0 text-left text-xs font-semibold text-gray-700">
                                        {""}
                                    </th>

                                    {/* 일별 합계 */}
                                    <th className="sticky left-[32px] z-20 w-[100px] min-w-[100px] max-w-[100px] bg-white pt-4 px-3 text-left text-xs font-semibold text-gray-700">
                                        {""}
                                    </th>

                                    {tripDates.map((date) => (
                                        <td
                                            key={date.toISOString()}
                                            className="w-[100px] min-w-[100px] max-w-[100px] px-2 pt-4 text-center text-xs font-semibold text-gray-900"
                                        >
                                            ${getDateTotal(date).toFixed(2)}
                                        </td>
                                    ))}

                                    <td className="w-[78px] min-w-[78px] max-w-[78px] pt-4 pl-3 text-center text-sm font-semibold text-gray-900">
                                        $
                                        {totalExpense.toLocaleString(undefined, {
                                            minimumFractionDigits: 2,
                                            maximumFractionDigits: 2,
                                        })}
                                    </td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                </div>
            </section>

            {/* Add City Modal - 여행 정보 수정 */}
            {isAddEditCityModalOpen && (
                <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/30 px-5">
                    <div className="w-full max-w-md rounded-3xl bg-white p-5 shadow-xl">
                        <div className="flex items-center justify-between">
                            <h2 className="text-xl font-bold">도시 추가</h2>

                            <button
                                type="button"
                                onClick={() => {
                                    setIsAddEditCityModalOpen(false);
                                }}
                                className="flex h-9 w-9 items-center justify-center rounded-full bg-gray-100 text-gray-500"
                            >
                                ×
                            </button>
                        </div>

                        {/* 도시 */}
                        <div className="mt-6">
                            <p className="text-sm font-medium text-gray-700">도시</p>

                            <input
                                type="text"
                                value={editCity}
                                onChange={(e) => {
                                    setEditCity(e.target.value);
                                }}
                                placeholder="도시명을 입력해주세요"
                                className="mt-2 h-[52px] w-full rounded-2xl bg-gray-100 px-4 text-sm outline-none"
                            />
                        </div>

                        {/* 국가 */}
                        <div className="mt-5">
                            <p className="text-sm font-medium text-gray-700">국가</p>

                            <select
                                value={editNewCityCountryCode}
                                onChange={(e) => {
                                    setEditNewCityCountryCode(e.target.value);
                                }}
                                className="mt-2 h-[52px] w-full rounded-2xl bg-gray-100 px-4 text-sm outline-none"
                            >
                                <option value="">국가를 선택해주세요</option>
                                <option value="CA">🇨🇦 Canada</option>
                                <option value="US">🇺🇸 United States</option>
                                <option value="KR">🇰🇷 South Korea</option>
                                <option value="JP">🇯🇵 Japan</option>
                            </select>
                        </div>

                        {/* 위도 / 경도 */}
                        <div className="mt-5">
                            <p className="text-sm font-medium text-gray-700">위치 정보</p>

                            <div className="mt-2 grid grid-cols-2 gap-3">
                                <div>
                                    <p className="mb-2 text-xs text-gray-400">위도</p>

                                    <input
                                        type="number"
                                        step="any"
                                        value={editLatitude ?? ""}
                                        onChange={(e) => {
                                            const value = e.target.value;

                                            setEditLatitude(value === "" ? null : Number(value));
                                        }}
                                        placeholder="예: 50.1163"
                                        className="h-[52px] w-full rounded-2xl bg-gray-100 px-4 text-sm outline-none"
                                    />
                                </div>

                                <div>
                                    <p className="mb-2 text-xs text-gray-400">경도</p>

                                    <input
                                        type="number"
                                        step="any"
                                        value={editLongitude ?? ""}
                                        onChange={(e) => {
                                            const value = e.target.value;

                                            setEditLongitude(value === "" ? null : Number(value));
                                        }}
                                        placeholder="예: -122.9574"
                                        className="h-[52px] w-full rounded-2xl bg-gray-100 px-4 text-sm outline-none"
                                    />
                                </div>
                            </div>

                            <p className="mt-2 text-xs text-gray-400">지도에 표시할 위치를 입력해주세요.</p>
                        </div>

                        {/* 버튼 */}
                        <div className="mt-6 flex gap-3">
                            <button
                                type="button"
                                onClick={() => {
                                    setIsAddEditCityModalOpen(false);
                                }}
                                className="flex-1 rounded-2xl border border-gray-200 py-4 text-sm font-medium text-gray-700"
                            >
                                취소
                            </button>

                            <button
                                type="button"
                                disabled={
                                    !editCity.trim() ||
                                    !editNewCityCountryCode ||
                                    editLatitude === null ||
                                    editLongitude === null ||
                                    Number.isNaN(editLatitude) ||
                                    Number.isNaN(editLongitude)
                                }
                                onClick={async () => {
                                    const countryInfo = await getCountryInfo(editNewCityCountryCode);

                                    setEditCity(formatCityName(editCity));
                                    setEditCountryCode(editNewCityCountryCode);
                                    setEditCountry(countryInfo.name);

                                    setShowEditCityResults(false);
                                    setEditCitySearchResults([]);
                                    setIsAddEditCityModalOpen(false);
                                }}
                                className="flex-1 rounded-2xl bg-black py-4 text-sm font-medium text-white disabled:opacity-30"
                            >
                                선택하기
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <style jsx>{`
                @keyframes categorySlideUp {
                    0% {
                        opacity: 0;
                        transform: translateY(28px);
                    }

                    100% {
                        opacity: 1;
                        transform: translateY(0);
                    }
                }

                .category-slide-up {
                    animation: categorySlideUp 0.55s cubic-bezier(0.22, 1, 0.36, 1);
                }
            `}</style>
        </div>
    );
}
