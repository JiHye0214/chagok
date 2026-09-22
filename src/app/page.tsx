import { redirect } from "next/navigation";
import { sql } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/user";
import SplashPage from "./SplashPage";
import LivingPage from "./(app)/living/page";
import AppLayout from "./(app)/layout";
import StartupSplash from "./StartupSplash";

export default async function Page() {
    const user = await getCurrentUser();

    // 로그아웃 상태 → 시작하기가 있는 진짜 Splash
    if (!user) {
        return <SplashPage />;
    }

    const profileResult = await sql`
        SELECT nickname
        FROM user_profiles
        WHERE user_id = ${user.id}
        LIMIT 1
    `;

    // 로그인했지만 닉네임이 없으면 닉네임 입력
    if (!profileResult[0]?.nickname) {
        redirect("/onboarding/nickname");
    }

    // 로그인 + 가입 완료 → 시작하기 없는 Splash → 생활
    return (
        <StartupSplash>
            <AppLayout>
                <LivingPage />
            </AppLayout>
        </StartupSplash>
    );
}
