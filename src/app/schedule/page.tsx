"use client";

import dynamic from "next/dynamic";

const SchedulePage = dynamic(
    () => import("./SchedulePage"),
    {
        ssr: false,
    }
);

export default function Page() {
    return <SchedulePage />;
}

// 이렇게 하면 SchedulePage가 서버에서 렌더링되지 않아서
// localStorage와 new Date() 때문에 발생하는 hydration mismatch를 피할 수 있어.