"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function NicknamePage() {
    const router = useRouter();

    const [country, setCountry] = useState<string | null>(null);
    const [nickname, setNickname] = useState("");
    const [error, setError] = useState("");
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);

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
            } catch (error) {
                console.error("프로필 확인 실패:", error);
            } finally {
                setIsLoading(false);
            }
        };

        checkProfile();
    }, [router]);

    const stepNumber = country === "CA" ? "05" : "04";

    const isValidNickname = /^[가-힣a-z0-9._]{3,20}$/.test(nickname);

    const handleNext = async () => {
        const trimmedNickname = nickname.trim();

        if (!/^[가-힣a-z0-9._]{3,20}$/.test(trimmedNickname)) {
            setError("3~20자의 한글, 영문 소문자, 숫자, ., _만 사용할 수 있어요.");
            return;
        }

        const language = localStorage.getItem("chagok_language") || "ko";

        const countryCode = localStorage.getItem("chagok_country");

        const provinceCode = localStorage.getItem("chagok_region");

        const timezone = localStorage.getItem("chagok_timezone");

        // 현재 지원 국가에 따라 통화 자동 설정
        let currency = "";

        if (countryCode === "KR") {
            currency = "KRW";
        } else if (countryCode === "CA") {
            currency = "CAD";
        }

        if (!countryCode || !timezone || !currency) {
            setError("사용자 정보를 확인할 수 없어요. 처음부터 다시 진행해 주세요.");
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
                    countryCode,
                    provinceCode,
                    timezone,
                    currency,
                }),
            });

            const data = await response.json();

            if (!response.ok) {
                setError(data.error || "프로필을 저장하지 못했어요.");
                return;
            }

            // 실제 저장은 DB가 담당하므로
            // 기존 nickname localStorage는 사용하지 않음
            localStorage.removeItem("chagok_nickname");

            router.push("/");
        } catch (error) {
            console.error("프로필 저장 실패:", error);
            setError("프로필을 저장하지 못했어요. 다시 시도해 주세요.");
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
                <p className="absolute left-6 top-8 text-2xl font-semibold tracking-[-0.05em] text-gray-900">차곡</p>

                <main className="flex h-full w-full items-center justify-center">
                    <div className="w-full">
                        <div className="opacity-0 animate-[onboardingFadeUp_0.6s_ease-out_0.2s_forwards]">
                            <p className="text-xs text-gray-400">{stepNumber}</p>

                            <h1 className="mt-3 text-2xl font-semibold tracking-[-0.04em] text-gray-900">닉네임을 정해 주세요</h1>

                            <p className="mt-2 text-sm text-gray-400">차곡에서 사용할 이름을 정해 주세요.</p>
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
                                placeholder="닉네임을 입력해 주세요"
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
                                    3~20자의 한글, 영문 소문자, 숫자, ., _를 사용할 수 있어요.
                                </p>
                            )}
                        </div>

                        <button
                            type="button"
                            onClick={handleNext}
                            disabled={!isValidNickname || isSaving}
                            className="mt-6 flex h-14 w-full items-center justify-center rounded-2xl bg-gray-900 text-sm font-medium text-white opacity-0 animate-[onboardingFadeUp_0.6s_ease-out_forwards] transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:bg-gray-200 disabled:text-gray-400"
                            style={{ animationDelay: "0.45s" }}
                        >
                            {isSaving ? "저장 중..." : "차곡 시작하기"}
                        </button>
                    </div>
                </main>

                <button
                    type="button"
                    onClick={() => router.push("/auth/login")}
                    className="absolute bottom-8 left-6 text-xs text-gray-400 transition hover:text-gray-900"
                >
                    ← 이전
                </button>
            </div>
        </div>
    );
}
