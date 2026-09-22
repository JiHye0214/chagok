"use client";

import { useEffect, useState } from "react";
import { ChevronRight, LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth/auth-client";

type Profile = {
    nickname: string | null;
    language: string | null;
    countryCode: string | null;
    provinceCode: string | null;
    currency: string | null;
};

const countryLabels: Record<string, string> = {
    KR: "한국",
    CA: "캐나다",
};

const provinceLabels: Record<string, string> = {
    BC: "British Columbia",
    ON: "Ontario",
};

const languageLabels: Record<string, string> = {
    ko: "한국어",
    en: "English",
};

export default function SettingsPage() {
    const router = useRouter();

    const [profile, setProfile] = useState<Profile | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const loadProfile = async () => {
            try {
                const response = await fetch("/api/user/profile");

                if (!response.ok) {
                    return;
                }

                const data = await response.json();

                setProfile({
                    nickname: data.nickname ?? null,
                    language: data.language ?? null,
                    countryCode: data.countryCode ?? null,
                    provinceCode: data.provinceCode ?? null,
                    currency: data.currency ?? null,
                });
            } catch (error) {
                console.error("프로필을 불러오지 못했어요.", error);
            } finally {
                setLoading(false);
            }
        };

        loadProfile();
    }, []);

    const handleLogout = async () => {
        try {
            await authClient.signOut();

            router.replace("/");
            router.refresh();
        } catch (error) {
            console.error("로그아웃에 실패했어요.", error);
        }
    };

    return (
        <div className="mx-auto w-full max-w-md">
            <header className="mb-8">
                <h1 className="text-2xl font-semibold tracking-[-0.04em] text-gray-900">설정</h1>
            </header>

            <section>
                <h2 className="mb-3 px-1 text-xs font-medium text-gray-400">프로필</h2>

                <div className="overflow-hidden rounded-2xl bg-white">
                    <button
                        type="button"
                        onClick={() => router.push("/settings/nickname")}
                        className="flex w-full items-center justify-between px-4 py-4 text-left"
                    >
                        <div>
                            <p className="text-sm text-gray-900">닉네임</p>
                            <p className="mt-1 text-xs text-gray-400">{loading ? "불러오는 중..." : profile?.nickname || "-"}</p>
                        </div>

                        <ChevronRight size={18} strokeWidth={1.7} className="text-gray-300" />
                    </button>
                </div>
            </section>

            <section className="mt-8">
                <h2 className="mb-3 px-1 text-xs font-medium text-gray-400">기본 설정</h2>

                <div className="overflow-hidden rounded-2xl bg-white">
                    <div className="flex items-center justify-between px-4 py-4">
                        <span className="text-sm text-gray-900">언어</span>
                        <span className="text-sm text-gray-400">
                            {loading ? "-" : languageLabels[profile?.language ?? ""] || "-"}
                        </span>
                    </div>

                    <div className="mx-4 border-t border-gray-100" />

                    <div className="flex items-center justify-between px-4 py-4">
                        <span className="text-sm text-gray-900">국가</span>
                        <span className="text-sm text-gray-400">
                            {loading ? "-" : countryLabels[profile?.countryCode ?? ""] || "-"}
                        </span>
                    </div>

                    {profile?.countryCode === "CA" && (
                        <>
                            <div className="mx-4 border-t border-gray-100" />

                            <div className="flex items-center justify-between px-4 py-4">
                                <span className="text-sm text-gray-900">지역</span>
                                <span className="text-sm text-gray-400">
                                    {provinceLabels[profile?.provinceCode ?? ""] || "-"}
                                </span>
                            </div>
                        </>
                    )}

                    <div className="mx-4 border-t border-gray-100" />

                    <div className="flex items-center justify-between px-4 py-4">
                        <span className="text-sm text-gray-900">통화</span>
                        <span className="text-sm text-gray-400">{loading ? "-" : profile?.currency || "-"}</span>
                    </div>
                </div>
            </section>

            <section className="mt-8">
                <h2 className="mb-3 px-1 text-xs font-medium text-gray-400">계정</h2>

                <div className="overflow-hidden rounded-2xl bg-white">
                    <button type="button" onClick={handleLogout} className="flex w-full items-center gap-3 px-4 py-4 text-left">
                        <LogOut size={18} strokeWidth={1.7} className="text-gray-400" />
                        <span className="text-sm text-gray-900">로그아웃</span>
                    </button>
                </div>
            </section>
        </div>
    );
}
