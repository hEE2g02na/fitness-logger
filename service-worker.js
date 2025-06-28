const cacheName = 'fitness-logger-v1';
const filesToCache = [
    './',
    './index.html',
    './style.css',
    './script.js',
    './manifest.json',
    './icons/icon-192.png',
    './icons/icon-512.png'
];

self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(cacheName).then(cache => cache.addAll(filesToCache))
    );
    self.skipWaiting();
});

self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(keys =>
            Promise.all(
                keys.filter(k => k !== cacheName).map(k => caches.delete(k))
            )
        )
    );
    self.clients.claim();
});

self.addEventListener('fetch', event => {
    event.respondWith(
        caches.match(event.request).then(response =>
                response || fetch(event.request).then(fetchRes => {
                    // Optionally update cache in background
                    if (event.request.method === 'GET' && fetchRes && fetchRes.status === 200) {
                        const resClone = fetchRes.clone();
                        caches.open(cacheName).then(cache => cache.put(event.request, resClone));
                    }
                    return fetchRes;
                }).catch(() => response)
        )
    );
});