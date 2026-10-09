import type { ReactNode } from "react";
import BottomNav from "@/components/BottomNav";
import DialogProvider from "@/components/DialogProvider";
import UpgradeProvider from "@/components/UpgradeProvider";

export default function AppLayout({ children }: { children: ReactNode }) {
    return (
        <UpgradeProvider>
            <DialogProvider>
                <main className="min-h-screen bg-gray-50 px-5 pt-8 pb-30">{children}</main>

                <BottomNav />
            </DialogProvider>
        </UpgradeProvider>
    );
}
