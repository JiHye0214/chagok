"use client";

import { useEffect, useState } from "react";
import { Check, ChevronRight, LogOut, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth/auth-client";
import { useI18n } from "@/components/I18nProvider";
import { useUpgrade } from "@/components/UpgradeProvider";
import { LANGUAGES, getCountry, getCountryLabel, getRegionLabel } from "@/lib/countries";
import BottomSheet from "@/components/BottomSheet";
import LoadingScreen from "@/components/LoadingScreen";
import PlanComparisonTable from "@/components/PlanComparisonTable";
import { useDialog } from "@/components/DialogProvider";
import { BILLING_ENABLED, getPlanPrice, getYearlyDiscountPercent } from "@/lib/plans";
import { formatCurrency } from "@/lib/salary/format";

type DowngradeItem = {
    key: string;
    label: string;
    limit: number | null;
    used: number;
    toDelete: number;
};

type DowngradeInfo = {
    expiresAt: string | null;
    cancelRequestedAt: string | null;
    preview?: { items: DowngradeItem[]; customCategoryCount: number };
};

const formatLongDate = (value: string | null | undefined, locale: string) => {
    if (!value) {
        return "";
    }

    return new Date(value).toLocaleDateString(locale, { year: "numeric", month: "long", day: "numeric" });
};

type Profile = {
    nickname: string | null;
    language: string | null;
    countryCode: string | null;
    provinceCode: string | null;
    currency: string | null;
};

const PRO_BENEFIT_KEYS = ["settings.plan.benefit1", "settings.plan.benefit2", "settings.plan.benefit3"] as const;

// 해지 시트의 항목 이름 (서버가 주는 key 로 찾는다)
const DOWNGRADE_ITEM_KEYS = {
    payHistory: "settings.downgrade.item.payHistory",
    workSchedules: "settings.downgrade.item.workSchedules",
    livingTransactions: "settings.downgrade.item.livingTransactions",
    fixedExpenses: "settings.downgrade.item.fixedExpenses",
    trips: "settings.downgrade.item.trips",
    tripExpenses: "settings.downgrade.item.tripExpenses",
} as const;

export default function SettingsPage() {
    const { confirm, alert: showAlert } = useDialog();
    const router = useRouter();
    const { isPro, isPlanLoaded, openUpgrade, refreshPlan } = useUpgrade();
    const { t, language, locale } = useI18n();

    const [profile, setProfile] = useState<Profile | null>(null);
    const [loading, setLoading] = useState(true);

    const [isBenefitsOpen, setIsBenefitsOpen] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [deleteConfirmation, setDeleteConfirmation] = useState("");

    // Pro 해지: 0 = 닫힘, 1 = 한도 안내, 2 = 문구 입력
    const [downgradeInfo, setDowngradeInfo] = useState<DowngradeInfo | null>(null);
    const [downgradeStep, setDowngradeStep] = useState<0 | 1 | 2>(0);
    const [downgradeConfirmation, setDowngradeConfirmation] = useState("");
    const [isDowngradeBusy, setIsDowngradeBusy] = useState(false);

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

    const loadDowngradeInfo = async (withPreview: boolean) => {
        try {
            const response = await fetch(`/api/subscription/downgrade${withPreview ? "?preview=1" : ""}`);
            const data = await response.json().catch(() => null);

            if (!response.ok || !data?.isPro) {
                setDowngradeInfo(null);
                return null;
            }

            const info: DowngradeInfo = {
                expiresAt: data.expiresAt ?? null,
                cancelRequestedAt: data.cancelRequestedAt ?? null,
                preview: data.preview,
            };

            setDowngradeInfo(info);

            return info;
        } catch (error) {
            console.error("해지 정보를 불러오지 못했어요.", error);
            return null;
        }
    };

    useEffect(() => {
        if (isPro) {
            void loadDowngradeInfo(false);
        }
    }, [isPro]);

    const closeDowngrade = () => {
        setDowngradeStep(0);
        setDowngradeConfirmation("");
    };

    const openDowngrade = async () => {
        setIsDowngradeBusy(true);

        const info = await loadDowngradeInfo(true);

        setIsDowngradeBusy(false);

        if (!info?.preview) {
            showAlert(t("settings.downgrade.loadFailed"));
            return;
        }

        setDowngradeConfirmation("");
        setDowngradeStep(1);
    };

    const confirmDowngrade = async () => {
        if (downgradeConfirmation !== t("settings.downgrade.phrase")) {
            return;
        }

        setIsDowngradeBusy(true);

        try {
            const response = await fetch("/api/subscription/downgrade", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ confirmation: downgradeConfirmation }),
            });

            const data = await response.json().catch(() => null);

            if (!response.ok) {
                showAlert(data?.error || t("settings.downgrade.failed"));
                return;
            }

            const endDate = formatLongDate(downgradeInfo?.expiresAt, locale);

            closeDowngrade();

            if (data?.result === "done") {
                await showAlert(t("settings.downgrade.doneNow"));
                window.location.reload();
                return;
            }

            await loadDowngradeInfo(false);

            showAlert(t("settings.downgrade.scheduled", { date: endDate }));
        } catch (error) {
            console.error("Pro 해지에 실패했어요.", error);
            showAlert(t("settings.downgrade.failed"));
        } finally {
            setIsDowngradeBusy(false);
        }
    };

    const cancelDowngrade = async () => {
        const confirmed = await confirm(t("settings.downgrade.undoConfirm"));

        if (!confirmed) {
            return;
        }

        setIsDowngradeBusy(true);

        try {
            const response = await fetch("/api/subscription/downgrade", { method: "DELETE" });
            const data = await response.json().catch(() => null);

            if (!response.ok) {
                showAlert(data?.error || t("settings.downgrade.undoFailed"));
                return;
            }

            await loadDowngradeInfo(false);
            void refreshPlan();
        } catch (error) {
            console.error("해지 취소에 실패했어요.", error);
            showAlert(t("settings.downgrade.undoFailed"));
        } finally {
            setIsDowngradeBusy(false);
        }
    };

    const handleLogout = async () => {
        const confirmed = await confirm(t("settings.logoutConfirm"));

        if (!confirmed) {
            return;
        }

        try {
            const result = (await authClient.signOut()) as { error?: { message?: string } | null } | undefined;

            // better-auth 는 실패해도 예외를 던지지 않고 error 를 돌려준다
            if (result?.error) {
                throw new Error(result.error.message ?? "signOut failed");
            }

            // 화면 캐시가 남지 않도록 페이지를 새로 불러서 시작 화면으로 간다
            window.location.href = "/";
        } catch (error) {
            console.error("로그아웃에 실패했어요.", error);
            showAlert(t("settings.logoutFailed"));
        }
    };

    const handleDeleteAccount = async () => {
        const confirmed = await confirm(t("settings.withdrawConfirm"));

        if (!confirmed) {
            return;
        }

        setDeleteConfirmation("");
        setShowDeleteModal(true);
    };

    const confirmDeleteAccount = async () => {
        if (deleteConfirmation !== t("settings.withdrawPhrase")) {
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
                showAlert(data?.error || t("settings.withdrawFailed"));
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
            showAlert(t("settings.withdrawFailed"));
        } finally {
            setIsDeleting(false);
        }
    };

    if (loading || !isPlanLoaded) {
        return <LoadingScreen />;
    }

    const planPrice = getPlanPrice(profile?.currency);

    const planDiscount = getYearlyDiscountPercent(planPrice);

    return (
        <div className="mx-auto w-full max-w-md">
            <header className="mt-5 mb-8">
                <p className="text-sm text-gray-500">{t("common.appName")}</p>

                <h1 className="mt-2 text-3xl font-bold text-gray-900">{t("settings.title")}</h1>
            </header>

            <section>
                <h2 className="mb-3 px-1 text-xs font-medium text-gray-400">{t("settings.section.profile")}</h2>

                <div className="overflow-hidden rounded-3xl bg-white shadow-sm">
                    <button
                        type="button"
                        onClick={() => router.push("/settings/nickname")}
                        className="flex w-full items-center justify-between px-5 py-4 text-left transition-colors active:bg-gray-50"
                    >
                        <div>
                            <p className="text-sm text-gray-900">{t("settings.nickname")}</p>
                            <p className="mt-1 text-xs text-gray-400">{loading ? t("common.loadingEllipsis") : profile?.nickname || "-"}</p>
                        </div>

                        <ChevronRight size={18} strokeWidth={1.7} className="text-gray-300" />
                    </button>
                </div>
            </section>

            <section className="mt-8">
                <h2 className="mb-3 px-1 text-xs font-medium text-gray-400">{t("settings.section.plan")}</h2>

                {isPro ? (
                    <div className="overflow-hidden rounded-3xl bg-white shadow-sm">
                        <button
                            type="button"
                            onClick={() => setIsBenefitsOpen(true)}
                            className="flex w-full items-center justify-between px-5 py-4 text-left transition-colors active:bg-gray-50"
                        >
                            <span className="text-sm text-gray-900">{t("settings.plan.mine")}</span>

                            <span className="flex items-center gap-1 text-sm text-gray-400">
                                Pro
                                <ChevronRight size={16} strokeWidth={1.7} className="text-gray-300" />
                            </span>
                        </button>

                        {downgradeInfo?.cancelRequestedAt && (
                            <>
                                <div className="mx-5 border-t border-gray-100" />

                                <div className="px-5 py-4">
                                    <p className="text-sm text-gray-900">
                                        {downgradeInfo.expiresAt
                                            ? t("settings.plan.cancelScheduled", { date: formatLongDate(downgradeInfo.expiresAt, locale) })
                                            : t("settings.plan.cancelScheduledNoDate")}
                                    </p>

                                    <p className="mt-1 text-xs leading-5 text-gray-400">{t("settings.plan.cancelScheduledNote")}</p>

                                    <button
                                        type="button"
                                        onClick={() => void cancelDowngrade()}
                                        disabled={isDowngradeBusy}
                                        className="mt-3 rounded-xl bg-gray-100 px-4 py-2.5 text-sm font-medium text-gray-700 disabled:opacity-50"
                                    >
                                        {t("settings.plan.undoCancel")}
                                    </button>
                                </div>
                            </>
                        )}
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

                            <span className="text-xs font-medium text-gray-400">{t("settings.plan.currentFree")}</span>
                        </div>

                        <p className="mt-6 text-2xl font-bold leading-snug tracking-tight text-white">
                            {t("settings.plan.headline1")}
                            <br />
                            {t("settings.plan.headline2")}
                        </p>

                        {!isPro && (
                            <p className="mt-3 text-sm text-gray-400">
                                <span className="text-lg font-bold text-white">
                                    {formatCurrency(planPrice.monthly, planPrice.currency)}
                                </span>{" "}
                                {t("settings.plan.priceSuffix", { percent: planDiscount })}
                            </p>
                        )}

                        <ul className="mt-7 space-y-4">
                            {PRO_BENEFIT_KEYS.map((benefitKey) => (
                                <li key={benefitKey} className="flex items-center gap-3">
                                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white">
                                        <Check size={14} strokeWidth={3} className="text-gray-900" />
                                    </span>

                                    <span className="text-[15px] text-gray-100">{t(benefitKey)}</span>
                                </li>
                            ))}
                        </ul>

                        {!isPro && (
                            <button
                                type="button"
                                onClick={() => openUpgrade("general")}
                                className="mt-8 flex w-full items-center justify-center gap-1.5 rounded-2xl bg-white py-4 text-sm font-semibold text-gray-900 transition-colors active:bg-gray-200"
                            >
                                {BILLING_ENABLED ? t("settings.plan.ctaUpgrade") : t("settings.plan.ctaView")}
                                <ChevronRight size={16} strokeWidth={2} />
                            </button>
                        )}
                    </div>
                </div>
                )}
            </section>

            <section className="mt-8">
                <h2 className="mb-3 px-1 text-xs font-medium text-gray-400">{t("settings.section.basic")}</h2>

                <div className="overflow-hidden rounded-3xl bg-white shadow-sm">
                    <button
                        type="button"
                        onClick={() => router.push("/settings/language")}
                        className="flex w-full items-center justify-between px-5 py-4 text-left transition-colors active:bg-gray-50"
                    >
                        <span className="text-sm text-gray-900">{t("settings.language")}</span>
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
                        <span className="text-sm text-gray-900">{t("settings.country")}</span>
                        <span className="flex items-center gap-1 text-sm text-gray-400">
                            {loading ? "-" : getCountryLabel(profile?.countryCode, { short: true, language }) || "-"}
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
                                <span className="text-sm text-gray-900">{t("settings.region")}</span>
                                <span className="flex items-center gap-1 text-sm text-gray-400">
                                    {getRegionLabel(profile?.countryCode, profile?.provinceCode) || "-"}
                                    <ChevronRight size={16} strokeWidth={1.7} className="text-gray-300" />
                                </span>
                            </button>
                        </>
                    )}

                    <div className="mx-5 border-t border-gray-100" />

                    <div className="flex items-center justify-between px-5 py-4">
                        <span className="text-sm text-gray-900">{t("settings.currency")}</span>
                        <span className="text-sm text-gray-400">{loading ? "-" : profile?.currency || "-"}</span>
                    </div>
                </div>
            </section>

            <section className="mt-8">
                <h2 className="mb-3 px-1 text-xs font-medium text-gray-400">{t("settings.section.about")}</h2>

                <div className="overflow-hidden rounded-3xl bg-white shadow-sm">
                    <a
                        href="/legal/terms"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex w-full items-center justify-between px-5 py-4 transition-colors active:bg-gray-50"
                    >
                        <span className="text-sm text-gray-900">{t("settings.terms")}</span>
                        <ChevronRight size={16} strokeWidth={1.7} className="text-gray-300" />
                    </a>

                    <div className="mx-5 border-t border-gray-100" />

                    <a
                        href="/legal/privacy"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex w-full items-center justify-between px-5 py-4 transition-colors active:bg-gray-50"
                    >
                        <span className="text-sm text-gray-900">{t("settings.privacy")}</span>
                        <ChevronRight size={16} strokeWidth={1.7} className="text-gray-300" />
                    </a>
                </div>
            </section>

            <section className="mt-8">
                <h2 className="mb-3 px-1 text-xs font-medium text-gray-400">{t("settings.section.account")}</h2>

                <div className="overflow-hidden rounded-3xl bg-white shadow-sm">
                    <button type="button" onClick={handleLogout} className="flex w-full items-center gap-3 px-5 py-4 text-left transition-colors active:bg-gray-50">
                        <LogOut size={18} strokeWidth={1.7} className="text-gray-400" />
                        <span className="text-sm text-gray-900">{t("settings.logout")}</span>
                    </button>

                    <div className="mx-5 border-t border-gray-100" />

                    <button
                        type="button"
                        onClick={handleDeleteAccount}
                        disabled={isDeleting}
                        className="flex w-full items-center gap-3 px-5 py-4 text-left disabled:opacity-50"
                    >
                        <Trash2 size={18} strokeWidth={1.7} className="text-red-500" />
                        <span className="text-sm text-red-500">{isDeleting ? t("settings.withdrawing") : t("settings.withdraw")}</span>
                    </button>
                </div>
            </section>

            <BottomSheet isOpen={isBenefitsOpen} onClose={() => setIsBenefitsOpen(false)} title={t("settings.plan.benefitsTitle")}>
                <p className="text-sm leading-6 text-gray-600">{t("settings.plan.benefitsBody")}</p>

                <PlanComparisonTable className="mt-5" />

                {downgradeInfo && !downgradeInfo.cancelRequestedAt && (
                    <button
                        type="button"
                        onClick={() => {
                            setIsBenefitsOpen(false);
                            void openDowngrade();
                        }}
                        disabled={isDowngradeBusy}
                        className="mx-auto mt-8 block px-4 py-2 text-xs text-gray-400 underline disabled:opacity-50"
                    >
                        {t("settings.plan.cancelProLink")}
                    </button>
                )}
            </BottomSheet>

            <BottomSheet isOpen={downgradeStep > 0} onClose={isDowngradeBusy ? () => undefined : closeDowngrade}>
                {downgradeStep === 1 && downgradeInfo?.preview && (
                    <>
                        <div>
                            <h2 className="text-lg font-semibold text-gray-900">{t("settings.downgrade.title")}</h2>

                            <p className="mt-3 text-sm leading-6 text-gray-500">
                                {t("settings.downgrade.intro")}
                            </p>
                        </div>

                        <div className="mt-5 overflow-hidden rounded-2xl bg-gray-50">
                            <div className="flex items-center px-4 py-2.5 text-xs text-gray-400">
                                <span className="min-w-0 flex-1">{t("settings.downgrade.colItem")}</span>
                                <span style={{ width: 72, flexShrink: 0 }} className="whitespace-nowrap text-right">
                                    {t("settings.downgrade.colLimit")}
                                </span>
                                <span style={{ width: 72, flexShrink: 0 }} className="whitespace-nowrap text-right">
                                    {t("settings.downgrade.colUsed")}
                                </span>
                                <span style={{ width: 44, flexShrink: 0 }} className="whitespace-nowrap text-right">
                                    {t("settings.downgrade.colDelete")}
                                </span>
                            </div>

                            {downgradeInfo.preview.items.map((item) => (
                                <div key={item.key} className="flex items-center border-t border-gray-100 px-4 py-3 text-sm">
                                    <span className="min-w-0 flex-1 pr-2 text-gray-900">
                                        {item.key in DOWNGRADE_ITEM_KEYS
                                            ? t(DOWNGRADE_ITEM_KEYS[item.key as keyof typeof DOWNGRADE_ITEM_KEYS], { count: item.limit ?? 0 })
                                            : item.label}
                                    </span>
                                    <span style={{ width: 72, flexShrink: 0 }} className="whitespace-nowrap text-right text-gray-500">
                                        {item.limit === null ? t("settings.downgrade.unavailable") : item.limit}
                                    </span>
                                    <span style={{ width: 72, flexShrink: 0 }} className="whitespace-nowrap text-right text-gray-500">
                                        {item.used}
                                    </span>
                                    <span
                                        style={{ width: 44, flexShrink: 0 }}
                                        className={`whitespace-nowrap text-right font-medium ${
                                            item.toDelete > 0 ? "text-red-500" : "text-gray-300"
                                        }`}
                                    >
                                        {item.toDelete > 0 ? item.toDelete : "-"}
                                    </span>
                                </div>
                            ))}
                        </div>

                        {downgradeInfo.preview.customCategoryCount > 0 && (
                            <p className="mt-3 text-xs leading-5 text-gray-500">
                                {t("settings.downgrade.categoryNote", { count: downgradeInfo.preview.customCategoryCount })}
                            </p>
                        )}

                        <p className="mt-3 text-xs leading-5 text-gray-400">
                            {downgradeInfo.expiresAt
                                ? t("settings.downgrade.dateNote", { date: formatLongDate(downgradeInfo.expiresAt, locale) })
                                : t("settings.downgrade.noDateNote")}
                        </p>

                        <div className="mt-6 flex gap-3">
                            <button
                                type="button"
                                onClick={closeDowngrade}
                                className="flex-1 rounded-2xl bg-gray-100 py-3.5 text-sm font-semibold text-gray-700"
                            >
                                {t("settings.downgrade.keep")}
                            </button>

                            <button
                                type="button"
                                onClick={() => setDowngradeStep(2)}
                                className="flex-1 rounded-2xl bg-red-500 py-3.5 text-sm font-semibold text-white"
                            >
                                {t("settings.downgrade.continue")}
                            </button>
                        </div>
                    </>
                )}

                {downgradeStep === 2 && downgradeInfo && (
                    <>
                        <div>
                            <h2 className="text-lg font-semibold text-gray-900">{t("settings.downgrade.confirmTitle")}</h2>

                            <p className="mt-3 text-sm leading-6 text-gray-500">
                                {downgradeInfo.expiresAt
                                    ? t("settings.downgrade.confirmBodyDate", { date: formatLongDate(downgradeInfo.expiresAt, locale) })
                                    : t("settings.downgrade.confirmBodyNow")}
                                <br />
                                {t("settings.downgrade.irreversible")}
                            </p>
                        </div>

                        <div className="mt-6">
                            <p className="text-sm font-medium text-gray-700">{t("settings.typePrompt")}</p>

                            <p className="mt-2 rounded-xl bg-gray-50 px-3 py-3 text-sm font-medium text-gray-900">
                                {t("settings.downgrade.phrase")}
                            </p>

                            <input
                                type="text"
                                value={downgradeConfirmation}
                                onChange={(e) => setDowngradeConfirmation(e.target.value)}
                                placeholder={t("settings.typePlaceholder")}
                                disabled={isDowngradeBusy}
                                className="mt-3 w-full rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-gray-400 disabled:bg-gray-50"
                            />
                        </div>

                        <div className="mt-6 flex gap-3">
                            <button
                                type="button"
                                onClick={closeDowngrade}
                                disabled={isDowngradeBusy}
                                className="flex-1 rounded-2xl bg-gray-100 py-3.5 text-sm font-semibold text-gray-700 disabled:opacity-50"
                            >
                                {t("settings.downgrade.keep")}
                            </button>

                            <button
                                type="button"
                                onClick={() => void confirmDowngrade()}
                                disabled={downgradeConfirmation !== t("settings.downgrade.phrase") || isDowngradeBusy}
                                className="flex-1 rounded-2xl bg-red-500 py-3.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-gray-200 disabled:text-gray-400"
                            >
                                {isDowngradeBusy ? t("common.processing") : t("settings.downgrade.submit")}
                            </button>
                        </div>
                    </>
                )}
            </BottomSheet>

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
                                <h2 className="text-lg font-semibold text-gray-900">{t("settings.withdraw")}</h2>

                                <p className="mt-3 text-sm leading-6 text-gray-500">
                                    {t("settings.withdrawBody1")}
                                    <br />
                                    {t("settings.withdrawBody2")}
                                </p>
                            </div>

                            <div className="mt-6">
                                <p className="text-sm font-medium text-gray-700">{t("settings.typePrompt")}</p>

                                <p className="mt-2 rounded-xl bg-gray-50 px-3 py-3 text-sm font-medium text-gray-900">
                                    {t("settings.withdrawPhrase")}
                                </p>

                                <input
                                    type="text"
                                    value={deleteConfirmation}
                                    onChange={(e) => setDeleteConfirmation(e.target.value)}
                                    placeholder={t("settings.typePlaceholder")}
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
                                    {t("common.cancel")}
                                </button>

                                <button
                                    type="button"
                                    onClick={() => void confirmDeleteAccount()}
                                    disabled={deleteConfirmation !== t("settings.withdrawPhrase") || isDeleting}
                                    className="flex-1 rounded-2xl bg-red-500 py-3.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-gray-200 disabled:text-gray-400"
                                >
                                    {isDeleting ? t("settings.withdrawing") : t("settings.withdraw")}
                                </button>
                            </div>
                
                
                    </>
                )}
            </BottomSheet>
        </div>
    );
}
