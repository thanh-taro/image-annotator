// MOD-Host — the offline service worker, built to the stable, unhashed path /sw.js (ADR-0011,
// scripts/lib/offline.mjs). Adapted from DAFV. Hand-written, no dependency. It never fetches on its
// own initiative: no install-time precache, no periodic or background work. Its only fetches are the
// browser's own requests it forwards (the page, network first; an asset cache miss) and seeding the
// files the page already loaded, read from the HTTP cache with `cache: 'force-cache'` (NFR-01: the
// tool's own files only). One fixed cache shared by every worker version, pruned per navigation after
// seeding. No `skipWaiting` / `clients.claim`: a new worker waits until every tab of the old one has
// closed, and the page is never reloaded under the user (F-017.R3).
// Classic script: this file must not import anything shared with the page (one bundle entry).
// Implements: F-017.R1, F-017.R2, F-017.R3, INV-04, NFR-01.
import {
  CACHE_NAME,
  cacheKey,
  pageAssets,
  pageStorable,
  prunable,
  routeOf,
  seedPlan,
  staleCaches,
  storedPage,
  type SeedTarget,
} from './offline-policy';

// Minimal service-worker typings (the DOM lib is in scope; the WebWorker lib would clash).
interface ExtendableEvent extends Event {
  waitUntil(p: Promise<unknown>): void;
}
interface FetchEvent extends ExtendableEvent {
  readonly request: Request;
  respondWith(r: Response | Promise<Response>): void;
}
interface ExtendableMessageEvent extends ExtendableEvent {
  readonly data: unknown;
  readonly origin: string;
}
interface WorkerScope {
  readonly location: { readonly origin: string };
  addEventListener(type: 'activate', fn: (e: ExtendableEvent) => void): void;
  addEventListener(type: 'fetch', fn: (e: FetchEvent) => void): void;
  addEventListener(type: 'message', fn: (e: ExtendableMessageEvent) => void): void;
}
const scope = self as unknown as WorkerScope;
const ORIGIN = scope.location.origin;

const usable = (r: Response) => r.ok && r.type === 'basic' && !r.redirected;

// Activate: only caches of an older schema are removed; the shared cache stays (F-017.R3).
scope.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      for (const name of staleCaches(await caches.keys(), CACHE_NAME)) await caches.delete(name);
    })(),
  );
});

scope.addEventListener('fetch', (event) => {
  const req = event.request;
  const route = routeOf(req, ORIGIN);
  if (!route) return;
  const key = cacheKey(new URL(req.url), ORIGIN);
  if (!key) return;
  if (route === 'page') {
    // Implements: F-017.R2 / R3 — network first: the version check happens only while the page is
    // being opened with a connection; offline, the stored page (matched ignoring the query) opens.
    // The page is stored by the seed, after its files, never here.
    event.respondWith(
      fetch(req).catch(
        async () => (await (await caches.open(CACHE_NAME)).match(key, { ignoreSearch: true })) ?? Response.error(),
      ),
    );
    return;
  }
  // Hashed files are immutable: cache first; a miss is the browser's own request for one of the
  // tool's files, kept for offline use.
  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      const hit = await cache.match(key);
      if (hit) return hit;
      const res = await fetch(req);
      if (usable(res)) event.waitUntil(cache.put(key, res.clone()));
      return res;
    })(),
  );
});

/**
 * Seeding (ADR-0011): the page posts the files it loaded; they come from the HTTP cache. Files first,
 * then the page, stored only when every file its build names is cached (the HTML the HTTP cache returns
 * may be a newer version than the page that loaded); otherwise the stored page is kept. Pruning only
 * after a page was stored. Seeds run one at a time. Resolves true when the page was stored.
 */
async function seed(assets: readonly SeedTarget[], page: SeedTarget): Promise<boolean> {
  const cache = await caches.open(CACHE_NAME);
  const get = async (href: string) => {
    try {
      const res = await fetch(href, { cache: 'force-cache' });
      return usable(res) ? res : null;
    } catch {
      return null; // offline or evicted: kept for the next visit
    }
  };
  for (const { href, key } of assets) {
    if (await cache.match(key)) continue;
    const res = await get(href);
    if (!res) return false;
    await cache.put(key, res);
  }
  const res = await get(page.href);
  if (!res) return false;
  const keys = (await cache.keys()).map((r) => r.url);
  const html = await res.clone().text();
  if (!pageStorable(html, keys, ORIGIN)) return false;
  await cache.put(page.key, storedPage(html, res));
  // Keep what this session loaded and every file the stored page names; drop an older version's.
  const keep = [...assets.map((a) => a.key), ...(pageAssets(html, ORIGIN) ?? [])];
  for (const key of prunable(keys, keep, ORIGIN)) await cache.delete(key);
  return true;
}

let seeding: Promise<unknown> = Promise.resolve();

scope.addEventListener('message', (event) => {
  if (event.origin !== ORIGIN) return;
  const { assets, page } = seedPlan(event.data, ORIGIN);
  if (!page) return;
  const run = () => seed(assets, page);
  seeding = seeding.then(run, run);
  event.waitUntil(seeding);
});
