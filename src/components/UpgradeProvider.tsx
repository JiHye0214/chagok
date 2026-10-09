"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import UpgradeSheet from "@/components/UpgradeSheet";
import type { PlanCode, UpgradeReason } from "@/lib/plans";

type UpgradeContextValue = {
    planCode: PlanCode;
    isPro: boolean;
    currency: string | null;
    // 어느 화면에서든 openUpgrade("trip-limit") 처럼 부르면 요금제 시트가 열린다.
    openUpgrade: (reason?: UpgradeReason) => void;
    // 결제 후 등으로 요금제가 바뀌었을 때 다시 불러온다.
    refreshPlan: () => Promise<void>;
    // 요금제 조회가 끝났는지. false 인 동안은 free 로 보이므로, 무료 전용 표시는 true 일 때만 그린다.
    isPlanLoaded: boolean;
};

const UpgradeContext = createContext<UpgradeContextValue | null>(null);

export function useUpgrade() {
    const context = useContext(UpgradeContext);

    if (!context) {
        throw new Error("useUpgrade 는 UpgradeProvider 안에서만 쓸 수 있어요.");
    }

    return context;
}

export default function UpgradeProvider({ children }: { children: ReactNode }) {
    const [planCode, setPlanCode] = useState<PlanCode>("free");
    const [isPlanLoaded, setIsPlanLoaded] = useState(false);
    const [currency, setCurrency] = useState<string | null>(null);
    const [isOpen, setIsOpen] = useState(false);
    const [reason, setReason] = useState<UpgradeReason>("general");

    const refreshPlan = useCallback(async () => {
        try {
            const [meResponse, profileResponse] = await Promise.all([fetch("/api/auth/me"), fetch("/api/user/profile")]);

            if (meResponse.ok) {
                const me = await meResponse.json();

                setPlanCode(me.planCode === "pro" ? "pro" : "free");
                setIsPlanLoaded(true);
            }

            if (profileResponse.ok) {
                const profile = await profileResponse.json();

                setCurrency(profile?.currency ?? null);
            }
        } catch (error) {
            console.error("요금제 정보를 불러오지 못했어요:", error);
        }
    }, []);

    useEffect(() => {
        void refreshPlan();
    }, [refreshPlan]);

    const openUpgrade = useCallback((nextReason: UpgradeReason = "general") => {
        setReason(nextReason);
        setIsOpen(true);
    }, []);

    const value = useMemo<UpgradeContextValue>(
        () => ({ planCode, isPro: planCode === "pro", currency, openUpgrade, refreshPlan, isPlanLoaded }),
        [planCode, currency, openUpgrade, refreshPlan, isPlanLoaded],
    );

    return (
        <UpgradeContext.Provider value={value}>
            {children}

            <UpgradeSheet
                isOpen={isOpen}
                onClose={() => setIsOpen(false)}
                reason={reason}
                isPro={planCode === "pro"}
                currency={currency}
            />
        </UpgradeContext.Provider>
    );
}
