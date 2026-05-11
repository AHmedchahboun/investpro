/* ═══════════════════════════════════════════════════════════
   InvestPro — Service Worker v4
   Network-first strategy — no forced offline mode
═══════════════════════════════════════════════════════════ */

const CACHE_NAME = 'investpro-v6';

const STATIC_ASSETS = [
  '/css/style.css',
  '/css/dashboard-v2.css',
  '/css/vip-pro.css',
  '/css/referral.css',
  '/css/how-it-works.css',
  '/css/welcome-modal.css',
  '/css/fintech-pro.css',
  '/css/mobile.css',
];

/* ── Install ─────────────────────────────────────────────── */
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_NAME).then(cache =>
      Promise.allSettled(STATIC_ASSETS.map(url => cache.add(url).catch(() => null)))
    )
  );
  self.skipWaiting();
});

/* ── Activate: delete old caches ─────────────────────────── */
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

/* ── Fetch: Network-first for everything ─────────────────── */
self.addEventListener('fetch', e => {
  const { request } = e;
  const url = new URL(request.url);

  // Skip non-GET and chrome-extension requests
  if (request.method !== 'GET') return;
  if (!url.protocol.startsWith('http')) return;

  // API calls — network only, never cache, never fake offline
  if (url.pathname.startsWith('/api')) {
    e.respondWith(fetch(request));
    return;
  }

  // CDN assets (Chart.js, FontAwesome) — cache-first
  if (url.hostname.includes('jsdelivr.net')) {
    e.respondWith(
      caches.match(request).then(cached => {
        if (cached) return cached;
        return fetch(request).then(res => {
          if (res.ok) {
            const clone = res.clone();
            caches.open(CACHE_NAME).then(c => c.put(request, clone));
          }
          return res;
        }).catch(() => new Response('', { status: 503 }));
      })
    );
    return;
  }

  // Everything else — network-first, fallback to cache
  e.respondWith(
    fetch(request)
      .then(res => {
        if (res.ok && request.method === 'GET') {
          const clone = res.clone();
          caches.open(CACHE_NAME).then(c => c.put(request, clone));
        }
        return res;
      })
      .catch(() => caches.match(request))
  );
});
