"use client";

import { useRouter } from "next/navigation";

const countries = [
    {
        code: "KR",
        label: "대한민국",
        englishLabel: "South Korea",
        timezone: "Asia/Seoul",
    },
    {
        code: "CA",
        label: "캐나다",
        englishLabel: "Canada",
    },
];

export default function CountryPage() {
    const router = useRouter();

    const handleCountrySelect = (countryCode: string) => {
        localStorage.setItem("chagok_country", countryCode);

        if (countryCode === "CA") {
            localStorage.removeItem("chagok_region");
            localStorage.removeItem("chagok_timezone");

            router.push("/onboarding/region");
            return;
        }

        localStorage.removeItem("chagok_region");
        localStorage.setItem("chagok_timezone", "Asia/Seoul");

        router.push("/auth/login");
    };

    return (
        <div className="h-full w-full">
            <div className="relative mx-auto h-full w-full max-w-md px-6">
                {/* Brand */}
                <p className="absolute left-6 top-8 text-2xl font-semibold tracking-[-0.05em] text-gray-900">차곡</p>

                {/* Content */}
                <main className="flex h-full w-full items-center justify-center">
                    <div className="w-full">
                        {/* Question */}
                        <div className="opacity-0 animate-[onboardingFadeUp_0.6s_ease-out_0.2s_forwards]">
                            <p className="text-xs text-gray-400">02</p>

                            <h1 className="mt-3 text-2xl font-semibold tracking-[-0.04em] text-gray-900">국가를 선택해 주세요</h1>

                            <p className="mt-2 text-sm text-gray-400">거주 국가를 선택해 주세요.</p>
                        </div>

                        {/* Countries */}
                        <div className="mt-10 space-y-3">
                            {countries.map((country, index) => (
                                <button
                                    key={country.code}
                                    type="button"
                                    onClick={() => handleCountrySelect(country.code)}
                                    className="flex w-full translate-y-3 items-center justify-between rounded-2xl border border-gray-200 bg-white px-5 py-4 text-left opacity-0 animate-[onboardingFadeUp_0.6s_ease-out_forwards] transition hover:border-gray-400"
                                    style={{
                                        animationDelay: `${0.35 + index * 0.1}s`,
                                    }}
                                >
                                    <span className="text-sm font-medium text-gray-900">{country.label}</span>

                                    <span className="text-xs text-gray-400">{country.englishLabel}</span>
                                </button>
                            ))}
                        </div>
                    </div>
                </main>

                {/* Back */}
                <button
                    type="button"
                    onClick={() => router.push("/onboarding/language")}
                    className="absolute bottom-8 left-6 text-xs text-gray-400 transition hover:text-gray-900"
                >
                    ← 이전
                </button>
            </div>
        </div>
    );
}
