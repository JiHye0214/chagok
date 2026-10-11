"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Check } from "lucide-react";
import BackButtonHeader from "@/components/BackButtonHeader";
import LoadingScreen from "@/components/LoadingScreen";
import { LANGUAGES } from "@/lib/countries";

export default function LanguageSettingsPage() {
    const router = useRouter();

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
                setError("프로필을 불러오지 못했어요.");
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
                setError(data.error || "언어를 저장하지 못했어요.");
                return;
            }

            router.push("/settings");
        } catch (saveError) {
            console.error("언어 저장 실패:", saveError);
            setError("언어를 저장하지 못했어요. 다시 시도해 주세요.");
        } finally {
            setIsSaving(false);
        }
    };

    if (isLoading) {
        return <LoadingScreen />;
    }

    return (
        <div className="mx-auto w-full max-w-md">
            <BackButtonHeader href="/settings" title="언어" description="차곡에서 사용할 언어를 바꿀 수 있어요." />

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
                            className={`flex w-full items-center justify-between rounded-2xl px-4 py-4 text-left transition-colors ${
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
                선택한 언어는 계정에 저장돼요. 직접 적어 둔 메모와 기록 내용은 언어를 바꿔도 그대로 유지돼요.
            </p>

            {error && <p className="mt-3 px-1 text-xs text-red-500">{error}</p>}

            <button
                type="button"
                onClick={() => void handleSave()}
                disabled={!isChanged || isSaving}
                className="mt-6 flex h-14 w-full items-center justify-center rounded-2xl bg-gray-900 text-sm font-medium text-white transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:bg-gray-200 disabled:text-gray-400"
            >
                {isSaving ? "저장 중..." : "저장하기"}
            </button>
        </div>
    );
}
