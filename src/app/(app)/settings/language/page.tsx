"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Check } from "lucide-react";
import BackButtonHeader from "@/components/BackButtonHeader";
import { translateServerMessage } from "@/lib/i18n/serverMessages";
import { useI18n } from "@/components/I18nProvider";
import LoadingScreen from "@/components/LoadingScreen";
import { LANGUAGES } from "@/lib/countries";

export default function LanguageSettingsPage() {
    const router = useRouter();
    const { t, setLanguage } = useI18n();

    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [savedLanguage, setSavedLanguage] = useState("");
    const [selectedLanguage, setSelectedLanguage] = useState("");
    const [error, setError] = useState("");

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

                setSavedLanguage(data.language ?? "");
                setSelectedLanguage(data.language ?? "");
            } catch (loadError) {
                console.error("프로필을 불러오지 못했어요.", loadError);
                setError(t("settings.profileLoadFailed"));
            } finally {
                setIsLoading(false);
            }
        };

        void loadProfile();
    }, [router]);

    const isChanged = selectedLanguage !== "" && selectedLanguage !== savedLanguage;

    const handleSave = async () => {
        if (!isChanged) {
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
                body: JSON.stringify({ language: selectedLanguage }),
            });

            const data = await response.json();

            if (!response.ok) {
                setError(translateServerMessage(data.error, t) || t("settingsLang.saveFailed"));
                return;
            }

            // 저장이 끝났으니 화면 언어를 바로 바꾼다
            setLanguage(selectedLanguage);

            router.push("/settings");
        } catch (saveError) {
            console.error("언어 저장 실패:", saveError);
            setError(t("settingsLang.saveFailedRetry"));
        } finally {
            setIsSaving(false);
        }
    };

    if (isLoading) {
        return <LoadingScreen />;
    }

    return (
        <div className="mx-auto w-full max-w-md">
            <BackButtonHeader href="/settings" title={t("settingsLang.title")} description={t("settingsLang.description")} />

            <section className="mt-8 rounded-3xl bg-white p-3 shadow-sm">
                {LANGUAGES.map((language) => {
                    const isSelected = selectedLanguage === language.code;

                    return (
                        <button
                            key={language.code}
                            type="button"
                            onClick={() => {
                                setSelectedLanguage(language.code);
                                setError("");
                            }}
                            className={`flex w-full items-center justify-between rounded-2xl p-3 text-left transition-colors ${
                                isSelected ? "bg-gray-50" : "active:bg-gray-50"
                            }`}
                        >
                            <div>
                                <p className="text-sm font-medium text-gray-900">{language.label}</p>

                                <p className="mt-0.5 text-xs text-gray-400">{language.englishLabel}</p>
                            </div>

                            {isSelected && <Check size={18} strokeWidth={2} className="text-gray-900" />}
                        </button>
                    );
                })}
            </section>

            <p className="mt-4 px-1 text-xs leading-5 text-gray-400">
                {t("settingsLang.note")}
            </p>

            {error && <p className="mt-3 px-1 text-xs text-red-500">{error}</p>}

            <button
                type="button"
                onClick={() => void handleSave()}
                disabled={!isChanged || isSaving}
                className="mt-6 flex h-14 w-full items-center justify-center rounded-2xl bg-gray-900 text-sm font-medium text-white transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:bg-gray-200 disabled:text-gray-400"
            >
                {isSaving ? t("common.saving") : t("settingsLang.save")}
            </button>
        </div>
    );
}
