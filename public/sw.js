self.addEventListener('install', (e) => {
    console.log('[Service Worker] Installed');
});

self.addEventListener('fetch', (e) => {
    // Minimal bypass to keep the app online and installable
    e.respondWith(fetch(e.request).catch(() => caches.match(e.request)));
});
