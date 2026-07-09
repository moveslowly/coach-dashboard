// Minimal service worker: cache-first for the app shell, offline fallback to cached index.html.
const CACHE_NAME = "coach-cache-v1";
const APP_SHELL = [
  "./index.html",
  "./data.js",
  "./manifest.webmanifest"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((names) =>
      Promise.all(
        names
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) {
        // Serve from cache immediately, refresh in the background.
        event.waitUntil(
          fetch(req)
            .then((res) => {
              if (res && res.ok) {
                caches.open(CACHE_NAME).then((cache) => cache.put(req, res.clone()));
              }
            })
            .catch(() => {})
        );
        return cached;
      }

      return fetch(req)
        .then((res) => {
          if (res && res.ok) {
            const clone = res.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(req, clone));
          }
          return res;
        })
        .catch(() => {
          // Offline fallback: serve the cached shell for navigations.
          if (req.mode === "navigate") {
            return caches.match("./index.html");
          }
          return caches.match(req);
        });
    })
  );
});
