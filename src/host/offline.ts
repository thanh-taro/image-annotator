// MOD-Host — offline use, page side (ADR-0011, ADR-0021). Adapted from DAFV: registers /sw.js after
// first render and, once the typefaces have loaded, posts the worker the list of the tool's own files
// so it can store them from the HTTP cache. Registration failures are silent: the tool then simply
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

async function register(fontsReady: Promise<unknown>): Promise<void> {
  const sw = navigator.serviceWorker;
  // `updateViaCache: 'all'` (ADR-0011): the browser's update check of /sw.js may be answered by the
  // HTTP cache, so it adds no request after load (F-017.R2).
  await sw.register('/sw.js', { updateViaCache: 'all' });
  const ready = await sw.ready;
  await settleWithin(fontsReady, FONTS_WAIT_MS);
  await settleWithin(document.fonts?.ready ?? Promise.resolve(), FONTS_WAIT_MS);
  const meta = document.querySelector<HTMLMetaElement>(`meta[name="${ASSETS_META}"]`);
  const urls = seedList(
    location.href,
    performance.getEntriesByType('resource').map((e) => e.name),
    (meta?.content ?? '').split(/\s+/).filter(Boolean),
    location.origin,
  );
  ready.active?.postMessage({ type: 'seed', urls });
}

let started = false;

/**
 * Starts offline support once, after first render (ADR-0011). `fontsReady` settles when the startup
 * font loads have (MOD-Host `loadFonts`); the list is posted only after that. No-op in development,
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
  const run = () => void register(fontsReady).catch(() => undefined);
  if (document.readyState === 'complete') run();
  else window.addEventListener('load', run, { once: true });
}
