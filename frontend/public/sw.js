const CACHE_NAME = "diaghub-shell-v2";
const APP_SHELL = ["/manifest.webmanifest", "/icons/app-icon.svg"];
const CACHEABLE_API_PREFIXES = ["/api/families", "/api/health"];
const STATIC_ASSET_DESTINATIONS = new Set(["style", "script", "font", "image"]);

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)).catch(() => Promise.resolve())
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") {
    return;
  }

  const url = new URL(event.request.url);
  const isApiCacheable = CACHEABLE_API_PREFIXES.some((prefix) => url.pathname.startsWith(prefix));
  const isNavigationRequest = event.request.mode === "navigate";
  const isStaticAsset =
    url.origin === self.location.origin && STATIC_ASSET_DESTINATIONS.has(event.request.destination);

  if (isNavigationRequest) {
    event.respondWith(networkFirst(event.request));
    return;
  }

  if (isApiCacheable) {
    event.respondWith(networkFirst(event.request));
    return;
  }

  if (isStaticAsset) {
    event.respondWith(staleWhileRevalidate(event.request));
  }
});

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) {
    return cached;
  }

  const response = await fetch(request);
  const cache = await caches.open(CACHE_NAME);
  cache.put(request, response.clone());
  return response;
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);

  const networkPromise = fetch(request)
    .then((response) => {
      cache.put(request, response.clone());
      return response;
    })
    .catch(() => cached);

  return cached || networkPromise;
}

async function networkFirst(request) {
  const cache = await caches.open(CACHE_NAME);

  try {
    const response = await fetch(request);
    if (response && response.ok) {
      cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    const cached = await cache.match(request);
    if (cached) {
      return cached;
    }
    throw error;
  }
}
