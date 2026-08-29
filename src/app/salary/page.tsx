"use client";

import { useState } from "react";

type PayType = "hourly" | "salary" | "commission" | "other";

type PayFrequency = "weekly" | "biweekly" | "semi-monthly" | "monthly" | "custom";

type TipType = "cash" | "paycheque" | "both";

type SalarySettings = {
    province: "ON";
    payType: PayType;
    payFrequency: PayFrequency;
    hasTips: boolean;
    tipType?: TipType;
    hourlyWage?: number;
    monthlySalary?: number;
    nextPayDate: string;
};

type PayPeriod = {
    startDate: string;
    endDate: string;
    payDate: string;
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

        return settings.payType;
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

        return settings.payFrequency;
    });

    const [hasTips, setHasTips] = useState(() => {
        if (typeof window === "undefined") {
            return false;
        }

        const saved = localStorage.getItem("chagok-salary-settings");

        if (!saved) {
            return false;
        }

        const settings: SalarySettings = JSON.parse(saved);

        return settings.hasTips;
    });

    const [tipType, setTipType] = useState<TipType>(() => {
        if (typeof window === "undefined") {
            return "both";
        }

        const saved = localStorage.getItem("chagok-salary-settings");

        if (!saved) {
            return "both";
        }

        const settings: SalarySettings = JSON.parse(saved);

        return settings.tipType ?? "both";
    });

    const [hourlyWage, setHourlyWage] = useState(() => {
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

    const [monthlySalary, setMonthlySalary] = useState(() => {
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

    const [nextPayDate, setNextPayDate] = useState(() => {
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

    const getCurrentPayPeriod = (): PayPeriod | null => {
        if (!nextPayDate) {
            return null;
        }

        const payDate = new Date(`${nextPayDate}T00:00:00`);

        let daysPerPeriod = 14;

        if (payFrequency === "weekly") {
            daysPerPeriod = 7;
        }

        if (payFrequency === "biweekly") {
            daysPerPeriod = 14;
        }

        if (payFrequency === "monthly") {
            daysPerPeriod = 30;
        }

        if (payFrequency === "semi-monthly") {
            daysPerPeriod = 15;
        }

        const startDate = new Date(payDate);

        startDate.setDate(startDate.getDate() - daysPerPeriod);

        const formatDate = (date: Date) => {
            return date.toISOString().split("T")[0];
        };

        return {
            startDate: formatDate(startDate),
            endDate: formatDate(payDate),
            payDate: nextPayDate,
        };
    };

    const currentPayPeriod = getCurrentPayPeriod();

    const getNextPayDate = () => {
        if (!nextPayDate) {
            return null;
        }

        const date = new Date(`${nextPayDate}T00:00:00`);

        if (payFrequency === "weekly") {
            date.setDate(date.getDate() + 7);
        }

        if (payFrequency === "biweekly") {
            date.setDate(date.getDate() + 14);
        }

        return date;
    };

    const getDaysUntilPay = () => {
        if (!nextPayDate) {
            return null;
        }

        const today = new Date();

        const payDate = new Date(`${nextPayDate}T00:00:00`);

        const todayDate = new Date(today.getFullYear(), today.getMonth(), today.getDate());

        const difference = payDate.getTime() - todayDate.getTime();

        return Math.ceil(difference / (1000 * 60 * 60 * 24));
    };

    const daysUntilPay = getDaysUntilPay();

    const handleSave = () => {
        const settings: SalarySettings = {
            province: "ON",
            payType,
            payFrequency,
            hasTips,
            tipType: hasTips ? tipType : undefined,
            hourlyWage: payType === "hourly" ? Number(hourlyWage) : undefined,
            monthlySalary: payType === "salary" ? Number(monthlySalary) : undefined,
            nextPayDate,
        };

        localStorage.setItem("chagok-salary-settings", JSON.stringify(settings));

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
                </section>

                {/* Wage */}
                {payType === "hourly" && (
                    <section className="mt-5 rounded-3xl bg-white p-6 shadow-sm">
                        <h2 className="text-lg font-semibold">시급</h2>

                        <div className="mt-4 flex items-center rounded-2xl bg-gray-100 px-4">
                            <span className="text-gray-500">$</span>

                            <input
                                type="number"
                                value={hourlyWage}
                                onChange={(e) => setHourlyWage(e.target.value)}
                                placeholder="18.60"
                                className="w-full bg-transparent px-2 py-4 outline-none"
                            />
                        </div>
                    </section>
                )}

                {payType === "salary" && (
                    <section className="mt-5 rounded-3xl bg-white p-6 shadow-sm">
                        <h2 className="text-lg font-semibold">월급</h2>

                        <div className="mt-4 flex items-center rounded-2xl bg-gray-100 px-4">
                            <span className="text-gray-500">$</span>

                            <input
                                type="number"
                                value={monthlySalary}
                                onChange={(e) => setMonthlySalary(e.target.value)}
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

                {nextPayDate && (
                    <section className="mt-5 rounded-3xl bg-white p-6 shadow-sm">
                        <p className="text-sm text-gray-500">다음 급여</p>

                        <p className="mt-2 text-3xl font-bold">
                            {daysUntilPay === 0
                                ? "오늘이에요 💰"
                                : daysUntilPay !== null && daysUntilPay > 0
                                  ? `${daysUntilPay}일 남았어요`
                                  : "급여일이 지났어요"}
                        </p>

                        <p className="mt-2 text-sm text-gray-400">{nextPayDate}</p>

                        <p className="mt-1 text-sm text-gray-400">
                            {payFrequency === "biweekly"
                                ? "격주 급여"
                                : payFrequency === "weekly"
                                  ? "주급"
                                  : payFrequency === "monthly"
                                    ? "월급"
                                    : ""}
                        </p>
                    </section>
                )}

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
                    <p className="text-sm text-gray-500">근무 지역</p>

                    <p className="mt-2 text-lg font-semibold">🇨🇦 Ontario</p>

                    <p className="mt-2 text-sm text-gray-400">현재는 Ontario 기준으로 계산합니다.</p>
                </section>

                {/* Save */}
                <button onClick={handleSave} className="mt-6 w-full rounded-2xl bg-black py-4 text-sm font-semibold text-white">
                    급여 설정 저장
                </button>
            </div>
        </main>
    );
}
