// MOD-Host — the offline cache policy as pure functions (no DOM, no worker globals), ADR-0011.
// Adapted from DAFV. Imported only by the service worker entry (`sw.ts`), so the bundler inlines it
// into /sw.js; it must stay self-contained (/sw.js shares no code with the page).
// Implements: F-017.R1 (every file of the build stored before a page is), F-017.R2 (only the tool's
// own files are ever stored: the allow-list is enforced inside the worker), F-017.R3 (one cache shared
// by every worker version; a stored page is replaced only by a complete newer one), INV-04 and NFR-01
// (no image, annotation or address query is kept), RULE-16 / RULE-17 (the page query kept for seeding).

/** Prefix of every Cache Storage name the tool owns. */
export const CACHE_PREFIX = 'image-annotator-';
/**
 * The one Cache Storage entry set (ADR-0011). Its version is the cache *schema*: bumped only when the
 * stored format changes, never per build, so every worker version reads and writes the same entries.
 * Bumping it deletes the old entries on activation (`staleCaches`), leaving no offline copy until the
 * next complete seed: migrate the old entries in `activate` when you bump it.
 */
export const CACHE_NAME = `${CACHE_PREFIX}v1`;
/** Upper bound of a seed list (the tool has about ten files; anything larger is not ours). */
export const MAX_SEED_URLS = 64;
/** Name of the build's `<meta>` listing every hashed file of the build (MOD-Build, scripts/lib/offline.mjs). */
export const ASSETS_META = 'tk-assets';

/** Caches of other schema versions, deleted when a worker activates. */
export function staleCaches(names: readonly string[], current = CACHE_NAME): string[] {
  return names.filter((n) => n.startsWith(CACHE_PREFIX) && n !== current);
}

const ASSET = /^\/assets\/[A-Za-z0-9_-][A-Za-z0-9._-]*$/;

/** Hashed, immutable build output: one file name directly under /assets/, no dot segments, no map. */
export function isAssetPath(pathname: string): boolean {
  return ASSET.test(pathname) && !pathname.includes('..') && !pathname.endsWith('.map');
}

/** The open-source notices, emitted by the build as a hashed text file (ADR-0025.3). */
export function isNoticesPath(pathname: string): boolean {
  return isAssetPath(pathname) && /^\/assets\/third-party-notices-[\w-]+\.txt$/.test(pathname);
}

/** The tool's page (served at the root of its own origin). */
export function isPagePath(pathname: string): boolean {
  return pathname === '/' || pathname === '/index.html';
}

const ownHttp = (u: URL, origin: string) => (u.protocol === 'https:' || u.protocol === 'http:') && u.origin === origin;

/**
 * The cache key of an allowed tool URL, or null when the URL must never be stored (blob:, data:,
 * other origins, any path off the allow-list, an asset with a query). The page has one key whatever
 * its address; it is matched ignoring the query because the portal opens the tool with `?theme=` and
 * `?lang=` (RULE-16, RULE-17).
 */
export function cacheKey(url: URL, origin: string): string | null {
  if (!ownHttp(url, origin)) return null;
  if (isPagePath(url.pathname)) return `${origin}/`;
  if (isAssetPath(url.pathname) && !url.search) return origin + url.pathname;
  return null;
}

export type Route = 'page' | 'asset' | null;

/**
 * How the worker answers a request: `page` network first with the stored page as the offline
 * fallback; `asset` cache first; null — not intercepted (other origins, non-GET, other paths).
 */
export function routeOf(req: { method: string; url: string; mode: string }, origin: string): Route {
  if (req.method !== 'GET') return null;
  let u: URL;
  try {
    u = new URL(req.url);
  } catch {
    return null;
  }
  if (!ownHttp(u, origin)) return null;
  if (req.mode === 'navigate') {
    if (isPagePath(u.pathname)) return 'page';
    // ADR-0025.3: the notices are a hashed text file the privacy details open in a new tab; offline it
    // comes from the offline copy like any hashed file. No other hashed file is opened as a page.
    return isNoticesPath(u.pathname) && !u.search ? 'asset' : null;
  }
  return isAssetPath(u.pathname) && !u.search ? 'asset' : null;
}

export interface SeedTarget {
  /** What is fetched (the address the page loaded it from, so its HTTP cache entry is reused). */
  readonly href: string;
  /** Where it is stored. */
  readonly key: string;
}

export interface SeedPlan {
  /** Assets first … */
  readonly assets: SeedTarget[];
  /** … and the page last, so a stored page never names files that are not stored. */
  readonly page: SeedTarget | null;
}

/** RULE-17's supported languages, in copy.md order (kept in step with MOD-Copy by tests/unit/host.offline.test.ts). */
export const PAGE_LANGUAGES = ['en-US', 'vi-VN'] as const;

/**
 * RULE-17 matching, the same as `matchLanguage` (language.ts; the unit tests keep them in step):
 * equal to a supported language ignoring case, or sharing its primary language.
 */
export function isSupportedLanguage(value: string): boolean {
  const v = value.trim().toLowerCase();
  if (v === '') return false;
  if (PAGE_LANGUAGES.some((l) => l.toLowerCase() === v)) return true;
  const primary = v.split(/[-_]/)[0];
  return PAGE_LANGUAGES.some((l) => l.toLowerCase().split('-')[0] === primary);
}

/** Longest raw `lang` value kept in the seeded page address (a BCP 47 tag's practical maximum). */
export const MAX_LANG_LENGTH = 35;

