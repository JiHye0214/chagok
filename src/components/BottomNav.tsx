"use client";

import { usePathname, useRouter } from "next/navigation";
import { House, Wallet, BriefcaseBusiness, Plane } from "lucide-react";

export default function BottomNav() {
    const router = useRouter();
    const pathname = usePathname();

    if (pathname.startsWith("/onboarding")) {
        return null;
    }

    return (
        <nav className="fixed bottom-5 left-1/2 z-50 w-[calc(100%-32px)] max-w-md -translate-x-1/2 rounded-[28px] border border-gray-200/70 bg-white/90 px-4 py-3 shadow-lg backdrop-blur-xl">
            <div className="mx-auto flex items-center justify-around">
                {/* 홈 */}
                <button
                    onClick={() => router.push("/")}
                    className={`flex flex-col items-center gap-0.5 px-3 py-0.5 ${
                        pathname === "/" ? "text-black" : "text-gray-400"
                    }`}
                >
                    <House size={20} strokeWidth={1.8} />
                    <span className="text-[11px]">홈</span>
                </button>

                {/* 생활 */}
                <button
                    onClick={() => router.push("/living")}
                    className={`flex flex-col items-center gap-0.5 px-3 py-0.5 ${
                        pathname.startsWith("/living") ? "text-black" : "text-gray-400"
                    }`}
                >
                    <Wallet size={20} strokeWidth={1.8} />
                    <span className="text-[11px]">생활</span>
                </button>

                {/* 급여 */}
                <button
                    onClick={() => router.push("/salary")}
                    className={`flex flex-col items-center gap-0.5 px-3 py-0.5 ${
                        pathname.startsWith("/salary") ? "text-black" : "text-gray-400"
                    }`}
                >
                    <BriefcaseBusiness size={20} strokeWidth={1.8} />
                    <span className="text-[11px]">급여</span>
                </button>

                {/* 여행 */}
                <button
                    onClick={() => router.push("/travel")}
                    className={`flex flex-col items-center gap-0.5 px-3 py-0.5 ${
                        pathname.startsWith("/travel") ? "text-black" : "text-gray-400"
                    }`}
                >
                    <Plane size={20} strokeWidth={1.8} />
                    <span className="text-[11px]">여행</span>
                </button>
            </div>
        </nav>
    );
}
