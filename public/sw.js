// RoofCalc Pro PWA Service Worker (Sijitek Solutions)
// Safe strategy: NEVER intercepts /api/*, auth, or payment requests;
// Network-first for HTML pages so Vercel deploys show up immediately.

const CACHE_NAME = 'roofcalc-pro-pwa-v1';
const CORE_ASSETS = [
  '/',
  '/manifest.webmanifest',
  '/favicon.svg',
  '/icon-192.png',
  '/icon-512.png',
  '/apple-touch-icon.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(CORE_ASSETS))
      .catch(() => {})
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  // Never intercept cross-origin requests (Supabase, Paystack, Google Auth, fonts, CDN)
  if (url.origin !== self.location.origin) return;
  // Never intercept API endpoints
  if (url.pathname.startsWith('/api/')) return;

  // Network-first for HTML navigations so fresh deploys load immediately (fallback to cache when offline)
  if (req.mode === 'navigate' || req.headers.get('accept')?.includes('text/html')) {
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res && res.status === 200) {
            const copy = res.clone();
            caches.open(CACHE_NAME).then((c) => c.put('/', copy)).catch(() => {});
          }
          return res;
        })
        .catch(() => caches.match('/'))
    );
    return;
  }

  // Cache-first for versioned Vite /assets/* bundles and static icons
  if (
    url.pathname.startsWith('/assets/') ||
    url.pathname.endsWith('.png') ||
    url.pathname.endsWith('.svg') ||
    url.pathname.endsWith('.webmanifest')
  ) {
    event.respondWith(
      caches.match(req).then((cached) => {
        if (cached) return cached;
        return fetch(req).then((res) => {
          if (res && res.status === 200) {
            const copy = res.clone();
            caches.open(CACHE_NAME).then((c) => c.put(req, copy)).catch(() => {});
          }
          return res;
        });
      })
    );
  }
});
