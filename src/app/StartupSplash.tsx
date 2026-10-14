"use client";

import { useEffect, useState } from "react";
import StackBars from "@/components/StackBars";

type StartupSplashProps = {
    children: React.ReactNode;
};

export default function StartupSplash({ children }: StartupSplashProps) {
    const [showSplash, setShowSplash] = useState(true);
    const [isLeaving, setIsLeaving] = useState(false);

    useEffect(() => {
        // 막대가 모두 쌓인 뒤 잠깐 보여주고 넘어간다
        const leaveTimer = window.setTimeout(() => {
            setIsLeaving(true);

            window.setTimeout(() => {
                setShowSplash(false);
            }, 550);
        }, 2200);

        return () => {
            window.clearTimeout(leaveTimer);
        };
    }, []);

    return (
        <>
            {!showSplash && children}

            {showSplash && (
                <div
                    className={`fixed inset-0 z-[9999] flex items-center justify-center overflow-hidden bg-gray-50 ${
                        isLeaving ? "animate-[splashExit_0.55s_ease-in-out_forwards]" : ""
                    }`}
                >
                    <StackBars size={120} />
                </div>
            )}
        </>
    );
}
