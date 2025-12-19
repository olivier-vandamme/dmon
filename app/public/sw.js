// Dmon — Service Worker (App Shell caching)
const CACHE_NAME = 'dmon-app-shell-v1';
const ASSETS = [
  '/',
  '/css/style.css',
  '/favicon.svg'
  // Add other static assets you want cached (bundle, fonts, etc.)
];

self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(ASSETS))
  );
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    // Cleanup old caches
    const keys = await caches.keys();
    await Promise.all(keys.map(k => {
      if (k !== CACHE_NAME) return caches.delete(k);
    }));
    // Enable navigation preload (supported browsers)
    if (self.registration.navigationPreload) {
      await self.registration.navigationPreload.enable();
    }
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  const request = event.request;

  // For navigation, try network-first with fallback to cached index.html
  if (request.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const preload = await event.preloadResponse;
        if (preload) return preload;
        const network = await fetch(request);
        return network;
      } catch (err) {
        // Fallback to cached root
        const cache = await caches.open(CACHE_NAME);
        return cache.match('/') || cache.match('/index.html');
      }
    })());
    return;
  }

  // For other requests, use cache-first then network
  event.respondWith(caches.match(request).then(cached => cached || fetch(request)));
});
