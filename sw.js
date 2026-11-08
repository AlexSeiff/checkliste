// Bei JEDER Änderung an der App diese Versionsnummer hochzählen (v2 -> v3 -> ...)
const CACHE_NAME = "opas-haushalt-v8";

const ASSETS = [
  "./",
  "./index.html",
  "./style.css",
  "./app.js",
  "./data.js",
  "./manifest.json",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

// Erst Netz, dann Cache.
// Vorher war es umgekehrt – dadurch brauchte jede Änderung zwei App-Starts,
// bis sie zu sehen war. Offline funktioniert die App weiterhin, dann greift
// einfach der Cache-Zweig.
self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  if (new URL(req.url).origin !== self.location.origin) return;

  event.respondWith(
    fetch(req)
      .then((res) => {
        if (res && res.ok) {
          const kopie = res.clone();
          caches.open(CACHE_NAME).then((c) => c.put(req, kopie));
        }
        return res;
      })
      .catch(() =>
        caches.match(req).then((cached) => {
          if (cached) return cached;
          // Seitenaufruf ohne Netz und ohne passenden Eintrag: Startseite liefern
          if (req.mode === "navigate") return caches.match("./index.html");
          return Response.error();
        })
      )
  );
});
