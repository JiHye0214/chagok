"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";

type BackButtonHeaderProps = {
    href: string;
    title: string;
    description: string;
};

export default function BackButtonHeader({
    href,
    title,
    description,
}: BackButtonHeaderProps) {
    return (
        <header>
            <Link
                href={href}
                className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-gray-500 shadow-sm"
                aria-label={`${title}로 돌아가기`}
            >
                <ArrowLeft size={19} strokeWidth={1.8} />
            </Link>

            <h1 className="mt-6 text-3xl font-bold">{title}</h1>

            <p className="mt-2 text-sm text-gray-500">{description}</p>
        </header>
    );
}