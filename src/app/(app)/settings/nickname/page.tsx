"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import BackButtonHeader from "@/components/BackButtonHeader";

const NICKNAME_PATTERN = /^[가-힣a-z0-9._]{3,20}$/;

const NICKNAME_RULE = "3~20자의 한글, 영문 소문자, 숫자, ., _를 사용할 수 있어요.";

export default function NicknameSettingsPage() {
    const router = useRouter();

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
                setError("프로필을 불러오지 못했어요.");
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
            setError(NICKNAME_RULE);
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
                setError(data.error || "닉네임을 저장하지 못했어요.");
                return;
            }

            router.push("/settings");
        } catch (saveError) {
            console.error("닉네임 저장 실패:", saveError);
            setError("닉네임을 저장하지 못했어요. 다시 시도해 주세요.");
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="mx-auto w-full max-w-md">
            <BackButtonHeader href="/settings" title="닉네임" description="차곡에서 사용할 이름을 바꿀 수 있어요." />

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
                    placeholder={isLoading ? "불러오는 중..." : "닉네임을 입력해 주세요"}
                    maxLength={20}
                    className={`h-14 w-full rounded-2xl border bg-white px-5 text-sm text-gray-900 outline-none transition placeholder:text-gray-300 ${
                        error ? "border-red-300 focus:border-red-400" : "border-gray-200 focus:border-gray-400"
                    }`}
                    autoFocus
                />

                {error ? (
                    <p className="mt-2 text-xs text-red-400">{error}</p>
                ) : (
                    <p className="mt-2 text-xs text-gray-400">{NICKNAME_RULE}</p>
                )}
            </section>

            <button
                type="button"
                onClick={() => void handleSave()}
                disabled={isLoading || !isValid || !isChanged || isSaving}
                className="mt-6 flex h-14 w-full items-center justify-center rounded-2xl bg-gray-900 text-sm font-medium text-white transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:bg-gray-200 disabled:text-gray-400"
            >
                {isSaving ? "저장 중..." : "저장"}
            </button>
        </div>
    );
}
