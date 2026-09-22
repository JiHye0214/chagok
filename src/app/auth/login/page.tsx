"use client";

import { useEffect, useState } from "react";
import { createAuthClient } from "better-auth/react";

const authClient = createAuthClient();

export default function LoginPage() {
    const [country, setCountry] = useState<string | null>(null);

    useEffect(() => {
        setCountry(localStorage.getItem("chagok_country"));
    }, []);

    const handleGoogleLogin = async () => {
        sessionStorage.setItem("chagok_login_splash", "true");

        await authClient.signIn.social({
            provider: "google",
            callbackURL: "/",
        });
    };

    const handleKakaoLogin = async () => {
        sessionStorage.setItem("chagok_login_splash", "true");

        await authClient.signIn.social({
            provider: "kakao",
            callbackURL: "/",
        });
    };

    const stepNumber = country === "CA" ? "04" : "03";

    return (
        <main className="h-[100dvh] w-full overflow-hidden bg-gray-50">
            <div className="relative mx-auto h-full w-full max-w-md px-6">
                {/* Brand */}
                <p className="absolute left-6 top-8 text-2xl font-semibold tracking-[-0.05em] text-gray-900">차곡</p>

                {/* Content */}
                <main className="flex h-full w-full items-center justify-center">
                    <div className="w-full">
                        {/* Question */}
                        <div className="opacity-0 animate-[onboardingFadeUp_0.6s_ease-out_0.2s_forwards]">
                            <p className="text-xs text-gray-400">{stepNumber}</p>

                            <h1 className="mt-3 text-2xl font-semibold tracking-[-0.04em] text-gray-900">로그인해 주세요</h1>

                            <p className="mt-2 text-sm text-gray-400">차곡을 시작하려면 로그인이 필요해요.</p>
                        </div>

                        {/* Login Buttons */}
                        <div className="mt-10 space-y-3">
                            {/* Google */}
                            <button
                                type="button"
                                onClick={handleGoogleLogin}
                                className="flex h-14 w-full items-center justify-center gap-3 rounded-2xl border border-gray-200 bg-white text-sm font-medium text-gray-900 opacity-0 animate-[onboardingFadeUp_0.6s_ease-out_forwards] transition hover:border-gray-400"
                                style={{
                                    animationDelay: "0.35s",
                                }}
                            >
                                <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
                                    <path
                                        fill="#4285F4"
                                        d="M21.35 12.23c0-.79-.07-1.55-.23-2.27H12v4.3h5.24a4.48 4.48 0 0 1-1.94 2.94v2.45h3.14c1.84-1.69 2.91-4.18 2.91-7.42Z"
                                    />
                                    <path
                                        fill="#34A853"
                                        d="M12 21.75c2.63 0 4.84-.87 6.45-2.36l-3.14-2.45c-.87.58-1.98.92-3.31.92-2.54 0-4.69-1.72-5.46-4.03H3.3v2.53A9.75 9.75 0 0 0 12 21.75Z"
                                    />
                                    <path
                                        fill="#FBBC05"
                                        d="M6.54 13.83A5.86 5.86 0 0 1 6.23 12c0-.64.11-1.26.31-1.83V7.64H3.3A9.75 9.75 0 0 0 2.25 12c0 1.57.38 3.05 1.05 4.36l3.24-2.53Z"
                                    />
                                    <path
                                        fill="#EA4335"
                                        d="M12 6.14c1.43 0 2.71.49 3.72 1.45l2.79-2.79C16.84 3.14 14.63 2.25 12 2.25a9.75 9.75 0 0 0-8.7 5.39l3.24 2.53C7.31 7.86 9.46 6.14 12 6.14Z"
                                    />
                                </svg>
                                Google로 계속하기
                            </button>

                            {/* Kakao - Korea only */}
                            {country === "KR" && (
                                <button
                                    type="button"
                                    onClick={handleKakaoLogin}
                                    className="flex h-14 w-full items-center justify-center gap-3 rounded-2xl bg-[#FEE500] text-sm font-medium text-gray-900 opacity-0 animate-[onboardingFadeUp_0.6s_ease-out_forwards] transition hover:brightness-95"
                                    style={{
                                        animationDelay: "0.45s",
                                    }}
                                >
                                    <img src="/icons/kakao.png" alt="" className="h-5 w-5" />
                                    카카오로 계속하기
                                </button>
                            )}
                        </div>
                    </div>
                </main>

                {/* Back */}
                <button
                    type="button"
                    onClick={() => {
                        if (country === "CA") {
                            window.location.href = "/onboarding/region";
                        } else {
                            window.location.href = "/onboarding/country";
                        }
                    }}
                    className="absolute bottom-8 left-6 text-xs text-gray-400 transition hover:text-gray-900"
                >
                    ← 이전
                </button>
            </div>
        </main>
    );
}
