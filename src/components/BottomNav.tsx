"use client";

import { usePathname, useRouter } from "next/navigation";
import { Wallet, BriefcaseBusiness, Plane, Settings } from "lucide-react";
import { useI18n } from "@/components/I18nProvider";

export default function BottomNav() {
    const router = useRouter();
    const pathname = usePathname();
    const { t } = useI18n();

    if (pathname.startsWith("/onboarding")) {
        return null;
    }

    return (
        <nav className="fixed bottom-5 left-1/2 z-50 w-[calc(100%-32px)] max-w-md -translate-x-1/2 rounded-[28px] border border-gray-200/70 bg-white/90 px-4 py-3 shadow-lg backdrop-blur-xl">
            <div className="mx-auto flex items-center justify-around">
                <button
                    onClick={() => router.push("/living")}
                    className={`flex flex-col items-center gap-0.5 px-3 py-0.5 ${
                        (pathname === "/" || pathname.startsWith("/living")) ? "text-black" : "text-gray-400"
                    }`}
                >
                    <Wallet size={20} strokeWidth={1.8} />
                    <span className="text-[11px]">{t("nav.living")}</span>
                </button>

                <button
                    onClick={() => router.push("/salary")}
                    className={`flex flex-col items-center gap-0.5 px-3 py-0.5 ${
                        pathname.startsWith("/salary") ? "text-black" : "text-gray-400"
                    }`}
                >
                    <BriefcaseBusiness size={20} strokeWidth={1.8} />
                    <span className="text-[11px]">{t("nav.salary")}</span>
                </button>

                <button
                    onClick={() => router.push("/travel")}
                    className={`flex flex-col items-center gap-0.5 px-3 py-0.5 ${
                        pathname.startsWith("/travel") ? "text-black" : "text-gray-400"
                    }`}
                >
                    <Plane size={20} strokeWidth={1.8} />
                    <span className="text-[11px]">{t("nav.travel")}</span>
                </button>

                <button
                    onClick={() => router.push("/settings")}
                    className={`flex flex-col items-center gap-0.5 px-3 py-0.5 ${
                        pathname.startsWith("/settings") ? "text-black" : "text-gray-400"
                    }`}
                >
                    <Settings size={20} strokeWidth={1.8} />
                    <span className="text-[11px]">{t("nav.settings")}</span>
                </button>
            </div>
        </nav>
    );
}
