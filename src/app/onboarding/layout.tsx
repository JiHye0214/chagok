import type { ReactNode } from "react";

export default function OnboardingLayout({ children }: { children: ReactNode }) {
    return <div className="h-[100dvh] w-full overflow-hidden bg-gray-50">{children}</div>;
}
