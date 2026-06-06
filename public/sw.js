// Minimal service worker so the app is installable as a PWA (Phase 0).
// Full offline caching strategy is finalized in Phase 5 — for now this just
// satisfies the install requirement and passes requests through to the network.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) =>
  event.waitUntil(self.clients.claim()),
);
self.addEventListener("fetch", () => {
  // Network-only for now; intentionally no caching yet.
});
