/* ═══════════════════════════════════════════════════════════
   InvestPro — Service Worker (PWA)
   Cache-first for static assets, network-first for API
═══════════════════════════════════════════════════════════ */

const CACHE  = 'investpro-v2';
const STATIC = [
  '/',
  '/index.html',
  '/dashboard.html',
  '/css/style.css',
  '/css/dashboard-v2.css',
  '/css/vip-pro.css',
  '/css/referral.css',
  '/css/how-it-works.css',
  '/css/welcome-modal.css',
  '/css/fintech-pro.css',
  '/css/mobile.css',
  '/js/api.js',
  '/js/fintech-pro.js',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css',
];

/* ── Install: pre-cache static shell ─────────────────────── */
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => {
      return Promise.allSettled(STATIC.map(url => c.add(url).catch(() => null)));
    })
  );
  self.skipWaiting();
});

/* ── Activate: clean old caches ──────────────────────────── */
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

/* ── Fetch strategy ──────────────────────────────────────── */
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);

  /* API calls → Network-first, fallback to offline page */
  if (url.hostname.includes('onrender.com') || url.pathname.startsWith('/api')) {
    e.respondWith(
      fetch(e.request).catch(() =>
        new Response(
          JSON.stringify({ success: false, message: 'لا يوجد اتصال بالإنترنت' }),
          { headers: { 'Content-Type': 'application/json' } }
        )
      )
    );
    return;
  }

  /* Chart.js CDN → Cache-first */
  if (url.hostname.includes('jsdelivr.net') || url.hostname.includes('cdnjs.cloudflare.com')) {
    e.respondWith(
      caches.match(e.request).then(cached => cached || fetch(e.request).then(res => {
        const clone = res.clone();
        caches.open(CACHE).then(c => c.put(e.request, clone));
        return res;
      }))
    );
    return;
  }

  /* Static assets → Cache-first */
  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) return cached;
      return fetch(e.request).then(res => {
        if (res.ok && e.request.method === 'GET') {
          const clone = res.clone();
          caches.open(CACHE).then(c => c.put(e.request, clone));
        }
        return res;
      }).catch(() => caches.match('/dashboard.html'));
    })
  );
});
