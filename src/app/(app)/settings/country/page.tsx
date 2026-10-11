"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import BackButtonHeader from "@/components/BackButtonHeader";
import { translateServerMessage } from "@/lib/i18n/serverMessages";
import { useI18n } from "@/components/I18nProvider";
import { COUNTRIES, getCountry } from "@/lib/countries";

export default function CountrySettingsPage() {
    const router = useRouter();
    const { t, language } = useI18n();

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
                setError(t("settings.profileLoadFailed"));
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
            setError(t("settings.countryPage.pickRegion"));
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
                setError(translateServerMessage(data.error, t) || t("settings.countryPage.saveFailed"));
                return;
            }

            router.push("/settings");
        } catch (saveError) {
            console.error("국가·지역 저장 실패:", saveError);
            setError(t("settings.countryPage.saveFailedRetry"));
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="mx-auto w-full max-w-md">
            <BackButtonHeader href="/settings" title={t("settings.countryPage.title")} description={t("settings.countryPage.description")} />

            <section className="mt-8 rounded-3xl bg-white p-6 shadow-sm">
                <h2 className="text-lg font-semibold">{t("settings.country")}</h2>

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
                            <span>{language === "en" ? country.nameEn : country.nameKo}</span>

                            <span className="text-xs opacity-60">{language === "en" ? country.nameKo : country.nameEn}</span>
                        </button>
                    ))}
                </div>
            </section>

            {selectedCountry?.hasRegions && (
                <section className="mt-5 rounded-3xl bg-white p-6 shadow-sm">
                    <h2 className="text-lg font-semibold">{t("settings.region")}</h2>

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
                                    {!region.payrollSupported && ` · ${t("settings.countryPage.taxPending")}`}
                                </p>
                            </button>
                        ))}
                    </div>
                </section>
            )}

            {hasCountryChanged && selectedCountry && (
                <section className="mt-5 rounded-2xl bg-amber-50 px-4 py-4">
                    <p className="text-sm font-semibold text-amber-800">{t("settings.countryPage.warnTitle")}</p>

                    <ul className="mt-2 space-y-1.5 text-xs leading-5 text-amber-700">
                        <li>
                            · {t("settings.countryPage.warnCurrency", { from: savedCountry?.currency ?? "-", to: selectedCountry.currency })}
                        </li>
                        <li>· {t("settings.countryPage.warnWipe")}</li>
                        <li>· {t("settings.countryPage.warnDeleted")}</li>
                        <li>· {t("settings.countryPage.warnKept")}</li>
                    </ul>

                    <label className="mt-3 flex items-start gap-2 text-xs leading-5 text-amber-800">
                        <input
                            type="checkbox"
                            checked={isResetConfirmed}
                            onChange={(event) => setIsResetConfirmed(event.target.checked)}
                            className="mt-0.5"
                        />
                        <span>{t("settings.countryPage.warnCheck")}</span>
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
                {isSaving ? t("common.saving") : hasCountryChanged ? t("settings.countryPage.changeCountry") : t("common.save")}
            </button>
        </div>
    );
}
