'use client';
import { useEffect } from 'react';
export default function InstallApp() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production' || !('serviceWorker' in navigator)) return;
    let active = true;
    void (async () => {
      await navigator.serviceWorker.register('/sw.js');
      const registration = await navigator.serviceWorker.ready;
      if (!active) return;
      // Warm files that loaded before the worker took control of this first visit.
      registration.active?.postMessage({
        type: 'CACHE_ASSETS',
        urls: performance.getEntriesByType('resource').map((entry) => entry.name),
      });
    })().catch(() => {});
    return () => {
      active = false;
    };
  }, []);
  return null;
}
