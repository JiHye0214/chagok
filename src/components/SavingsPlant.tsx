// 저축 진행도에 따라 자라는 화분. 숫자가 아니라 그림이라 통화(원/달러)와 상관없이 쓸 수 있다.
// 색은 여행 지구본에서 쓰는 초록·산호색과 맞췄다.

type SavingsPlantProps = {
    // 0~100
    progress: number;
    className?: string;
};

const LEAF = "#78C58D";
const LEAF_DARK = "#5DAE76";
const STEM = "#5DAE76";
const BLOOM = "#F08A78";
const BLOOM_CENTER = "#F6C46B";
const POT = "#E8D9C6";
const POT_SHADE = "#D9C6AE";
const SOIL = "#8A6E5A";

const clamp01 = (value: number) => Math.min(Math.max(value, 0), 1);

// 줄기를 따라 잎이 나오는 위치와, 그 잎이 나타나는 진행도
const LEAVES = [
    { at: 0.28, side: -1, from: 0.1 },
    { at: 0.42, side: 1, from: 0.25 },
    { at: 0.58, side: -1, from: 0.4 },
    { at: 0.72, side: 1, from: 0.55 },
    { at: 0.86, side: -1, from: 0.7 },
] as const;

export default function SavingsPlant({ progress, className = "" }: SavingsPlantProps) {
    const p = clamp01(progress / 100);

    // 줄기 높이: 처음엔 작은 싹, 목표를 채우면 가장 높게
    const baseY = 84;
    const height = 10 + 52 * p;
    const tipY = baseY - height;
    const sway = 3 * Math.min(p * 2, 1);

    const stemPath = `M60 ${baseY} C60 ${baseY - height * 0.4}, ${60 + sway} ${baseY - height * 0.7}, 60 ${tipY}`;

    // 줄기 위의 y 좌표(근사)
    const stemY = (t: number) => baseY - height * t;

    const isBloom = p >= 1;
    const hasBud = p >= 0.85 && !isBloom;

    return (
        <svg
            viewBox="0 0 120 120"
            className={className}
            role="img"
            aria-label={`저축 목표 ${Math.round(p * 100)}% 달성`}
        >
            {/* 화분 뒤 줄기 */}
            <path d={stemPath} fill="none" stroke={STEM} strokeWidth={3} strokeLinecap="round" />

            {/* 잎 */}
            {LEAVES.map((leaf, index) => {
                if (p < leaf.from) {
                    return null;
                }

                const grow = clamp01((p - leaf.from) / 0.25);
                const size = 6 + 6 * grow;
                const x = 60 + leaf.side * (size * 0.75);
                const y = stemY(leaf.at);
                const angle = leaf.side * -35;

                return (
                    <ellipse
                        key={index}
                        cx={x}
                        cy={y}
                        rx={size}
                        ry={size * 0.48}
                        fill={index % 2 === 0 ? LEAF : LEAF_DARK}
                        transform={`rotate(${angle} ${x} ${y})`}
                    />
                );
            })}

            {/* 처음에는 아주 작은 떡잎 두 장 */}
            {p < 0.1 && (
                <>
                    <ellipse cx={55.5} cy={tipY + 1} rx={5} ry={2.6} fill={LEAF} transform={`rotate(-30 55.5 ${tipY + 1})`} />
                    <ellipse cx={64.5} cy={tipY + 1} rx={5} ry={2.6} fill={LEAF_DARK} transform={`rotate(30 64.5 ${tipY + 1})`} />
                </>
            )}

            {/* 꽃봉오리 */}
            {hasBud && <ellipse cx={60} cy={tipY - 3} rx={4} ry={5.5} fill={BLOOM} />}

            {/* 꽃 */}
            {isBloom && (
                <g>
                    {[0, 72, 144, 216, 288].map((deg) => (
                        <ellipse
                            key={deg}
                            cx={60}
                            cy={tipY - 8}
                            rx={4.6}
                            ry={7}
                            fill={BLOOM}
                            transform={`rotate(${deg} 60 ${tipY})`}
                        />
                    ))}
                    <circle cx={60} cy={tipY} r={4.2} fill={BLOOM_CENTER} />
                </g>
            )}

            {/* 흙 */}
            <ellipse cx={60} cy={baseY} rx={24} ry={3.4} fill={SOIL} />

            {/* 화분 */}
            <path d="M33 86 h54 a3 3 0 0 1 3 3 v3 a3 3 0 0 1 -3 3 h-54 a3 3 0 0 1 -3 -3 v-3 a3 3 0 0 1 3 -3 z" fill={POT_SHADE} />
            <path d="M37 95 h46 l-4.5 18 a4 4 0 0 1 -3.9 3 h-29.2 a4 4 0 0 1 -3.9 -3 z" fill={POT} />
        </svg>
    );
}
