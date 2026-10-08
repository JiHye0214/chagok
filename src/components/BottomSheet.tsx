"use client";

import { useEffect, useState } from "react";
import type { ReactNode } from "react";

type BottomSheetProps = {
    isOpen: boolean;
    onClose: () => void;
    title?: string;
    children: ReactNode;
};

// 설정 시트(LivingStartSheet, SalarySettingsSheet)와 같은 모양: 위쪽 손잡이 바만 있고 X 버튼은 없다.
// 바깥 어두운 영역을 누르면 닫힌다.
export default function BottomSheet({ isOpen, onClose, title, children }: BottomSheetProps) {
    const [isMounted, setIsMounted] = useState(false);
    const [isAnimating, setIsAnimating] = useState(false);

    useEffect(() => {
        if (isOpen) {
            setIsMounted(true);

            document.body.style.overflow = "hidden";

            const frame = window.requestAnimationFrame(() => {
                window.requestAnimationFrame(() => {
                    setIsAnimating(true);
                });
            });

            return () => {
                window.cancelAnimationFrame(frame);
                document.body.style.overflow = "";
            };
        }

        setIsAnimating(false);

        const timer = window.setTimeout(() => {
            setIsMounted(false);
        }, 350);

        document.body.style.overflow = "";

        return () => {
            clearTimeout(timer);
            document.body.style.overflow = "";
        };
    }, [isOpen]);

    if (!isMounted) {
        return null;
    }

    return (
        <div className="fixed inset-0 z-[10000]">
            <button
                type="button"
                aria-label="닫기"
                onClick={onClose}
                className={`absolute inset-0 bg-black/30 transition-opacity duration-300 ease-out ${
                    isAnimating ? "opacity-100" : "opacity-0"
                }`}
            />

            <div
                className={`absolute inset-x-0 bottom-0 mx-auto flex max-h-[95dvh] w-full max-w-md flex-col rounded-t-[2rem] bg-gray-50 shadow-2xl transform-gpu transition-transform duration-[350ms] ease-[cubic-bezier(0.22,1,0.36,1)] ${
                    isAnimating ? "translate-y-0" : "translate-y-full"
                }`}
            >
                <div className="flex shrink-0 items-center justify-center px-6 pb-4 pt-3">
                    <div className="h-1.5 w-10 rounded-full bg-gray-300" />
                </div>

                <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-8 pt-2">
                    {title && <h2 className="mb-5 text-2xl font-bold tracking-[-0.04em] text-gray-950">{title}</h2>}

                    {children}
                </div>
            </div>
        </div>
    );
}
