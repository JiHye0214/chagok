import type { ReactNode } from "react";
import BottomNav from "@/components/BottomNav";

export default function AppLayout({ children }: { children: ReactNode }) {
    return (
        <>
            <main className="min-h-screen bg-gray-50 px-5 pt-8 pb-30">{children}</main>

            <BottomNav />
        </>
    );
}
