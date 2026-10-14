"use client";

import { useEffect, useState } from "react";
import { useI18n } from "@/components/I18nProvider";
import StackBars from "@/components/StackBars";

type LoadingScreenProps = {
    message?: string;
};

/*
 * 모든 페이지가 같이 쓰는 로딩 화면.
 * 화면 전체를 어둡게 덮고, 가운데에 막대가 쌓이는 표시만 보여준다.
 * 아주 빨리 끝나는 로딩에서는 깜빡이지 않도록 120ms 뒤에 나타난다.
 */
export default function LoadingScreen({ message }: LoadingScreenProps) {
    const { t } = useI18n();
    const [isVisible, setIsVisible] = useState(false);

    useEffect(() => {
        const timer = window.setTimeout(() => setIsVisible(true), 120);

        return () => window.clearTimeout(timer);
    }, []);

    return (
        <div
            role="status"
            aria-live="polite"
            className={`fixed inset-0 z-[60] flex items-center justify-center bg-neutral-800/70 backdrop-blur-[2px] transition-opacity duration-300 ${
                isVisible ? "opacity-100" : "opacity-0"
            }`}
        >
            <div className="flex flex-col items-center">
                <StackBars size={64} mode="loop" inkColor="#ffffff" accentColor="#9CC7A8" />

                {/* 기본 문구는 화면 읽기 프로그램용으로만 두고, 따로 넘긴 문구만 보여준다 */}
                <p className={message ? "mt-4 text-sm font-medium text-white/90" : "sr-only"}>{message ?? t("common.loading")}</p>
            </div>
        </div>
    );
}

/*
 * 화면 일부(표, 목록 안쪽)만 로딩할 때 쓰는 작은 표시.
 */
export function InlineLoading({ message }: LoadingScreenProps) {
    const { t } = useI18n();

    return (
        <div role="status" aria-live="polite" className="flex flex-col items-center justify-center py-10">
            <StackBars size={40} mode="loop" />

            <p className={message ? "mt-3 text-xs font-medium text-gray-400" : "sr-only"}>{message ?? t("common.loading")}</p>
        </div>
    );
}
