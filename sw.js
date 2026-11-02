/* GymLog Offline Service Worker (Classic Script for maximum iOS Safari compatibility) */
const CACHE_NAME = 'gymlog-pwa-v3';

const PRECACHE_ASSETS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './styles/tokens.css',
  './styles/base.css',
  './styles/components.css',
  './src/app.js',
  './src/audio.js',
  './src/chart.js',
  './src/csv.js',
  './src/icons.js',
  './src/models.js',
  './src/overload.js',
  './src/storage.js',
  './src/store.js',
  './src/weight.js',
  './src/views/dashboard.js',
  './src/views/history.js',
  './src/views/machines.js',
  './src/views/settings.js',
  './src/views/workout.js',
  './assets/apple-touch-icon.png',
  './assets/favicon.png',
  './assets/icon-192.png',
  './assets/icon-512.png',
];

if (typeof globalThis !== 'undefined') {
  globalThis.__GYMLOG_PRECACHE_ASSETS__ = PRECACHE_ASSETS;
}

if (typeof self !== 'undefined' && typeof self.addEventListener === 'function') {
  self.addEventListener('install', (event) => {
    event.waitUntil(
      caches
        .open(CACHE_NAME)
        .then((cache) => cache.addAll(PRECACHE_ASSETS))
        .then(() => self.skipWaiting())
    );
  });

  self.addEventListener('activate', (event) => {
    event.waitUntil(
      caches
        .keys()
        .then((keys) =>
          Promise.all(
            keys
              .filter((key) => key !== CACHE_NAME)
              .map((oldKey) => caches.delete(oldKey))
          )
        )
        .then(() => self.clients.claim())
    );
  });

  self.addEventListener('fetch', (event) => {
    const req = event.request;
    if (req.method !== 'GET') return;

    let url;
    try {
      url = new URL(req.url);
    } catch {
      return;
    }

    if (url.origin !== self.location.origin) return;

    // Never cache local Mac sync API calls
    if (url.pathname.endsWith('/api/sync') || url.pathname.includes('/api/')) {
      return;
    }

    // Stale-while-revalidate: instant offline/underground-gym load + background update
    event.respondWith(
      caches.open(CACHE_NAME).then(async (cache) => {
        const cached = await cache.match(req, { ignoreSearch: true });
        const networkPromise = fetch(req)
          .then((networkRes) => {
            if (networkRes && networkRes.ok && networkRes.type === 'basic') {
              cache.put(req, networkRes.clone());
            }
            return networkRes;
          })
          .catch(() => null);

        if (cached) {
          return cached;
        }

        const fresh = await networkPromise;
        if (fresh) {
          return fresh;
        }

        if (req.mode === 'navigate') {
          const fallback = await cache.match('./index.html');
          if (fallback) return fallback;
        }

        return new Response('Offline — Ressource nicht im Cache gefunden.', {
          status: 503,
          headers: { 'Content-Type': 'text/plain; charset=utf-8' },
        });
      })
    );
  });
}
