"use client";

import { useEffect } from "react";
import { useDialog } from "@/components/DialogProvider";
import { getCountry, getCountryLabel, getRegionLabel } from "@/lib/countries";

/*
 * 로그인 직후 한 번만 확인한다.
 * 이미 가입한 계정은 저장된 설정이 우선이라, 로그인 전에 고른 국가와 다르면 어떤 설정으로 들어왔는지 알려준다.
 * 확인이 끝나면 온보딩 중에 임시로 담아둔 선택값은 지운다.
 */
export default function LoginCountryNotice() {
    const { alert: showAlert } = useDialog();

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

                    const savedLabel = [getCountryLabel(savedCountry.code), regionLabel].filter(Boolean).join(" · ");

                    await showAlert(
                        `저장된 설정(${savedLabel})으로 들어왔어요.\n국가나 지역을 바꾸고 싶다면 설정에서 바꿀 수 있어요.`,
                        "저장된 설정으로 시작해요",
                    );
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
