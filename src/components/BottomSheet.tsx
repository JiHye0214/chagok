"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";

type BottomSheetProps = {
    isOpen: boolean;
    onClose: () => void;
    title?: string;
    children: React.ReactNode;
};

export default function BottomSheet({ isOpen, onClose, title, children }: BottomSheetProps) {
    const [isVisible, setIsVisible] = useState(false);

    useEffect(() => {
        if (isOpen) {
            setIsVisible(true);
            document.body.style.overflow = "hidden";
        } else {
            document.body.style.overflow = "";

            const timer = window.setTimeout(() => {
                setIsVisible(false);
            }, 300);

            return () => clearTimeout(timer);
        }

        return () => {
            document.body.style.overflow = "";
        };
    }, [isOpen]);

    if (!isVisible) {
        return null;
    }

    return (
        <div className="fixed inset-0 z-[10000]">
            {/* Background */}
            <button
                type="button"
                aria-label="닫기"
                onClick={onClose}
                className={`absolute inset-0 bg-black/30 transition-opacity duration-300 ${isOpen ? "opacity-100" : "opacity-0"}`}
            />

            {/* Sheet */}
            <div
                className={`absolute inset-x-0 bottom-0 mx-auto flex max-h-[95dvh] w-full max-w-md flex-col rounded-t-[2rem] bg-gray-50 shadow-2xl transition-transform duration-300 ease-out ${
                    isOpen ? "translate-y-0" : "translate-y-full"
                }`}
            >
                {/* Header */}
                <div className="flex shrink-0 items-center justify-between border-b border-gray-100 px-5 py-4">
                    <div className="flex items-center gap-3">
                        <div className="h-1 w-10 rounded-full bg-gray-300" />

                        {title && <h2 className="text-base font-semibold text-gray-900">{title}</h2>}
                    </div>

                    <button
                        type="button"
                        onClick={onClose}
                        className="flex h-9 w-9 items-center justify-center rounded-full bg-gray-100"
                    >
                        <X size={18} strokeWidth={1.8} className="text-gray-500" />
                    </button>
                </div>

                {/* Content */}
                <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-8 pt-5">{children}</div>
            </div>
        </div>
    );
}
