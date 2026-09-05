"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import BackButtonHeader from "@/components/BackButtonHeader";

type PayHistory = {
    startDate: string;
    endDate: string;

    hours: number;
    basePay: number;

    paychequeTips: number;
    cashTips: number;

    grossPay: number;
    deductions: number;
    cpp: number;
    cpp2: number;
    ei: number;
    federalTax: number;
    provincialTax: number;

    netPay: number;
    totalIncome: number;

    province: string;

    tipType: "cash" | "paycheque" | "both" | null;
    hasTips: boolean;
    isConfirmed: boolean;

    vacationPay: number;
};

const formatDisplayDate = (dateValue: string | Date) => {
    if (!dateValue) {
        return "";
    }

    const date = dateValue instanceof Date ? dateValue : new Date(`${dateValue}T00:00:00`);

    if (Number.isNaN(date.getTime())) {
        return String(dateValue);
    }

    return `${date.getFullYear()}. ${date.getMonth() + 1}. ${date.getDate()}.`;
};

export default function PayHistoryPage() {
    const [payHistory, setPayHistory] = useState<PayHistory[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    const [selectedHistory, setSelectedHistory] = useState<PayHistory | null>(null);

    const [isEditOpen, setIsEditOpen] = useState(false);

    const [actualHours, setActualHours] = useState("");
    const [actualCashTips, setActualCashTips] = useState("");
    const [actualPaychequeTips, setActualPaychequeTips] = useState("");

    const [isSaving, setIsSaving] = useState(false);

    const [latestPayHistory, setLatestPayHistory] = useState<{
        startDate: string;
        endDate: string;
        totalIncome: number;
        isConfirmed: boolean;
    } | null>(null);

    const loadPayHistory = async () => {
        try {
            const response = await fetch("/api/pay-history");

            if (!response.ok) {
                throw new Error("급여 기록 조회 실패");
            }

            const data: PayHistory[] = await response.json();

            setPayHistory(data);
        } catch (error) {
            console.error(error);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        let cancelled = false;

        const load = async () => {
            try {
                const response = await fetch("/api/pay-history");

                if (!response.ok) {
                    throw new Error("급여 기록 조회 실패");
                }

                const data: PayHistory[] = await response.json();

                if (!cancelled) {
                    setPayHistory(data);
                    setIsLoading(false);
                }
            } catch (error) {
                if (!cancelled) {
                    console.error(error);
                    setIsLoading(false);
                }
            }
        };

        load();

        return () => {
            cancelled = true;
        };
    }, []);

    useEffect(() => {
        const loadLatestPayHistory = async () => {
            try {
                const response = await fetch("/api/pay-history");

                if (!response.ok) {
                    return;
                }

                const data = await response.json();

                if (data.length > 0) {
                    setLatestPayHistory(data[0]);
                }
            } catch (error) {
                console.error("급여 기록 조회 실패:", error);
            }
        };

        loadLatestPayHistory();
    }, []);

    const openDetail = (history: PayHistory) => {
        setSelectedHistory(history);
    };

    const closeDetail = () => {
        setSelectedHistory(null);
        setIsEditOpen(false);
    };

    const openEdit = () => {
        if (!selectedHistory) {
            return;
        }

        setActualHours(selectedHistory.hours.toString());
        setActualCashTips(selectedHistory.cashTips.toString());
        setActualPaychequeTips(selectedHistory.paychequeTips.toString());

        setIsEditOpen(true);
    };

    const saveActualPay = async () => {
        if (!selectedHistory) {
            return;
        }

        const hours = Number(actualHours);
        const cashTips = Number(actualCashTips);
        const paychequeTips = Number(actualPaychequeTips);

        if (!Number.isFinite(hours) || hours < 0) {
            alert("근무시간을 확인해주세요.");
            return;
        }

        if (!Number.isFinite(cashTips) || cashTips < 0) {
            alert("현금 팁을 확인해주세요.");
            return;
        }

        if (!Number.isFinite(paychequeTips) || paychequeTips < 0) {
            alert("급여 포함 팁을 확인해주세요.");
            return;
        }

        try {
            setIsSaving(true);

            const response = await fetch("/api/pay-history/update", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    payPeriodStart: selectedHistory.startDate,
                    payPeriodEnd: selectedHistory.endDate,
                    actualHours: hours,
                    actualCashTips: cashTips,
                    actualPaychequeTips: paychequeTips,
                }),
            });

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.error || "급여 수정 실패");
            }

            await loadPayHistory();

            setIsEditOpen(false);
            setSelectedHistory(null);
        } catch (error) {
            console.error(error);

            alert("급여 기록을 수정하지 못했습니다.");
        } finally {
            setIsSaving(false);
        }
    };

    const confirmPay = async (history: PayHistory) => {
        try {
            const response = await fetch("/api/pay-history/confirm", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    payPeriodStart: history.startDate,
                    payPeriodEnd: history.endDate,
                }),
            });

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.error || "급여 확정 실패");
            }

            setPayHistory((prev) =>
                prev.map((item) =>
                    item.startDate === history.startDate && item.endDate === history.endDate
                        ? {
                              ...item,
                              isConfirmed: true,
                          }
                        : item,
                ),
            );

            if (
                selectedHistory &&
                selectedHistory.startDate === history.startDate &&
                selectedHistory.endDate === history.endDate
            ) {
                setSelectedHistory({
                    ...selectedHistory,
                    isConfirmed: true,
                });
            }
        } catch (error) {
            console.error(error);

            alert("급여를 확정하지 못했습니다.");
        }
    };

    if (isLoading) {
        return (
            <div className="mx-auto max-w-md">
                <p className="text-sm text-gray-400">급여 기록을 불러오는 중...</p>
            </div>
        );
    }

    return (
        <>
            <div className="mx-auto max-w-md">
                <BackButtonHeader
                    href="/salary"
                    title="급여 기록"
                    description="지난 급여 기간과 실제 수령 금액을 확인해보세요.."
                />

                {payHistory.length === 0 ? (
                    <section className="mt-6 rounded-3xl bg-white p-6 shadow-sm">
                        <p className="text-sm text-gray-400">아직 급여 기록이 없어요.</p>
                    </section>
                ) : (
                    <div className="mt-6 space-y-3">
                        {payHistory.map((history, index) => (
                            <button
                                type="button"
                                key={`${history.startDate}-${history.endDate}`}
                                onClick={() => openDetail(history)}
                                className="w-full rounded-3xl bg-white p-5 text-left shadow-sm transition hover:shadow-md"
                            >
                                <div className="flex items-center justify-between">
                                    <div>
                                        {/* 아 트루펄스는 && */}
                                        {index === 0 && <p className="text-xs text-gray-400">최근 급여</p>}

                                        <p className="mt-1 font-semibold">
                                            {formatDisplayDate(history.startDate)}
                                            {" ~ "}
                                            {formatDisplayDate(history.endDate)}
                                        </p>
                                    </div>

                                    {history.isConfirmed ? (
                                        <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs text-gray-500">
                                            ✓ 확인 완료
                                        </span>
                                    ) : (
                                        <span
                                            role="button"
                                            tabIndex={0}
                                            onClick={(event) => {
                                                event.stopPropagation();
                                                confirmPay(history);
                                            }}
                                            className="rounded-full bg-black px-3 py-1.5 text-xs font-medium text-white"
                                        >
                                            확정
                                        </span>
                                    )}
                                </div>

                                <div className="mt-5 grid grid-cols-2 gap-y-4 text-sm">
                                    <div>
                                        <p className="text-xs text-gray-400">일한 시간</p>

                                        <p className="mt-1 font-medium">
                                            {history.hours.toFixed(2)}
                                            시간
                                        </p>
                                    </div>

                                    <div>
                                        <p className="text-xs text-gray-400">팁</p>

                                        <p className="mt-1 font-medium">
                                            ${(history.cashTips + history.paychequeTips).toFixed(2)}
                                        </p>
                                    </div>

                                    <div>
                                        <p className="text-xs text-gray-400">급여</p>

                                        <p className="mt-1 font-medium">${history.netPay.toFixed(2)}</p>
                                    </div>

                                    <div>
                                        <p className="text-xs text-gray-400">총액</p>

                                        <p className="mt-1 text-lg font-bold">${history.totalIncome.toFixed(2)}</p>
                                    </div>
                                </div>
                            </button>
                        ))}
                    </div>
                )}
            </div>

            {/* 상세 모달 */}
            {selectedHistory && !isEditOpen && (
                <div
                    className="fixed inset-0 z-80 flex items-end justify-center bg-black/40 p-4 sm:items-center"
                    onClick={closeDetail}
                >
                    <div
                        className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-3xl scrollbar-hide"
                        onClick={(event) => event.stopPropagation()}
                    >
                        <section className="rounded-3xl bg-black p-6 text-white shadow-sm">
                            <div className="flex items-start justify-between">
                                <div>
                                    <p className="mt-2 text-xs text-gray-500">
                                        {formatDisplayDate(selectedHistory.startDate)}
                                        {" ~ "}
                                        {formatDisplayDate(selectedHistory.endDate)}
                                    </p>
                                </div>

                                <button type="button" onClick={closeDetail} className="text-xl text-gray-400">
                                    ×
                                </button>
                            </div>

                            <p className="mt-5 text-4xl font-bold">${selectedHistory.netPay.toFixed(2)}</p>

                            <div className="mt-6 space-y-3 text-sm">
                                <div className="flex justify-between">
                                    <span className="text-gray-400">근무시간</span>

                                    <span>
                                        {selectedHistory.hours.toFixed(2)}
                                        시간
                                    </span>
                                </div>

                                <div className="flex justify-between">
                                    <span className="text-gray-400">기본 급여</span>

                                    <span>${selectedHistory.basePay.toFixed(2)}</span>
                                </div>

                                {selectedHistory.paychequeTips > 0 && (
                                    <div className="flex justify-between">
                                        <span className="text-gray-400">급여 포함 팁</span>

                                        <span>${selectedHistory.paychequeTips.toFixed(2)}</span>
                                    </div>
                                )}

                                <div className="flex justify-between">
                                    <span className="text-gray-400">Vacation Pay (4%)</span>

                                    <span>${(selectedHistory.vacationPay ?? 0).toFixed(2)}</span>
                                </div>

                                <div className="mt-4 border-t border-gray-800 pt-4">
                                    <div className="flex justify-between">
                                        <span className="text-gray-300">세전 급여</span>

                                        <span className="font-semibold">${selectedHistory.grossPay.toFixed(2)}</span>
                                    </div>
                                </div>

                                <div className="flex justify-between">
                                    <span className="text-gray-400">예상 공제</span>

                                    <span>
                                        -$
                                        {selectedHistory.deductions.toFixed(2)}
                                    </span>
                                </div>

                                <div className="flex justify-between">
                                    <span className="text-gray-300">실수령 급여</span>

                                    <span className="font-semibold">${selectedHistory.netPay.toFixed(2)}</span>
                                </div>

                                {selectedHistory.cashTips > 0 && (
                                    <div className="mt-4 border-t border-gray-800 pt-4">
                                        <div className="flex justify-between">
                                            <span className="text-gray-400">현금 팁</span>

                                            <span>${selectedHistory.cashTips.toFixed(2)}</span>
                                        </div>
                                    </div>
                                )}

                                <div className="my-6 flex items-center justify-between rounded-2xl bg-white p-3 text-black">
                                    <span className="text-sm font-medium">
                                        {selectedHistory.cashTips > 0 ? "총 수령액" : "실수령액"}
                                    </span>

                                    <span className="text-xl font-bold">${selectedHistory.totalIncome.toFixed(2)}</span>
                                </div>
                            </div>

                            {/* 공제 상세 */}
                            <div className="mt-5 rounded-2xl bg-white/5 p-4">
                                <p className="text-xs font-medium text-gray-300">예상 공제 내역</p>

                                <div className="mt-3 space-y-2 text-xs">
                                    <div className="flex justify-between">
                                        <span className="text-gray-500">CPP</span>
                                        <span className="text-gray-300">-${selectedHistory.cpp.toFixed(2)}</span>
                                    </div>

                                    <div className="flex justify-between">
                                        <span className="text-gray-500">CPP2</span>
                                        <span className="text-gray-300">-${selectedHistory.cpp2.toFixed(2)}</span>
                                    </div>

                                    <div className="flex justify-between">
                                        <span className="text-gray-500">EI</span>
                                        <span className="text-gray-300">-${selectedHistory.ei.toFixed(2)}</span>
                                    </div>

                                    <div className="flex justify-between">
                                        <span className="text-gray-500">연방 소득세</span>
                                        <span className="text-gray-300">-${selectedHistory.federalTax.toFixed(2)}</span>
                                    </div>

                                    <div className="flex justify-between">
                                        <span className="text-gray-500">{selectedHistory.province} 소득세</span>

                                        <span className="text-gray-300">-${selectedHistory.provincialTax.toFixed(2)}</span>
                                    </div>

                                    {/* 총 공제 */}
                                    <div className="mt-3 border-t border-white/10 pt-3">
                                        <div className="flex justify-between">
                                            <span className="text-gray-300">총 공제</span>

                                            <span className="font-medium text-white">
                                                -${selectedHistory.deductions.toFixed(2)}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <p className="mt-5 text-xs text-gray-400">
                                급여 기록은 실제 근무시간과 팁을 기준으로 저장된 급여 정보입니다.
                            </p>

                            {!selectedHistory.isConfirmed && (
                                <button
                                    type="button"
                                    onClick={() => confirmPay(selectedHistory)}
                                    className="mt-6 w-full rounded-2xl bg-white px-4 py-3 text-sm font-medium text-black transition hover:bg-gray-100"
                                >
                                    이 급여 확정하기
                                </button>
                            )}

                            {selectedHistory.isConfirmed && (
                                <div className="mt-6 w-full rounded-2xl bg-white/10 px-4 py-3 text-center text-sm text-gray-300">
                                    ✓ 확인 완료
                                </div>
                            )}

                            <button
                                type="button"
                                onClick={openEdit}
                                className="mt-3 w-full rounded-2xl border border-white/10 px-4 py-3 text-sm font-medium text-white transition hover:bg-white/10"
                            >
                                실제 급여와 다른가요?
                                <span className="ml-1">→</span>
                            </button>
                        </section>
                    </div>
                </div>
            )}

            {/* 수정 모달 */}
            {selectedHistory && isEditOpen && (
                <div
                    className="fixed inset-0 z-[60] flex items-end justify-center bg-black/40 p-4 sm:items-center"
                    onClick={() => setIsEditOpen(false)}
                >
                    <div
                        className="w-full max-w-md rounded-3xl bg-white p-6 shadow-xl"
                        onClick={(event) => event.stopPropagation()}
                    >
                        <div className="flex items-center justify-between">
                            <div>
                                <h2 className="text-xl font-bold">실제 급여 확인</h2>

                                <p className="mt-1 text-sm text-gray-400">실제 내역과 달랐던 부분만 수정해주세요.</p>
                            </div>

                            <button type="button" onClick={() => setIsEditOpen(false)} className="text-xl text-gray-400">
                                ×
                            </button>
                        </div>

                        <div className="mt-6 space-y-5">
                            <div>
                                <label className="text-sm font-medium">총 근무시간</label>

                                <div className="mt-2 flex items-center gap-2">
                                    <input
                                        type="number"
                                        min="0"
                                        step="0.1"
                                        value={actualHours}
                                        onChange={(e) => {
                                            const value = e.target.value;

                                            if (value === "") {
                                                setActualHours("");
                                                return;
                                            }

                                            setActualHours(value.replace(/^0+(?=\d)/, ""));
                                        }}
                                        className="w-full rounded-2xl border border-gray-200 px-4 py-3 outline-none focus:border-black"
                                    />

                                    <span className="text-sm text-gray-400">시간</span>
                                </div>
                            </div>

                            {selectedHistory.hasTips &&
                                (selectedHistory.tipType === "paycheque" || selectedHistory.tipType === "both") && (
                                    <div>
                                        <label className="text-sm font-medium">급여 포함 팁</label>

                                        <div className="mt-2 flex items-center gap-2">
                                            <span className="text-gray-400">$</span>

                                            <input
                                                type="number"
                                                min="0"
                                                step="0.01"
                                                value={actualPaychequeTips}
                                                onChange={(e) => {
                                                    const value = e.target.value;

                                                    if (value === "") {
                                                        setActualPaychequeTips("");
                                                        return;
                                                    }

                                                    setActualPaychequeTips(value.replace(/^0+(?=\d)/, ""));
                                                }}
                                                className="w-full rounded-2xl border border-gray-200 px-4 py-3 outline-none focus:border-black"
                                            />
                                        </div>
                                    </div>
                                )}

                            {selectedHistory.hasTips &&
                                (selectedHistory.tipType === "cash" || selectedHistory.tipType === "both") && (
                                    <div>
                                        <label className="text-sm font-medium">현금 팁</label>

                                        <div className="mt-2 flex items-center gap-2">
                                            <span className="text-gray-400">$</span>

                                            <input
                                                type="number"
                                                min="0"
                                                step="0.01"
                                                value={actualCashTips}
                                                onChange={(e) => {
                                                    const value = e.target.value;

                                                    if (value === "") {
                                                        setActualCashTips("");
                                                        return;
                                                    }

                                                    setActualCashTips(value.replace(/^0+(?=\d)/, ""));
                                                }}
                                                className="w-full rounded-2xl border border-gray-200 px-4 py-3 outline-none focus:border-black"
                                            />
                                        </div>
                                    </div>
                                )}
                        </div>

                        <div className="mt-6 rounded-2xl bg-gray-50 p-4">
                            <p className="text-xs text-gray-400">저장하면 실제 근무시간과 팁이 급여 기록에 반영됩니다.</p>
                        </div>

                        <div className="mt-5 flex gap-3">
                            <button
                                type="button"
                                onClick={() => setIsEditOpen(false)}
                                className="flex-1 rounded-2xl bg-gray-100 py-3 text-sm font-medium"
                            >
                                취소
                            </button>

                            <button
                                type="button"
                                onClick={saveActualPay}
                                disabled={isSaving}
                                className="flex-1 rounded-2xl bg-black py-3 text-sm font-medium text-white disabled:opacity-50"
                            >
                                {isSaving ? "저장 중..." : "저장하기"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
