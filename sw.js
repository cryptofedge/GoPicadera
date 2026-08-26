/* Go Picadera service worker.
 *
 * Deliberately network-first for the page itself: a menu site must never serve
 * a stale price from cache. The cache exists only so the app still opens if the
 * customer is on a bad connection, and it is wiped whenever VERSION changes.
 *
 * Bump VERSION on every deploy that changes index.html.
 */
const VERSION = "gp-v84";
const SHELL = ["./", "./index.html", "./assets/logo.png"];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);

  // Remote photos (their Supabase bucket / gopicadera.com) -- cache-first, they
  // are content-addressed and never change under the same URL.
  if (url.origin !== location.origin) {
    e.respondWith(
      caches.match(req).then(hit => hit || fetch(req).then(res => {
        if (res.ok && res.type === "basic") {
          const copy = res.clone();
          caches.open(VERSION).then(c => c.put(req, copy));
        }
        return res;
      }).catch(() => hit))
    );
    return;
  }

  // Same-origin -- network first, fall back to cache only when offline.
  e.respondWith(
    fetch(req)
      .then(res => {
        const copy = res.clone();
        caches.open(VERSION).then(c => c.put(req, copy));
        return res;
      })
      .catch(() => caches.match(req).then(hit => hit || caches.match("./index.html")))
  );
});






