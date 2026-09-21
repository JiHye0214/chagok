"use client";

import { useRouter } from "next/navigation";

const languages = [
    {
        code: "ko",
        label: "한국어",
        englishLabel: "Korean",
    },
    {
        code: "en",
        label: "English",
        englishLabel: "English",
    },
];

export default function LanguagePage() {
    const router = useRouter();

    const handleLanguageSelect = (languageCode: string) => {
        localStorage.setItem("chagok_language", languageCode);
        router.push("/onboarding/country");
    };

    return (
        <div className="h-full w-full">
            <div className="relative mx-auto h-full w-full max-w-md px-6">
                {/* Brand */}
                <p className="absolute left-6 top-8 text-2xl font-semibold tracking-[-0.05em] text-gray-900 opacity-0 animate-[onboardingFadeUp_0.6s_ease-out_0.1s_forwards]">
                    차곡
                </p>
                {/* Content */}
                <main className="flex h-full w-full items-center justify-center">
                    <div className="w-full">
                        {/* Question */}
                        <div className="opacity-0 animate-[onboardingFadeUp_0.6s_ease-out_0.2s_forwards]">
                            <p className="text-xs text-gray-400">01</p>

                            <h1 className="mt-3 text-2xl font-semibold tracking-[-0.04em] text-gray-900">언어를 선택해 주세요</h1>

                            <p className="mt-2 text-sm text-gray-400">사용할 언어를 선택해 주세요.</p>
                        </div>

                        {/* Languages */}
                        <div className="mt-10 space-y-3">
                            {languages.map((language, index) => (
                                <button
                                    key={language.code}
                                    type="button"
                                    onClick={() => handleLanguageSelect(language.code)}
                                    className="flex w-full translate-y-3 items-center justify-between rounded-2xl border border-gray-200 bg-white px-5 py-4 text-left opacity-0 animate-[onboardingFadeUp_0.6s_ease-out_forwards] transition hover:border-gray-400"
                                    style={{
                                        animationDelay: `${0.35 + index * 0.1}s`,
                                    }}
                                >
                                    <span className="text-sm font-medium text-gray-900">{language.label}</span>

                                    <span className="text-xs text-gray-400">{language.englishLabel}</span>
                                </button>
                            ))}
                        </div>
                    </div>
                </main>
            </div>
        </div>
    );
}
