// Bump this version whenever any shipped file changes.
const VERSION = 'v8.0.0';
const SCOPE = self.registration.scope;
const PREFIX = `mfm-oracle:${SCOPE}:`;
const CACHE = `${PREFIX}${VERSION}`;
const ASSETS = [
  './', './index.html', './styles.css', './app.js', './oracle-core.js', './ball.js',
  './manifest.webmanifest', './icon-192.png', './icon-512.png', './apple-touch-icon.png',
].map(path => new URL(path, SCOPE).href);

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE)
    .then(cache => cache.addAll(ASSETS.map(url => new Request(url, { cache: 'reload' }))))
    .then(() => self.skipWaiting()));
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    const previous = keys.filter(key => key.startsWith(PREFIX) && key !== CACHE);
    await Promise.all(previous.map(key => caches.delete(key)));
    await self.clients.claim();
    // Upgrade even old app versions that have no reload handler. Only reload
    // after the entire replacement release has been successfully cached.
    if (previous.length) {
      const windows = await self.clients.matchAll({type:'window'});
      // Do not await navigation here: navigation fetches wait for activation.
      for (const client of windows.filter(client => client.url.startsWith(SCOPE))) {
        client.navigate(client.url).catch(() => null);
      }
    }
  })());
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
