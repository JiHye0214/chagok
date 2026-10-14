type StackBarsProps = {
    // 로고 전체 크기(px)
    size?: number;
    // once: 한 번만 쌓인다 (시작 화면) / loop: 쌓였다 사라지기를 반복한다 (로딩)
    mode?: "once" | "loop";
    // 막대 색. 어두운 배경에서는 inkColor 를 밝게 쓴다
    inkColor?: string;
    accentColor?: string;
};

// 로고 안에서 막대의 위치(%). 아래(초록)부터 하나씩 쌓인다.
const BARS = [
    { left: 11.67, top: 63.33, accent: true, delay: 0 },
    { left: 25, top: 40, accent: false, delay: 0.45 },
    { left: 11.67, top: 16.67, accent: false, delay: 0.9 },
];

export default function StackBars({
    size = 120,
    mode = "once",
    inkColor = "#111111",
    accentColor = "#6E9B7C",
}: StackBarsProps) {
    const animation =
        mode === "loop"
            ? "animate-[barLoop_1.8s_cubic-bezier(0.22,0.8,0.3,1)_infinite]"
            : "animate-[barStack_0.7s_cubic-bezier(0.22,0.8,0.3,1)_forwards]";

    return (
        <div className="relative" style={{ width: size, height: size }} aria-hidden="true">
            {BARS.map((bar) => (
                <span
                    key={bar.top}
                    className={`absolute block rounded-full opacity-0 ${animation}`}
                    style={{
                        left: `${bar.left}%`,
                        top: `${bar.top}%`,
                        width: "61.67%",
                        height: "20%",
                        backgroundColor: bar.accent ? accentColor : inkColor,
                        animationDelay: `${bar.delay + (mode === "once" ? 0.1 : 0)}s`,
                    }}
                />
            ))}
        </div>
    );
}
