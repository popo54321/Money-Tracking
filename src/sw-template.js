/* Offline support for the web app. Generated into dist/sw.js at build time. */
const VERSION = '__VERSION__';
const CACHE = 'mt-' + VERSION;
const FILES = __FILES__;

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES)));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('mt-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  // exchange rates, BTC price and GitHub always go to the internet
  if (url.origin !== self.location.origin) return;
  if (req.mode === 'navigate') {
    // the built-in calculator (retire/) is a page of its own; every other page opens the app
    const own = url.pathname.includes('/retire/');
    event.respondWith(
      (own
        ? caches.match(req, { ignoreSearch: true, ignoreVary: true })
        : caches.match('./index.html', { ignoreVary: true })
      ).then(
        (hit) =>
          hit ||
          fetch(req).catch(() => caches.match(own ? './retire/index.html' : './', { ignoreSearch: true, ignoreVary: true })),
      ),
    );
    return;
  }
  event.respondWith(
    caches.match(req, { ignoreSearch: true, ignoreVary: true }).then(
      (hit) =>
        hit ||
        fetch(req).then((res) => {
          if (res.ok && res.type === 'basic') {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(req, copy));
          }
          return res;
        }),
    ),
  );
});
