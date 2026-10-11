"use client";

import { useEffect, useState } from "react";
import { Check, ChevronRight, LogOut, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth/auth-client";
import { useUpgrade } from "@/components/UpgradeProvider";
import { LANGUAGES, getCountry, getCountryLabel, getRegionLabel } from "@/lib/countries";
import BottomSheet from "@/components/BottomSheet";
import { useDialog } from "@/components/DialogProvider";
import { BILLING_ENABLED, getPlanPrice, getYearlyDiscountPercent } from "@/lib/plans";
import { formatCurrency } from "@/lib/salary/format";

type Profile = {
    nickname: string | null;
    language: string | null;
    countryCode: string | null;
    provinceCode: string | null;
    currency: string | null;
};

const PRO_BENEFITS = ["급여·생활·여행 기록 무제한", "고정지출과 카테고리 관리", "여행 통계와 소비 분석"];

export default function SettingsPage() {
    const { confirm, alert: showAlert } = useDialog();
    const router = useRouter();
    const { isPro, openUpgrade } = useUpgrade();

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
        const confirmed = await confirm("로그아웃하시겠어요?");

        if (!confirmed) {
            return;
        }

        try {
            await authClient.signOut();

            router.replace("/");
            router.refresh();
        } catch (error) {
            console.error("로그아웃에 실패했어요.", error);
            showAlert("로그아웃에 실패했어요.");
        }
    };

    const handleDeleteAccount = async () => {
        const confirmed = await confirm(
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

            // 서버가 JSON이 아닌 응답(오류 페이지 등)을 보내도 화면이 깨지지 않게 읽는다
            const data = await response.json().catch(() => null);

            if (!response.ok) {
                showAlert(data?.error || "회원탈퇴에 실패했어요.");
                return;
            }

            // 계정과 세션은 이미 지워졌으므로 로그아웃이 실패해도 탈퇴는 끝난 것으로 본다
            try {
                await authClient.signOut();
            } catch (signOutError) {
                console.error("탈퇴 후 로그아웃 처리 실패(무시):", signOutError);
            }

            window.location.href = "/";
        } catch (error) {
            console.error("회원탈퇴에 실패했어요.", error);
            showAlert("회원탈퇴에 실패했어요.");
        } finally {
            setIsDeleting(false);
        }
    };

    const planPrice = getPlanPrice(profile?.currency);

    const planDiscount = getYearlyDiscountPercent(planPrice);

    return (
        <div className="mx-auto w-full max-w-md">
            <header className="mt-5 mb-8">
                <p className="text-sm text-gray-500">차곡</p>

                <h1 className="mt-2 text-3xl font-bold text-gray-900">설정</h1>
            </header>

            <section>
                <h2 className="mb-3 px-1 text-xs font-medium text-gray-400">프로필</h2>

                <div className="overflow-hidden rounded-3xl bg-white shadow-sm">
                    <button
                        type="button"
                        onClick={() => router.push("/settings/nickname")}
                        className="flex w-full items-center justify-between px-5 py-4 text-left transition-colors active:bg-gray-50"
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
                <h2 className="mb-3 px-1 text-xs font-medium text-gray-400">요금제</h2>

                {isPro ? (
                    <div className="overflow-hidden rounded-3xl bg-white shadow-sm">
                        <div className="flex items-center justify-between px-5 py-4">
                            <span className="text-sm text-gray-900">내 요금제</span>

                            <span className="text-sm text-gray-400">Pro</span>
                        </div>
                    </div>
                ) : (
                <div className="relative overflow-hidden rounded-3xl bg-gray-900 p-6 shadow-sm">
                    {/* 장식 */}
                    <div className="pointer-events-none absolute -right-12 -top-12 h-40 w-40 rounded-full bg-gray-800" />
                    <div className="pointer-events-none absolute -right-4 top-16 h-16 w-16 rounded-full bg-gray-800" />

                    <div className="relative">
                        <div className="flex items-center gap-2">
                            <span className="rounded-full bg-white px-2.5 py-1 text-[11px] font-bold tracking-wide text-gray-900">
                                PRO
                            </span>

                            <span className="text-xs font-medium text-gray-400">현재 플랜 · {isPro ? "Pro" : "무료"}</span>
                        </div>

                        <p className="mt-6 text-2xl font-bold leading-snug tracking-tight text-white">
                            {isPro ? (
                                <>
                                    Pro를 이용 중이에요
                                    <br />
                                    제한 없이 기록하세요
                                </>
                            ) : (
                                <>
                                    제한 없이,
                                    <br />
                                    더 자유롭게 기록하세요
                                </>
                            )}
                        </p>

                        {!isPro && (
                            <p className="mt-3 text-sm text-gray-400">
                                <span className="text-lg font-bold text-white">
                                    {formatCurrency(planPrice.monthly, planPrice.currency)}
                                </span>{" "}
                                / 월 · 연간 결제 시 {planDiscount}% 할인
                            </p>
                        )}

                        <ul className="mt-7 space-y-4">
                            {PRO_BENEFITS.map((benefit) => (
                                <li key={benefit} className="flex items-center gap-3">
                                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white">
                                        <Check size={14} strokeWidth={3} className="text-gray-900" />
                                    </span>

                                    <span className="text-[15px] text-gray-100">{benefit}</span>
                                </li>
                            ))}
                        </ul>

                        {!isPro && (
                            <button
                                type="button"
                                onClick={() => openUpgrade("general")}
                                className="mt-8 flex w-full items-center justify-center gap-1.5 rounded-2xl bg-white py-4 text-sm font-semibold text-gray-900 transition-colors active:bg-gray-200"
                            >
                                {BILLING_ENABLED ? "Pro로 전환하기" : "Pro 혜택 확인하기"}
                                <ChevronRight size={16} strokeWidth={2} />
                            </button>
                        )}
                    </div>
                </div>
                )}
            </section>

            <section className="mt-8">
                <h2 className="mb-3 px-1 text-xs font-medium text-gray-400">기본 설정</h2>

                <div className="overflow-hidden rounded-3xl bg-white shadow-sm">
                    <button
                        type="button"
                        onClick={() => router.push("/settings/language")}
                        className="flex w-full items-center justify-between px-5 py-4 text-left transition-colors active:bg-gray-50"
                    >
                        <span className="text-sm text-gray-900">언어</span>
                        <span className="flex items-center gap-1 text-sm text-gray-400">
                            {loading ? "-" : LANGUAGES.find((language) => language.code === profile?.language)?.label || "-"}
                            <ChevronRight size={16} strokeWidth={1.7} className="text-gray-300" />
                        </span>
                    </button>

                    <div className="mx-5 border-t border-gray-100" />

                    <button
                        type="button"
                        onClick={() => router.push("/settings/country")}
                        className="flex w-full items-center justify-between px-5 py-4 text-left transition-colors active:bg-gray-50"
                    >
                        <span className="text-sm text-gray-900">국가</span>
                        <span className="flex items-center gap-1 text-sm text-gray-400">
                            {loading ? "-" : getCountryLabel(profile?.countryCode, { short: true }) || "-"}
                            <ChevronRight size={16} strokeWidth={1.7} className="text-gray-300" />
                        </span>
                    </button>

                    {getCountry(profile?.countryCode)?.hasRegions && (
                        <>
                            <div className="mx-5 border-t border-gray-100" />

                            <button
                                type="button"
                                onClick={() => router.push("/settings/country")}
                                className="flex w-full items-center justify-between px-5 py-4 text-left transition-colors active:bg-gray-50"
                            >
                                <span className="text-sm text-gray-900">지역</span>
                                <span className="flex items-center gap-1 text-sm text-gray-400">
                                    {getRegionLabel(profile?.countryCode, profile?.provinceCode) || "-"}
                                    <ChevronRight size={16} strokeWidth={1.7} className="text-gray-300" />
                                </span>
                            </button>
                        </>
                    )}

                    <div className="mx-5 border-t border-gray-100" />

                    <div className="flex items-center justify-between px-5 py-4">
                        <span className="text-sm text-gray-900">통화</span>
                        <span className="text-sm text-gray-400">{loading ? "-" : profile?.currency || "-"}</span>
                    </div>
                </div>
            </section>

            <section className="mt-8">
                <h2 className="mb-3 px-1 text-xs font-medium text-gray-400">계정</h2>

                <div className="overflow-hidden rounded-3xl bg-white shadow-sm">
                    <button type="button" onClick={handleLogout} className="flex w-full items-center gap-3 px-5 py-4 text-left transition-colors active:bg-gray-50">
                        <LogOut size={18} strokeWidth={1.7} className="text-gray-400" />
                        <span className="text-sm text-gray-900">로그아웃</span>
                    </button>

                    <div className="mx-5 border-t border-gray-100" />

                    <button
                        type="button"
                        onClick={handleDeleteAccount}
                        disabled={isDeleting}
                        className="flex w-full items-center gap-3 px-5 py-4 text-left disabled:opacity-50"
                    >
                        <Trash2 size={18} strokeWidth={1.7} className="text-red-500" />
                        <span className="text-sm text-red-500">{isDeleting ? "탈퇴 처리 중..." : "회원탈퇴"}</span>
                    </button>
                </div>
            </section>

            <BottomSheet
                    isOpen={Boolean(showDeleteModal)}
                    onClose={() => {
                        setShowDeleteModal(false);
                        setDeleteConfirmation("");
                    }}
                >
                {showDeleteModal && (
                    <>
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
                
                
                    </>
                )}
            </BottomSheet>
        </div>
    );
}
