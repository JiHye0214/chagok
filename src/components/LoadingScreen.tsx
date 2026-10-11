"use client";

import { useEffect, useState } from "react";

type LoadingScreenProps = {
    message?: string;
};

/*
 * 모든 페이지가 같이 쓰는 로딩 화면.
 * 화면 전체를 어둡게 덮고, 가운데에 회전 표시와 문구만 보여준다.
 * 아주 빨리 끝나는 로딩에서는 깜빡이지 않도록 120ms 뒤에 나타난다.
 */
export default function LoadingScreen({ message = "불러오는 중" }: LoadingScreenProps) {
    const [isVisible, setIsVisible] = useState(false);

    useEffect(() => {
        const timer = window.setTimeout(() => setIsVisible(true), 120);

        return () => window.clearTimeout(timer);
    }, []);

    return (
        <div
            role="status"
            aria-live="polite"
            className={`fixed inset-0 z-[60] flex items-center justify-center bg-gray-900/70 backdrop-blur-[2px] transition-opacity duration-300 ${
                isVisible ? "opacity-100" : "opacity-0"
            }`}
        >
            <div className="flex flex-col items-center">
                <div className="h-10 w-10 animate-spin rounded-full border-[3px] border-white/20 border-t-white" />

                <p className="mt-4 text-sm font-medium text-white/90">{message}</p>
            </div>
        </div>
    );
}

/*
 * 화면 일부(표, 목록 안쪽)만 로딩할 때 쓰는 작은 표시.
 */
export function InlineLoading({ message = "불러오는 중" }: LoadingScreenProps) {
    return (
        <div role="status" aria-live="polite" className="flex flex-col items-center justify-center py-10">
            <div className="h-7 w-7 animate-spin rounded-full border-[3px] border-gray-200 border-t-gray-900" />

            <p className="mt-3 text-xs font-medium text-gray-400">{message}</p>
        </div>
    );
}
