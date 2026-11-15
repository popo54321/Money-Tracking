/* Offline support for the web app. Generated into dist/sw.js at build time. */
const VERSION = '__VERSION__';
const CACHE = 'mt-' + VERSION;
const FILES = __FILES__;

// download every file, a few at a time, telling open pages how far it has got (for the progress on screen)
self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE);
      const pages = await self.clients.matchAll({ includeUncontrolled: true, type: 'window' });
      const tell = (done) =>
        pages.forEach((p) => p.postMessage({ type: 'UPDATE_PROGRESS', version: VERSION, done, total: FILES.length }));
      let done = 0;
      tell(0);
      const queue = FILES.slice();
      const worker = async () => {
        while (queue.length) {
          await cache.add(queue.shift());
          done++;
          tell(done);
        }
      };
      await Promise.all([worker(), worker(), worker(), worker()]);
    })(),
  );
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
