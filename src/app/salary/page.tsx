"use client";

import { useState } from "react";
import { calculatePayrollTax } from "@/lib/payrollTax";

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
    nextPayDate: string;
    semiMonthlyType?: SemiMonthlyType;
    customPayDays?: number;
};

type PayPeriod = {
    startDate: string;
    endDate: string;
    payDate: string;
};

const formatDate = (date: Date) => {
    return date.toISOString().split("T")[0];
};

const getPayPeriod = (
    payDate: Date,
    payFrequency: PayFrequency,
    semiMonthlyType?: SemiMonthlyType,
    customPayDays?: number,
): PayPeriod | null => {
    const endDate = new Date(payDate);
    const startDate = new Date(payDate);

    switch (payFrequency) {
        case "weekly":
            startDate.setDate(startDate.getDate() - 7);
            break;

        case "biweekly":
            startDate.setDate(startDate.getDate() - 14);
            break;

        case "monthly":
            startDate.setMonth(startDate.getMonth() - 1);
            break;

        case "semi-monthly":
            if (semiMonthlyType === "fifteenth-end") {
                if (endDate.getDate() === 15) {
                    startDate.setDate(1);
                } else {
                    startDate.setMonth(startDate.getMonth() - 1);
                    startDate.setDate(16);
                }
            } else {
                if (endDate.getDate() === 1) {
                    startDate.setMonth(startDate.getMonth() - 1);
                    startDate.setDate(16);
                } else {
                    startDate.setDate(1);
                }
            }
            break;

        case "custom":
            if (!customPayDays || customPayDays < 1) {
                return null;
            }

            startDate.setDate(startDate.getDate() - customPayDays);
            break;

        default:
            return null;
    }

    return {
        startDate: formatDate(startDate),
        endDate: formatDate(endDate),
        payDate: formatDate(endDate),
    };
};

const getNextPayDate = (
    savedNextPayDate: string,
    payFrequency: PayFrequency,
    today: Date,
    customPayDays?: number,
    semiMonthlyType?: SemiMonthlyType,
) => {
    const date = new Date(`${savedNextPayDate}T00:00:00`);

    const todayDate = new Date(today.getFullYear(), today.getMonth(), today.getDate());

    if (date >= todayDate) {
        return date;
    }

    switch (payFrequency) {
        case "weekly":
            while (date < todayDate) {
                date.setDate(date.getDate() + 7);
            }
            break;

        case "biweekly":
            while (date < todayDate) {
                date.setDate(date.getDate() + 14);
            }
            break;

        case "monthly":
            while (date < todayDate) {
                date.setMonth(date.getMonth() + 1);
            }
            break;

        case "semi-monthly":
            while (date < todayDate) {
                if (semiMonthlyType === "fifteenth-end") {
                    if (date.getDate() === 15) {
                        date.setMonth(date.getMonth() + 1);
                        date.setDate(15);
                    } else {
                        date.setDate(15);
                    }

                    if (date < todayDate) {
                        date.setMonth(date.getMonth() + 1);
                        date.setDate(15);
                    }
                } else {
                    if (date.getDate() === 1) {
                        date.setDate(15);
                    } else {
                        date.setMonth(date.getMonth() + 1);
                        date.setDate(1);
                    }
                }
            }
            break;

        case "custom":
            if (!customPayDays || customPayDays < 1) {
                return null;
            }

            while (date < todayDate) {
                date.setDate(date.getDate() + customPayDays);
            }
            break;

        default:
            return null;
    }

    return date;
};

