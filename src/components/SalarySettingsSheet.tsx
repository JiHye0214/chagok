"use client";

import { useEffect, useRef, useState } from "react";
import { getPayPeriodEndDate } from "@/lib/payPeriod";
import { getCurrencySymbol } from "@/lib/salary/format";
import { getDefaultHolidayPayMode } from "@/lib/labor/rules";
import { isPayrollCountry } from "@/lib/payroll";
import type { HolidayPayMode } from "@/lib/holiday";
import { todayDateString } from "@/lib/dateOnly";
import { WAGE_BASELINE_DATE } from "@/lib/salary/wage";
import type { HourlyWageEntry } from "@/lib/salary/wage";
import { getMinimumWageOn } from "@/lib/minimumWage";
import type { WagePreset } from "@/lib/minimumWage";

type PayType = "hourly" | "salary" | "commission" | "other";

type PayFrequency = "weekly" | "biweekly" | "semi-monthly" | "monthly" | "custom";

type TipType = "cash" | "paycheque" | "both";

type SemiMonthlyType = "first-fifteenth" | "fifteenth-end";

type RegionCode = string;

type CountryOptionsInput = {
    // 분수 (0.04 = 4%)
    vacationPayRate?: number;
    holidayPayMode?: HolidayPayMode;
};

type SalarySettings = {
    payType: PayType;
    payFrequency: PayFrequency;
    hasTips: boolean;
    tipType?: TipType;
    hourlyWage?: number;
    // 서버가 내려주는 시급 변경 이력
    hourlyWageHistory?: HourlyWageEntry[];
    // 시급을 바꿨을 때만 보낸다: "all"(처음부터) 또는 적용 시작 날짜(YYYY-MM-DD)
    hourlyWageApplyFrom?: string;
    monthlySalary?: number;
    payPeriodStartDate?: string;
    payDate?: string;
    payDateOffset?: number | null;
    semiMonthlyType?: SemiMonthlyType;
    customPayDays?: number;
    countryOptions?: CountryOptionsInput;
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
    onSaved?: () => void | Promise<void>;
    // 최저시급 안내에서 넘어온 경우: 시급과 적용일을 미리 채워서 연다
    wagePreset?: WagePreset | null;
};

