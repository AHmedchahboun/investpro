const CACHE_NAME = 'investpro-v9';

const STATIC_ASSETS = [
  '/css/style.css',
  '/css/dashboard-v2.css',
  '/css/vip-pro.css',
  '/css/referral.css',
  '/css/how-it-works.css',
  '/css/welcome-modal.css',
  '/css/fintech-pro.css',
  '/css/mobile.css',
  '/css/pro-enhancements.css',
  '/css/premium-ui.css',
  '/js/csp-events.js',
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache =>
      Promise.allSettled(STATIC_ASSETS.map(url => cache.add(url)))
    )
  );
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key)))
    )
  );
  self.clients.claim();
});

function fallbackResponse(request) {
  if (request.destination === 'style') {
    return new Response('', {
      status: 200,
      headers: { 'Content-Type': 'text/css; charset=utf-8' },
    });
  }

  if (request.destination === 'document') {
    return new Response('<!doctype html><title>InvestPro</title><body>InvestPro is temporarily unavailable.</body>', {
      status: 503,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
  }

  return new Response('', { status: 504, statusText: 'Gateway Timeout' });
}

async function fromCacheOrFallback(request) {
  const cached = await caches.match(request);
  return cached || fallbackResponse(request);
}

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;

  try {
    const response = await fetch(request);
    if (response.ok) {
      const clone = response.clone();
      caches.open(CACHE_NAME).then(cache => cache.put(request, clone)).catch(() => {});
    }
    return response;
  } catch (_) {
    return fromCacheOrFallback(request);
  }
}

async function networkFirst(request) {
  try {
    const response = await fetch(request);
    if (response.ok && request.method === 'GET') {
      const clone = response.clone();
      caches.open(CACHE_NAME).then(cache => cache.put(request, clone)).catch(() => {});
    }
    return response;
  } catch (_) {
    return fromCacheOrFallback(request);
  }
}

self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  if (request.method !== 'GET') return;
  if (!url.protocol.startsWith('http')) return;

  if (url.pathname.startsWith('/api')) {
    event.respondWith(fetch(request).catch(() => fallbackResponse(request)));
    return;
  }

  if (
    url.hostname.includes('jsdelivr.net') ||
    url.hostname.includes('cdnjs.cloudflare.com') ||
    url.hostname.includes('fonts.googleapis.com') ||
    url.hostname.includes('fonts.gstatic.com')
  ) {
    event.respondWith(cacheFirst(request));
    return;
  }

  event.respondWith(networkFirst(request));
});
