"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { ReactNode } from "react";

type BottomSheetProps = {
    isOpen: boolean;
    onClose: () => void;
    title?: string;
    children: ReactNode;
};

const ENTER_MS = 350;
const EXIT_MS = 260;
const EASE_OUT = "cubic-bezier(0.22, 1, 0.36, 1)";
const EASE_IN = "cubic-bezier(0.4, 0, 1, 1)";

// 시트가 여러 개 겹쳐 열려도 배경 스크롤 잠금이 서로를 풀어버리지 않도록 개수를 센다.
let openSheetCount = 0;

const lockBodyScroll = () => {
    openSheetCount += 1;
    document.body.style.overflow = "hidden";
};

const unlockBodyScroll = () => {
    openSheetCount = Math.max(0, openSheetCount - 1);

    if (openSheetCount === 0) {
        document.body.style.overflow = "";
    }
};

// 설정 시트(LivingStartSheet, SalarySettingsSheet)와 같은 모양: 위쪽 손잡이 바만 있고 X 버튼은 없다.
// 바깥 어두운 영역을 누르면 닫힌다. 아래에서 위로 올라오고, 닫힐 때는 아래로 내려간다.
//
// 사용법: 부모는 조건부로 지우지 말고 isOpen 으로만 열고 닫는다.
//   <BottomSheet isOpen={Boolean(item)} onClose={...}>{item && <내용 />}</BottomSheet>
// 닫히는 동안에는 마지막으로 열려 있던 내용을 그대로 보여줘서, item 이 null 이 돼도 깨지지 않는다.
export default function BottomSheet({ isOpen, onClose, title, children }: BottomSheetProps) {
    const [isMounted, setIsMounted] = useState(isOpen);

    const sheetRef = useRef<HTMLDivElement>(null);
    const backdropRef = useRef<HTMLButtonElement>(null);

    // 닫히는 동안 보여줄 마지막 내용
    const lastContentRef = useRef<{ title?: string; children: ReactNode }>({ title, children });

    if (isOpen) {
        lastContentRef.current = { title, children };
    }

    const content = isOpen ? { title, children } : lastContentRef.current;

    // 이미 올라온 상태인지 (열릴 때 한 번만 올라오는 동작을 하기 위해)
    const hasEnteredRef = useRef(false);
    const exitRef = useRef<{ cancel: () => void } | null>(null);

    // 열기: DOM 을 먼저 붙인다
    useEffect(() => {
        if (isOpen) {
            setIsMounted(true);
        }
    }, [isOpen]);

    // 배경 스크롤 잠금
    useEffect(() => {
        if (!isOpen) {
            return;
        }

        lockBodyScroll();

        return () => unlockBodyScroll();
    }, [isOpen]);

    // 올라오는 동작 (화면에 처음 그려지기 전에 시작해서 깜빡임이 없다)
    useLayoutEffect(() => {
        if (!isOpen || !isMounted || hasEnteredRef.current) {
            return;
        }

        hasEnteredRef.current = true;
        exitRef.current?.cancel();
        exitRef.current = null;

        sheetRef.current?.animate?.([{ transform: "translateY(100%)" }, { transform: "translateY(0)" }], {
            duration: ENTER_MS,
            easing: EASE_OUT,
        });

        backdropRef.current?.animate?.([{ opacity: 0 }, { opacity: 1 }], {
            duration: ENTER_MS - 50,
            easing: "ease-out",
        });
    }, [isOpen, isMounted]);

    // 내려가는 동작이 끝나면 DOM 을 지운다
    useLayoutEffect(() => {
        if (isOpen || !isMounted) {
            return;
        }

        hasEnteredRef.current = false;

        const sheet = sheetRef.current;
        const backdrop = backdropRef.current;

        if (!sheet || typeof sheet.animate !== "function") {
            setIsMounted(false);

            return;
        }

        const sheetAnimation = sheet.animate([{ transform: "translateY(0)" }, { transform: "translateY(100%)" }], {
            duration: EXIT_MS,
            easing: EASE_IN,
            fill: "forwards",
        });

        const backdropAnimation = backdrop?.animate?.([{ opacity: 1 }, { opacity: 0 }], {
            duration: EXIT_MS,
            easing: "ease-in",
            fill: "forwards",
        });

        exitRef.current = {
            cancel: () => {
                sheetAnimation.cancel();
                backdropAnimation?.cancel();
            },
        };

        sheetAnimation.onfinish = () => {
            exitRef.current = null;
            setIsMounted(false);
        };
    }, [isOpen, isMounted]);

    if (!isMounted && !isOpen) {
        return null;
    }

    // isOpen 이 막 true 가 된 첫 렌더에는 아직 isMounted 가 false 라서 한 번 더 렌더된 뒤에 그려진다.
    if (!isMounted) {
        return null;
    }

    return (
        <div className="fixed inset-0 z-[10000]">
            <button
                ref={backdropRef}
                type="button"
                aria-label="닫기"
                onClick={onClose}
                className="absolute inset-0 bg-black/30"
            />

            <div
                ref={sheetRef}
                className="absolute inset-x-0 bottom-0 mx-auto flex max-h-[95dvh] w-full max-w-md flex-col rounded-t-[2rem] bg-gray-50 shadow-2xl"
            >
                <div className="flex shrink-0 items-center justify-center px-6 pb-4 pt-3">
                    <div className="h-1.5 w-10 rounded-full bg-gray-300" />
                </div>

                <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-8 pt-2 scrollbar-hide">
                    {content.title && (
                        <h2 className="mb-5 text-2xl font-bold tracking-[-0.04em] text-gray-950">{content.title}</h2>
                    )}

                    {content.children}
                </div>
            </div>
        </div>
    );
}