export default function SalarySettingsSheet({ isOpen, onClose, onSaved, wagePreset }: SalarySettingsSheetProps) {
    const [payType, setPayType] = useState<PayType>("hourly");
    const [payFrequency, setPayFrequency] = useState<PayFrequency>("biweekly");

    const [hasTips, setHasTips] = useState(false);
    const [tipType, setTipType] = useState<TipType>("paycheque");

    const [hourlyWage, setHourlyWage] = useState("");

    // 시트가 열리는 순간의 preset 을 읽기 위해 ref 로 들고 있는다 (preset 이 바뀐다고 설정을 다시 불러오진 않음)
    const wagePresetRef = useRef<WagePreset | null>(null);
    wagePresetRef.current = wagePreset ?? null;

    // 시급을 바꿀 때 "언제부터" 적용할지 묻기 위한 값들
    const [savedHourlyWage, setSavedHourlyWage] = useState<number | null>(null);
    const [wageHistory, setWageHistory] = useState<HourlyWageEntry[]>([]);
    const [wageApplyMode, setWageApplyMode] = useState<"from-date" | "all">("from-date");
    const [wageApplyDate, setWageApplyDate] = useState(() => todayDateString());
    const [monthlySalary, setMonthlySalary] = useState("");

    const [payPeriodStartDate, setPayPeriodStartDate] = useState("");
    const [payDate, setPayDate] = useState("");

    const [semiMonthlyType, setSemiMonthlyType] = useState<SemiMonthlyType>("first-fifteenth");

    const [customPayDays, setCustomPayDays] = useState(14);

    // 베케이션 페이는 화면에서는 퍼센트(4), 저장할 때는 분수(0.04)로 다룬다
    const [vacationPayPercent, setVacationPayPercent] = useState("4");
    const [holidayPayMode, setHolidayPayMode] = useState<HolidayPayMode | null>(null);

    const [saveError, setSaveError] = useState<string | null>(null);

    /*
     * 근무 지역은 Salary Settings가 아니라
     * user_profiles를 기준으로 사용한다.
     */
    const [regionCode, setRegionCode] = useState<RegionCode | null>(null);
    const [countryCode, setCountryCode] = useState<string | null>(null);
    const [currency, setCurrency] = useState<string | null>(null);

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
                requestAnimationFrame(() => {
                    setIsAnimating(true);
                });
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
     *
     * 로딩 화면을 따로 보여주지 않는다.
     * Sheet는 즉시 렌더링되고,
     * API는 백그라운드에서 불러온다.
     */
    useEffect(() => {
        if (!isOpen) {
            return;
        }

        const loadSalarySettings = async () => {
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
                setCurrency(profile.currency ?? null);

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

                    setSavedHourlyWage(settings.hourlyWage !== undefined ? settings.hourlyWage : null);

                    setWageHistory(settings.hourlyWageHistory ?? []);

                    setWageApplyMode("from-date");

                    setWageApplyDate(todayDateString());

                    if (wagePresetRef.current && (settings.payType ?? "hourly") === "hourly") {
                        setHourlyWage(String(wagePresetRef.current.hourlyWage));
                        setWageApplyDate(wagePresetRef.current.effectiveDate);
                    }

                    setMonthlySalary(settings.monthlySalary !== undefined ? String(settings.monthlySalary) : "");

                    setPayPeriodStartDate(settings.payPeriodStartDate ?? "");

                    setPayDate(settings.payDate ?? "");

                    setSemiMonthlyType(settings.semiMonthlyType ?? "first-fifteenth");

                    setCustomPayDays(settings.customPayDays ?? 14);

                    const savedRate = settings.countryOptions?.vacationPayRate;

                    setVacationPayPercent(
                        savedRate !== undefined ? String(Math.round(savedRate * 10000) / 100) : "4",
                    );

                    setHolidayPayMode(settings.countryOptions?.holidayPayMode ?? null);
                }

                setSaveError(null);
            } catch (error) {
                console.error("급여 설정 조회 실패:", error);
            }
        };

        void loadSalarySettings();
    }, [isOpen]);

    /*
     * 지역 표시
     *
     * 현재 앱에서 알고 있는 지역 이름만 표시하고,
     * 나중에 새로운 국가/지역이 추가되면
     * regionCode 자체를 fallback으로 보여준다.
     */
    const getWorkRegionLabel = () => {
        const countryLabels: Record<string, string> = {
            KR: "🇰🇷 대한민국",
            CA: "🇨🇦 캐나다",
            US: "🇺🇸 미국",
            AU: "🇦🇺 호주",
            GB: "🇬🇧 영국",
        };

        const regionLabels: Record<string, string> = {
            ON: "🇨🇦 Ontario",
            BC: "🇨🇦 British Columbia",
            AB: "🇨🇦 Alberta",
            SK: "🇨🇦 Saskatchewan",
            MB: "🇨🇦 Manitoba",
            QC: "🇨🇦 Quebec",
        };

        if (!countryCode) {
            return "국가 설정 필요";
        }

        if (regionCode) {
            return regionLabels[regionCode] ?? `${countryLabels[countryCode] ?? countryCode} · ${regionCode}`;
        }

        return countryLabels[countryCode] ?? countryCode;
    };

    const upperCountry = countryCode?.toUpperCase() ?? null;
    const isSupportedCountry = isPayrollCountry(upperCountry);

    // 선택하지 않았으면 그 나라의 기본값
    const effectiveHolidayPayMode: HolidayPayMode | null =
        holidayPayMode ?? (upperCountry ? getDefaultHolidayPayMode(upperCountry) : null);

    const showVacationPay = upperCountry === "CA" && payType === "hourly";

    // 이미 저장된 시급이 있고, 지금 입력한 시급이 그것과 다를 때
    const isWageChanged =
        payType === "hourly" &&
        savedHourlyWage !== null &&
        Number(hourlyWage) > 0 &&
        Number(hourlyWage) !== savedHourlyWage;

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
            setSaveError("프로필의 국가 설정을 확인해주세요.");
            return;
        }

        if (payType === "hourly" && !(Number(hourlyWage) > 0)) {
            setSaveError("시급을 입력해주세요.");
            return;
        }

        if (payType === "salary" && !(Number(monthlySalary) > 0)) {
            setSaveError("월급을 입력해주세요.");
            return;
        }

        if (isWageChanged && wageApplyMode === "from-date" && !wageApplyDate) {
            setSaveError("시급을 적용할 날짜를 선택해주세요.");
            return;
        }

        const needsStartDate = payFrequency === "weekly" || payFrequency === "biweekly" || payFrequency === "custom";

        if (needsStartDate && !payPeriodStartDate) {
            setSaveError("급여 기간 시작일을 입력해주세요.");
            return;
        }

        let countryOptions: CountryOptionsInput | undefined;

        if (isSupportedCountry) {
            countryOptions = {};

            if (upperCountry === "CA" && vacationPayPercent !== "") {
                const percent = Number(vacationPayPercent);

                if (!Number.isFinite(percent) || percent < 0 || percent > 20) {
                    setSaveError("베케이션 페이 비율은 0~20% 사이로 입력해주세요.");
                    return;
                }

                countryOptions.vacationPayRate = Math.round(percent * 100) / 10000;
            }

            if (holidayPayMode) {
                countryOptions.holidayPayMode = holidayPayMode;
            }
        }

        setSaveError(null);

        const settings: SalarySettings = {
            payType,
            payFrequency,
            hasTips,

            tipType: hasTips ? tipType : undefined,

            hourlyWage: payType === "hourly" ? Math.max(0, Number(hourlyWage) || 0) : undefined,

            // 이미 시급이 있고 값이 바뀐 경우에만 "언제부터"를 같이 보낸다
            hourlyWageApplyFrom: isWageChanged ? (wageApplyMode === "all" ? "all" : wageApplyDate) : undefined,

            monthlySalary: payType === "salary" ? Math.max(0, Number(monthlySalary) || 0) : undefined,

            // 비어 있으면 보내지 않는다 (빈 문자열을 보내면 서버가 날짜 오류로 거부함)
            payPeriodStartDate: payPeriodStartDate || undefined,
            payDate: payDate || undefined,

            countryOptions,

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

            // 전체 페이지를 새로고침하지 않고
            // 부모에서 필요한 급여 데이터를 다시 조회한다.
            await onSaved?.();

            onClose();
        } catch (error) {
            console.error(error);

            setSaveError("급여 설정 저장에 실패했어요. 잠시 후 다시 시도해주세요.");
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
                className={`absolute inset-x-0 bottom-0 mx-auto flex max-h-[95dvh] w-full max-w-md flex-col rounded-t-[2rem] bg-gray-50 transform-gpu transition-transform duration-[400ms] ease-[cubic-bezier(0.22,1,0.36,1)] ${
                    isAnimating ? "translate-y-0" : "translate-y-full"
                }`}
            >
                {/* 상단 */}
                <div className="flex shrink-0 items-center justify-center px-5 pb-4 pt-3">
                    <div className="h-1.5 w-10 rounded-full bg-gray-300" />
                </div>

                {/* 내용 */}
                <div className="min-h-0 overflow-y-auto px-6 pb-8 scrollbar-hide">
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
                                        1일 ~ 15일 / 16일 ~ 말일 (월 2회)
                                    </button>

                                    <button
                                        type="button"
                                        onClick={() => setSemiMonthlyType("fifteenth-end")}
                                        className={`w-full rounded-2xl p-4 text-left text-sm ${
                                            semiMonthlyType === "fifteenth-end" ? "bg-black text-white" : "bg-gray-100"
                                        }`}
                                    >
                                        16일 ~ 다음달 15일 (월 1회)
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
                                <span className="text-gray-500">{getCurrencySymbol(currency)}</span>

                                <input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    value={hourlyWage}
                                    onChange={(e) => {
                                        const value = Number(e.target.value);

                                        setHourlyWage(value < 0 ? "0" : e.target.value);
                                    }}
                                    placeholder={currency === "KRW" ? "10,320" : "17.60"}
                                    className="w-full bg-transparent px-2 py-4 outline-none"
                                />
                            </div>

                            {/* 이 지역의 최저시급 참고 표시 */}
                            {(() => {
                                const minimum = getMinimumWageOn(countryCode, regionCode, todayDateString());

                                if (!minimum || (currency && minimum.currency !== currency)) {
                                    return null;
                                }

                                return (
                                    <p className="mt-2 text-xs text-gray-400">
                                        최저시급 {getCurrencySymbol(currency)}
                                        {minimum.hourlyWage} ({minimum.effectiveDate}부터)
                                    </p>
                                );
                            })()}

                            {/* 시급을 바꾸면 언제부터 적용할지 묻는다 */}
                            {isWageChanged && (
                                <div className="mt-4 rounded-2xl bg-gray-50 p-4">
                                    <p className="text-sm font-semibold text-gray-900">언제부터 적용할까요?</p>

                                    <p className="mt-1 text-xs leading-5 text-gray-500">
                                        그 날짜 전에 한 근무는 예전 시급으로, 그 날짜부터는 새 시급으로 계산해요. 다음 달부터 오르기로 한 것처럼 앞으로의 날짜도 고를 수 있어요.
                                    </p>

                                    <div className="mt-3 grid grid-cols-2 gap-2">
                                        <button
                                            type="button"
                                            onClick={() => setWageApplyMode("from-date")}
                                            className={`rounded-xl py-3 text-sm font-medium transition-colors ${
                                                wageApplyMode === "from-date"
                                                    ? "bg-gray-900 text-white"
                                                    : "bg-white text-gray-600"
                                            }`}
                                        >
                                            날짜부터
                                        </button>

                                        <button
                                            type="button"
                                            onClick={() => setWageApplyMode("all")}
                                            className={`rounded-xl py-3 text-sm font-medium transition-colors ${
                                                wageApplyMode === "all" ? "bg-gray-900 text-white" : "bg-white text-gray-600"
                                            }`}
                                        >
                                            처음부터 전부
                                        </button>
                                    </div>

                                    {wageApplyMode === "from-date" ? (
                                        <input
                                            type="date"
                                            value={wageApplyDate}
                                            onChange={(e) => setWageApplyDate(e.target.value)}
                                            className="mt-3 w-full rounded-xl bg-white px-4 py-3 text-sm outline-none"
                                        />
                                    ) : (
                                        <p className="mt-3 text-xs leading-5 text-gray-500">
                                            이전 기록까지 모두 새 시급으로 계산해요. 시급을 잘못 입력했을 때 쓰세요.
                                        </p>
                                    )}
                                </div>
                            )}

                            {/* 시급 변경 이력 (2개 이상일 때만) */}
                            {wageHistory.length > 1 && (
                                <div className="mt-4">
                                    <p className="text-xs font-medium text-gray-400">시급 변경 이력</p>

                                    <ul className="mt-2 space-y-1">
                                        {[...wageHistory].reverse().map((entry) => (
                                            <li key={entry.effectiveDate} className="flex justify-between text-xs text-gray-500">
                                                <span>
                                                    {entry.effectiveDate === WAGE_BASELINE_DATE
                                                        ? "처음"
                                                        : `${entry.effectiveDate}부터`}
                                                </span>

                                                <span className="font-medium text-gray-700">
                                                    {getCurrencySymbol(currency)}
                                                    {entry.hourlyWage}
                                                </span>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                        </section>
                    )}

                    {/* Monthly Salary */}
                    {payType === "salary" && (
                        <section className="mt-5 rounded-3xl bg-white p-6 shadow-sm">
                            <h2 className="text-lg font-semibold">월급</h2>

                            <div className="mt-4 flex items-center rounded-2xl bg-gray-100 px-4">
                                <span className="text-gray-500">{getCurrencySymbol(currency)}</span>

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
                                        className={`w-full rounded-2xl p-4 text-left text-sm ${
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

                                <p className="mt-1 font-semibold">{calculatedEndDate || "시작일과 주기를 먼저 설정해주세요"}</p>

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

                    {/* Vacation / Holiday Pay */}
                    {isSupportedCountry && (showVacationPay || payType === "hourly") && (
                        <section className="mt-5 rounded-3xl bg-white p-6 shadow-sm">
                            <h2 className="text-lg font-semibold">휴가 · 공휴일 수당</h2>

                            {showVacationPay && (
                                <div className="mt-4">
                                    <p className="mb-2 text-sm text-gray-500">베케이션 페이 (매 급여에 얹어서 받는 비율)</p>

                                    <div className="flex items-center rounded-2xl bg-gray-100 px-4">
                                        <input
                                            type="number"
                                            min="0"
                                            max="20"
                                            step="0.01"
                                            value={vacationPayPercent}
                                            onChange={(e) => setVacationPayPercent(e.target.value)}
                                            placeholder="4"
                                            className="w-full bg-transparent px-2 py-4 outline-none"
                                        />

                                        <span className="shrink-0 text-gray-500">%</span>
                                    </div>

                                    <p className="mt-2 text-xs leading-5 text-gray-400">
                                        온타리오 기본은 4%이고, 한 직장에서 5년 이상 일했다면 6%예요.
                                        급여명세서에 적힌 비율을 그대로 입력하세요.
                                    </p>
                                </div>
                            )}

                            {payType === "hourly" && (
                                <div className="mt-5">
                                    <p className="mb-2 text-sm text-gray-500">공휴일 수당 방식</p>

                                    <div className="space-y-2">
                                        {(
                                            [
                                                ["full", "공휴일마다 수당을 받고, 일하면 가산 수당도 받아요"],
                                                ["worked-only", "공휴일에 일한 날만 받아요"],
                                                ["none", "공휴일 수당을 따로 받지 않아요"],
                                            ] as [HolidayPayMode, string][]
                                        ).map(([value, label]) => (
                                            <button
                                                type="button"
                                                key={value}
                                                onClick={() => setHolidayPayMode(value)}
                                                className={`w-full rounded-2xl p-4 text-left text-sm ${
                                                    effectiveHolidayPayMode === value ? "bg-black text-white" : "bg-gray-100"
                                                }`}
                                            >
                                                {label}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </section>
                    )}

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
                    {saveError && <p className="mt-4 text-center text-sm text-red-500">{saveError}</p>}

                    <button
                        type="button"
                        onClick={handleSave}
                        disabled={isSaving}
                        className="mt-6 w-full rounded-2xl bg-black py-4 text-sm font-semibold text-white disabled:opacity-50"
                    >
                        {isSaving ? "저장 중..." : "급여 설정 저장"}
                    </button>
                </div>
            </div>
        </div>
    );
}
