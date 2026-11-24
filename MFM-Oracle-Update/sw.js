// Bump this version whenever any shipped file changes.
const VERSION = 'v3.0.0';
const SCOPE = self.registration.scope;
const PREFIX = `mfm-oracle:${SCOPE}:`;
const CACHE = `${PREFIX}${VERSION}`;
const ASSETS = [
  './', './index.html', './styles.css', './app.js', './oracle-core.js', './ball.js',
  './manifest.webmanifest', './icon-192.png', './icon-512.png', './apple-touch-icon.png',
].map(path => new URL(path, SCOPE).href);

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(
    ASSETS.map(url => new Request(url, { cache: 'reload' }))
  )));
  // An update waits until the previous app is closed, keeping every open tab
  // on one complete version. A first installation activates automatically.
});

self.addEventListener('activate', event => {
  event.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(key => key.startsWith(PREFIX) && key !== CACHE)
      .map(key => caches.delete(key))))
    .then(() => self.clients.claim()));
});

self.addEventListener('message', event => {
  if (event.data?.type !== 'CHECK_OFFLINE_READY' || !event.ports[0]) return;
  event.waitUntil(caches.open(CACHE)
    .then(cache => Promise.all(ASSETS.map(url => cache.match(url))))
    .then(responses => event.ports[0].postMessage({
      type: 'OFFLINE_STATUS', ready: responses.every(Boolean), version: VERSION,
    })));
});

self.addEventListener('fetch', event => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin || !url.href.startsWith(SCOPE)) return;
  const canonical = `${url.origin}${url.pathname}`;
  const isNavigation = request.mode === 'navigate';
  if (!isNavigation && !ASSETS.includes(canonical)) return;
  event.respondWith(caches.open(CACHE).then(async cache => {
    // The whole app stays on its precached release, including query-string
    // launches from a home-screen icon or QR code. No CDN dependency exists.
    const cached = await cache.match(isNavigation ? new URL('./index.html', SCOPE).href : canonical);
    if (cached) return cached;
    return fetch(request);
  }));
});
