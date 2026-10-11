"use client";

import LoadingScreen, { InlineLoading } from "@/components/LoadingScreen";
import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Plus, Pencil, Trash2, X, GripVertical, Lock } from "lucide-react";
import { useSearchParams } from "next/navigation";
import BackButtonHeader from "@/components/BackButtonHeader";
import { useUpgrade } from "@/components/UpgradeProvider";
import { useDialog } from "@/components/DialogProvider";
import UsageMeter from "@/components/UsageMeter";
import BottomSheet from "@/components/BottomSheet";
import { useI18n } from "@/components/I18nProvider";
import { getCategoryLabel } from "@/lib/i18n/categories";
import type { MessageKey } from "@/lib/i18n";

type TFn = (key: MessageKey, params?: Record<string, string | number>) => string;

type TransactionType = "income" | "expense" | "transfer";

type TransferDirection = "living_to_savings" | "savings_to_living" | null;

type CategoryKind = "fixed" | "variable" | "income";

type LivingCategory = {
    id: number;
    name: string;
    kind: CategoryKind;
};

type LivingTransaction = {
    id: number;
    transactionDate: string;
    type: TransactionType;
    amount: number;
    categoryId: number | null;
    categoryName: string | null;
    memo: string | null;
    transferDirection: TransferDirection;
};

type FixedExpense = {
    id: number;
    name: string;
    amount: number;
    categoryId: number;
    categoryName: string;
    paymentDay: number;
    memo: string | null;
    sortOrder: number;
    // 아직 시작 전인 고정지출 (startMonth: "YYYY-MM")
    startMonth: string | null;
    isUpcoming: boolean;
};

type FixedChangeScope = "this-month-only" | "from-this-month" | "from-next-month";
type FixedDeleteMode = "this-month-only" | "from-this-month" | "all";

// 고정지출은 "이번 달" 기준으로 보여주고 바꾼다
const getThisMonthString = () => {
    const now = new Date();

    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
};

type Holiday = {
    date: string;
    name: string;
    global: boolean;
};

const getCurrencyLocale = (currencyCode: string) => {
    switch (currencyCode) {
        case "KRW":
            return "ko-KR";
        case "CAD":
            return "en-CA";
        case "USD":
            return "en-US";
        default:
            return "en-CA";
    }
};

const formatMoney = (amount: number, currencyCode: string | null) => {
    if (!currencyCode) {
        return "";
    }

    return new Intl.NumberFormat(getCurrencyLocale(currencyCode), {
        style: "currency",
        currency: currencyCode,
        minimumFractionDigits: currencyCode === "KRW" ? 0 : 2,
        maximumFractionDigits: currencyCode === "KRW" ? 0 : 2,
    }).format(Math.abs(amount));
};

const getCurrencySymbol = (currencyCode: string | null) => {
    if (!currencyCode) {
        return "";
    }

    return (
        new Intl.NumberFormat(getCurrencyLocale(currencyCode), {
            style: "currency",
            currency: currencyCode,
            minimumFractionDigits: 0,
            maximumFractionDigits: 0,
        })
            .formatToParts(0)
            .find((part) => part.type === "currency")?.value ?? currencyCode
    );
};

const formatMonth = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;

