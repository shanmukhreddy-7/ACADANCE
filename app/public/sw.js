const CACHE = 'acadence-shell-v8';
const cacheable = (url) =>
  url.origin === location.origin &&
  (url.pathname === '/' ||
    url.pathname.startsWith('/_next/static/') ||
    url.pathname.startsWith('/photo-demo/') ||
    url.pathname.startsWith('/brand/') ||
    [
      '/academic_core.wasm',
      '/icon.svg',
      '/manifest.webmanifest',
    ].includes(url.pathname));
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) =>
        cache.addAll([
          '/',
          '/academic_core.wasm',
          '/icon.svg',
          '/manifest.webmanifest',
          '/brand/acadence-mark.svg',
          '/brand/icon-192-v2.png',
          '/brand/icon-512-v2.png',
        ]),
      ),
  );
});
self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((key) => key.startsWith('acadence-shell-') && key !== CACHE)
          .map((key) => caches.delete(key)),
      );
      await self.clients.claim();
    })(),
  );
});
self.addEventListener('message', (event) => {
  if (event.data?.type !== 'CACHE_ASSETS' || !Array.isArray(event.data.urls)) return;
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE);
      const urls = event.data.urls.filter(
        (value) => typeof value === 'string' && URL.canParse(value) && cacheable(new URL(value)),
      );
      await Promise.allSettled(urls.map((url) => cache.add(url)));
    })(),
  );
});
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET' || !cacheable(new URL(event.request.url))) return;
  event.respondWith(
    (async () => {
      try {
        const response = await fetch(event.request);
        if (response.ok) {
          const cache = await caches.open(CACHE);
          await cache.put(event.request, response.clone());
        }
        return response;
      } catch {
        return (await caches.match(event.request)) || Response.error();
      }
    })(),
  );
});