/**
 * Implements: ADR-0011 ("The seed keeps the page address as loaded …") — the only query the page
 * address may keep when fetched for seeding: one made only of `theme` and/or `lang`, each at most once,
 * `theme` being `light` or `dark` (RULE-16) and `lang` a supported value (RULE-17). It is kept exactly as
 * loaded, so the seed is answered by the HTTP cache and the first embedded visit makes no extra page
 * request. Any other query is dropped.
 */
export function keepsPageQuery(search: string): boolean {
  if (search === '') return true;
  if (!search.startsWith('?') || search === '?') return false;
  const seen = new Set<string>();
  for (const part of search.slice(1).split('&')) {
    const eq = part.indexOf('=');
    if (eq < 0) return false;
    const name = part.slice(0, eq);
    const raw = part.slice(eq + 1);
    if ((name !== 'theme' && name !== 'lang') || seen.has(name)) return false;
    seen.add(name);
    let value: string;
    try {
      value = decodeURIComponent(raw.replace(/\+/g, ' '));
    } catch {
      return false;
    }
    const ok =
      name === 'theme'
        ? value === 'light' || value === 'dark'
        : raw.length <= MAX_LANG_LENGTH && isSupportedLanguage(value);
    if (!ok) return false;
  }
  return true;
}

/**
 * Validates a `{ type: 'seed', urls }` message from the page into the tool's own files to store.
 * Everything off the allow-list is dropped; the page keeps only a `theme`/`lang` query. At most
 * MAX_SEED_URLS entries, no duplicates by key.
 */
export function seedPlan(data: unknown, origin: string): SeedPlan {
  const empty: SeedPlan = { assets: [], page: null };
  if (typeof data !== 'object' || data === null) return empty;
  const { type, urls } = data as { type?: unknown; urls?: unknown };
  if (type !== 'seed' || !Array.isArray(urls)) return empty;
  const assets: SeedTarget[] = [];
  let page: SeedTarget | null = null;
  const keys = new Set<string>();
  for (const raw of urls.slice(0, MAX_SEED_URLS)) {
    if (typeof raw !== 'string') continue;
    let u: URL;
    try {
      u = new URL(raw, origin);
    } catch {
      continue;
    }
    u.hash = '';
    const key = cacheKey(u, origin);
    if (!key) continue;
    if (isPagePath(u.pathname)) {
      if (page) continue;
      if (!keepsPageQuery(u.search)) u.search = '';
      page = { href: u.href, key };
      continue;
    }
    if (keys.has(key)) continue;
    keys.add(key);
    assets.push({ href: u.href, key });
  }
  return { assets, page };
}

const META = new RegExp(`<meta\\s+name="${ASSETS_META}"\\s+content="([^"]*)"`);

/**
 * Every hashed file a page's build names in its `tk-assets` meta, as cache keys; null when the page has
 * no valid list (then it is never stored, so a page from elsewhere can never replace the tool's).
 */
export function pageAssets(html: string, origin: string): string[] | null {
  const m = META.exec(html);
  if (!m) return null;
  const out: string[] = [];
  for (const p of (m[1] ?? '').split(/\s+/).filter(Boolean)) {
    let u: URL;
    try {
      u = new URL(p, origin);
    } catch {
      return null;
    }
    const key = cacheKey(u, origin);
    if (!key || !isAssetPath(u.pathname)) return null;
    out.push(key);
  }
  return out.length ? out : null;
}

/**
 * Whether a fetched page may replace the stored one: every file its build names is already cached, so
 * it boots and every feature works offline (F-017.R1). The page fetched for seeding can be newer than
 * the one that loaded (a new version published meanwhile); storing it without its files would open
 * blank offline, so the previous complete version is kept instead.
 */
export function pageStorable(html: string, cachedKeys: readonly string[], origin: string): boolean {
  const files = pageAssets(html, origin);
  if (!files) return false;
  const have = new Set(cachedKeys);
  return files.every((f) => have.has(f));
}

/**
 * Entries to delete after a complete seed (per navigation, ADR-0011): files neither this session nor
 * the stored page uses (an older version's), and anything off the allow-list. The page entry stays.
 */
export function prunable(cachedKeys: readonly string[], keep: readonly string[], origin: string): string[] {
  const kept = new Set(keep);
  return cachedKeys.filter((k) => {
    let u: URL;
    try {
      u = new URL(k);
    } catch {
      return true;
    }
    if (cacheKey(u, origin) !== k) return true;
    return !isPagePath(u.pathname) && !kept.has(k);
  });
}

/**
 * The page response to store: the same body, status and headers in a new Response with no URL, so the
 * address it was fetched from (`?theme=`, `?lang=`) is not remembered on the device (INV-04, RULE-17).
 */
export function storedPage(body: string, res: Pick<Response, 'status' | 'statusText' | 'headers'>): Response {
  return new Response(body, { status: res.status, statusText: res.statusText, headers: res.headers });
}

/**
 * The `frame-ancestors` sources of a CSP header, normalised (sorted, lower-case), or '' when absent.
 * Implements: NFR-09 — the worker compares the served page's with the stored page's, so a host
 * removed from the allow-list cannot keep embedding the stored copy (sw.ts).
 */
export function frameAncestors(csp: string | null): string {
  for (const part of (csp ?? '').split(';')) {
    const [name, ...sources] = part.trim().split(/\s+/);
    if (name?.toLowerCase() === 'frame-ancestors')
      return sources
        .map((v) => v.toLowerCase())
        .sort()
        .join(' ');
  }
  return '';
}