const formatDate = (date: Date) =>
    `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

const getTransactionNet = (transaction: LivingTransaction) => {
    if (transaction.type === "income") {
        return transaction.amount;
    }

    if (transaction.type === "expense") {
        return -transaction.amount;
    }

    return transaction.transferDirection === "savings_to_living" ? transaction.amount : -transaction.amount;
};

const getTransactionLabel = (transaction: LivingTransaction, t: TFn) => {
    if (transaction.type === "income") {
        return transaction.categoryName ? getCategoryLabel(transaction.categoryName, t) : t("manage.type.income");
    }

    if (transaction.type === "expense") {
        return transaction.categoryName ? getCategoryLabel(transaction.categoryName, t) : t("manage.type.expense");
    }

    return transaction.transferDirection === "living_to_savings" ? t("manage.type.saving") : t("manage.type.fromSavings");
};

const ProBadge = () => (
    <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-1 text-[10px] font-semibold text-gray-400">
        <Lock size={10} strokeWidth={2} />
        Pro
    </span>
);

export default function LivingManagePage() {
    const { confirm, alert: showAlert } = useDialog();
    const { openUpgrade } = useUpgrade();
    const { t, locale } = useI18n();

    const searchParams = useSearchParams();

    const [currentDate, setCurrentDate] = useState(() => new Date());

    const [transactions, setTransactions] = useState<LivingTransaction[]>([]);
    const [categories, setCategories] = useState<LivingCategory[]>([]);
    const [fixedExpenses, setFixedExpenses] = useState<FixedExpense[]>([]);

    const [loading, setLoading] = useState(true);
    const [fixedLoading, setFixedLoading] = useState(true);

    const [planCode, setPlanCode] = useState("free");

    // user_profiles 기준 지역 / 국가 / 통화
    const [countryCode, setCountryCode] = useState<string | null>(null);
    const [province, setProvince] = useState<string | null>(null);
    const [currency, setCurrency] = useState<string | null>(null);

    const [holidays, setHolidays] = useState<Holiday[]>([]);
    const [totalTransactionCount, setTotalTransactionCount] = useState(0);

    const [selectedDate, setSelectedDate] = useState<string>(formatDate(new Date()));

    const [editingTransaction, setEditingTransaction] = useState<LivingTransaction | null>(null);

    const [isFormOpen, setIsFormOpen] = useState(false);

    const [isFormMounted, setIsFormMounted] = useState(false);
    const [isFormAnimating, setIsFormAnimating] = useState(false);

    const [editingFixedExpense, setEditingFixedExpense] = useState<FixedExpense | null>(null);

    const [isFixedFormOpen, setIsFixedFormOpen] = useState(false);

    const [draggedFixedId, setDraggedFixedId] = useState<number | null>(null);

    const [isCategoryFormOpen, setIsCategoryFormOpen] = useState(false);
    const [editingCategory, setEditingCategory] = useState<LivingCategory | null>(null);

    const [isFixedFormMounted, setIsFixedFormMounted] = useState(false);
    const [isFixedFormAnimating, setIsFixedFormAnimating] = useState(false);
    const [isTransactionFormMounted, setIsTransactionFormMounted] = useState(false);
    const [isTransactionFormAnimating, setIsTransactionFormAnimating] = useState(false);

    const [isCategoryFormMounted, setIsCategoryFormMounted] = useState(false);
    const [isCategoryFormAnimating, setIsCategoryFormAnimating] = useState(false);

    const [categoryForm, setCategoryForm] = useState({
        name: "",
        kind: "variable" as CategoryKind,
    });

    const [form, setForm] = useState({
        date: formatDate(new Date()),
        type: "expense" as TransactionType,
        amount: "",
        categoryId: "",
        memo: "",
        transferDirection: "living_to_savings" as "living_to_savings" | "savings_to_living",
    });

    const [fixedForm, setFixedForm] = useState({
        name: "",
        amount: "",
        categoryId: "",
        paymentDay: "1",
        memo: "",
        // 새로 추가할 때만 쓴다
        startMode: "this-month" as "this-month" | "next-month",
    });

    // 금액·결제일을 바꿀 때 "언제부터 적용할지" 고르는 시트 / 삭제 방식을 고르는 시트
    const [isFixedScopeSheetOpen, setIsFixedScopeSheetOpen] = useState(false);
    const [fixedDeleteTarget, setFixedDeleteTarget] = useState<FixedExpense | null>(null);

    const FREE_LIVING_TRANSACTION_LIMIT = 300;

    const isFree = planCode === "free";

    const isLivingTransactionLimitReached = isFree && totalTransactionCount >= FREE_LIVING_TRANSACTION_LIMIT;

    // 고정지출은 Pro 전용이라 무료 플랜은 추가할 수 없다.
    const isFixedExpenseLimitReached = isFree;

    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const monthKey = formatMonth(currentDate);

    const monthLabel = currentDate.toLocaleDateString(locale, {
        year: "numeric",
        month: "long",
    });

    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    const calendarCells = useMemo(() => {
        const cells: (number | null)[] = [];

        for (let i = 0; i < firstDay; i++) {
            cells.push(null);
        }

        for (let day = 1; day <= daysInMonth; day++) {
            cells.push(day);
        }

        while (cells.length % 7 !== 0) {
            cells.push(null);
        }

        return cells;
    }, [firstDay, daysInMonth]);

    const monthTotals = useMemo(() => {
        return transactions.reduce(
            (total, transaction) => {
                if (transaction.type === "income") {
                    total.income += transaction.amount;
                }

                if (transaction.type === "expense") {
                    total.expense += transaction.amount;
                }

                return total;
            },
            {
                income: 0,
                expense: 0,
            },
        );
    }, [transactions]);

    const fixedExpenseTotal = useMemo(
        () => fixedExpenses.filter((expense) => !expense.isUpcoming).reduce((sum, expense) => sum + expense.amount, 0),
        [fixedExpenses],
    );

    const transactionsByDate = useMemo(() => {
        const grouped = new Map<string, LivingTransaction[]>();

        transactions.forEach((transaction) => {
            const existing = grouped.get(transaction.transactionDate) ?? [];

            existing.push(transaction);
            grouped.set(transaction.transactionDate, existing);
        });

        return grouped;
    }, [transactions]);

    const selectedTransactions = transactionsByDate.get(selectedDate) ?? [];

    const selectedHoliday = holidays.find((item) => item.date === selectedDate);

    const selectedDateObject = new Date(`${selectedDate}T00:00:00`);

    const selectedDateLabel = selectedDateObject.toLocaleDateString(locale, {
        month: "long",
        day: "numeric",
        weekday: "short",
    });

    const loadTransactions = async () => {
        try {
            setLoading(true);

            const startDate = `${monthKey}-01`;
            const endDate = formatDate(new Date(year, month + 1, 0));

            const response = await fetch(`/api/living/transactions?startDate=${startDate}&endDate=${endDate}`);

            if (!response.ok) {
                throw new Error("거래내역을 불러오지 못했습니다.");
            }

            const data = await response.json();

            setTransactions(data.transactions ?? []);
            setTotalTransactionCount(Number(data.totalCount ?? 0));
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const loadCategories = async () => {
        try {
            const response = await fetch("/api/living/categories");

            if (!response.ok) {
                throw new Error("카테고리를 불러오지 못했습니다.");
            }

            const data = await response.json();

            setCategories(data.categories ?? []);
        } catch (error) {
            console.error(error);
        }
    };

    const loadFixedExpenses = async () => {
        try {
            setFixedLoading(true);

            const response = await fetch(`/api/living/fixed-expenses?month=${getThisMonthString()}`);

            if (!response.ok) {
                throw new Error("고정지출을 불러오지 못했습니다.");
            }

            const data = await response.json();

            setFixedExpenses(data.fixedExpenses ?? []);
        } catch (error) {
            console.error(error);
        } finally {
            setFixedLoading(false);
        }
    };

    useEffect(() => {
        const loadPlan = async () => {
            try {
                const response = await fetch("/api/auth/me");

                if (!response.ok) {
                    return;
                }

                const data = await response.json();

                setPlanCode(data.planCode ?? "free");
            } catch (error) {
                console.error(error);
            }
        };

        loadPlan();
    }, []);

    /*
     * --------------------------------------------------
     * Load User Profile
     * --------------------------------------------------
     * 국가 / 지역 / 통화는 모두 user_profiles를 기준으로 한다.
     */
    useEffect(() => {
        const loadProfile = async () => {
            try {
                const response = await fetch("/api/user/profile");

                if (!response.ok) {
                    throw new Error("프로필 조회 실패");
                }

                const data = await response.json();

                setCountryCode(data.countryCode ?? null);
                setProvince(data.provinceCode ?? null);
                setCurrency(data.currency ?? null);
            } catch (error) {
                console.error("프로필 조회 실패:", error);

                setCountryCode(null);
                setProvince(null);
                setCurrency(null);
            }
        };

        loadProfile();
    }, []);

    /*
     * --------------------------------------------------
     * Load Holidays
     * --------------------------------------------------
     * 국가 / 지역 모두 user_profiles에서 가져온다.
     */
    useEffect(() => {
        if (!countryCode) {
            setHolidays([]);
            return;
        }

        const loadHolidays = async () => {
            try {
                const params = new URLSearchParams({
                    year: String(year),
                    country: countryCode,
                });

                if (province) {
                    params.set("province", province);
                }

                const response = await fetch(`/api/holidays?${params.toString()}`);

                if (!response.ok) {
                    throw new Error("공휴일 조회 실패");
                }

                const data: Holiday[] = await response.json();

                setHolidays(data);
            } catch (error) {
                console.error("공휴일 조회 실패:", error);
                setHolidays([]);
            }
        };

        loadHolidays();
    }, [year, countryCode, province]);

    useEffect(() => {
        loadTransactions();
    }, [monthKey]);

    useEffect(() => {
        loadCategories();
        loadFixedExpenses();
    }, []);

    const moveMonth = (amount: number) => {
        const nextDate = new Date(year, month + amount, 1);

        setCurrentDate(nextDate);

        const nextMonth = formatMonth(nextDate);
        setSelectedDate(`${nextMonth}-01`);
    };

    const getDayTransactions = (day: number) => {
        const date = formatDate(new Date(year, month, day));

        return transactionsByDate.get(date) ?? [];
    };

    const getDayNet = (day: number) => {
        return getDayTransactions(day).reduce((sum, transaction) => sum + getTransactionNet(transaction), 0);
    };

    const openAddForm = (date?: string, transferDirection?: "living_to_savings" | "savings_to_living") => {
        if (isLivingTransactionLimitReached) {
            openUpgrade("living-limit");
            return;
        }

        setEditingTransaction(null);

        setForm({
            date: date ?? selectedDate ?? formatDate(new Date(year, month, 1)),
            type: transferDirection ? "transfer" : "expense",
            amount: "",
            categoryId: "",
            memo: "",
            transferDirection: transferDirection ?? "living_to_savings",
        });

        setIsFormOpen(true);
    };

    useEffect(() => {
        const type = searchParams.get("type");
        const direction = searchParams.get("direction");

        if (type === "transfer") {
            openAddForm(undefined, direction === "savings_to_living" ? "savings_to_living" : "living_to_savings");
        }
    }, [searchParams]);

    useEffect(() => {
        if (isFixedFormOpen) {
            setIsFixedFormMounted(true);

            const frame = window.requestAnimationFrame(() => {
                window.requestAnimationFrame(() => {
                    setIsFixedFormAnimating(true);
                });
            });

            return () => {
                window.cancelAnimationFrame(frame);
            };
        }

        setIsFixedFormAnimating(false);

        const timer = window.setTimeout(() => {
            setIsFixedFormMounted(false);
        }, 350);

        return () => {
            clearTimeout(timer);
        };
    }, [isFixedFormOpen]);

    useEffect(() => {
        if (isCategoryFormOpen) {
            setIsCategoryFormMounted(true);

            const frame = window.requestAnimationFrame(() => {
                window.requestAnimationFrame(() => {
                    setIsCategoryFormAnimating(true);
                });
            });

            return () => {
                window.cancelAnimationFrame(frame);
            };
        }

        setIsCategoryFormAnimating(false);

        const timer = window.setTimeout(() => {
            setIsCategoryFormMounted(false);
        }, 350);

        return () => {
            clearTimeout(timer);
        };
    }, [isCategoryFormOpen]);

    useEffect(() => {
        if (isFormOpen) {
            setIsFormMounted(true);

            const frame = window.requestAnimationFrame(() => {
                window.requestAnimationFrame(() => {
                    setIsFormAnimating(true);
                });
            });

            return () => {
                window.cancelAnimationFrame(frame);
            };
        }

        setIsFormAnimating(false);

        const timer = window.setTimeout(() => {
            setIsFormMounted(false);
        }, 350);

        return () => {
            clearTimeout(timer);
        };
    }, [isFormOpen]);

    useEffect(() => {
        if (isFormOpen) {
            setIsTransactionFormMounted(true);

            const frame = window.requestAnimationFrame(() => {
                window.requestAnimationFrame(() => {
                    setIsTransactionFormAnimating(true);
                });
            });

            return () => {
                window.cancelAnimationFrame(frame);
            };
        }

        setIsTransactionFormAnimating(false);

        const timer = window.setTimeout(() => {
            setIsTransactionFormMounted(false);
        }, 350);

        return () => {
            clearTimeout(timer);
        };
    }, [isFormOpen]);

    const openEditForm = (transaction: LivingTransaction) => {
        setEditingTransaction(transaction);

        setForm({
            date: transaction.transactionDate,
            type: transaction.type,
            amount: String(transaction.amount),
            categoryId: transaction.categoryId ? String(transaction.categoryId) : "",
            memo: transaction.memo ?? "",
            transferDirection: transaction.transferDirection ?? "living_to_savings",
        });

        setIsFormOpen(true);
    };

    const saveTransaction = async () => {
        const amount = Number(form.amount);

        if (!form.date) {
            showAlert(t("manage.alert.date"));
            return;
        }

        if (!Number.isFinite(amount) || amount <= 0) {
            showAlert(t("manage.alert.amount"));
            return;
        }

        if (form.type !== "transfer" && !form.categoryId) {
            showAlert(t("manage.alert.category"));
            return;
        }

        try {
            const payload = {
                transactionDate: form.date,
                type: form.type,
                amount: Number(amount.toFixed(2)),
                categoryId: form.type === "transfer" ? null : Number(form.categoryId),
                memo: form.memo.trim() || null,
                transferDirection: form.type === "transfer" ? form.transferDirection : null,
            };

            const response = await fetch("/api/living/transactions", {
                method: editingTransaction ? "PATCH" : "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(
                    editingTransaction
                        ? {
                              id: editingTransaction.id,
                              ...payload,
                          }
                        : payload,
                ),
            });

            if (!response.ok) {
                const data = await response.json().catch(() => null);
                showAlert(data?.error ?? t("manage.alert.saveFailed"));
                return;
            }

            setIsFormOpen(false);
            setEditingTransaction(null);

            await loadTransactions();
        } catch (error) {
            console.error(error);
            showAlert(t("manage.alert.saveError"));
        }
    };

    const deleteTransaction = async (id: number) => {
        if (!await confirm(t("manage.confirm.deleteRecord"))) {
            return;
        }

        try {
            const response = await fetch(`/api/living/transactions?id=${id}`, {
                method: "DELETE",
            });

            if (!response.ok) {
                throw new Error(t("manage.alert.deleteFailed"));
            }

            setIsFormOpen(false);
            setEditingTransaction(null);

            await loadTransactions();
        } catch (error) {
            console.error(error);
        }
    };

    const openAddFixedForm = () => {
        if (isFixedExpenseLimitReached) {
            openUpgrade("fixed-expense");
            return;
        }

        setEditingFixedExpense(null);

        setFixedForm({
            name: "",
            amount: "",
            categoryId: categories.find((category) => category.kind === "fixed")?.id.toString() ?? "",
            paymentDay: "1",
            memo: "",
            startMode: "this-month",
        });

        setIsFixedFormOpen(true);
    };

    const openEditFixedForm = (expense: FixedExpense) => {
        setEditingFixedExpense(expense);

        setFixedForm({
            name: expense.name,
            amount: String(expense.amount),
            categoryId: String(expense.categoryId),
            paymentDay: String(expense.paymentDay),
            memo: expense.memo ?? "",
            startMode: "this-month",
        });

        setIsFixedFormOpen(true);
    };

    const isFixedFormValid = () => {
        const amount = Number(fixedForm.amount);
        const paymentDay = Number(fixedForm.paymentDay);

        return Boolean(fixedForm.name.trim() && amount && amount > 0 && fixedForm.categoryId && paymentDay >= 1 && paymentDay <= 31);
    };

    const submitFixedExpense = async (scope?: FixedChangeScope) => {
        if (!isFixedFormValid()) {
            return;
        }

        try {
            const payload = {
                name: fixedForm.name.trim(),
                amount: Number(fixedForm.amount),
                categoryId: Number(fixedForm.categoryId),
                paymentDay: Number(fixedForm.paymentDay),
                memo: fixedForm.memo.trim() || null,
                month: getThisMonthString(),
            };

            const response = await fetch("/api/living/fixed-expenses", {
                method: editingFixedExpense ? "PATCH" : "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(
                    editingFixedExpense
                        ? {
                              id: editingFixedExpense.id,
                              ...payload,
                              scope,
                          }
                        : {
                              ...payload,
                              startMode: fixedForm.startMode,
                          },
                ),
            });

            if (!response.ok) {
                const data = await response.json().catch(() => null);

                throw new Error(data?.error ?? t("manage.alert.fixedSaveFailed"));
            }

            setIsFixedScopeSheetOpen(false);
            setIsFixedFormOpen(false);
            setEditingFixedExpense(null);

            await loadFixedExpenses();
        } catch (error) {
            console.error(error);

            setIsFixedScopeSheetOpen(false);

            showAlert(error instanceof Error ? error.message : t("manage.alert.fixedSaveFailed"));
        }
    };

    const saveFixedExpense = async () => {
        if (!isFixedFormValid()) {
            return;
        }

        // 금액이나 결제일이 바뀌면 언제부터 적용할지 먼저 묻는다 (시작 전 항목은 묻지 않는다)
        if (
            editingFixedExpense &&
            !editingFixedExpense.isUpcoming &&
            (Number(fixedForm.amount) !== editingFixedExpense.amount || Number(fixedForm.paymentDay) !== editingFixedExpense.paymentDay)
        ) {
            setIsFixedScopeSheetOpen(true);
            return;
        }

        await submitFixedExpense();
    };

    const requestDeleteFixedExpense = async (expense: FixedExpense) => {
        // 시작 전 항목은 지울 방식이 하나뿐이다
        if (expense.isUpcoming) {
            if (await confirm(t("manage.confirm.deleteFixed"))) {
                await deleteFixedExpense(expense.id, "all");
            }

            return;
        }

        setFixedDeleteTarget(expense);
    };

    const deleteFixedExpense = async (id: number, mode: FixedDeleteMode) => {
        try {
            const response = await fetch(`/api/living/fixed-expenses?id=${id}&mode=${mode}&month=${getThisMonthString()}`, {
                method: "DELETE",
            });

            if (!response.ok) {
                throw new Error("고정지출을 삭제하지 못했습니다.");
            }

            setFixedDeleteTarget(null);
            setIsFixedFormOpen(false);
            setEditingFixedExpense(null);

            await loadFixedExpenses();
        } catch (error) {
            console.error(error);

            setFixedDeleteTarget(null);

            showAlert(t("manage.alert.fixedDeleteFailed"));
        }
    };

    const reorderFixedExpenses = async (draggedId: number, targetId: number) => {
        if (draggedId === targetId) {
            return;
        }

        const next = [...fixedExpenses];

        const fromIndex = next.findIndex((item) => item.id === draggedId);
        const toIndex = next.findIndex((item) => item.id === targetId);

        if (fromIndex === -1 || toIndex === -1) {
            return;
        }

        const [removed] = next.splice(fromIndex, 1);

        next.splice(toIndex, 0, removed);

        const reordered = next.map((item, index) => ({
            ...item,
            sortOrder: index,
        }));

        setFixedExpenses(reordered);

        try {
            const response = await fetch("/api/living/fixed-expenses/reorder", {
                method: "PATCH",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    ids: reordered.map((item) => item.id),
                }),
            });

            if (!response.ok) {
                throw new Error("고정지출 순서를 저장하지 못했습니다.");
            }
        } catch (error) {
            console.error(error);

            await loadFixedExpenses();
        }
    };

    const openAddCategoryForm = (kind: CategoryKind) => {
        if (isFree) {
            openUpgrade("living-category");
            return;
        }

        setEditingCategory(null);

        setCategoryForm({
            name: "",
            kind,
        });

        setIsCategoryFormOpen(true);
    };

    const openEditCategoryForm = (category: LivingCategory) => {
        if (isFree) {
            openUpgrade("living-category");
            return;
        }

        setEditingCategory(category);

        setCategoryForm({
            name: category.name,
            kind: category.kind,
        });

        setIsCategoryFormOpen(true);
    };

    const saveCategory = async () => {
        if (isFree) {
            openUpgrade("living-category");
            return;
        }

        const name = categoryForm.name.trim();

        if (!name) {
            return;
        }

        try {
            const response = await fetch("/api/living/categories", {
                method: editingCategory ? "PATCH" : "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(
                    editingCategory
                        ? {
                              id: editingCategory.id,
                              name,
                          }
                        : {
                              name,
                              kind: categoryForm.kind,
                          },
                ),
            });

            const data = await response.json().catch(() => null);

            if (!response.ok) {
                throw new Error(data?.error ?? t("manage.alert.categorySaveFailed"));
            }

            await loadCategories();

            if (!editingCategory && data?.category?.id) {
                const newCategoryId = String(data.category.id);

                if (categoryForm.kind === "fixed") {
                    setFixedForm((prev) => ({
                        ...prev,
                        categoryId: newCategoryId,
                    }));
                }

                if (categoryForm.kind === "variable") {
                    setForm((prev) => ({
                        ...prev,
                        categoryId: newCategoryId,
                    }));
                }

                if (categoryForm.kind === "income") {
                    setForm((prev) => ({
                        ...prev,
                        categoryId: newCategoryId,
                    }));
                }
            }

            setIsCategoryFormOpen(false);
            setEditingCategory(null);
        } catch (error) {
            console.error(error);
        }
    };

    const deleteCategory = async (category: LivingCategory) => {
        if (isFree) {
            openUpgrade("living-category");
            return;
        }

        if (!await confirm(t("manage.confirm.deleteCategory", { name: getCategoryLabel(category.name, t) }))) {
            return;
        }

        try {
            const response = await fetch(`/api/living/categories?id=${category.id}`, {
                method: "DELETE",
            });

            if (!response.ok) {
                const data = await response.json().catch(() => null);

                throw new Error(data?.error ?? t("manage.alert.categoryDeleteFailed"));
            }

            if (form.categoryId === String(category.id)) {
                setForm((prev) => ({
                    ...prev,
                    categoryId: "",
                }));
            }

            if (fixedForm.categoryId === String(category.id)) {
                setFixedForm((prev) => ({
                    ...prev,
                    categoryId: "",
                }));
            }

            await loadCategories();
        } catch (error) {
            console.error(error);
        }
    };

    const categoryModalCategories = categories.filter((category) => category.kind === categoryForm.kind);

    // 처음 불러오는 동안에는 로딩 화면만 보여준다 (헤더가 비쳐 보이지 않게)
    if (loading && fixedLoading) {
        return <LoadingScreen />;
    }

    return (
        <div className="mx-auto max-w-md">
            <BackButtonHeader href="/living" title={t("manage.title")} description={t("manage.description")} />

            <UsageMeter
                label={t("manage.usageLabel")}
                used={totalTransactionCount}
                limit={FREE_LIVING_TRANSACTION_LIMIT}
                reason="living-limit"
                className="mt-6"
            />

            {/* Month navigation */}
            <div className="mt-10 flex items-center justify-between">
                <button
                    type="button"
                    onClick={() => moveMonth(-1)}
                    className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-gray-500 shadow-sm transition-colors hover:bg-gray-50"
                >
                    <ChevronLeft size={18} />
                </button>

                <p className="text-[15px] font-semibold text-gray-900">{monthLabel}</p>

                <button
                    type="button"
                    onClick={() => moveMonth(1)}
                    className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-gray-500 shadow-sm transition-colors hover:bg-gray-50"
                >
                    <ChevronRight size={18} />
                </button>
            </div>

            {/* Monthly summary */}
            <section className="mt-5 rounded-[28px] bg-white px-6 py-5 shadow-sm">
                <div className="flex items-center">
                    <div className="flex flex-1 items-center justify-between pr-5">
                        <span className="text-[12px] font-medium text-gray-400">{t("manage.type.income")}</span>

                        <span className="text-[15px] font-semibold text-gray-900">
                            +{formatMoney(monthTotals.income, currency)}
                        </span>
                    </div>

                    <div className="h-5 w-px bg-gray-100" />

                    <div className="flex flex-1 items-center justify-between pl-5">
                        <span className="text-[12px] font-medium text-gray-400">{t("manage.type.expense")}</span>

                        <span className="text-[15px] font-semibold text-gray-900">
                            -{formatMoney(monthTotals.expense, currency)}
                        </span>
                    </div>
                </div>
            </section>

            {/* Fixed expenses */}
            <section className="mt-5 rounded-[28px] bg-white p-5 shadow-sm">
                <div className="flex items-start justify-between">
                    <div>
                        <p className="text-xs text-gray-400">{t("manage.fixed.manage")}</p>

                        <div className="mt-1 flex items-center gap-2">
                            <h2 className="text-lg font-semibold">{t("manage.fixed.title")}</h2>

                            {planCode === "free" && (
                                <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-1 text-[10px] font-semibold text-gray-400">
                                    <Lock size={10} strokeWidth={2} />
                                    Pro
                                </span>
                            )}
                        </div>
                    </div>

                    {planCode !== "free" && fixedExpenses.length > 0 && (
                        <p className="text-[13px] font-medium text-gray-500">
                            {formatMoney(fixedExpenseTotal, currency)}
                            {t("manage.fixed.perMonth")}
                        </p>
                    )}
                </div>

                {planCode === "free" ? (
                    <div className="mt-5 rounded-2xl bg-[#F7F7F5] px-5 py-7 text-center">
                        <Lock size={18} className="mx-auto text-gray-300" />

                        <p className="mt-3 text-sm font-medium text-gray-600">{t("manage.fixed.proOnly")}</p>

                        <p className="mt-1 text-xs text-gray-400">{t("manage.fixed.proBody")}</p>

                        <button
                            type="button"
                            onClick={() => openUpgrade("fixed-expense")}
                            className="mt-4 rounded-full bg-gray-900 px-4 py-2 text-xs font-medium text-white"
                        >
                            {t("manage.fixed.learnPro")}
                        </button>
                    </div>
                ) : (
                    <>
                        <div className="mt-5">
                            {fixedLoading ? (
                                <InlineLoading />
                            ) : fixedExpenses.length === 0 ? (
                                <div className="rounded-2xl bg-[#F7F7F5] px-5 py-7 text-center">
                                    <p className="text-sm font-medium text-gray-600">{t("manage.fixed.emptyTitle")}</p>

                                    <p className="mt-1 text-xs text-gray-400">{t("manage.fixed.emptyBody")}</p>
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    {fixedExpenses.map((expense) => (
                                        <div
                                            key={expense.id}
                                            draggable
                                            onDragStart={() => setDraggedFixedId(expense.id)}
                                            onDragOver={(event) => event.preventDefault()}
                                            onDrop={() => {
                                                if (draggedFixedId !== null) {
                                                    reorderFixedExpenses(draggedFixedId, expense.id);
                                                }

                                                setDraggedFixedId(null);
                                            }}
                                            className="group flex items-center gap-3 rounded-2xl bg-[#F7F7F5] px-3.5 py-3"
                                        >
                                            <GripVertical size={16} className="shrink-0 cursor-grab text-gray-300" />

                                            <div className="min-w-0 flex-1">
                                                <div className="flex items-center gap-2">
                                                    <p className="truncate text-sm font-medium text-gray-800">{expense.name}</p>

                                                    <span className="shrink-0 text-[10px] text-gray-400">
                                                        {t("manage.fixed.dayShort", { day: expense.paymentDay })}
                                                    </span>

                                                    {expense.isUpcoming && expense.startMonth && (
                                                        <span className="shrink-0 rounded-full bg-white px-2 py-0.5 text-[10px] font-medium text-gray-500">
                                                            {t("manage.fixed.startsFrom", { month: new Date(2000, Number(expense.startMonth.slice(5)) - 1, 1).toLocaleDateString(locale, { month: "short" }) })}
                                                        </span>
                                                    )}
                                                </div>

                                                <p className="mt-0.5 text-xs text-gray-400">{getCategoryLabel(expense.categoryName, t)}</p>
                                            </div>

                                            <p className="shrink-0 text-sm font-medium text-gray-900">
                                                {formatMoney(expense.amount, currency)}
                                            </p>

                                            <button
                                                type="button"
                                                onClick={() => openEditFixedForm(expense)}
                                                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-gray-300 transition-all hover:bg-white hover:text-gray-600 group-hover:opacity-100 md:opacity-0"
                                            >
                                                <Pencil size={14} />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        <button
                            type="button"
                            onClick={openAddFixedForm}
                            className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-gray-200 py-3 text-[13px] font-medium text-gray-500 transition-colors hover:border-gray-300 hover:bg-gray-50"
                        >
                            <Plus size={16} />
                            {t("manage.fixed.add")}
                        </button>
                    </>
                )}
            </section>

            {/* Calendar */}
            <section className="mt-5 rounded-[28px] bg-white p-5 pt-10 shadow-sm">
                <div className="grid grid-cols-7 text-center">
                    {Array.from({ length: 7 }, (_, index) =>
                        new Date(2023, 0, 1 + index).toLocaleDateString(locale, { weekday: "short" }),
                    ).map((day) => (
                        <div key={day} className="pb-3 text-[11px] font-medium text-gray-400">
                            {day}
                        </div>
                    ))}
                </div>

                {loading ? (
                    <div className="flex h-96 items-center justify-center">
                        <InlineLoading />
                    </div>
                ) : (
                    <div className="grid grid-cols-7 gap-y-1">
                        {calendarCells.map((day, index) => {
                            if (day === null) {
                                return <div key={`empty-${index}`} className="h-[68px]" />;
                            }

                            const date = formatDate(new Date(year, month, day));

                            const holiday = holidays.find((item) => item.date === date);

                            const isSelected = selectedDate === date;

                            const dayTransactions = getDayTransactions(day);

                            const normalTransactions = dayTransactions.filter((transaction) => transaction.type !== "transfer");

                            const savingsTransactions = dayTransactions.filter((transaction) => transaction.type === "transfer");

                            const normalNet = normalTransactions.reduce(
                                (sum, transaction) => sum + getTransactionNet(transaction),
                                0,
                            );

                            const savingsNet = savingsTransactions.reduce(
                                (sum, transaction) => sum + getTransactionNet(transaction),
                                0,
                            );

                            const hasNormalTransactions = normalTransactions.length > 0;
                            const hasSavings = savingsTransactions.length > 0;

                            return (
                                <button
                                    key={date}
                                    type="button"
                                    onClick={() => setSelectedDate(date)}
                                    className="flex h-[68px] flex-col items-center rounded-2xl pt-1.5 transition-colors hover:bg-gray-50"
                                >
                                    <span
                                        className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-medium ${
                                            isSelected
                                                ? holiday
                                                    ? "bg-gray-900 text-red-500"
                                                    : "bg-gray-900 text-white"
                                                : holiday
                                                  ? "text-red-500"
                                                  : "text-gray-700"
                                        }`}
                                    >
                                        {day}
                                    </span>

                                    {hasNormalTransactions && (
                                        <span
                                            className={`mt-1 max-w-full truncate px-0.5 text-[9px] font-medium ${
                                                normalNet > 0
                                                    ? "text-[#C66B6B]"
                                                    : normalNet < 0
                                                      ? "text-[#718FB8]"
                                                      : "text-gray-400"
                                            }`}
                                        >
                                            {normalNet > 0 ? "+" : normalNet < 0 ? "−" : ""}
                                            {formatMoney(normalNet, currency)}
                                        </span>
                                    )}

                                    {hasSavings && (
                                        <span className="max-w-full truncate px-0.5 text-[9px] font-medium text-[#7FA58D]">
                                            {formatMoney(Math.abs(savingsNet), currency)}
                                        </span>
                                    )}

                                    {holiday && !hasNormalTransactions && !hasSavings && (
                                        <span className="mt-0.5 max-w-full truncate px-0.5 text-[8px] font-medium text-red-500">
                                            {holiday.name}
                                        </span>
                                    )}
                                </button>
                            );
                        })}
                    </div>
                )}

                <div className="mt-4 flex items-center gap-4 text-xs text-gray-400">
                    <div className="flex items-center gap-2">
                        <span className="h-2.5 w-2.5 rounded-full bg-red-500" />
                        {t("manage.legend.holiday")}
                    </div>

                    <div className="flex items-center gap-2">
                        <span className="h-2.5 w-2.5 rounded-full bg-gray-900" />
                        {t("manage.legend.selected")}
                    </div>
                </div>
            </section>

            {/* Selected day details */}
            <section className="mt-5 rounded-[28px] bg-white p-5 shadow-sm">
                <div className="flex items-end justify-between">
                    <div>
                        <p className="text-xs text-gray-400">{t("manage.legend.selected")}</p>

                        <h2 className={`mt-1 text-lg font-semibold ${selectedHoliday ? "text-red-500" : "text-gray-900"}`}>
                            {selectedDateLabel}
                        </h2>

                        {selectedHoliday && <p className="mt-1 text-xs font-medium text-red-500">{selectedHoliday.name}</p>}
                    </div>

                    {selectedTransactions.length > 0 && <p className="text-xs text-gray-400">{t("manage.count", { count: selectedTransactions.length })}</p>}
                </div>

                {selectedTransactions.length === 0 ? (
                    <div className="mt-6 rounded-2xl bg-[#F7F7F5] px-5 py-8 text-center">
                        <p className="text-sm font-medium text-gray-600">{t("manage.day.emptyTitle")}</p>

                        <p className="mt-1 text-xs text-gray-400">{t("manage.day.emptyBody")}</p>
                    </div>
                ) : (
                    <div className="mt-5 divide-y divide-gray-100">
                        {selectedTransactions.map((transaction) => {
                            const net = getTransactionNet(transaction);

                            return (
                                <button
                                    key={transaction.id}
                                    type="button"
                                    onClick={() => openEditForm(transaction)}
                                    className="flex w-full items-center justify-between py-4 text-left first:pt-0 last:pb-0"
                                >
                                    <div className="min-w-0 pr-4">
                                        <div className="flex items-center gap-2">
                                            <span
                                                className={`text-[10px] font-semibold ${
                                                    transaction.type === "transfer"
                                                        ? "text-[#7FA58D]"
                                                        : net > 0
                                                          ? "text-[#C66B6B]"
                                                          : "text-[#718FB8]"
                                                }`}
                                            >
                                                {transaction.type === "transfer" ? t("manage.type.saving") : net > 0 ? t("manage.type.income") : t("manage.type.expense")}{" "}
                                            </span>

                                            <p className="truncate text-sm font-medium text-gray-800">
                                                {getTransactionLabel(transaction, t)}
                                            </p>
                                        </div>

                                        {transaction.memo && (
                                            <p className="mt-1 truncate text-xs text-gray-400">{transaction.memo}</p>
                                        )}
                                    </div>

                                    <p className="shrink-0 text-[15px] font-medium text-gray-900">
                                        {net > 0 ? "+" : net < 0 ? "−" : ""}
                                        {formatMoney(net, currency)}
                                    </p>
                                </button>
                            );
                        })}
                    </div>
                )}

                <div className="mt-6 grid grid-cols-2 gap-2">
                    <button
                        type="button"
                        onClick={() => openAddForm(selectedDate)}
                        className={`flex items-center justify-center gap-1.5 rounded-2xl py-3.5 text-[13px] font-medium transition-colors ${
                            isLivingTransactionLimitReached
                                ? "bg-gray-100 text-gray-400"
                                : "bg-gray-900 text-white hover:bg-gray-800"
                        }`}
                    >
                        {isLivingTransactionLimitReached ? <Lock size={15} /> : <Plus size={16} />}

                        {isLivingTransactionLimitReached ? t("manage.limitReached") : t("manage.recordExpense")}
                    </button>

                    <button
                        type="button"
                        onClick={() => {
                            if (isLivingTransactionLimitReached) {
                                openUpgrade("living-limit");
                                return;
                            }

                            setEditingTransaction(null);

                            setForm({
                                date: selectedDate,
                                type: "income",
                                amount: "",
                                categoryId: "",
                                memo: "",
                                transferDirection: "living_to_savings",
                            });

                            setIsFormOpen(true);
                        }}
                        className={`flex items-center justify-center gap-1.5 rounded-2xl py-3.5 text-[13px] font-medium transition-colors ${
                            isLivingTransactionLimitReached
                                ? "bg-gray-100 text-gray-400"
                                : "bg-[#F7F7F5] text-gray-700 hover:bg-gray-100"
                        }`}
                    >
                        {isLivingTransactionLimitReached ? <Lock size={15} /> : <Plus size={16} />}

                        {isLivingTransactionLimitReached ? t("manage.limitReached") : t("manage.recordIncome")}
                    </button>
                </div>
            </section>

            {/* Transaction modal */}
            {isTransactionFormMounted && (
                <div className="fixed inset-0 z-[140]">
                    {/* Backdrop */}
                    <button
                        type="button"
                        aria-label={t("common.close")}
                        onClick={() => setIsFormOpen(false)}
                        className={`absolute inset-0 bg-black/30 transition-opacity duration-300 ease-out ${
                            isTransactionFormAnimating ? "opacity-100" : "opacity-0"
                        }`}
                    />

                    {/* Bottom sheet */}
                    <div
                        className={`absolute inset-x-0 bottom-0 mx-auto flex max-h-[95dvh] w-full max-w-md flex-col rounded-t-[2rem] bg-gray-50 shadow-2xl transform-gpu transition-transform duration-[350ms] ease-[cubic-bezier(0.22,1,0.36,1)] ${
                            isTransactionFormAnimating ? "translate-y-0" : "translate-y-full"
                        }`}
                    >
                        {/* Drag handle */}
                        <div className="flex shrink-0 items-center justify-center px-6 pb-3 pt-3">
                            <div className="h-1.5 w-10 rounded-full bg-gray-300" />
                        </div>

                        {/* Scroll area */}
                        <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-8 pt-2">
                            <div className="mb-6 flex items-center justify-between">
                                <div>
                                    <p className="text-xs text-gray-400">{t("manage.sheet.label")}</p>

                                    <h2 className="mt-1 text-xl font-semibold text-gray-900">
                                        {editingTransaction ? t("manage.sheet.edit") : t("manage.sheet.add")}
                                    </h2>
                                </div>

                            </div>

                            <div className="space-y-4">
                                <div className="grid grid-cols-3 gap-2">
                                    <button
                                        type="button"
                                        onClick={() =>
                                            setForm((prev) => ({
                                                ...prev,
                                                type: "expense",
                                                categoryId: "",
                                            }))
                                        }
                                        className={`rounded-2xl py-3 text-sm font-medium ${
                                            form.type === "expense" ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-500"
                                        }`}
                                    >
                                        {t("manage.type.expense")}
                                    </button>

                                    <button
                                        type="button"
                                        onClick={() =>
                                            setForm((prev) => ({
                                                ...prev,
                                                type: "income",
                                                categoryId: "",
                                            }))
                                        }
                                        className={`rounded-2xl py-3 text-sm font-medium ${
                                            form.type === "income" ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-500"
                                        }`}
                                    >
                                        {t("manage.type.income")}
                                    </button>

                                    <button
                                        type="button"
                                        onClick={() =>
                                            setForm((prev) => ({
                                                ...prev,
                                                type: "transfer",
                                                categoryId: "",
                                            }))
                                        }
                                        className={`rounded-2xl py-3 text-sm font-medium ${
                                            form.type === "transfer" ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-500"
                                        }`}
                                    >
                                        {t("manage.type.transfer")}
                                    </button>
                                </div>

                                {form.type === "transfer" && (
                                    <div className="grid grid-cols-2 gap-2">
                                        <button
                                            type="button"
                                            onClick={() =>
                                                setForm((prev) => ({
                                                    ...prev,
                                                    transferDirection: "living_to_savings",
                                                }))
                                            }
                                            className={`rounded-2xl py-3 text-xs font-medium ${
                                                form.transferDirection === "living_to_savings"
                                                    ? "bg-gray-900 text-white"
                                                    : "bg-gray-100 text-gray-500"
                                            }`}
                                        >
                                            {t("manage.transfer.toSavings")}
                                        </button>

                                        <button
                                            type="button"
                                            onClick={() =>
                                                setForm((prev) => ({
                                                    ...prev,
                                                    transferDirection: "savings_to_living",
                                                }))
                                            }
                                            className={`rounded-2xl py-3 text-xs font-medium ${
                                                form.transferDirection === "savings_to_living"
                                                    ? "bg-gray-900 text-white"
                                                    : "bg-gray-100 text-gray-500"
                                            }`}
                                        >
                                            {t("manage.transfer.toLiving")}
                                        </button>
                                    </div>
                                )}

                                <input
                                    type="date"
                                    value={form.date}
                                    onChange={(event) =>
                                        setForm((prev) => ({
                                            ...prev,
                                            date: event.target.value,
                                        }))
                                    }
                                    className="w-full rounded-2xl bg-gray-100 px-4 py-3.5 text-sm outline-none"
                                />

                                <div className="flex items-center rounded-2xl bg-gray-100 px-4 py-3">
                                    <span className="mr-2 text-lg font-medium text-gray-400">{getCurrencySymbol(currency)}</span>

                                    <input
                                        type="number"
                                        step={currency === "KRW" ? "1" : "0.01"}
                                        min="0"
                                        inputMode="decimal"
                                        placeholder={currency === "KRW" ? "0" : "0.00"}
                                        value={form.amount}
                                        onChange={(event) =>
                                            setForm((prev) => ({
                                                ...prev,
                                                amount: event.target.value,
                                            }))
                                        }
                                        className="w-full bg-transparent text-xl font-semibold text-gray-900 outline-none"
                                    />
                                </div>

                                {form.type === "expense" && (
                                    <div>
                                        <select
                                            value={form.categoryId}
                                            onChange={(event) =>
                                                setForm((prev) => ({
                                                    ...prev,
                                                    categoryId: event.target.value,
                                                }))
                                            }
                                            className="w-full rounded-2xl bg-gray-100 px-4 py-3.5 text-sm outline-none"
                                        >
                                            <option value="">{t("manage.category.select")}</option>

                                            {categories
                                                .filter((category) => category.kind === "variable")
                                                .map((category) => (
                                                    <option key={category.id} value={category.id}>
                                                        {getCategoryLabel(category.name, t)}
                                                    </option>
                                                ))}
                                        </select>

                                        <button
                                            type="button"
                                            onClick={() => openAddCategoryForm("variable")}
                                            className={`mt-2 flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed py-3 text-[13px] font-medium transition-colors ${
                                                isFree
                                                    ? "border-gray-100 bg-gray-50 text-gray-300"
                                                    : "border-gray-200 text-gray-500 hover:border-gray-300 hover:bg-gray-50"
                                            }`}
                                        >
                                            {isFree ? <Lock size={14} /> : <Plus size={15} />}
                                            {t("manage.category.addButton")}
                                            {isFree && <ProBadge />}
                                        </button>
                                    </div>
                                )}

                                {form.type === "income" && (
                                    <div>
                                        <select
                                            value={form.categoryId}
                                            onChange={(event) =>
                                                setForm((prev) => ({
                                                    ...prev,
                                                    categoryId: event.target.value,
                                                }))
                                            }
                                            className="w-full rounded-2xl bg-gray-100 px-4 py-3.5 text-sm outline-none"
                                        >
                                            <option value="">{t("manage.category.select")}</option>

                                            {categories
                                                .filter((category) => category.kind === "income")
                                                .map((category) => (
                                                    <option key={category.id} value={category.id}>
                                                        {getCategoryLabel(category.name, t)}
                                                    </option>
                                                ))}
                                        </select>

                                        <button
                                            type="button"
                                            onClick={() => openAddCategoryForm("income")}
                                            className={`mt-2 flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed py-3 text-[13px] font-medium transition-colors ${
                                                isFree
                                                    ? "border-gray-100 bg-gray-50 text-gray-300"
                                                    : "border-gray-200 text-gray-500 hover:border-gray-300 hover:bg-gray-50"
                                            }`}
                                        >
                                            {isFree ? <Lock size={14} /> : <Plus size={15} />}
                                            {t("manage.category.addButton")}
                                            {isFree && <ProBadge />}
                                        </button>
                                    </div>
                                )}

                                {form.type !== "transfer" && (
                                    <textarea
                                        placeholder={t("manage.memo")}
                                        value={form.memo}
                                        onChange={(event) =>
                                            setForm((prev) => ({
                                                ...prev,
                                                memo: event.target.value,
                                            }))
                                        }
                                        rows={3}
                                        className="w-full resize-none rounded-2xl bg-gray-100 px-4 py-3.5 text-sm outline-none"
                                    />
                                )}

                                <div className="flex gap-3">
                                    <button
                                        type="button"
                                        onClick={saveTransaction}
                                        className="flex-1 rounded-2xl bg-gray-900 py-3.5 text-sm font-medium text-white"
                                    >
                                        {editingTransaction ? t("manage.btn.update") : t("manage.btn.record")}
                                    </button>

                                    {editingTransaction && (
                                        <button
                                            type="button"
                                            onClick={() => deleteTransaction(editingTransaction.id)}
                                            className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-red-50 py-3.5 text-sm font-medium text-red-500"
                                        >
                                            <Trash2 size={16} />
                                            {t("manage.btn.delete")}
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Fixed expense modal */}
            {isFixedFormMounted && (
                <div className="fixed inset-0 z-[150]">
                    <button
                        type="button"
                        aria-label={t("common.close")}
                        onClick={() => setIsFixedFormOpen(false)}
                        className={`absolute inset-0 bg-black/30 transition-opacity duration-300 ease-out ${
                            isFixedFormAnimating ? "opacity-100" : "opacity-0"
                        }`}
                    />

                    <div
                        className={`absolute inset-x-0 bottom-0 mx-auto flex max-h-[95dvh] w-full max-w-md flex-col rounded-t-[2rem] bg-gray-50 shadow-2xl transform-gpu transition-transform duration-[350ms] ease-[cubic-bezier(0.22,1,0.36,1)] ${
                            isFixedFormAnimating ? "translate-y-0" : "translate-y-full"
                        }`}
                    >
                        <div className="flex shrink-0 items-center justify-center px-6 pb-3 pt-3">
                            <div className="h-1.5 w-10 rounded-full bg-gray-300" />
                        </div>

                        <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-8 pt-2">
                            <div className="mb-6 flex items-center justify-between">
                                <div>
                                    <p className="text-xs text-gray-400">{t("manage.fixed.title")}</p>

                                    <h2 className="mt-1 text-xl font-semibold text-gray-900">
                                        {editingFixedExpense ? t("manage.fixed.edit") : t("manage.fixed.add")}
                                    </h2>
                                </div>
                            </div>

                            <div className="space-y-4">
                                <input
                                    type="text"
                                    placeholder={t("manage.fixed.namePlaceholder")}
                                    value={fixedForm.name}
                                    onChange={(event) =>
                                        setFixedForm((prev) => ({
                                            ...prev,
                                            name: event.target.value,
                                        }))
                                    }
                                    className="w-full rounded-2xl bg-gray-100 px-4 py-3.5 text-sm outline-none"
                                />

                                <div className="flex items-center rounded-2xl bg-gray-100 px-4 py-3">
                                    <span className="mr-2 text-lg font-medium text-gray-400">{getCurrencySymbol(currency)}</span>

                                    <input
                                        type="number"
                                        inputMode="decimal"
                                        placeholder={currency === "KRW" ? "0" : "0.00"}
                                        step={currency === "KRW" ? "1" : "0.01"}
                                        min="0"
                                        value={fixedForm.amount}
                                        onChange={(event) =>
                                            setFixedForm((prev) => ({
                                                ...prev,
                                                amount: event.target.value,
                                            }))
                                        }
                                        className="w-full bg-transparent text-xl font-semibold text-gray-900 outline-none"
                                    />
                                </div>

                                {!editingFixedExpense && (
                                    <div className="grid grid-cols-2 gap-2">
                                        {(
                                            [
                                                ["this-month", t("manage.start.thisMonth")],
                                                ["next-month", t("manage.start.nextMonth")],
                                            ] as const
                                        ).map(([value, label]) => (
                                            <button
                                                key={value}
                                                type="button"
                                                onClick={() => setFixedForm((prev) => ({ ...prev, startMode: value }))}
                                                className={`rounded-2xl py-3 text-sm font-medium ${
                                                    fixedForm.startMode === value ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-500"
                                                }`}
                                            >
                                                {label}
                                            </button>
                                        ))}
                                    </div>
                                )}

                                <div>
                                    <div className="grid grid-cols-2 gap-2">
                                        <select
                                            value={fixedForm.categoryId}
                                            onChange={(event) =>
                                                setFixedForm((prev) => ({
                                                    ...prev,
                                                    categoryId: event.target.value,
                                                }))
                                            }
                                            className="rounded-2xl bg-gray-100 px-4 py-3.5 text-sm outline-none"
                                        >
                                            <option value="">{t("manage.category.label")}</option>

                                            {categories
                                                .filter((category) => category.kind === "fixed")
                                                .map((category) => (
                                                    <option key={category.id} value={category.id}>
                                                        {getCategoryLabel(category.name, t)}
                                                    </option>
                                                ))}
                                        </select>

                                        <select
                                            value={fixedForm.paymentDay}
                                            onChange={(event) =>
                                                setFixedForm((prev) => ({
                                                    ...prev,
                                                    paymentDay: event.target.value,
                                                }))
                                            }
                                            className="rounded-2xl bg-gray-100 px-4 py-3.5 text-sm outline-none"
                                        >
                                            {Array.from({ length: 31 }, (_, index) => index + 1).map((day) => (
                                                <option key={day} value={day}>
                                                    {t("manage.fixed.monthlyDay", { day })}
                                                </option>
                                            ))}
                                        </select>
                                    </div>

                                    <button
                                        type="button"
                                        onClick={() => openAddCategoryForm("fixed")}
                                        className={`mt-2 flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed py-3 text-[13px] font-medium transition-colors ${
                                            isFree
                                                ? "border-gray-100 bg-gray-50 text-gray-300"
                                                : "border-gray-200 text-gray-500 hover:border-gray-300 hover:bg-gray-50"
                                        }`}
                                    >
                                        {isFree ? <Lock size={14} /> : <Plus size={15} />}
                                        {t("manage.category.addButton")}
                                        {isFree && <ProBadge />}
                                    </button>
                                </div>

                                <textarea
                                    placeholder={t("manage.memo")}
                                    value={fixedForm.memo}
                                    onChange={(event) =>
                                        setFixedForm((prev) => ({
                                            ...prev,
                                            memo: event.target.value,
                                        }))
                                    }
                                    rows={3}
                                    className="w-full resize-none rounded-2xl bg-gray-100 px-4 py-3.5 text-sm outline-none"
                                />

                                <div className="flex gap-3">
                                    <button
                                        type="button"
                                        onClick={saveFixedExpense}
                                        className="flex-1 rounded-2xl bg-gray-900 py-3.5 text-sm font-medium text-white"
                                    >
                                        {editingFixedExpense ? t("manage.btn.update") : t("manage.btn.add")}
                                    </button>

                                    {editingFixedExpense && (
                                        <button
                                            type="button"
                                            onClick={() => void requestDeleteFixedExpense(editingFixedExpense)}
                                            className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-red-50 py-3.5 text-sm font-medium text-red-500"
                                        >
                                            <Trash2 size={16} />
                                            {t("manage.btn.delete")}
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* 금액·결제일을 바꿀 때: 언제부터 적용할지 */}
            <BottomSheet isOpen={isFixedScopeSheetOpen} onClose={() => setIsFixedScopeSheetOpen(false)}>
                {isFixedScopeSheetOpen && (
                    <>
                        <div className="mb-5">
                            <p className="text-xs text-gray-400">{t("manage.fixed.title")}</p>

                            <h3 className="mt-1 text-lg font-semibold tracking-[-0.03em] text-gray-900">{t("manage.scope.title")}</h3>

                            <p className="mt-2 text-sm leading-6 text-gray-500">
                                {t("manage.scope.body")}
                            </p>
                        </div>

                        <div className="space-y-2">
                            {(
                                [
                                    ["this-month-only", t("manage.scope.onlyThis"), t("manage.scope.onlyThisBody")],
                                    ["from-this-month", t("manage.scope.fromThis"), t("manage.scope.fromThisBody")],
                                    ["from-next-month", t("manage.scope.fromNext"), t("manage.scope.fromNextBody")],
                                ] as const
                            ).map(([scope, title, description]) => (
                                <button
                                    key={scope}
                                    type="button"
                                    onClick={() => void submitFixedExpense(scope)}
                                    className="w-full rounded-2xl bg-white px-4 py-4 text-left shadow-sm transition-colors active:bg-gray-50"
                                >
                                    <p className="text-sm font-semibold text-gray-900">{title}</p>

                                    <p className="mt-1 text-xs text-gray-400">{description}</p>
                                </button>
                            ))}
                        </div>
                    </>
                )}
            </BottomSheet>

            {/* 고정지출 삭제 방식 */}
            <BottomSheet isOpen={Boolean(fixedDeleteTarget)} onClose={() => setFixedDeleteTarget(null)}>
                {fixedDeleteTarget && (
                    <>
                        <div className="mb-5">
                            <p className="text-xs text-gray-400">{t("manage.fixed.title")}</p>

                            <h3 className="mt-1 text-lg font-semibold tracking-[-0.03em] text-gray-900">
                                {t("manage.delete.title", { name: fixedDeleteTarget.name })}
                            </h3>
                        </div>

                        <div className="space-y-2">
                            <button
                                type="button"
                                onClick={() => void deleteFixedExpense(fixedDeleteTarget.id, "this-month-only")}
                                className="w-full rounded-2xl bg-white px-4 py-4 text-left shadow-sm transition-colors active:bg-gray-50"
                            >
                                <p className="text-sm font-semibold text-gray-900">{t("manage.delete.onlyThis")}</p>

                                <p className="mt-1 text-xs text-gray-400">{t("manage.delete.onlyThisBody")}</p>
                            </button>

                            <button
                                type="button"
                                onClick={() => void deleteFixedExpense(fixedDeleteTarget.id, "from-this-month")}
                                className="w-full rounded-2xl bg-white px-4 py-4 text-left shadow-sm transition-colors active:bg-gray-50"
                            >
                                <p className="text-sm font-semibold text-gray-900">{t("manage.delete.fromThis")}</p>

                                <p className="mt-1 text-xs text-gray-400">{t("manage.delete.fromThisBody")}</p>
                            </button>

                            <button
                                type="button"
                                onClick={() => void deleteFixedExpense(fixedDeleteTarget.id, "all")}
                                className="w-full rounded-2xl bg-red-50 px-4 py-4 text-left transition-colors active:bg-red-100"
                            >
                                <p className="text-sm font-semibold text-red-500">{t("manage.delete.all")}</p>

                                <p className="mt-1 text-xs text-red-400">{t("manage.delete.allBody")}</p>
                            </button>
                        </div>
                    </>
                )}
            </BottomSheet>

            {/* Category modal */}
            {isCategoryFormMounted && (
                <div className="fixed inset-0 z-[160]">
                    <button
                        type="button"
                        aria-label={t("common.close")}
                        onClick={() => {
                            setIsCategoryFormOpen(false);
                            setEditingCategory(null);
                        }}
                        className={`absolute inset-0 bg-black/30 transition-opacity duration-300 ease-out ${
                            isCategoryFormAnimating ? "opacity-100" : "opacity-0"
                        }`}
                    />

                    <div
                        className={`absolute inset-x-0 bottom-0 mx-auto flex max-h-[90dvh] w-full max-w-md flex-col rounded-t-[2rem] bg-gray-50 shadow-2xl transform-gpu transition-transform duration-[350ms] ease-[cubic-bezier(0.22,1,0.36,1)] ${
                            isCategoryFormAnimating ? "translate-y-0" : "translate-y-full"
                        }`}
                    >
                        <div className="flex shrink-0 items-center justify-center px-6 pb-4 pt-3">
                            <div className="h-1.5 w-10 rounded-full bg-gray-300" />
                        </div>

                        <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-8 pt-2">
                            <div className="mb-7 flex items-center justify-between">
                                <div>
                                    <p className="text-xs text-gray-400">{t("manage.category.label")}</p>

                                    <h2 className="mt-1 text-2xl font-bold tracking-[-0.04em] text-gray-950">
                                        {editingCategory ? t("manage.category.edit") : t("manage.category.add")}
                                    </h2>
                                </div>

                                <button
                                    type="button"
                                    onClick={() => {
                                        setIsCategoryFormOpen(false);
                                        setEditingCategory(null);
                                    }}
                                    className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-gray-500 shadow-sm"
                                >
                                    <X size={17} />
                                </button>
                            </div>

                            <div className="space-y-4">
                                <input
                                    type="text"
                                    placeholder={t("manage.category.namePlaceholder")}
                                    value={categoryForm.name}
                                    onChange={(event) =>
                                        setCategoryForm((prev) => ({
                                            ...prev,
                                            name: event.target.value,
                                        }))
                                    }
                                    className="w-full rounded-3xl bg-white px-5 py-4 text-sm shadow-sm outline-none placeholder:text-gray-300"
                                    autoFocus
                                />

                                <button
                                    type="button"
                                    onClick={saveCategory}
                                    className="w-full rounded-2xl bg-gray-900 py-4 text-sm font-semibold text-white transition-colors hover:bg-gray-800"
                                >
                                    {editingCategory ? t("manage.btn.update") : t("manage.btn.add")}
                                </button>

                                {categoryModalCategories.length > 0 && (
                                    <div>
                                        <div className="mb-3 flex items-center justify-between">
                                            <p className="text-xs text-gray-400">{t("manage.category.current")}</p>

                                            {isFree && <ProBadge />}
                                        </div>

                                        <div className="space-y-2">
                                            {categoryModalCategories.map((category) => (
                                                <div
                                                    key={category.id}
                                                    className="flex items-center rounded-3xl bg-white px-5 py-3.5 shadow-sm"
                                                >
                                                    <p className="min-w-0 flex-1 truncate text-sm font-medium text-gray-700">
                                                        {getCategoryLabel(category.name, t)}
                                                    </p>

                                                    <button
                                                        type="button"
                                                        onClick={() => openEditCategoryForm(category)}
                                                        className={`flex h-8 w-8 items-center justify-center rounded-full transition-colors ${
                                                            isFree
                                                                ? "text-gray-200"
                                                                : "text-gray-300 hover:bg-gray-50 hover:text-gray-600"
                                                        }`}
                                                    >
                                                        {isFree ? <Lock size={13} /> : <Pencil size={14} />}
                                                    </button>

                                                    <button
                                                        type="button"
                                                        onClick={() => deleteCategory(category)}
                                                        className={`flex h-8 w-8 items-center justify-center rounded-full transition-colors ${
                                                            isFree
                                                                ? "text-gray-200"
                                                                : "text-gray-300 hover:bg-gray-50 hover:text-red-500"
                                                        }`}
                                                    >
                                                        {isFree ? <Lock size={13} /> : <Trash2 size={14} />}
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
