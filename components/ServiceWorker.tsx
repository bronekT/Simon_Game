"use client";

import { useEffect } from "react";

// Registers the PWA service worker on the client (makes the app installable).
export function ServiceWorker() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        // Registration failure shouldn't break the app — ignore silently.
      });
    }
  }, []);
  return null;
}
