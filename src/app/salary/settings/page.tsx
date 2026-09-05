"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getPayPeriodEndDate } from "@/lib/payPeriod";
import { ArrowLeft } from "lucide-react";
import BackButtonHeader from "@/components/BackButtonHeader";

type PayType = "hourly" | "salary" | "commission" | "other";

type PayFrequency = "weekly" | "biweekly" | "semi-monthly" | "monthly" | "custom";

type TipType = "cash" | "paycheque" | "both";

type SemiMonthlyType = "first-fifteenth" | "fifteenth-end";

type Province = "ON" | "BC" | "AB" | "SK" | "MB" | "QC";

type SalarySettings = {
    province: Province;
    payType: PayType;
    payFrequency: PayFrequency;
    hasTips: boolean;
    tipType?: TipType;
    hourlyWage?: number;
    monthlySalary?: number;
    payPeriodStartDate?: string;
    payDate?: string;
    semiMonthlyType?: SemiMonthlyType;
    customPayDays?: number;
    vacationPayRate?: number;
};

export default function SalaryPage() {
    const [payType, setPayType] = useState<PayType>("hourly");
    const [payFrequency, setPayFrequency] = useState<PayFrequency>("biweekly");
    const [hasTips, setHasTips] = useState(false);
    const [tipType, setTipType] = useState<TipType>("paycheque");
    const [hourlyWage, setHourlyWage] = useState("");
    const [monthlySalary, setMonthlySalary] = useState("");
    const [payPeriodStartDate, setPayPeriodStartDate] = useState("");
    const [payDate, setPayDate] = useState("");
    const [semiMonthlyType, setSemiMonthlyType] = useState<SemiMonthlyType>("first-fifteenth");
    const [customPayDays, setCustomPayDays] = useState(14);
    const [province, setProvince] = useState<Province>("ON");

    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const loadSalarySettings = async () => {
            try {
                const response = await fetch("/api/salary-settings");

                if (!response.ok) {
                    throw new Error("급여 설정 조회 실패");
                }

                const settings: SalarySettings | null = await response.json();

                if (settings) {
                    setPayType(settings.payType ?? "hourly");
                    setPayFrequency(settings.payFrequency ?? "biweekly");
                    setHasTips(settings.hasTips ?? false);
                    setTipType(settings.tipType ?? "paycheque");

                    setHourlyWage(settings.hourlyWage !== undefined ? String(settings.hourlyWage) : "");

                    setMonthlySalary(settings.monthlySalary !== undefined ? String(settings.monthlySalary) : "");

                    setPayPeriodStartDate(settings.payPeriodStartDate ?? "");
                    setPayDate(settings.payDate ?? "");

                    setSemiMonthlyType(settings.semiMonthlyType ?? "first-fifteenth");

                    setCustomPayDays(settings.customPayDays ?? 14);

                    setProvince(settings.province ?? "ON");
                }
            } catch (error) {
                console.error(error);
            } finally {
                setIsLoading(false);
            }
        };

        loadSalarySettings();
    }, []);

    const handleSave = async () => {
        const settings: SalarySettings = {
            province,
            payType,
            payFrequency,
            hasTips,
            tipType: hasTips ? tipType : undefined,

            hourlyWage: payType === "hourly" ? Math.max(0, Number(hourlyWage) || 0) : undefined,

            monthlySalary: payType === "salary" ? Math.max(0, Number(monthlySalary) || 0) : undefined,

            payPeriodStartDate,
            payDate,

            semiMonthlyType: payFrequency === "semi-monthly" ? semiMonthlyType : undefined,

            customPayDays: payFrequency === "custom" ? Math.max(1, customPayDays || 1) : undefined,
        };

        try {
            const response = await fetch("/api/salary-settings", {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(settings),
            });

            if (!response.ok) {
                throw new Error("급여 설정 저장 실패");
            }

            alert("급여 설정이 저장됐어요!");
        } catch (error) {
            console.error(error);
            alert("급여 설정 저장에 실패했어요.");
        }
    };
    const calculatedEndDate = payPeriodStartDate
        ? getPayPeriodEndDate(payPeriodStartDate, payFrequency, semiMonthlyType, customPayDays)
        : "";

    // Loading...
    if (isLoading) {
        return (
            <div className="mx-auto max-w-md">
                <p className="text-sm text-gray-400">급여 정보를 불러오는 중...</p>
            </div>
        );
    }

    return (
        <div className="mx-auto max-w-md">
            {/* Header */}
            <BackButtonHeader href="/salary" title="급여 관리" description="급여와 근무 정보를 설정해주세요." />

            {/* Pay Type */}

            <section className="mt-6 rounded-3xl bg-white p-6 shadow-sm">
                <h2 className="text-lg font-semibold">급여 받는 방식</h2>

                <div className="mt-4 grid grid-cols-2 gap-2">
                    <button
                        type="button"
                        onClick={() => setPayType("hourly")}
                        className={`rounded-2xl p-4 text-sm font-medium ${
                            payType === "hourly" ? "bg-black text-white" : "bg-gray-100"
                        }`}
                    >
                        시급
                    </button>

                    <button
                        type="button"
                        onClick={() => {
                            setPayType("salary");
                            setPayFrequency("monthly");
                        }}
                        className={`rounded-2xl p-4 text-sm font-medium ${
                            payType === "salary" ? "bg-black text-white" : "bg-gray-100"
                        }`}
                    >
                        월급
                    </button>

                    <button
                        type="button"
                        onClick={() => setPayType("commission")}
                        className={`rounded-2xl p-4 text-sm font-medium ${
                            payType === "commission" ? "bg-black text-white" : "bg-gray-100"
                        }`}
                    >
                        커미션
                    </button>

                    <button
                        type="button"
                        onClick={() => setPayType("other")}
                        className={`rounded-2xl p-4 text-sm font-medium ${
                            payType === "other" ? "bg-black text-white" : "bg-gray-100"
                        }`}
                    >
                        기타
                    </button>
                </div>
            </section>

            {/* Pay Frequency */}

            {payType !== "salary" && (
                <section className="mt-5 rounded-3xl bg-white p-6 shadow-sm">
                    <h2 className="text-lg font-semibold">급여 받는 주기</h2>

                    <div className="mt-4 space-y-2">
                        {[
                            ["weekly", "매주"],
                            ["biweekly", "격주"],
                            ["semi-monthly", "월 2회"],
                            ["monthly", "매월"],
                            ["custom", "직접 설정"],
                        ].map(([value, label]) => (
                            <button
                                type="button"
                                key={value}
                                onClick={() => setPayFrequency(value as PayFrequency)}
                                className={`w-full rounded-2xl p-4 text-left text-sm font-medium ${
                                    payFrequency === value ? "bg-black text-white" : "bg-gray-100"
                                }`}
                            >
                                {label}
                            </button>
                        ))}
                    </div>

                    {payFrequency === "semi-monthly" && (
                        <div className="mt-4 space-y-2">
                            <p className="text-sm text-gray-500">급여 기간 규칙을 선택해주세요.</p>

                            <button
                                type="button"
                                onClick={() => setSemiMonthlyType("first-fifteenth")}
                                className={`w-full rounded-2xl p-4 text-left text-sm ${
                                    semiMonthlyType === "first-fifteenth" ? "bg-black text-white" : "bg-gray-100"
                                }`}
                            >
                                1일 ~ 15일 / 16일 ~ 말일
                            </button>

                            <button
                                type="button"
                                onClick={() => setSemiMonthlyType("fifteenth-end")}
                                className={`w-full rounded-2xl p-4 text-left text-sm ${
                                    semiMonthlyType === "fifteenth-end" ? "bg-black text-white" : "bg-gray-100"
                                }`}
                            >
                                16일 ~ 다음달 15일
                            </button>
                        </div>
                    )}

                    {payFrequency === "custom" && (
                        <div className="mt-4">
                            <p className="mb-2 text-sm text-gray-500">며칠마다 급여를 받나요?</p>

                            <div className="flex items-center gap-3">
                                <input
                                    type="number"
                                    min="1"
                                    value={customPayDays}
                                    onChange={(e) => setCustomPayDays(Math.max(1, Number(e.target.value) || 1))}
                                    className="w-full rounded-2xl bg-gray-100 px-4 py-4 outline-none"
                                />

                                <span className="shrink-0 text-sm text-gray-500">일마다</span>
                            </div>
                        </div>
                    )}
                </section>
            )}

            {/* Hourly Wage */}

            {payType === "hourly" && (
                <section className="mt-5 rounded-3xl bg-white p-6 shadow-sm">
                    <h2 className="text-lg font-semibold">시급</h2>

                    <div className="mt-4 flex items-center rounded-2xl bg-gray-100 px-4">
                        <span className="text-gray-500">$</span>

                        <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={hourlyWage}
                            onChange={(e) => {
                                const value = Number(e.target.value);

                                setHourlyWage(value < 0 ? "0" : e.target.value);
                            }}
                            placeholder="17.60"
                            className="w-full bg-transparent px-2 py-4 outline-none"
                        />
                    </div>
                </section>
            )}

            {/* Monthly Salary */}

            {payType === "salary" && (
                <section className="mt-5 rounded-3xl bg-white p-6 shadow-sm">
                    <h2 className="text-lg font-semibold">월급</h2>

                    <div className="mt-4 flex items-center rounded-2xl bg-gray-100 px-4">
                        <span className="text-gray-500">$</span>

                        <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={monthlySalary}
                            onChange={(e) => {
                                const value = Number(e.target.value);

                                setMonthlySalary(value < 0 ? "0" : e.target.value);
                            }}
                            placeholder="3000"
                            className="w-full bg-transparent px-2 py-4 outline-none"
                        />
                    </div>
                </section>
            )}

            {/* Tips */}

            <section className="mt-5 rounded-3xl bg-white p-6 shadow-sm">
                <h2 className="text-lg font-semibold">팁을 받나요?</h2>

                <div className="mt-4 grid grid-cols-2 gap-2">
                    <button
                        type="button"
                        onClick={() => setHasTips(true)}
                        className={`rounded-2xl p-4 text-sm font-medium ${hasTips ? "bg-black text-white" : "bg-gray-100"}`}
                    >
                        예
                    </button>

                    <button
                        type="button"
                        onClick={() => setHasTips(false)}
                        className={`rounded-2xl p-4 text-sm font-medium ${!hasTips ? "bg-black text-white" : "bg-gray-100"}`}
                    >
                        아니오
                    </button>
                </div>

                {hasTips && (
                    <div className="mt-4 space-y-2">
                        <p className="text-sm text-gray-500">팁 지급 방식</p>

                        {[
                            ["cash", "현금"],
                            ["paycheque", "급여에 포함"],
                            ["both", "둘 다"],
                        ].map(([value, label]) => (
                            <button
                                type="button"
                                key={value}
                                onClick={() => setTipType(value as TipType)}
                                className={`w-full rounded-2xl p-3 text-left text-sm ${
                                    tipType === value ? "bg-black text-white" : "bg-gray-100"
                                }`}
                            >
                                {label}
                            </button>
                        ))}
                    </div>
                )}
            </section>

            {/* Pay Period */}

            <section className="mt-5 rounded-3xl bg-white p-6 shadow-sm">
                <h2 className="text-lg font-semibold">급여 기간</h2>

                <p className="mt-2 text-sm text-gray-400">최근 실제 근무 기간의 시작일과 급여일을 설정해주세요.</p>

                <div className="mt-4 space-y-4">
                    {/* Start Date */}

                    <div>
                        <p className="mb-2 text-sm text-gray-500">급여 기간 시작일</p>

                        <input
                            type="date"
                            value={payPeriodStartDate}
                            onChange={(e) => setPayPeriodStartDate(e.target.value)}
                            className="w-full rounded-2xl bg-gray-100 px-4 py-4 outline-none"
                        />
                    </div>

                    {/* Auto End Date */}

                    <div className="rounded-2xl bg-gray-50 p-4">
                        <p className="text-sm text-gray-500">급여 기간 종료일</p>

                        <p className="mt-1 font-semibold">{calculatedEndDate || "시작일과 주기를 먼저 설정해주세요"}</p>

                        <p className="mt-1 text-xs text-gray-400">급여 주기에 따라 자동으로 계산돼요.</p>
                    </div>

                    {/* Pay Date */}

                    <div>
                        <p className="mb-2 text-sm text-gray-500">급여일</p>

                        <input
                            type="date"
                            value={payDate}
                            onChange={(e) => setPayDate(e.target.value)}
                            className="w-full rounded-2xl bg-gray-100 px-4 py-4 outline-none"
                        />
                    </div>
                </div>
            </section>

            {/* Province */}

            <section className="mt-5 rounded-3xl bg-white p-6 shadow-sm">
                <h2 className="text-lg font-semibold">근무 지역</h2>

                <p className="mt-2 text-sm text-gray-400">근무하는 주를 선택해주세요.</p>

                <div className="mt-4 space-y-2">
                    {[
                        ["ON", "Ontario"],
                        ["BC", "British Columbia"],
                        ["AB", "Alberta"],
                        ["SK", "Saskatchewan"],
                        ["MB", "Manitoba"],
                        ["QC", "Quebec"],
                    ].map(([value, label]) => (
                        <button
                            type="button"
                            key={value}
                            onClick={() => setProvince(value as Province)}
                            className={`w-full rounded-2xl p-4 text-left text-sm font-medium ${
                                province === value ? "bg-black text-white" : "bg-gray-100"
                            }`}
                        >
                            🇨🇦 {label}
                        </button>
                    ))}
                </div>

                <p className="mt-4 text-xs text-gray-400">선택한 지역을 기준으로 급여 계산을 적용할 예정이에요.</p>
            </section>

            {/* Save */}

            <button
                type="button"
                onClick={handleSave}
                className="mt-6 w-full rounded-2xl bg-black py-4 text-sm font-semibold text-white"
            >
                급여 설정 저장
            </button>
        </div>
    );
}
