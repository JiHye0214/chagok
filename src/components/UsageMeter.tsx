"use client";

import { useUpgrade } from "@/components/UpgradeProvider";
import type { UpgradeReason } from "@/lib/plans";

type UsageMeterProps = {
    // 예: "급여 기록"
    label: string;
    used: number;
    limit: number;
    reason: UpgradeReason;
    className?: string;
};

// 무료 요금제에서만 보이는 카드: 현재 플랜, 얼마나 썼는지, 몇 개 더 추가할 수 있는지를 알려주고
// 카드 어디를 눌러도 Pro 안내 시트가 열린다. Pro 이거나 요금제를 아직 모를 땐 아무것도 그리지 않는다.
export default function UsageMeter({ label, used, limit, reason, className = "" }: UsageMeterProps) {
    const { isPro, isPlanLoaded, openUpgrade } = useUpgrade();

    if (!isPlanLoaded || isPro) {
        return null;
    }

    const safeUsed = Math.max(0, used);
    const remaining = Math.max(0, limit - safeUsed);
    const ratio = Math.min(100, Math.round((safeUsed / limit) * 100));
    const isFull = remaining === 0;
    const isAlmostFull = !isFull && remaining <= Math.max(1, Math.ceil(limit * 0.1));

    // 어두운 카드 위에서 잘 보이도록 밝은 색을 쓴다: 평소 흰색, 거의 참 노란색, 가득 참 빨간색
    const tone = isFull ? "text-red-400" : isAlmostFull ? "text-amber-300" : "text-white";
    const barTone = isFull ? "bg-red-400" : isAlmostFull ? "bg-amber-300" : "bg-white";

    return (
        <button
            type="button"
            onClick={() => openUpgrade(reason)}
            className={`block w-full rounded-3xl bg-gray-900 p-5 text-left shadow-sm transition hover:bg-gray-800 active:scale-[0.99] ${className}`}
        >
            <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                    <p className="text-[11px] font-medium text-gray-400">
                        현재 플랜 <span className="ml-1 rounded-full bg-white/10 px-2 py-0.5 text-gray-200">무료</span>
                    </p>

                    <p className="mt-2 text-sm font-semibold text-gray-100">
                        {label} <span className={tone}>{safeUsed}</span>
                        <span className="text-gray-500"> / {limit}</span>
                    </p>
                </div>

                <span className="shrink-0 rounded-full bg-white px-3 py-1.5 text-[11px] font-semibold text-gray-900">
                    Pro 알아보기
                </span>
            </div>

            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/15">
                <div className={`h-full rounded-full transition-all ${barTone}`} style={{ width: `${ratio}%` }} />
            </div>

            <p className="mt-2 text-xs leading-5 text-gray-400">
                {isFull
                    ? "무료 한도를 모두 썼어요. Pro로 업그레이드하면 제한 없이 기록할 수 있어요."
                    : `무료 플랜이라 ${remaining}개 더 추가할 수 있어요. Pro는 제한이 없어요.`}
            </p>
        </button>
    );
}
