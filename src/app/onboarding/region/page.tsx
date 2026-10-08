"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getCountry } from "@/lib/countries";
import type { CountryConfig } from "@/lib/countries";

export default function RegionPage() {
    const router = useRouter();

    // 앞 단계에서 고른 국가. 지역을 고르는 나라가 아니면 이 화면에 머물지 않는다.
    const [country, setCountry] = useState<CountryConfig | null>(null);

    useEffect(() => {
        const savedCountry = getCountry(localStorage.getItem("chagok_country"));

        if (!savedCountry) {
            router.replace("/onboarding/country");
            return;
        }

        if (!savedCountry.hasRegions) {
            router.replace("/auth/login");
            return;
        }

        setCountry(savedCountry);
    }, [router]);

    const regions = country?.regions ?? [];

    const handleRegionSelect = (regionCode: string, timezoneCode: string) => {
        localStorage.setItem("chagok_region", regionCode);
        localStorage.setItem("chagok_timezone", timezoneCode);

        router.push("/auth/login");
    };

    if (!country) {
        return null;
    }

    return (
        <div className="h-full w-full">
            <div className="relative mx-auto h-full w-full max-w-md px-6">
                {/* Brand */}
                <p className="absolute left-6 top-8 text-2xl font-semibold tracking-[-0.05em] text-gray-900">
                    차곡
                </p>
                {/* Content */}
                <main className="flex h-full w-full items-center justify-center">
                    <div className="w-full">
                        {/* Question */}
                        <div className="opacity-0 animate-[onboardingFadeUp_0.6s_ease-out_0.2s_forwards]">
                            <p className="text-xs text-gray-400">03</p>

                            <h1 className="mt-3 text-2xl font-semibold tracking-[-0.04em] text-gray-900">지역을 선택해 주세요</h1>

                            <p className="mt-2 text-sm text-gray-400">거주 지역과 시간대를 선택해 주세요.</p>
                        </div>

                        {/* Regions */}
                        <div className="mt-10 space-y-3">
                            {regions.map((region, index) => (
                                <button
                                    key={region.code}
                                    type="button"
                                    onClick={() => handleRegionSelect(region.code, region.timezone)}
                                    className="flex w-full translate-y-3 items-center justify-between rounded-2xl border border-gray-200 bg-white px-5 py-4 text-left opacity-0 animate-[onboardingFadeUp_0.6s_ease-out_forwards] transition hover:border-gray-400"
                                    style={{
                                        animationDelay: `${0.35 + index * 0.1}s`,
                                    }}
                                >
                                    <div>
                                        <p className="text-sm font-medium text-gray-900">{region.name}</p>

                                        <p className="mt-1 text-xs text-gray-400">
                                            {region.timezoneName} {region.timezoneOffset}
                                            {!region.payrollSupported && " · 세금 계산 준비 중"}
                                        </p>
                                    </div>

                                    <span className="text-sm text-gray-300">→</span>
                                </button>
                            ))}
                        </div>
                    </div>
                </main>

                {/* Back */}
                <button
                    type="button"
                    onClick={() => router.push("/onboarding/country")}
                    className="absolute bottom-8 left-6 text-xs text-gray-400 transition hover:text-gray-900"
                >
                    ← 이전
                </button>
            </div>
        </div>
    );
}
