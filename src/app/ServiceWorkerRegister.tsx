"use client";

import { useEffect } from "react";

export default function ServiceWorkerRegister() {
    useEffect(() => {
        if (!("serviceWorker" in navigator)) {
            return;
        }

        navigator.serviceWorker
            .register("/sw.js")
            .then(() => {
                console.log(
                    "Service Worker registered"
                );
            })
            .catch((error) => {
                console.error(
                    "Service Worker registration failed:",
                    error
                );
            });
    }, []);

    return null;
}