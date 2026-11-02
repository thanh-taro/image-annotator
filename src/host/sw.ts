// MOD-Host — the offline service worker, built to the stable, unhashed path /sw.js (ADR-0011,
// scripts/lib/offline.mjs). Classic script: it must not import anything shared with the page.
// Phase 3.3 scaffold: emitted by the build so its headers and gates exist; it is not registered and
// handles nothing until F-017 is built (install/activate, seeding, network-first page,
// cache-first hashed assets, prune per navigation, no skipWaiting).
interface ServiceWorkerScope {
  addEventListener(type: 'install' | 'activate', fn: (e: Event) => void): void;
}
const scope = self as unknown as ServiceWorkerScope;
scope.addEventListener('install', () => undefined);
