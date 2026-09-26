"use client";

import { useEffect, useState } from "react";
import { ChevronRight, LogOut, Trash2 } from "lucide-react";
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

    const [isDeleting, setIsDeleting] = useState(false);
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [deleteConfirmation, setDeleteConfirmation] = useState("");

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
        const confirmed = window.confirm("로그아웃하시겠어요?");

        if (!confirmed) {
            return;
        }

        try {
            await authClient.signOut();

            router.replace("/");
            router.refresh();
        } catch (error) {
            console.error("로그아웃에 실패했어요.", error);
            alert("로그아웃에 실패했어요.");
        }
    };

    const handleDeleteAccount = () => {
        const confirmed = window.confirm(
            "정말 회원탈퇴하시겠어요?\n\n모든 급여, 근무 기록, 생활비, 여행 및 설정 데이터가 삭제되며 복구할 수 없습니다.",
        );

        if (!confirmed) {
            return;
        }

        setDeleteConfirmation("");
        setShowDeleteModal(true);
    };

    const confirmDeleteAccount = async () => {
        if (deleteConfirmation !== "차곡차곡 부자가 되자") {
            return;
        }

        setIsDeleting(true);

        try {
            const response = await fetch("/api/user/account", {
                method: "DELETE",
            });

            const data = await response.json();

            if (!response.ok) {
                alert(data.error || "회원탈퇴에 실패했어요.");
                return;
            }

            await authClient.signOut();

            router.replace("/");
            router.refresh();
        } catch (error) {
            console.error("회원탈퇴에 실패했어요.", error);
            alert("회원탈퇴에 실패했어요.");
        } finally {
            setIsDeleting(false);
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

                    <div className="mx-4 border-t border-gray-100" />

                    <button
                        type="button"
                        onClick={handleDeleteAccount}
                        disabled={isDeleting}
                        className="flex w-full items-center gap-3 px-4 py-4 text-left disabled:opacity-50"
                    >
                        <Trash2 size={18} strokeWidth={1.7} className="text-red-500" />
                        <span className="text-sm text-red-500">{isDeleting ? "탈퇴 처리 중..." : "회원탈퇴"}</span>
                    </button>
                </div>
            </section>

            {showDeleteModal && (
                <div className="fixed inset-0 z-[10000] flex items-center justify-center px-5">
                    <button
                        type="button"
                        aria-label="닫기"
                        onClick={() => {
                            setShowDeleteModal(false);
                            setDeleteConfirmation("");
                        }}
                        className="absolute inset-0 bg-black/30"
                    />

                    <div className="relative w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl">
                        <div>
                            <h2 className="text-lg font-semibold text-gray-900">회원탈퇴</h2>

                            <p className="mt-3 text-sm leading-6 text-gray-500">
                                회원탈퇴를 진행하면 계정과 함께 저장된 모든 데이터가 삭제됩니다.
                                <br />
                                삭제된 데이터는 복구할 수 없습니다.
                            </p>
                        </div>

                        <div className="mt-6">
                            <p className="text-sm font-medium text-gray-700">확인하려면 아래 문구를 그대로 입력해주세요.</p>

                            <p className="mt-2 rounded-xl bg-gray-50 px-3 py-3 text-sm font-medium text-gray-900">
                                차곡차곡 부자가 되자
                            </p>

                            <input
                                type="text"
                                value={deleteConfirmation}
                                onChange={(e) => setDeleteConfirmation(e.target.value)}
                                placeholder="문구를 입력해주세요"
                                disabled={isDeleting}
                                className="mt-3 w-full rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-gray-400 disabled:bg-gray-50"
                            />
                        </div>

                        <div className="mt-6 flex gap-3">
                            <button
                                type="button"
                                onClick={() => {
                                    setShowDeleteModal(false);
                                    setDeleteConfirmation("");
                                }}
                                disabled={isDeleting}
                                className="flex-1 rounded-2xl bg-gray-100 py-3.5 text-sm font-semibold text-gray-700 disabled:opacity-50"
                            >
                                취소
                            </button>

                            <button
                                type="button"
                                onClick={() => void confirmDeleteAccount()}
                                disabled={deleteConfirmation !== "차곡차곡 부자가 되자" || isDeleting}
                                className="flex-1 rounded-2xl bg-red-500 py-3.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-gray-200 disabled:text-gray-400"
                            >
                                {isDeleting ? "탈퇴 처리 중..." : "회원탈퇴"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
