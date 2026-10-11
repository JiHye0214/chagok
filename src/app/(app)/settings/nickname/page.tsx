"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import BackButtonHeader from "@/components/BackButtonHeader";
import { translateServerMessage } from "@/lib/i18n/serverMessages";
import { useI18n } from "@/components/I18nProvider";

const NICKNAME_PATTERN = /^[가-힣a-z0-9._]{3,20}$/;

export default function NicknameSettingsPage() {
    const router = useRouter();
    const { t } = useI18n();
    const nicknameRule = t("settings.nicknamePage.rule");

    const [savedNickname, setSavedNickname] = useState("");
    const [nickname, setNickname] = useState("");
    const [error, setError] = useState("");
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);

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

                setSavedNickname(data.nickname ?? "");
                setNickname(data.nickname ?? "");
            } catch (loadError) {
                console.error("프로필을 불러오지 못했어요.", loadError);
                setError(t("settings.profileLoadFailed"));
            } finally {
                setIsLoading(false);
            }
        };

        void loadProfile();
    }, [router]);

    const trimmedNickname = nickname.trim();

    const isValid = NICKNAME_PATTERN.test(trimmedNickname);

    const isChanged = trimmedNickname !== savedNickname;

    const handleSave = async () => {
        if (!isValid) {
            setError(nicknameRule);
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
                body: JSON.stringify({ nickname: trimmedNickname }),
            });

            const data = await response.json();

            if (!response.ok) {
                setError(translateServerMessage(data.error, t) || t("settings.nicknamePage.saveFailed"));
                return;
            }

            router.push("/settings");
        } catch (saveError) {
            console.error("닉네임 저장 실패:", saveError);
            setError(t("settings.nicknamePage.saveFailedRetry"));
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="mx-auto w-full max-w-md">
            <BackButtonHeader href="/settings" title={t("settings.nicknamePage.title")} description={t("settings.nicknamePage.description")} />

            <section className="mt-8 rounded-3xl bg-white p-6 shadow-sm">
                <input
                    type="text"
                    value={nickname}
                    onChange={(e) => {
                        setNickname(e.target.value);
                        setError("");
                    }}
                    onKeyDown={(e) => {
                        if (e.key === "Enter" && isValid && isChanged && !isSaving) {
                            void handleSave();
                        }
                    }}
                    disabled={isLoading}
                    placeholder={isLoading ? t("common.loadingEllipsis") : t("settings.nicknamePage.placeholder")}
                    maxLength={20}
                    className={`h-14 w-full rounded-2xl border bg-white px-5 text-sm text-gray-900 outline-none transition placeholder:text-gray-300 ${
                        error ? "border-red-300 focus:border-red-400" : "border-gray-200 focus:border-gray-400"
                    }`}
                    autoFocus
                />

                {error ? (
                    <p className="mt-2 text-xs text-red-400">{error}</p>
                ) : (
                    <p className="mt-2 text-xs text-gray-400">{nicknameRule}</p>
                )}
            </section>

            <button
                type="button"
                onClick={() => void handleSave()}
                disabled={isLoading || !isValid || !isChanged || isSaving}
                className="mt-6 flex h-14 w-full items-center justify-center rounded-2xl bg-gray-900 text-sm font-medium text-white transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:bg-gray-200 disabled:text-gray-400"
            >
                {isSaving ? t("common.saving") : t("common.save")}
            </button>
        </div>
    );
}
