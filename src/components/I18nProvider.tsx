
"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { DEFAULT_LANGUAGE, isSupportedLanguage } from "@/lib/countries";
import { getLocale, translate, type MessageKey, type TranslateParams } from "@/lib/i18n";

// 마지막으로 확인한 화면 언어. 새로고침 때 한국어가 먼저 깜빡이지 않게 하려고 저장해 둔다.
const CACHE_KEY = "chagok_ui_language";

// 로그인 전 온보딩에서 고른 언어
const ONBOARDING_KEY = "chagok_language";

type I18nContextValue = {
    language: string;
    locale: string;
    t: (key: MessageKey, params?: TranslateParams) => string;
    // 언어를 바로 바꾼다. (저장은 호출한 쪽에서 /api/user/profile 로 한다)
    setLanguage: (language: string) => void;
};

const fallbackValue: I18nContextValue = {
    language: DEFAULT_LANGUAGE,
    locale: getLocale(DEFAULT_LANGUAGE),
    t: (key, params) => translate(DEFAULT_LANGUAGE, key, params),
    setLanguage: () => undefined,
};

const I18nContext = createContext<I18nContextValue>(fallbackValue);

const readStored = (key: string): string | null => {
    try {
        const value = localStorage.getItem(key);

        return isSupportedLanguage(value) ? value : null;
    } catch {
        return null;
    }
};

const writeCache = (language: string) => {
    try {
        localStorage.setItem(CACHE_KEY, language);
    } catch {
        // 저장이 막힌 환경이면 그냥 넘어간다
    }
};

export default function I18nProvider({ children }: { children: ReactNode }) {
    const [language, setLanguageState] = useState<string>(DEFAULT_LANGUAGE);
    // 저장된 언어를 확인하기 전까지는 화면을 숨겨 둔다. (기본 언어가 영어라서, 한국어 사용자에게 영어가 먼저 비치지 않게)
    const [isReady, setIsReady] = useState(false);
    const pathname = usePathname();
    const previousPathname = useRef<string | null>(null);

    const setLanguage = useCallback((next: string) => {
        if (!isSupportedLanguage(next)) {
            return;
        }

        setLanguageState(next);
        writeCache(next);
    }, []);

    // 저장된 계정 언어를 서버에서 가져온다. 로그인 전(401)이면 조용히 넘어간다.
    const loadProfileLanguage = useCallback(async () => {
        try {
            const response = await fetch("/api/user/profile");

            if (!response.ok) {
                return;
            }

            const profile = await response.json().catch(() => null);

            if (isSupportedLanguage(profile?.language)) {
                setLanguageState(profile.language);
                writeCache(profile.language);
            }
        } catch {
            // 네트워크 오류면 지금 언어를 유지한다
        }
    }, []);

    // 처음 열 때: 저장된 값으로 먼저 보여주고, 서버의 계정 언어로 확정한다
    useEffect(() => {
        const initial = readStored(ONBOARDING_KEY) ?? readStored(CACHE_KEY);

        if (initial) {
            setLanguageState(initial);
            setIsReady(true);
        }

        // 저장된 값이 없으면 서버 응답(로그인 전이면 곧바로 401)까지만 기다린다. 오래 걸려도 1.5초 뒤에는 보여준다.
        void loadProfileLanguage().finally(() => setIsReady(true));

        const timer = window.setTimeout(() => setIsReady(true), 1500);

        return () => window.clearTimeout(timer);
    }, [loadProfileLanguage]);

    // 화면을 옮길 때마다
    //  - 온보딩에서 고른 언어가 있으면 바로 반영한다 (로그인 전)
    //  - 언어 설정 화면에서 나올 때는 저장된 계정 언어를 다시 읽어 반영한다
    useEffect(() => {
        const previous = previousPathname.current;

        previousPathname.current = pathname;

        if (previous === null) {
            return;
        }

        const onboardingLanguage = readStored(ONBOARDING_KEY);

        if (onboardingLanguage) {
            setLanguageState(onboardingLanguage);
        }

        if (previous.startsWith("/settings/language") && !pathname.startsWith("/settings/language")) {
            void loadProfileLanguage();
        }
    }, [pathname, loadProfileLanguage]);

    useEffect(() => {
        document.documentElement.lang = language;
    }, [language]);

    const value = useMemo<I18nContextValue>(
        () => ({
            language,
            locale: getLocale(language),
            t: (key, params) => translate(language, key, params),
            setLanguage,
        }),
        [language, setLanguage],
    );

    return (
        <I18nContext.Provider value={value}>
            <div style={{ display: "contents", visibility: isReady ? "visible" : "hidden" }}>{children}</div>
        </I18nContext.Provider>
    );
}

export const useI18n = () => useContext(I18nContext);
