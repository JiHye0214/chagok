self.addEventListener("install", () => {
    self.skipWaiting();
});

self.addEventListener("activate", (event) => {
    event.waitUntil(
        self.clients.claim()
    );
});

self.addEventListener(
    "push",
    (event) => {
        const data =
            event.data?.json() ?? {
                title: "차곡",
                body: "새로운 알림이 있어요.",
            };

        event.waitUntil(
            self.registration.showNotification(
                data.title,
                {
                    body: data.body,
                    icon: "/icon-192.png",
                }
            )
        );
    }
);