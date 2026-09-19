"use client";

import { useState } from "react";

export default function AuthTestPage() {
    const [email, setEmail] = useState("test@chagok.local");
    const [password, setPassword] = useState("TestPassword123!");
    const [message, setMessage] = useState("");

    async function handleLogin() {
        setMessage("로그인 중...");

        const response = await fetch("/api/auth/sign-in/email", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            credentials: "include",
            body: JSON.stringify({
                email,
                password,
            }),
        });

        const data = await response.json();

        if (!response.ok) {
            setMessage(data?.message ?? "로그인 실패");
            return;
        }

        setMessage("로그인 성공!");
    }

    return (
        <main style={{ padding: 40 }}>
            <h1>Auth Test</h1>

            <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" />

            <br />

            <input value={password} onChange={(e) => setPassword(e.target.value)} type="password" placeholder="Password" />

            <br />

            <button onClick={handleLogin}>로그인</button>

            <p>{message}</p>
        </main>
    );
}
