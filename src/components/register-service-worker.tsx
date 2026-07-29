"use client";

import { useEffect } from "react";

/**
 * Registers public/sw.js, which caches the app shell and recipe pages for
 * offline use. Production only — a service worker in front of the dev server
 * interferes with hot reloading.
 */
export function RegisterServiceWorker() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;
    // updateViaCache "none" keeps sw.js itself out of the HTTP cache, so a
    // deploy's new version is picked up on the next visit.
    navigator.serviceWorker
      .register("/sw.js", { scope: "/", updateViaCache: "none" })
      // Offline caching is an enhancement; a failed registration changes
      // nothing about how the app works.
      .catch(() => {});
  }, []);

  return null;
}