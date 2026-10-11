import { Geist, Geist_Mono } from "next/font/google";
import ServiceWorkerRegister from "./ServiceWorkerRegister";
import I18nProvider from "@/components/I18nProvider";
import "./globals.css";

const geistSans = Geist({
    variable: "--font-geist-sans",
    subsets: ["latin"],
});

const geistMono = Geist_Mono({
    variable: "--font-geist-mono",
    subsets: ["latin"],
});

export const metadata = {
    title: "Chagok",
    description: "Track your living costs, pay and trips in one app.",
    manifest: "/manifest.json",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
    return (
        <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
            <body className="min-h-full flex flex-col">
                <I18nProvider>{children}</I18nProvider>
                <ServiceWorkerRegister />
            </body>
        </html>
    );
}
