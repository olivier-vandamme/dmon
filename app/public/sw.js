/**
 * Dmon — Service Worker
 *
 * Description:
 *   This Service Worker caches the App Shell (homepage and static assets)
 *   and applies a "stale-while-revalidate" strategy for navigations to
 *   serve the cached page immediately and update it in the background. CDN resources
 *   are cached with a "cache-first" policy and long TTL. It also handles install,
 *   activation, navigation preload and basic offline support.
 *
 * Purpose:
 *   - Improve offline availability and load performance
 *   - Reduce network requests for shared assets (CDN)
 *
 * Note:
 *   Keep the `CACHE_NAME` variable to force cache refresh on updates (e.g. bump version).
 */

const CACHE_NAME = 'dmon-app-shell-v2';
const ASSETS = [
  '/',
  '/css/style.css',
  '/favicon.svg'
];

// External assets to cache (CDN)
const CDN_ASSETS = [
  'https://cdnjs.cloudflare.com/ajax/libs/echarts/5.4.3/echarts.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css'
];

self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(async cache => {
      // Cache local assets
      await cache.addAll(ASSETS);
      // Cache CDN assets (don't fail install if CDN is unavailable)
      await Promise.allSettled(CDN_ASSETS.map(url => 
        fetch(url, { mode: 'cors' })
          .then(res => res.ok ? cache.put(url, res) : null)
          .catch(() => null)
      ));
    })
  );
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.map(k => {
      if (k !== CACHE_NAME) return caches.delete(k);
    }));
    if (self.registration.navigationPreload) {
      await self.registration.navigationPreload.enable();
    }
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  const request = event.request;
  const url = new URL(request.url);

  // Skip non-GET requests and SSE stream
  if (request.method !== 'GET' || url.pathname === '/stream' || url.pathname === '/check-update') {
    return;
  }

  // For navigation: stale-while-revalidate (show cached page instantly, update in background)
  if (request.mode === 'navigate') {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE_NAME);
      const cachedResponse = await cache.match('/');
      
      // Start network fetch in background
      const networkPromise = (async () => {
        try {
          const preload = await event.preloadResponse;
          const networkResponse = preload || await fetch(request);
          if (networkResponse.ok) {
            cache.put('/', networkResponse.clone());
          }
          return networkResponse;
        } catch (err) {
          return null;
        }
      })();

      // Return cached immediately if available, otherwise wait for network
      if (cachedResponse) {
        // Update cache in background (don't await)
        networkPromise.catch(() => {});
        return cachedResponse;
      }
      
      const networkResponse = await networkPromise;
      return networkResponse || new Response('Offline', { status: 503 });
    })());
    return;
  }

  // For CDN assets: cache-first with long TTL
  if (url.hostname.includes('cdnjs.cloudflare.com')) {
    event.respondWith(
      caches.match(request).then(cached => {
        if (cached) return cached;
        return fetch(request).then(response => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(request, clone));
          }
          return response;
        });
      })
    );
    return;
  }

  // For local static assets: cache-first
  event.respondWith(
    caches.match(request).then(cached => cached || fetch(request))
  );
});
