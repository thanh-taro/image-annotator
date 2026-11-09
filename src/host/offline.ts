// MOD-Host — offline use, page side (ADR-0011, ADR-0021, ADR-0025.4). Adapted from DAFV: registers /sw.js
// after first render, posts the worker the build's file list as soon as it is ready and, once the
// typefaces have loaded, the page's own entries, so it can store them (from the HTTP cache where the
// page already loaded them). Registration failures are silent: the tool then simply
// works online only. Embedded, the registration and its cache belong to the portal frame's
// partitioned storage, so the frame keeps its own offline copy (ADR-0021, F-017 edge cases).
// Implements: F-017.R1 (every file of the build is named, including both subsets of both typefaces
// and the effects worker), F-017.R2 (the page makes no request of its own: it only posts a list to its
// worker), F-017.R3 (nothing here ever reloads the page or activates a waiting worker).

/** Name of the build's `<meta>` listing every hashed file of the build (MOD-Build, scripts/lib/offline.mjs). */
export const ASSETS_META = 'tk-assets';
const MAX_SEED_URLS = 64;
/** Longest wait for the startup font loads before seeding anyway (a background tab may never settle them). */
export const FONTS_WAIT_MS = 3000;

const isAsset = (pathname: string) => /^\/assets\/[^/]+$/.test(pathname) && !pathname.endsWith('.map');

/**
 * The seed list: the page's own address and every same-origin `/assets/*` file it loaded (resource
 * timing), plus every file the build names (the effects worker, which not every engine lists as a page
 * resource and which starts only with the first image, ADR-0022). Other origins, `blob:` and `data:`
 * URLs are never named.
 */
export function seedList(
  documentUrl: string,
  resourceUrls: readonly string[],
  buildFiles: readonly string[],
  origin: string,
): string[] {
  const out = new Set<string>();
  const doc = new URL(documentUrl);
  if (doc.origin === origin) out.add(doc.pathname + doc.search);
  for (const raw of [...resourceUrls, ...buildFiles]) {
    let u: URL;
    try {
      u = new URL(raw, origin);
    } catch {
      continue;
    }
    if (u.origin === origin && !u.search && isAsset(u.pathname)) out.add(u.pathname);
  }
  return [...out].slice(0, MAX_SEED_URLS);
}

/**
 * ADR-0025.4: the early seed, posted as soon as the service worker is ready: every file the build names
 * (`tk-assets`), scripts first so the effects worker is stored before the first image can need it
 * (NFR-01: nothing is fetched on first use). No page: the page is stored only by the later seed.
 */
export function buildSeedList(buildFiles: readonly string[], origin: string): string[] {
  const files = seedList(origin + '/', [], buildFiles, origin).filter((u) => u !== '/');
  const script = (u: string) => (u.endsWith('.js') ? 0 : 1);
  return files.sort((a, b) => script(a) - script(b));
}

/** Resolves when `p` settles (fulfilled or rejected) or after `ms`, whichever comes first. */
export function settleWithin(p: Promise<unknown>, ms: number): Promise<void> {
  return Promise.race([
    p.then(
      () => undefined,
      () => undefined,
    ),
    new Promise<void>((r) => setTimeout(r, ms)),
  ]);
}

/** Resolves once the document's load event has fired. */
const loaded = () =>
  new Promise<void>((resolve) => {
    if (document.readyState === 'complete') resolve();
    else window.addEventListener('load', () => resolve(), { once: true });
  });

async function register(fontsReady: Promise<unknown>): Promise<void> {
  const sw = navigator.serviceWorker;
  // `updateViaCache: 'all'` (ADR-0011): the browser's update check of /sw.js may be answered by the
  // HTTP cache, so it adds no request after load (F-017.R2).
  await sw.register('/sw.js', { updateViaCache: 'all' });
  const ready = await sw.ready;
  const meta = document.querySelector<HTMLMetaElement>(`meta[name="${ASSETS_META}"]`);
  const buildFiles = (meta?.content ?? '').split(/\s+/).filter(Boolean);
  // Implements: ADR-0025.4 — the build's files at once (the effects worker before a first paste) …
  ready.active?.postMessage({ type: 'seed', urls: buildSeedList(buildFiles, location.origin) });
  // … and the page's own entries once it has loaded and the fonts have settled (they then come from
  // the HTTP cache).
  await settleWithin(fontsReady, FONTS_WAIT_MS);
  await settleWithin(document.fonts?.ready ?? Promise.resolve(), FONTS_WAIT_MS);
  await loaded();
  const urls = seedList(
    location.href,
    performance.getEntriesByType('resource').map((e) => e.name),
    buildFiles,
    location.origin,
  );
  ready.active?.postMessage({ type: 'seed', urls });
}

let started = false;

/**
 * Starts offline support once, after first render (ADR-0011). The build's files are posted as soon as
 * the worker is ready (ADR-0025.4); `fontsReady` settles when the startup font loads have (MOD-Host
 * `loadFonts`); the page's own list is posted only after that. No-op in development,
 * without service-worker support, or when registration is refused (sandboxing, blocked storage).
 */
export function startOffline(fontsReady: Promise<unknown> = Promise.resolve()): void {
  if (started || !__TK_OFFLINE__) return;
  started = true;
  try {
    if (!('serviceWorker' in navigator)) return;
  } catch {
    return;
  }
  // ADR-0025.4: registered right after first render, not after the load event, which waits for the
  // typefaces; so the early seed can store the effects worker before a first paste needs it.
  void register(fontsReady).catch(() => undefined);
}
