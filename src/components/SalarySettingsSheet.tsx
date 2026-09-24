"use client";

import { useEffect, useState } from "react";
import { getPayPeriodEndDate } from "@/lib/payPeriod";

type PayType = "hourly" | "salary" | "commission" | "other";

type PayFrequency = "weekly" | "biweekly" | "semi-monthly" | "monthly" | "custom";

type TipType = "cash" | "paycheque" | "both";

type SemiMonthlyType = "first-fifteenth" | "fifteenth-end";

type RegionCode = string;

type SalarySettings = {
    regionCode?: RegionCode;
    payType: PayType;
    payFrequency: PayFrequency;
    hasTips: boolean;
    tipType?: TipType;
    hourlyWage?: number;
    monthlySalary?: number;
    payPeriodStartDate?: string;
    payDate?: string;
    payDateOffset?: number | null;
    semiMonthlyType?: SemiMonthlyType;
    customPayDays?: number;
};

type UserProfile = {
    countryCode: string | null;
    provinceCode: string | null;
    currency: string | null;
    language: string | null;
    timezone?: string | null;
    nickname?: string | null;
};

type SalarySettingsSheetProps = {
    isOpen: boolean;
    onClose: () => void;
};

export default function SalarySettingsSheet({ isOpen, onClose }: SalarySettingsSheetProps) {
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

    /*
     * 근무 지역은 Salary Settings가 아니라
     * user_profiles를 기준으로 사용한다.
     */
    const [regionCode, setRegionCode] = useState<RegionCode | null>(null);
    const [countryCode, setCountryCode] = useState<string | null>(null);

    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);

    // 실제 DOM을 유지해서 닫힐 때도 애니메이션
    const [isMounted, setIsMounted] = useState(false);
    const [isAnimating, setIsAnimating] = useState(false);

    /*
     * Sheet open / close animation
     */
    useEffect(() => {
        if (isOpen) {
            setIsMounted(true);
            setIsAnimating(false);

            document.body.style.overflow = "hidden";

            const frame = requestAnimationFrame(() => {
                setIsAnimating(true);
            });

            return () => {
                cancelAnimationFrame(frame);
                document.body.style.overflow = "";
            };
        }

        if (!isMounted) {
            document.body.style.overflow = "";
            return;
        }

        setIsAnimating(false);
        document.body.style.overflow = "";

        const timer = window.setTimeout(() => {
            setIsMounted(false);
        }, 350);

        return () => {
            clearTimeout(timer);
            document.body.style.overflow = "";
        };
    }, [isOpen]);

    /*
     * Salary Settings + Profile
     */
    useEffect(() => {
        if (!isOpen) {
            return;
        }

        const loadSalarySettings = async () => {
            setIsLoading(true);

            try {
                const [salaryResponse, profileResponse] = await Promise.all([
                    fetch("/api/salary/salary-settings"),
                    fetch("/api/user/profile"),
                ]);

                if (!salaryResponse.ok) {
                    throw new Error("급여 설정 조회 실패");
                }

                if (!profileResponse.ok) {
                    throw new Error("프로필 조회 실패");
                }

                const settings: SalarySettings | null = await salaryResponse.json();

                const profile: UserProfile = await profileResponse.json();

                /*
                 * 국가와 지역은 user_profiles를 기준으로 한다.
                 *
                 * provinceCode라는 기존 API 필드명을
                 * Sheet 내부에서는 regionCode로 사용한다.
                 */
                setCountryCode(profile.countryCode ?? null);
                setRegionCode(profile.provinceCode ?? null);

                /*
                 * 기존 Salary Settings
                 * 지역(regionCode)은 profile을 기준으로 하므로
                 * 여기서는 급여 관련 설정만 불러온다.
                 */
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
                }
            } catch (error) {
                console.error("급여 설정 조회 실패:", error);
            } finally {
                setIsLoading(false);
            }
        };

        loadSalarySettings();
    }, [isOpen]);

    /*
     * 지역 표시
     *
     * 현재 앱에서 알고 있는 지역 이름만 표시하고,
     * 나중에 새로운 국가/지역이 추가되면
     * regionCode 자체를 fallback으로 보여준다.
     */
    const getWorkRegionLabel = () => {
        if (!countryCode) {
            return "프로필에서 설정된 지역";
        }

        if (!regionCode) {
            return "프로필에 설정된 국가";
        }

        const regionLabels: Record<string, string> = {
            ON: "🇨🇦 Ontario",
            BC: "🇨🇦 British Columbia",
            AB: "🇨🇦 Alberta",
            SK: "🇨🇦 Saskatchewan",
            MB: "🇨🇦 Manitoba",
            QC: "🇨🇦 Quebec",
        };

        return regionLabels[regionCode] ?? regionCode;
    };

    /*
     * Salary Settings 저장
     */
    const handleSave = async () => {
        /*
         * 국가 자체가 없는 경우에만 저장하지 않는다.
         *
         * 지역이 없는 국가는 정상적으로 저장 가능하다.
         */
        if (!countryCode) {
            alert("프로필의 국가 설정을 확인해주세요.");
            return;
        }

        const settings: SalarySettings = {
            ...(regionCode ? { regionCode } : {}),

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
            setIsSaving(true);

            const response = await fetch("/api/salary/salary-settings", {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(settings),
            });

            if (!response.ok) {
                throw new Error("급여 설정 저장 실패");
            }

            window.location.reload();

            onClose();
        } catch (error) {
            console.error(error);

            alert("급여 설정 저장에 실패했어요.");
        } finally {
            setIsSaving(false);
        }
    };

    const calculatedEndDate = payPeriodStartDate
        ? getPayPeriodEndDate(payPeriodStartDate, payFrequency, semiMonthlyType, customPayDays)
        : "";

    if (!isMounted) {
        return null;
    }

    return (
        <div className="fixed inset-0 z-[10000]">
            {/* 배경 */}
            <button
                type="button"
                aria-label="닫기"
                onClick={onClose}
                className={`absolute inset-0 bg-black/30 transition-opacity duration-300 ease-out ${
                    isAnimating ? "opacity-100" : "opacity-0"
                }`}
            />

            {/* Sheet */}
            <div
                className={`absolute inset-x-0 bottom-0 mx-auto flex max-h-[95dvh] w-full max-w-md flex-col rounded-t-[2rem] bg-gray-50 transform-gpu transition-transform duration-350 ease-[cubic-bezier(0.22,1,0.36,1)] ${
                    isAnimating ? "translate-y-0" : "translate-y-full"
                }`}
            >
                {/* 상단 */}
                <div className="flex shrink-0 items-center justify-center px-5 pb-4 pt-3">
                    <div className="h-1.5 w-10 rounded-full bg-gray-300" />
                </div>

                {/* 내용 */}
                <div className="min-h-0 overflow-y-auto px-6 pb-8 scrollbar-hide">
                    {isLoading ? (
                        <div className="py-10 text-center text-sm text-gray-400">급여 정보를 불러오는 중...</div>
                    ) : (
                        <>
                            <h1 className="mb-6 text-2xl font-semibold tracking-[-0.04em] text-gray-900">급여 설정</h1>

                            {/* Pay Type */}
                            <section className="rounded-3xl bg-white p-6 shadow-sm">
                                <h2 className="text-lg font-semibold">급여 받는 방식</h2>

                                <div className="mt-4 grid grid-cols-2 gap-2">
                                    {[
                                        ["hourly", "시급"],
                                        ["salary", "월급"],
                                        ["commission", "커미션"],
                                        ["other", "기타"],
                                    ].map(([value, label]) => (
                                        <button
                                            type="button"
                                            key={value}
                                            onClick={() => {
                                                setPayType(value as PayType);

                                                if (value === "salary") {
                                                    setPayFrequency("monthly");
                                                }
                                            }}
                                            className={`rounded-2xl p-4 text-sm font-medium ${
                                                payType === value ? "bg-black text-white" : "bg-gray-100"
                                            }`}
                                        >
                                            {label}
                                        </button>
                                    ))}
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
                                        className={`rounded-2xl p-4 text-sm font-medium ${
                                            hasTips ? "bg-black text-white" : "bg-gray-100"
                                        }`}
                                    >
                                        예
                                    </button>

                                    <button
                                        type="button"
                                        onClick={() => setHasTips(false)}
                                        className={`rounded-2xl p-4 text-sm font-medium ${
                                            !hasTips ? "bg-black text-white" : "bg-gray-100"
                                        }`}
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

                                <p className="mt-2 text-sm text-gray-400">
                                    최근 실제 근무 기간의 시작일과 급여일을 설정해주세요.
                                </p>

                                <div className="mt-4 space-y-4">
                                    <div>
                                        <p className="mb-2 text-sm text-gray-500">급여 기간 시작일</p>

                                        <input
                                            type="date"
                                            value={payPeriodStartDate}
                                            onChange={(e) => setPayPeriodStartDate(e.target.value)}
                                            className="w-full rounded-2xl bg-gray-100 px-4 py-4 outline-none"
                                        />
                                    </div>

                                    <div className="rounded-2xl bg-gray-50 p-4">
                                        <p className="text-sm text-gray-500">급여 기간 종료일</p>

                                        <p className="mt-1 font-semibold">
                                            {calculatedEndDate || "시작일과 주기를 먼저 설정해주세요"}
                                        </p>

                                        <p className="mt-1 text-xs text-gray-400">급여 주기에 따라 자동으로 계산돼요.</p>
                                    </div>

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

                            {/* Work Region */}
                            <section className="mt-5 rounded-3xl bg-white p-6 shadow-sm">
                                <h2 className="text-lg font-semibold">근무 지역</h2>

                                <p className="mt-2 text-sm leading-6 text-gray-400">
                                    급여 계산은 프로필에 설정된 지역을 기준으로 적용돼요.
                                </p>

                                <div className="mt-4 rounded-2xl bg-gray-50 p-4">
                                    <p className="text-sm text-gray-500">현재 설정된 지역</p>

                                    <p className="mt-1 font-semibold text-gray-900">{getWorkRegionLabel()}</p>
                                </div>

                                <p className="mt-4 text-xs leading-5 text-gray-400">
                                    지역을 변경하려면 프로필 설정에서 지역을 변경해주세요.
                                </p>
                            </section>

                            {/* Save */}
                            <button
                                type="button"
                                onClick={handleSave}
                                disabled={isSaving}
                                className="mt-6 w-full rounded-2xl bg-black py-4 text-sm font-semibold text-white disabled:opacity-50"
                            >
                                {isSaving ? "저장 중..." : "급여 설정 저장"}
                            </button>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}
