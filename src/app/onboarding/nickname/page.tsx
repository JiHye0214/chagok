"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { translateServerMessage } from "@/lib/i18n/serverMessages";
import { useI18n } from "@/components/I18nProvider";
import { DEFAULT_LANGUAGE, getCountry, getOnboardingStepNumber } from "@/lib/countries";

export default function NicknamePage() {
    const router = useRouter();
    const { t } = useI18n();

    const [country, setCountry] = useState<string | null>(null);
    const [nickname, setNickname] = useState("");
    const [error, setError] = useState("");
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [agreeAge, setAgreeAge] = useState(false);
    const [agreeTerms, setAgreeTerms] = useState(false);
    const [agreePrivacy, setAgreePrivacy] = useState(false);
    const allAgreed = agreeAge && agreeTerms && agreePrivacy;

    useEffect(() => {
        const savedCountry = localStorage.getItem("chagok_country");
        setCountry(savedCountry);

        const checkProfile = async () => {
            try {
                const response = await fetch("/api/user/profile");

                if (!response.ok) {
                    if (response.status === 401) {
                        router.replace("/auth/login");
                    }
                    return;
                }

                const data = await response.json();

                // 이미 프로필과 닉네임이 있는 사용자
                if (data.nickname) {
                    router.replace("/");
                    return;
                }

                // 로그인만 하고 언어·국가를 고르지 않은 새 사용자는 처음 단계부터 진행한다
                const chosenCountry = getCountry(savedCountry);

                if (!chosenCountry) {
                    router.replace("/onboarding/language");
                    return;
                }

                // 지역을 고르는 나라인데 지역이 아직 없으면 지역 선택으로 보낸다
                if (chosenCountry.hasRegions && !localStorage.getItem("chagok_region")) {
                    router.replace("/onboarding/region");
                    return;
                }
            } catch (error) {
                console.error("프로필 확인 실패:", error);
            } finally {
                setIsLoading(false);
            }
        };

        checkProfile();
    }, [router]);

    const stepNumber = getOnboardingStepNumber("nickname", country);

    const isValidNickname = /^[가-힣a-z0-9._]{3,20}$/.test(nickname);

    const handleNext = async () => {
        if (!allAgreed) {
            return;
        }

        const trimmedNickname = nickname.trim();

        if (!/^[가-힣a-z0-9._]{3,20}$/.test(trimmedNickname)) {
            setError(t("settings.nicknamePage.rule"));
            return;
        }

        const language = localStorage.getItem("chagok_language") || DEFAULT_LANGUAGE;

        const countryCode = localStorage.getItem("chagok_country");

        const provinceCode = localStorage.getItem("chagok_region");

        const selectedCountry = getCountry(countryCode);

        if (!selectedCountry) {
            setError(t("onboarding.nickname.noInfo"));
            return;
        }

        // 지역을 고르는 나라인데 지역이 없으면 지역 선택으로 돌려보낸다
        if (selectedCountry.hasRegions && !provinceCode) {
            router.push("/onboarding/region");
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
                    nickname: trimmedNickname,
                    language,
                    countryCode: selectedCountry.code,
                    provinceCode: selectedCountry.hasRegions ? provinceCode : null,
                    // 통화와 시간대는 서버가 국가·지역에서 정한다
                }),
            });

            const data = await response.json();

            if (!response.ok) {
                setError(translateServerMessage(data.error, t) || t("onboarding.nickname.saveFailed"));
                return;
            }

            // 실제 저장은 DB가 담당하므로
            // 기존 nickname localStorage는 사용하지 않음
            localStorage.removeItem("chagok_nickname");
            // 계정에 언어가 저장됐으니 온보딩 임시 값은 지운다 (남겨 두면 이후 언어 설정을 덮어쓴다)
            localStorage.removeItem("chagok_language");

            router.push("/");
        } catch (error) {
            console.error("프로필 저장 실패:", error);
            setError(t("onboarding.nickname.saveFailedRetry"));
        } finally {
            setIsSaving(false);
        }
    };

    if (isLoading) {
        return null;
    }

    return (
        <div className="h-full w-full">
            <div className="relative mx-auto h-full w-full max-w-md px-6">
                <p className="absolute left-6 top-8 text-2xl font-semibold tracking-[-0.05em] text-gray-900">{t("common.appName")}</p>

                <main className="flex h-full w-full items-center justify-center">
                    <div className="w-full">
                        <div className="opacity-0 animate-[onboardingFadeUp_0.6s_ease-out_0.2s_forwards]">
                            <p className="text-xs text-gray-400">{stepNumber}</p>

                            <h1 className="mt-3 text-2xl font-semibold tracking-[-0.04em] text-gray-900">{t("onboarding.nickname.title")}</h1>

                            <p className="mt-2 text-sm text-gray-400">{t("onboarding.nickname.description")}</p>
                        </div>

                        <div
                            className="mt-10 opacity-0 animate-[onboardingFadeUp_0.6s_ease-out_forwards]"
                            style={{ animationDelay: "0.35s" }}
                        >
                            <input
                                type="text"
                                value={nickname}
                                onChange={(e) => {
                                    setNickname(e.target.value);
                                    setError("");
                                }}
                                onKeyDown={(e) => {
                                    if (e.key === "Enter") {
                                        handleNext();
                                    }
                                }}
                                placeholder={t("settings.nicknamePage.placeholder")}
                                maxLength={20}
                                className={`h-14 w-full rounded-2xl border bg-white px-5 text-sm text-gray-900 outline-none transition placeholder:text-gray-300 ${
                                    error ? "border-red-300 focus:border-red-400" : "border-gray-200 focus:border-gray-400"
                                }`}
                                autoFocus
                            />

                            {error ? (
                                <p className="mt-2 text-xs text-red-400">{error}</p>
                            ) : (
                                <p className="mt-2 text-xs text-gray-400">
                                    {t("settings.nicknamePage.rule")}
                                </p>
                            )}
                        </div>

                        <div className="opacity-0 animate-[onboardingFadeUp_0.6s_ease-out_forwards]" style={{ animationDelay: "0.4s" }}>
                            <div className="mt-6 space-y-3">
                                {[
                                    { checked: agreeAge, set: setAgreeAge, label: t("onboarding.nickname.agreeAge"), href: null },
                                    { checked: agreeTerms, set: setAgreeTerms, label: t("onboarding.nickname.agreeTerms"), href: "/legal/terms" },
                                    { checked: agreePrivacy, set: setAgreePrivacy, label: t("onboarding.nickname.agreePrivacy"), href: "/legal/privacy" },
                                ].map((item) => (
                                    <div key={item.label} className="flex items-center justify-between gap-3">
                                        <label className="flex flex-1 cursor-pointer items-center gap-3 text-sm text-gray-700">
                                            <input
                                                type="checkbox"
                                                checked={item.checked}
                                                onChange={(e) => item.set(e.target.checked)}
                                                className="h-4 w-4 accent-gray-900"
                                            />
                                            {item.label}
                                        </label>
                                        {item.href && (
                                            <a
                                                href={item.href}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="shrink-0 text-xs text-gray-400 underline"
                                            >
                                                {t("onboarding.nickname.agreeView")}
                                            </a>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>

                        <button
                            type="button"
                            onClick={handleNext}
                            disabled={!isValidNickname || !allAgreed || isSaving}
                            className="mt-6 flex h-14 w-full items-center justify-center rounded-2xl bg-gray-900 text-sm font-medium text-white opacity-0 animate-[onboardingFadeUp_0.6s_ease-out_forwards] transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:bg-gray-200 disabled:text-gray-400"
                            style={{ animationDelay: "0.45s" }}
                        >
                            {isSaving ? t("common.saving") : t("onboarding.nickname.start")}
                        </button>
                    </div>
                </main>

                <button
                    type="button"
                    onClick={() => router.push(getCountry(country)?.hasRegions ? "/onboarding/region" : "/onboarding/country")}
                    className="absolute bottom-8 left-6 text-xs text-gray-400 transition hover:text-gray-900"
                >
                    {t("onboarding.back")}
                </button>
            </div>
        </div>
    );
}
