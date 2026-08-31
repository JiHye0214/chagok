export const getNotificationTime = (date: string, startTime: string, minutesBefore: number) => {
    if (!date || !startTime) {
        return null;
    }

    const [year, month, day] = date.split("-").map(Number);
    const [hour, minute] = startTime.split(":").map(Number);

    const workStart = new Date(year, month - 1, day, hour, minute, 0, 0);

    workStart.setMinutes(workStart.getMinutes() - minutesBefore);

    return workStart;
};

const urlBase64ToUint8Array = (base64String: string) => {
    const padding = "=".repeat((4 - (base64String.length % 4)) % 4);

    const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");

    const rawData = window.atob(base64);

    return Uint8Array.from([...rawData].map((char) => char.charCodeAt(0)));
};

export const subscribeToPush = async () => {
    if (!("serviceWorker" in navigator)) {
        throw new Error("이 브라우저에서는 Service Worker를 지원하지 않아요.");
    }

    if (!("PushManager" in window)) {
        throw new Error("이 브라우저에서는 Push 알림을 지원하지 않아요.");
    }

    const registration = await navigator.serviceWorker.register("/sw.js");

    const permission = await Notification.requestPermission();

    if (permission !== "granted") {
        throw new Error("알림 권한이 허용되지 않았어요.");
    }

    let subscription = await registration.pushManager.getSubscription();

    if (!subscription) {
        const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

        if (!publicKey) {
            throw new Error("VAPID public key가 설정되지 않았어요.");
        }

        subscription = await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(publicKey),
        });
    }

    await fetch("/api/push/subscribe", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            subscription,
        }),
    });
    
    return subscription;
};
