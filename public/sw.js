const CACHE = 'evacu-rosa-shell-v5';
self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE);
      const response = await fetch('/');
      if (!response.ok) throw new Error('Public shell unavailable.');
      const html = await response.clone().text();
      await cache.put('/', response);
      const assets = [
        '/logo.svg',
        '/icon.svg',
        ...new Set(
          [...html.matchAll(/(?:src|href)="([^\"]+)"/g)]
            .map((match) => match[1])
            .filter((url) => url.startsWith('/_next/static/')),
        ),
      ];
      await cache.addAll(assets);
    })(),
  );
  self.skipWaiting();
});
self.addEventListener('message', (event) => {
  if (event.data?.type !== 'CACHE_STATIC' || !Array.isArray(event.data.urls)) return;
  const urls = event.data.urls.filter((value) => {
    try {
      const url = new URL(value);
      return url.origin === self.location.origin && url.pathname.startsWith('/_next/static/');
    } catch {
      return false;
    }
  });
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) =>
        Promise.allSettled(
          urls.map((url) => cache.match(url).then((saved) => saved || cache.add(url))),
        ),
      ),
  );
});
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((k) => k.startsWith('evacu-rosa-shell-') && k !== CACHE)
            .map((k) => caches.delete(k)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});
self.addEventListener('fetch', (event) => {
  const request = event.request,
    url = new URL(request.url);
  // No third-party map tile caching, no API/auth/admin caching.
  if (
    request.method !== 'GET' ||
    url.origin !== self.location.origin ||
    url.pathname.startsWith('/api/') ||
    url.pathname.startsWith('/admin') ||
    request.headers.has('RSC')
  )
    return;
  if (request.mode === 'navigate' && url.pathname === '/') {
    event.respondWith(
      fetch(request)
        .then(async (response) => {
          if (response.ok) {
            const copy = response.clone();
            await caches
              .open(CACHE)
              .then((cache) => cache.put('/', copy))
              .catch(() => {});
          }
          return response;
        })
        .catch(() => caches.match('/').then((saved) => saved || Response.error())),
    );
  } else if (
    url.pathname.startsWith('/_next/static/') ||
    ['/icon.svg', '/logo.svg'].includes(url.pathname)
  ) {
    event.respondWith(
      caches.match(request).then(
        (saved) =>
          saved ||
          fetch(request).then(async (response) => {
            if (response.ok) {
              const copy = response.clone();
              await caches
                .open(CACHE)
                .then((cache) => cache.put(request, copy))
                .catch(() => {});
            }
            return response;
          }),
      ),
    );
  }
});
