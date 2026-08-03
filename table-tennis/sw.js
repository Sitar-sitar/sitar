const CACHE_NAME = "table-tennis-v0.6.3";
const CHILD_APP_PATH = new URL(
  "./table-tennis2/",
  self.registration.scope
).pathname;
const APP_SHELL = [
  "./",
  "./index.html",
  "./assets/app.js",
  "./assets/app.css",
  "./manifest.webmanifest",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/icon-maskable-512.png",
  "./icons/apple-touch-icon.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys
          .filter((key) => key.startsWith("table-tennis-") && key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  const requestUrl = new URL(event.request.url);
  if (
    requestUrl.origin === self.location.origin &&
    requestUrl.pathname.startsWith(CHILD_APP_PATH)
  ) return;

  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      const cached = await cache.match(event.request);
      if (cached) return cached;

      try {
        const response = await fetch(event.request);
        if (
          response.ok &&
          new URL(event.request.url).origin === self.location.origin
        ) {
          await cache.put(event.request, response.clone());
        }
        return response;
      } catch {
        if (event.request.mode === "navigate") {
          return (await cache.match("./index.html")) ?? Response.error();
        }
        return Response.error();
      }
    })()
  );
});