export default function SalaryPage() {
    const [payType, setPayType] = useState<PayType>(() => {
        if (typeof window === "undefined") {
            return "hourly";
        }

        const saved = localStorage.getItem("chagok-salary-settings");

        if (!saved) {
            return "hourly";
        }

        const settings: SalarySettings = JSON.parse(saved);

        return settings.payType ?? "hourly";
    });

    const [payFrequency, setPayFrequency] = useState<PayFrequency>(() => {
        if (typeof window === "undefined") {
            return "biweekly";
        }

        const saved = localStorage.getItem("chagok-salary-settings");

        if (!saved) {
            return "biweekly";
        }

        const settings: SalarySettings = JSON.parse(saved);

        return settings.payFrequency ?? "biweekly";
    });

    const [hasTips, setHasTips] = useState<boolean>(() => {
        if (typeof window === "undefined") {
            return false;
        }

        const saved = localStorage.getItem("chagok-salary-settings");

        if (!saved) {
            return false;
        }

        const settings: SalarySettings = JSON.parse(saved);

        return settings.hasTips ?? false;
    });

    const [tipType, setTipType] = useState<TipType>(() => {
        if (typeof window === "undefined") {
            return "paycheque";
        }

        const saved = localStorage.getItem("chagok-salary-settings");

        if (!saved) {
            return "paycheque";
        }

        const settings: SalarySettings = JSON.parse(saved);

        return settings.tipType ?? "paycheque";
    });

    const [hourlyWage, setHourlyWage] = useState<string>(() => {
        if (typeof window === "undefined") {
            return "";
        }

        const saved = localStorage.getItem("chagok-salary-settings");

        if (!saved) {
            return "";
        }

        const settings: SalarySettings = JSON.parse(saved);

        return settings.hourlyWage !== undefined ? String(settings.hourlyWage) : "";
    });

    const [monthlySalary, setMonthlySalary] = useState<string>(() => {
        if (typeof window === "undefined") {
            return "";
        }

        const saved = localStorage.getItem("chagok-salary-settings");

        if (!saved) {
            return "";
        }

        const settings: SalarySettings = JSON.parse(saved);

        return settings.monthlySalary !== undefined ? String(settings.monthlySalary) : "";
    });

    const [nextPayDate, setNextPayDate] = useState<string>(() => {
        if (typeof window === "undefined") {
            return "";
        }

        const saved = localStorage.getItem("chagok-salary-settings");

        if (!saved) {
            return "";
        }

        const settings: SalarySettings = JSON.parse(saved);

        return settings.nextPayDate ?? "";
    });

    const [semiMonthlyType, setSemiMonthlyType] = useState<SemiMonthlyType>(() => {
        if (typeof window === "undefined") {
            return "first-fifteenth";
        }

        const saved = localStorage.getItem("chagok-salary-settings");

        if (!saved) {
            return "first-fifteenth";
        }

        const settings: SalarySettings = JSON.parse(saved);

        return settings.semiMonthlyType ?? "first-fifteenth";
    });

    const [customPayDays, setCustomPayDays] = useState<number>(() => {
        if (typeof window === "undefined") {
            return 14;
        }

        const saved = localStorage.getItem("chagok-salary-settings");

        if (!saved) {
            return 14;
        }

        const settings: SalarySettings = JSON.parse(saved);

        return settings.customPayDays ?? 14;
    });

    const [province, setProvince] = useState<Province>(() => {
        if (typeof window === "undefined") {
            return "ON";
        }

        const saved = localStorage.getItem("chagok-salary-settings");

        if (!saved) {
            return "ON";
        }

        const settings: SalarySettings = JSON.parse(saved);

        return settings.province ?? "ON";
    });

    // --------------------------------------------------
    // Today
    // --------------------------------------------------

    const today = new Date();

    // --------------------------------------------------
    // Next pay date
    // --------------------------------------------------

    const actualNextPayDate = nextPayDate
        ? getNextPayDate(nextPayDate, payFrequency, today, customPayDays, semiMonthlyType)
        : null;

    // --------------------------------------------------
    // Pay period
    // --------------------------------------------------

    const currentPayPeriod =
        actualNextPayDate && payType !== "salary"
            ? getPayPeriod(actualNextPayDate, payFrequency, semiMonthlyType, customPayDays)
            : null;

    // --------------------------------------------------
    // Days until pay
    // --------------------------------------------------

    const getDaysUntilPay = () => {
        if (!actualNextPayDate) {
            return null;
        }

        const todayDate = new Date(today.getFullYear(), today.getMonth(), today.getDate());

        const payDate = new Date(actualNextPayDate.getFullYear(), actualNextPayDate.getMonth(), actualNextPayDate.getDate());

        const difference = payDate.getTime() - todayDate.getTime();

        return Math.ceil(difference / (1000 * 60 * 60 * 24));
    };

    const daysUntilPay = getDaysUntilPay();

    // --------------------------------------------------
    // Estimated Payroll Tax
    // --------------------------------------------------

    const estimatedGrossPay =
        payType === "hourly" ? Number(hourlyWage) || 0 : payType === "salary" ? Number(monthlySalary) || 0 : 0;

    const estimatedTax = estimatedGrossPay > 0 ? calculatePayrollTax(estimatedGrossPay, province, payFrequency) : null;

    // --------------------------------------------------
    // Save
    // --------------------------------------------------

    const handleSave = () => {
        const settings: SalarySettings = {
            province,

            payType,

            payFrequency,

            hasTips,

            tipType: hasTips ? tipType : undefined,

            hourlyWage: payType === "hourly" ? Math.max(0, Number(hourlyWage) || 0) : undefined,

            monthlySalary: payType === "salary" ? Math.max(0, Number(monthlySalary) || 0) : undefined,

            nextPayDate,

            semiMonthlyType: payFrequency === "semi-monthly" ? semiMonthlyType : undefined,

            customPayDays: payFrequency === "custom" ? Math.max(1, customPayDays || 1) : undefined,
        };

        localStorage.setItem("chagok-salary-settings", JSON.stringify(settings));

        window.dispatchEvent(new StorageEvent("storage"));

        alert("급여 설정이 저장됐어요!");
    };

    return (
        <main className="min-h-screen bg-gray-50 px-5 py-8">
            <div className="mx-auto max-w-md pb-20">
                {/* Header */}

                <header>
                    <p className="text-sm text-gray-500">차곡</p>

                    <h1 className="mt-2 text-3xl font-bold">급여 관리</h1>

                    <p className="mt-2 text-sm text-gray-500">급여와 근무 정보를 설정해주세요.</p>
                </header>

                {/* Pay Type */}

                <section className="mt-6 rounded-3xl bg-white p-6 shadow-sm">
                    <h2 className="text-lg font-semibold">급여 받는 방식</h2>

                    <div className="mt-4 grid grid-cols-2 gap-2">
                        <button
                            onClick={() => setPayType("hourly")}
                            className={`rounded-2xl p-4 text-sm font-medium ${
                                payType === "hourly" ? "bg-black text-white" : "bg-gray-100"
                            }`}
                        >
                            시급
                        </button>

                        <button
                            onClick={() => setPayType("salary")}
                            className={`rounded-2xl p-4 text-sm font-medium ${
                                payType === "salary" ? "bg-black text-white" : "bg-gray-100"
                            }`}
                        >
                            월급
                        </button>

                        <button
                            onClick={() => setPayType("commission")}
                            className={`rounded-2xl p-4 text-sm font-medium ${
                                payType === "commission" ? "bg-black text-white" : "bg-gray-100"
                            }`}
                        >
                            커미션
                        </button>

                        <button
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
                                ["biweekly", "격주 (Biweekly)"],
                                ["semi-monthly", "월 2회"],
                                ["monthly", "매월"],
                                ["custom", "직접 설정"],
                            ].map(([value, label]) => (
                                <button
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
                                <p className="text-sm text-gray-500">급여일을 선택해주세요.</p>

                                <button
                                    onClick={() => setSemiMonthlyType("first-fifteenth")}
                                    className={`w-full rounded-2xl p-4 text-left text-sm ${
                                        semiMonthlyType === "first-fifteenth" ? "bg-black text-white" : "bg-gray-100"
                                    }`}
                                >
                                    1일 / 15일
                                </button>

                                <button
                                    onClick={() => setSemiMonthlyType("fifteenth-end")}
                                    className={`w-full rounded-2xl p-4 text-left text-sm ${
                                        semiMonthlyType === "fifteenth-end" ? "bg-black text-white" : "bg-gray-100"
                                    }`}
                                >
                                    15일 / 말일
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
                            onClick={() => setHasTips(true)}
                            className={`rounded-2xl p-4 text-sm font-medium ${hasTips ? "bg-black text-white" : "bg-gray-100"}`}
                        >
                            예
                        </button>

                        <button
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

                {/* Next Pay Date */}

                <section className="mt-5 rounded-3xl bg-white p-6 shadow-sm">
                    <h2 className="text-lg font-semibold">다음 급여일</h2>

                    <p className="mt-2 text-sm text-gray-400">가장 가까운 급여일을 입력해주세요.</p>

                    <input
                        type="date"
                        value={nextPayDate}
                        onChange={(e) => setNextPayDate(e.target.value)}
                        className="mt-4 w-full rounded-2xl bg-gray-100 px-4 py-4 outline-none"
                    />
                </section>

                {/* Next Pay */}

                {actualNextPayDate && (
                    <section className="mt-5 rounded-3xl bg-white p-6 shadow-sm">
                        <p className="text-sm text-gray-500">다음 급여</p>

                        <p className="mt-2 text-3xl font-bold">
                            {daysUntilPay === 0
                                ? "오늘이에요 💰"
                                : daysUntilPay !== null && daysUntilPay > 0
                                  ? `${daysUntilPay}일 남았어요`
                                  : "급여일을 확인해주세요"}
                        </p>

                        <p className="mt-2 text-sm text-gray-400">{formatDate(actualNextPayDate)}</p>

                        <p className="mt-1 text-sm text-gray-400">
                            {payFrequency === "biweekly"
                                ? "격주 급여"
                                : payFrequency === "weekly"
                                  ? "주급"
                                  : payFrequency === "semi-monthly"
                                    ? semiMonthlyType === "first-fifteenth"
                                        ? "월 2회 · 1일 / 15일"
                                        : "월 2회 · 15일 / 말일"
                                    : payFrequency === "monthly"
                                      ? "매월 급여"
                                      : payFrequency === "custom"
                                        ? `${customPayDays}일마다 급여`
                                        : ""}
                        </p>
                    </section>
                )}

                {/* Current Pay Period */}

                {currentPayPeriod && (
                    <section className="mt-5 rounded-3xl bg-white p-6 shadow-sm">
                        <p className="text-sm text-gray-500">현재 Pay Period</p>

                        <p className="mt-2 text-2xl font-semibold">{currentPayPeriod.startDate}</p>

                        <p className="text-gray-400">~</p>

                        <p className="text-2xl font-semibold">{currentPayPeriod.endDate}</p>

                        <div className="mt-5 rounded-2xl bg-gray-50 p-4">
                            <p className="text-sm text-gray-500">Pay Day</p>

                            <p className="mt-1 font-semibold">{currentPayPeriod.payDate}</p>
                        </div>
                    </section>
                )}

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

                {/* Tax Information */}
                {/* 나중에 v2에서 나라별 어쩌고 진행할 것 */}
                {/* 
                <section className="mt-5 rounded-3xl bg-white p-6 shadow-sm">
                    <h2 className="text-lg font-semibold">급여 공제 안내</h2>

                    <p className="mt-2 text-sm text-gray-400">
                        {province === "ON"
                            ? "Ontario"
                            : province === "BC"
                              ? "British Columbia"
                              : province === "AB"
                                ? "Alberta"
                                : province === "SK"
                                  ? "Saskatchewan"
                                  : province === "MB"
                                    ? "Manitoba"
                                    : "Quebec"}
                        기준으로 급여 공제가 적용돼요.
                    </p>

                    <div className="mt-4 space-y-2">
                        <div className="rounded-2xl bg-gray-50 p-4">
                            <p className="font-medium">Federal Income Tax</p>
                            <p className="mt-1 text-xs text-gray-400">캐나다 연방 소득세</p>
                        </div>

                        <div className="rounded-2xl bg-gray-50 p-4">
                            <p className="font-medium">
                                {province === "ON" ? "Ontario Income Tax" : `${province} Provincial Tax`}
                            </p>
                            <p className="mt-1 text-xs text-gray-400">근무 지역에 따른 주 소득세</p>
                        </div>

                        <div className="rounded-2xl bg-gray-50 p-4">
                            <p className="font-medium">CPP</p>
                            <p className="mt-1 text-xs text-gray-400">Canada Pension Plan</p>
                        </div>

                        <div className="rounded-2xl bg-gray-50 p-4">
                            <p className="font-medium">EI</p>
                            <p className="mt-1 text-xs text-gray-400">Employment Insurance</p>
                        </div>
                    </div>

                    <p className="mt-4 text-xs text-gray-400">실제 공제액은 근무시간과 급여에 따라 스케줄에서 계산돼요.</p>
                </section> */}

                {/* Save */}

                <button onClick={handleSave} className="mt-6 w-full rounded-2xl bg-black py-4 text-sm font-semibold text-white">
                    급여 설정 저장
                </button>
            </div>
        </main>
    );
}
