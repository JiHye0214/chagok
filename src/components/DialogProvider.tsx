"use client";

import { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import BottomSheet from "@/components/BottomSheet";

type ConfirmOptions = {
    title?: string;
    confirmLabel?: string;
    cancelLabel?: string;
    // true 이면 확인 버튼이 빨간색. 지정하지 않으면 메시지에 "삭제"/"탈퇴"가 있을 때 자동으로 켠다.
    danger?: boolean;
};

type DialogContextValue = {
    // window.confirm 대신: const ok = await confirm("정말 삭제할까요?");
    confirm: (message: string, options?: ConfirmOptions) => Promise<boolean>;
    // window.alert 대신: alert("저장하지 못했어요.");  (기다리지 않고 바로 다음 코드로 넘어간다)
    alert: (message: string, title?: string) => void;
};

type DialogState = {
    kind: "confirm" | "alert";
    message: string;
    title?: string;
    confirmLabel: string;
    cancelLabel: string;
    danger: boolean;
};

const DialogContext = createContext<DialogContextValue | null>(null);

export function useDialog() {
    const context = useContext(DialogContext);

    if (!context) {
        throw new Error("useDialog 는 DialogProvider 안에서만 쓸 수 있어요.");
    }

    return context;
}

export default function DialogProvider({ children }: { children: ReactNode }) {
    const [dialog, setDialog] = useState<DialogState | null>(null);
    const [isOpen, setIsOpen] = useState(false);
    const resolverRef = useRef<((value: boolean) => void) | null>(null);

    const settle = useCallback((value: boolean) => {
        resolverRef.current?.(value);
        resolverRef.current = null;
        setIsOpen(false);
    }, []);

    const confirm = useCallback((message: string, options: ConfirmOptions = {}) => {
        // 이미 떠 있는 창이 있으면 취소로 닫고 새로 연다.
        resolverRef.current?.(false);

        return new Promise<boolean>((resolve) => {
            resolverRef.current = resolve;
            setDialog({
                kind: "confirm",
                message,
                title: options.title,
                confirmLabel: options.confirmLabel ?? "확인",
                cancelLabel: options.cancelLabel ?? "취소",
                danger: options.danger ?? /삭제|탈퇴/.test(message),
            });
            setIsOpen(true);
        });
    }, []);

    const alert = useCallback((message: string, title?: string) => {
        resolverRef.current?.(false);
        resolverRef.current = null;

        setDialog({ kind: "alert", message, title, confirmLabel: "확인", cancelLabel: "", danger: false });
        setIsOpen(true);
    }, []);

    const value = useMemo<DialogContextValue>(() => ({ confirm, alert }), [confirm, alert]);

    return (
        <DialogContext.Provider value={value}>
            {children}

            {/* 닫히는 동안에도 내용이 남아 있도록 dialog 는 지우지 않는다. */}
            <BottomSheet isOpen={isOpen && dialog !== null} onClose={() => settle(false)}>
                {dialog && (
                    <div>
                        {dialog.title && (
                            <h2 className="mb-2 text-xl font-bold tracking-[-0.04em] text-gray-950">{dialog.title}</h2>
                        )}

                        <p className="whitespace-pre-line text-[15px] leading-6 text-gray-700">{dialog.message}</p>

                        <div className={`mt-6 ${dialog.kind === "confirm" ? "grid grid-cols-2 gap-3" : ""}`}>
                            {dialog.kind === "confirm" && (
                                <button
                                    type="button"
                                    onClick={() => settle(false)}
                                    className="rounded-2xl bg-gray-200 py-4 text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-300"
                                >
                                    {dialog.cancelLabel}
                                </button>
                            )}

                            <button
                                type="button"
                                onClick={() => settle(true)}
                                className={`w-full rounded-2xl py-4 text-sm font-semibold text-white transition-colors ${
                                    dialog.danger ? "bg-red-500 hover:bg-red-600" : "bg-gray-900 hover:bg-gray-800"
                                }`}
                            >
                                {dialog.confirmLabel}
                            </button>
                        </div>
                    </div>
                )}
            </BottomSheet>
        </DialogContext.Provider>
    );
}
