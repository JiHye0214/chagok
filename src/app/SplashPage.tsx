"use client";

import { ArrowDownRight, ArrowUpRight, Plane, Wallet } from "lucide-react";
import { useEffect, useState } from "react";
import { useI18n } from "@/components/I18nProvider";
import { useRouter } from "next/navigation";

type SplashPageProps = {
    autoExit?: boolean;
};

export default function SplashPage({ autoExit = false }: SplashPageProps) {
    const router = useRouter();
    const { t, language } = useI18n();
    const [isLeaving, setIsLeaving] = useState(false);

    useEffect(() => {
        if (!autoExit) {
            return;
        }

        const timer = setTimeout(() => {
            setIsLeaving(true);
        }, 2000);

        return () => clearTimeout(timer);
    }, [autoExit]);

    const handleStart = () => {
        setIsLeaving(true);

        setTimeout(() => {
            router.replace("/onboarding/language");
        }, 550);
    };

    return (
        <div
            className={`min-h-[100dvh] overflow-hidden bg-gray-50 translate-y-0 opacity-100 ${
                isLeaving ? "pointer-events-none animate-[splashExit_0.6s_ease-out_forwards]" : "translate-y-0 opacity-100"
            }`}
        >
            <div className="mx-auto flex min-h-[100dvh] max-w-md flex-col px-5">
                <header className="pt-8 opacity-0 animate-[onboardingFadeUp_0.6s_ease-out_0.2s_forwards]">
                    <p className="text-sm text-gray-500">{t("splash.tagline")}</p>
                </header>

                <section className="relative flex flex-1 flex-col justify-center">
                    <div className="opacity-0 animate-[onboardingFadeUp_0.6s_ease-out_0.2s_forwards]">
                        <p className="text-[2rem] font-medium tracking-[-0.05em] text-gray-900">{t("splash.headline")}</p>

                        <h1
                            className={`mt-1 font-bold leading-[0.8] tracking-[-0.1em] text-gray-900 ${
                                language === "ko" ? "text-[6.5rem]" : "text-[5.5rem]"
                            }`}
                        >
                            {t("common.appName")}
                        </h1>
                    </div>

                    <div className="absolute right-0 top-[18%] flex translate-x-5 items-center gap-2 rounded-full bg-white px-3 py-2 opacity-0 shadow-sm animate-[onboardingFadeUp_0.6s_ease-out_0.2s_forwards]">
                        <Wallet size={14} strokeWidth={1.8} className="text-gray-400" />
                        <span className="text-xs text-gray-500">{t("splash.chipMoney")}</span>
                    </div>

                    <div className="absolute left-0 top-[58%] -translate-x-5 rounded-full bg-white px-3 py-2 opacity-0 shadow-sm animate-[onboardingFadeUp_0.6s_ease-out_0.2s_forwards]">
                        <div className="flex items-center gap-2">
                            <Plane size={14} strokeWidth={1.8} className="text-gray-400" />
                            <span className="text-xs text-gray-500">{t("splash.chipTrip")}</span>
                        </div>
                    </div>

                    <div className="absolute bottom-[8%] right-0 w-40 translate-y-5 rounded-2xl border border-gray-100 bg-white p-4 opacity-0 shadow-sm animate-[onboardingFadeUp_0.6s_ease-out_0.2s_forwards]">
                        <div className="mb-3 flex items-center justify-between">
                            <span className="text-[10px] uppercase tracking-[0.12em] text-gray-400">this month</span>

                            <span className="text-[10px] text-gray-300">09</span>
                        </div>

                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-[10px] text-gray-400">income</p>
                                <p className="mt-1 text-sm font-semibold text-gray-900">2,180</p>
                            </div>

                            <ArrowUpRight size={14} className="text-gray-300" />
                        </div>

                        <div className="my-3 border-t border-dashed border-gray-100" />

                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-[10px] text-gray-400">spending</p>
                                <p className="mt-1 text-sm font-semibold text-gray-900">684</p>
                            </div>

                            <ArrowDownRight size={14} className="text-gray-300" />
                        </div>
                    </div>
                </section>

                <footer className="border-t border-gray-200 py-5">
                    {!autoExit && (
                        <button
                            type="button"
                            onClick={handleStart}
                            disabled={isLeaving}
                            className="flex w-full items-center justify-between py-1 text-left"
                        >
                            <span className="text-xs text-gray-400">{t("splash.footer")}</span>

                            <span className="text-sm font-medium text-gray-900">{t("splash.start")}</span>
                        </button>
                    )}
                </footer>
            </div>
        </div>
    );
}
