/*
 * Dependency-free service worker: an offline app shell plus
 * stale-while-revalidate for recipe detail pages, which are static public
 * content. Pantry-, auth- and search-dependent routes (/matches, /favorites,
 * /shopping, /login, /auth/*, the filtered catalog) are never cached — they
 * need the network and their HTML is specific to one visitor or one query.
 *
 * Registered by src/components/register-service-worker.tsx (production only).
 * Bump VERSION to invalidate every cache on the next deploy.
 */

const VERSION = "v1";
const SHELL_CACHE = `ihm-shell-${VERSION}`;
const PAGE_CACHE = `ihm-pages-${VERSION}`;
const ASSET_CACHE = `ihm-assets-${VERSION}`;
const CURRENT_CACHES = [SHELL_CACHE, PAGE_CACHE, ASSET_CACHE];

// Enough to open the app with no network. The home page's own content is
// client-side (the bar lives in localStorage), so it works offline as is.
const SHELL_URLS = ["/", "/manifest.webmanifest", "/icons/icon-192.png"];

// Recipe detail pages only — see the note above about the other routes.
const CACHEABLE_PAGE = /^\/recipes\/[^/]+$/;

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      .then((cache) => cache.addAll(SHELL_URLS))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter(
              (key) => key.startsWith("ihm-") && !CURRENT_CACHES.includes(key),
            )
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  // Supabase (data, auth, images) always goes to the network.
  if (url.origin !== self.location.origin) return;

  // Build output is content-hashed and immutable, so cache-first is safe.
  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(cacheFirst(request, ASSET_CACHE));
    return;
  }

  // Full page loads only. Client-side transitions fetch RSC payloads from the
  // same URLs, and those must never be answered with an HTML document.
  if (request.mode !== "navigate") return;
  if (url.search !== "") return;

  if (url.pathname === "/") {
    event.respondWith(staleWhileRevalidate(event, SHELL_CACHE));
  } else if (CACHEABLE_PAGE.test(url.pathname)) {
    event.respondWith(staleWhileRevalidate(event, PAGE_CACHE));
  }
});

async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok && response.type === "basic") {
    cache.put(request, response.clone());
  }
  return response;
}

async function staleWhileRevalidate(event, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(event.request);
  const network = fetch(event.request).then((response) => {
    if (response.ok && response.type === "basic") {
      cache.put(event.request, response.clone());
    }
    return response;
  });

  if (cached) {
    // Refresh in the background; a failed revalidation leaves the cached copy
    // in place and the next visit tries again.
    event.waitUntil(network.catch(() => {}));
    return cached;
  }
  // Nothing cached: offline here means the browser's own error page, which is
  // more honest than serving another page's HTML under this URL.
  return network;
}
