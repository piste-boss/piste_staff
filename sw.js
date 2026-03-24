const CACHE = "km-cache-v2";
const ASSETS = [
  "/",
  "/index.html",
  "/clock.html",
  "/manifest.webmanifest",
  "/styles.css",
  "/icon-192.png",
  "/icon-512.png",
  "/js/config.js",
  "/js/utils.js",
  "/js/api.js",
  "/js/auth.js",
  "/js/calendar.js",
  "/js/app.js",
  "/js/clock-app.js",
];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)));
});
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))));
});
self.addEventListener("fetch", e => {
  const url = new URL(e.request.url);
  if (url.origin === location.origin) {
    e.respondWith(caches.match(e.request).then(r => r || fetch(e.request)));
    return;
  }
  e.respondWith(
    fetch(e.request).then(res => {
      const clone = res.clone();
      caches.open(CACHE).then(c => c.put(e.request, clone)).catch(()=>{});
      return res;
    }).catch(() => caches.match(e.request))
  );
});
