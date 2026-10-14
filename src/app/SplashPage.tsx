"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import StackBars from "@/components/StackBars";

/*
 * 로그인하지 않은 사용자가 처음 보는 시작 화면.
 * 막대가 쌓이는 모션을 보여준 뒤, 버튼 없이 자동으로 언어·지역 설정으로 넘어간다.
 * (로그인한 사용자의 시작 화면 StartupSplash 와 같은 모습)
 */
export default function SplashPage() {
    const router = useRouter();
    const [isLeaving, setIsLeaving] = useState(false);

    useEffect(() => {
        let moveTimer: number | undefined;

        // 막대가 모두 쌓인 뒤 잠깐 보여주고 넘어간다
        const leaveTimer = window.setTimeout(() => {
            setIsLeaving(true);

            moveTimer = window.setTimeout(() => {
                router.replace("/onboarding/language");
            }, 550);
        }, 2200);

        return () => {
            window.clearTimeout(leaveTimer);

            if (moveTimer !== undefined) {
                window.clearTimeout(moveTimer);
            }
        };
    }, [router]);

    return (
        <div
            className={`fixed inset-0 z-[9999] flex items-center justify-center overflow-hidden bg-gray-50 ${
                isLeaving ? "animate-[splashExit_0.55s_ease-in-out_forwards]" : ""
            }`}
        >
            <StackBars size={120} />
        </div>
    );
}
