"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import BackButtonHeader from "@/components/BackButtonHeader";
import { COUNTRIES, getCountry } from "@/lib/countries";

export default function CountrySettingsPage() {
    const router = useRouter();

    // 저장된 값
    const [savedCountryCode, setSavedCountryCode] = useState<string | null>(null);
    const [savedRegionCode, setSavedRegionCode] = useState<string | null>(null);

    // 화면에서 고른 값
    const [countryCode, setCountryCode] = useState<string | null>(null);
    const [regionCode, setRegionCode] = useState<string | null>(null);

    const [error, setError] = useState("");
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [isResetConfirmed, setIsResetConfirmed] = useState(false);

    useEffect(() => {
        const loadProfile = async () => {
            try {
                const response = await fetch("/api/user/profile");

                if (response.status === 401) {
                    router.replace("/auth/login");
                    return;
                }

                if (!response.ok) {
                    throw new Error("프로필 조회 실패");
                }

                const data = await response.json();

                setSavedCountryCode(data.countryCode ?? null);
                setSavedRegionCode(data.provinceCode ?? null);
                setCountryCode(data.countryCode ?? null);
                setRegionCode(data.provinceCode ?? null);
            } catch (loadError) {
                console.error("프로필을 불러오지 못했어요.", loadError);
                setError("프로필을 불러오지 못했어요.");
            } finally {
                setIsLoading(false);
            }
        };

        void loadProfile();
    }, [router]);

    const selectedCountry = getCountry(countryCode);
    const savedCountry = getCountry(savedCountryCode);

    const hasCountryChanged = Boolean(selectedCountry) && selectedCountry?.code !== savedCountryCode;

    const isRegionValid = !selectedCountry?.hasRegions || Boolean(regionCode && selectedCountry.regions.some((r) => r.code === regionCode));

    const isChanged = hasCountryChanged || (selectedCountry?.hasRegions === true && regionCode !== savedRegionCode);

    const handleSelectCountry = (nextCode: string) => {
        setCountryCode(nextCode);
        setError("");

        // 같은 나라로 돌아오면 저장된 지역을 되살리고, 다른 나라면 지역을 다시 고르게 한다
        setRegionCode(nextCode === savedCountryCode ? savedRegionCode : null);
    };

    const handleSave = async () => {
        if (!selectedCountry || !isRegionValid) {
            setError("지역을 선택해 주세요.");
            return;
        }

        setError("");
        setIsSaving(true);

        try {
            const response = await fetch("/api/user/profile", {
                method: "PATCH",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    countryCode: selectedCountry.code,
                    provinceCode: selectedCountry.hasRegions ? regionCode : null,
                    confirmReset: hasCountryChanged && isResetConfirmed,
                }),
            });

            const data = await response.json();

            if (!response.ok) {
                setError(data.error || "국가와 지역을 저장하지 못했어요.");
                return;
            }

            router.push("/settings");
        } catch (saveError) {
            console.error("국가·지역 저장 실패:", saveError);
            setError("저장하지 못했어요. 다시 시도해 주세요.");
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="mx-auto w-full max-w-md">
            <BackButtonHeader href="/settings" title="국가 · 지역" description="거주 국가와 지역을 바꿀 수 있어요." />

            <section className="mt-8 rounded-3xl bg-white p-6 shadow-sm">
                <h2 className="text-lg font-semibold">국가</h2>

                <div className="mt-4 space-y-2">
                    {COUNTRIES.map((country) => (
                        <button
                            type="button"
                            key={country.code}
                            disabled={isLoading}
                            onClick={() => handleSelectCountry(country.code)}
                            className={`flex w-full items-center justify-between rounded-2xl p-4 text-left text-sm font-medium ${
                                countryCode === country.code ? "bg-black text-white" : "bg-gray-100"
                            }`}
                        >
                            <span>{country.nameKo}</span>

                            <span className="text-xs opacity-60">{country.nameEn}</span>
                        </button>
                    ))}
                </div>
            </section>

            {selectedCountry?.hasRegions && (
                <section className="mt-5 rounded-3xl bg-white p-6 shadow-sm">
                    <h2 className="text-lg font-semibold">지역</h2>

                    <div className="mt-4 space-y-2">
                        {selectedCountry.regions.map((region) => (
                            <button
                                type="button"
                                key={region.code}
                                onClick={() => {
                                    setRegionCode(region.code);
                                    setError("");
                                }}
                                className={`w-full rounded-2xl p-4 text-left ${
                                    regionCode === region.code ? "bg-black text-white" : "bg-gray-100"
                                }`}
                            >
                                <p className="text-sm font-medium">{region.name}</p>

                                <p className="mt-1 text-xs opacity-60">
                                    {region.timezoneName} {region.timezoneOffset}
                                    {!region.payrollSupported && " · 세금 계산 준비 중"}
                                </p>
                            </button>
                        ))}
                    </div>
                </section>
            )}

            {hasCountryChanged && selectedCountry && (
                <section className="mt-5 rounded-2xl bg-amber-50 px-4 py-4">
                    <p className="text-sm font-semibold text-amber-800">국가를 바꾸기 전에 확인해 주세요</p>

                    <ul className="mt-2 space-y-1.5 text-xs leading-5 text-amber-700">
                        <li>
                            · 통화가 {savedCountry?.currency ?? "-"}에서 {selectedCountry.currency}(으)로 바뀌어요.
                        </li>
                        <li>· 금액과 관련된 데이터가 모두 삭제되고, 되돌릴 수 없어요.</li>
                        <li>· 삭제: 생활 내역, 고정지출, 저축 목표, 급여 설정, 근무 일정, 급여 기록, 여행 기록과 경비</li>
                        <li>· 유지: 계정, 닉네임, 구독, 생활 카테고리</li>
                    </ul>

                    <label className="mt-3 flex items-start gap-2 text-xs leading-5 text-amber-800">
                        <input
                            type="checkbox"
                            checked={isResetConfirmed}
                            onChange={(event) => setIsResetConfirmed(event.target.checked)}
                            className="mt-0.5"
                        />
                        <span>위 데이터가 모두 삭제되는 것을 이해했어요.</span>
                    </label>
                </section>
            )}

            {error && <p className="mt-4 text-center text-sm text-red-500">{error}</p>}

            <button
                type="button"
                onClick={() => void handleSave()}
                disabled={isLoading || !isChanged || !isRegionValid || isSaving || (hasCountryChanged && !isResetConfirmed)}
                className="mt-6 flex h-14 w-full items-center justify-center rounded-2xl bg-gray-900 text-sm font-medium text-white transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:bg-gray-200 disabled:text-gray-400"
            >
                {isSaving ? "저장 중..." : hasCountryChanged ? "국가 변경하기" : "저장"}
            </button>
        </div>
    );
}
