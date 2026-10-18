"use client";

import { Calendar, Clock } from "lucide-react";
import { useI18n } from "@/components/I18nProvider";

type DateInputProps = {
    value: string;
    onChange: (value: string) => void;
    // 값이 없을 때 보여줄 안내 글자 (iOS 는 비어 있는 날짜·시간칸에 아무것도 보여주지 않아서 직접 그린다)
    placeholder: string;
    // 날짜(기본) 또는 시간
    type?: "date" | "time";
    min?: string;
    max?: string;
    disabled?: boolean;
    // 칸 모양: filled(회색 바탕, 기본) / outline(흰 바탕 + 테두리) / white(흰 바탕)
    variant?: "filled" | "outline" | "white";
    // 높이를 조금 낮춘다
    compact?: boolean;
    className?: string;
};

const SURFACE = {
    filled: "bg-gray-100",
    outline: "border border-gray-200 bg-white",
    white: "bg-white",
} as const;

/*
 * 날짜·시간 입력칸. 모양은 우리가 그리고, 실제 선택은 투명한 <input type="date|time"> 가 맡는다.
 * - iOS 에서 비어 있는 칸이 안 보이거나, 두 칸을 나란히 놓으면 서로 겹쳐 보이는 문제를 피한다.
 * - 칸을 누르면 기기의 기본 선택창이 그대로 열린다.
 */
export default function DateInput({
    value,
    onChange,
    placeholder,
    type = "date",
    min,
    max,
    disabled = false,
    variant = "filled",
    compact = false,
    className = "",
}: DateInputProps) {
    const { locale } = useI18n();

    const getLabel = () => {
        if (!value) {
            return placeholder;
        }

        if (type === "time") {
            const [hour, minute] = value.split(":").map(Number);

            if (Number.isFinite(hour) && Number.isFinite(minute)) {
                return new Date(2000, 0, 1, hour, minute).toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" });
            }
        }

        return value;
    };

    const Icon = type === "time" ? Clock : Calendar;

    return (
        <div
            className={`relative flex min-w-0 items-center justify-between gap-2 overflow-hidden rounded-2xl px-4 ${
                compact ? "h-12" : "h-14"
            } ${SURFACE[variant]} ${disabled ? "opacity-50" : ""} ${className}`}
        >
            <span className={`min-w-0 truncate text-sm ${value ? "text-gray-900" : "text-gray-400"}`}>{getLabel()}</span>

            <Icon size={16} strokeWidth={1.7} className="shrink-0 text-gray-400" />

            <input
                type={type}
                value={value}
                min={min}
                max={max}
                disabled={disabled}
                onChange={(event) => onChange(event.target.value)}
                aria-label={placeholder}
                className="absolute inset-0 h-full w-full min-w-0 cursor-pointer appearance-none opacity-0 disabled:cursor-not-allowed"
            />
        </div>
    );
}
