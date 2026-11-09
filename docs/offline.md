# Offline worker: updates and switching it off

How the offline copy (F-017, ADR-0011, ADR-0021, ADR-0024) picks up a new version, and what to do if
a released `/sw.js` misbehaves.

## How a new version arrives
- The page is fetched network-first, so an online open always runs the newest page and its hashed
  files (F-017.R3). Nothing waits for the worker.
- `/sw.js` is served `Cache-Control: no-cache` and registered with `updateViaCache: 'all'`: each
  online open revalidates it (a small conditional request). A changed worker installs at once and
  **waits** until every open copy of the tool using the old worker has closed (no `skipWaiting`, no
  `clients.claim`); the next open after that uses it. A tab left open for days keeps the old worker.
- Each embedding site has its own copy (partitioned storage, ADR-0021), updated only when the tool is
  opened online in that site.
- A host removed from `HOST_ORIGINS`: the next online open in that host is refused by the new
  `frame-ancestors`, and the worker drops the stored page whose `frame-ancestors` differ from the
  served one, so the old copy no longer opens offline there. A device that never comes online again
  keeps its old copy; it contains only the tool's own files.

## Switching off a bad worker (kill switch)
Deploy a build whose `src/host/sw.ts` is replaced by:

```ts
const scope = self as unknown as {
  addEventListener(t: 'install' | 'activate', f: (e: { waitUntil(p: Promise<unknown>): void }) => void): void;
  skipWaiting(): Promise<void>;
  registration: { unregister(): Promise<boolean> };
};
scope.addEventListener('install', (e) => e.waitUntil(scope.skipWaiting()));
scope.addEventListener('activate', (e) =>
  e.waitUntil(
    (async () => {
      for (const n of await caches.keys()) if (n.startsWith('image-annotator-')) await caches.delete(n);
      await scope.registration.unregister();
    })(),
  ),
);
```

It has no `fetch` handler, so the page loads from the network; each device drops its copy on its
next online open. `skipWaiting` is acceptable here only because this worker serves nothing. The
alternative, without a build, is a temporary `Clear-Site-Data: "cache", "storage"` header on `/` in
`public/_headers`, which also removes the registration. Restore the normal worker in a later
release; it registers again on the next open.

## Manual checks per release candidate
- Firefox: offline after one visit, standalone and embedded, and that a standalone copy does not open
  the embedded tool offline (Playwright covers only Chromium and WebKit; ADR-0021).
- Real Safari: whether the worker downloads the files a second time on a first visit (ADR-0024).
