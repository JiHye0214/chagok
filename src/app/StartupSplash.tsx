"use client";

import { useEffect, useState } from "react";
import { ArrowDownRight, ArrowUpRight, Plane, Wallet } from "lucide-react";

type StartupSplashProps = {
    children: React.ReactNode;
};

export default function StartupSplash({ children }: StartupSplashProps) {
    const [showSplash, setShowSplash] = useState(true);
    const [isLeaving, setIsLeaving] = useState(false);

    useEffect(() => {
        const leaveTimer = window.setTimeout(() => {
            setIsLeaving(true);

            window.setTimeout(() => {
                setShowSplash(false);
            }, 550);
        }, 2000);

        return () => {
            window.clearTimeout(leaveTimer);
        };
    }, []);

    return (
        <>
            {!showSplash && children}

            {showSplash && (
                <div
                    className={`fixed inset-0 z-[9999] overflow-hidden bg-gray-50 ${
                        isLeaving ? "animate-[splashExit_0.55s_ease-in-out_forwards]" : ""
                    }`}
                >
                    <div className="mx-auto flex min-h-[100dvh] max-w-md flex-col px-5">
                        <header className="pt-8 opacity-0 animate-[splashFadeIn_0.7s_ease-out_forwards]">
                            <p className="text-sm text-gray-500">나를 위한 돈 관리 생활 어플</p>
                        </header>

                        <section className="relative flex flex-1 flex-col justify-center">
                            <div className="opacity-0 animate-[splashBrand_0.9s_ease-out_0.15s_forwards]">
                                <p className="text-[2rem] font-medium tracking-[-0.05em] text-gray-900">차곡차곡,</p>

                                <h1 className="mt-1 text-[6.5rem] font-bold leading-[0.8] tracking-[-0.1em] text-gray-900">
                                    차곡
                                </h1>
                            </div>

                            <div className="absolute right-0 top-[18%] flex translate-x-5 items-center gap-2 rounded-full bg-white px-3 py-2 opacity-0 shadow-sm animate-[splashFromRight_0.7s_ease-out_0.5s_forwards]">
                                <Wallet size={14} strokeWidth={1.8} className="text-gray-400" />

                                <span className="text-xs text-gray-500">돈을 기록하고</span>
                            </div>

                            <div className="absolute left-0 top-[58%] -translate-x-5 rounded-full bg-white px-3 py-2 opacity-0 shadow-sm animate-[splashFromLeft_0.7s_ease-out_0.7s_forwards]">
                                <div className="flex items-center gap-2">
                                    <Plane size={14} strokeWidth={1.8} className="text-gray-400" />

                                    <span className="text-xs text-gray-500">여행을 남기고</span>
                                </div>
                            </div>

                            <div className="absolute bottom-[8%] right-0 w-40 translate-y-5 rounded-2xl border border-gray-100 bg-white p-4 opacity-0 shadow-sm animate-[splashFromBottom_0.7s_ease-out_0.9s_forwards]">
                                <div className="mb-3 flex items-center justify-between">
                                    <span className="text-[10px] uppercase tracking-[0.12em] text-gray-400">this month</span>

                                    <span className="text-[10px] text-gray-300">09</span>
                                </div>

                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-[10px] text-gray-400">income</p>

                                        <p className="mt-1 text-sm font-semibold text-gray-900">$2,180</p>
                                    </div>

                                    <ArrowUpRight size={14} className="text-gray-300" />
                                </div>

                                <div className="my-3 border-t border-dashed border-gray-100" />

                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-[10px] text-gray-400">spending</p>

                                        <p className="mt-1 text-sm font-semibold text-gray-900">$684</p>
                                    </div>

                                    <ArrowDownRight size={14} className="text-gray-300" />
                                </div>
                            </div>
                        </section>
                    </div>
                </div>
            )}
        </>
    );
}
