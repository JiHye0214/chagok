"use client";

import { useEffect, useRef } from "react";
import { useDialog } from "@/components/DialogProvider";
import { useI18n } from "@/components/I18nProvider";
import { getCountry, getCountryLabel, getRegionLabel } from "@/lib/countries";

/*
 * 로그인 직후 한 번만 확인한다.
 * 이미 가입한 계정은 저장된 설정이 우선이라, 로그인 전에 고른 국가와 다르면 어떤 설정으로 들어왔는지 알려준다.
 * 확인이 끝나면 온보딩 중에 임시로 담아둔 선택값은 지운다.
 */
export default function LoginCountryNotice() {
    const { alert: showAlert } = useDialog();
    const { t, language } = useI18n();
    // 로그인 직후 한 번만 도는 effect 라, 언어가 바뀌어도 다시 실행되지 않도록 최신 값만 ref 로 읽는다
    const textRef = useRef({ t, language });

    useEffect(() => {
        textRef.current = { t, language };
    }, [t, language]);

    useEffect(() => {
        let shouldCheck = false;

        try {
            shouldCheck = sessionStorage.getItem("chagok_login_check") === "true";

            if (shouldCheck) {
                sessionStorage.removeItem("chagok_login_check");
            }
        } catch {
            return;
        }

        if (!shouldCheck) {
            return;
        }

        const check = async () => {
            try {
                const response = await fetch("/api/user/profile");

                if (!response.ok) {
                    return;
                }

                const profile = await response.json();

                const chosenCountry = localStorage.getItem("chagok_country");

                const savedCountry = getCountry(profile.countryCode);

                if (chosenCountry && savedCountry && chosenCountry !== savedCountry.code) {
                    const regionLabel = savedCountry.hasRegions ? getRegionLabel(savedCountry.code, profile.provinceCode) : "";

                    const { t: translate, language: currentLanguage } = textRef.current;

                    const savedLabel = [getCountryLabel(savedCountry.code, { language: currentLanguage }), regionLabel].filter(Boolean).join(" · ");

                    await showAlert(translate("alert.loginCountry.body", { label: savedLabel }), translate("alert.loginCountry.title"));
                }

                ["chagok_country", "chagok_region", "chagok_timezone", "chagok_language"].forEach((key) =>
                    localStorage.removeItem(key),
                );
            } catch (error) {
                console.error("로그인 설정 확인 실패:", error);
            }
        };

        void check();
    }, [showAlert]);

    return null;
}
