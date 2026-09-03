import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import ServiceWorkerRegister from "./ServiceWorkerRegister";
import "./globals.css";
import BottomNav from "@/components/BottomNav";

const geistSans = Geist({
    variable: "--font-geist-sans",
    subsets: ["latin"],
});

const geistMono = Geist_Mono({
    variable: "--font-geist-mono",
    subsets: ["latin"],
});

export const metadata = {
    title: "차곡",
    description: "생활비와 급여, 스케줄 관리 앱",
    manifest: "/manifest.json",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
    return (
        <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
            <body className="min-h-full flex flex-col">
                <main className="min-h-screen bg-gray-50 px-5 pt-8 pb-30">{children}</main>
                <ServiceWorkerRegister />
                <BottomNav />
            </body>
        </html>
    );
}
