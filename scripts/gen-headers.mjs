// Boot script + HOST_ORIGINS → `public/_headers` (Cloudflare static assets syntax, ADR-0010).
// HOST_ORIGINS: space-separated origins allowed to frame the tool (default https://tarokit.app;
// empty → 'none'). The same list is compiled into MOD-Host by vite.config.ts.
import { abs, emit, GENERATED_HEADER } from './lib/util.mjs';
import { BOOT_SOURCE, bootScriptHash } from './lib/boot.mjs';

const OUT = abs('public/_headers');
export const DEFAULT_HOST_ORIGINS = 'https://tarokit.app';

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]']);

/**
 * One HOST_ORIGINS entry as a serialised origin, or an Error explaining why it is refused
 * (NFR-09, RULE-16: the list feeds frame-ancestors and the compiled-in allow-list, so a wildcard,
 * keyword, path or stray directive must never reach either). https only; http for local hosts
 * (e2e stub host).
 */
export function normaliseOrigin(entry) {
  if (/['";*]/.test(entry) || entry === 'null') return new Error(`not an origin: ${entry}`);
  let url;
  try {
    url = new URL(entry);
  } catch {
    return new Error(`not an origin: ${entry}`);
  }
  const local = url.protocol === 'http:' && LOCAL_HOSTS.has(url.hostname);
  if (url.protocol !== 'https:' && !local) return new Error(`not https: ${entry}`);
  if (url.username || url.password || url.search || url.hash || url.pathname !== '/') {
    return new Error(`origin must have no path, query or credentials: ${entry}`);
  }
  if (url.origin.toLowerCase() !== entry.toLowerCase().replace(/\/$/, '')) {
    return new Error(`not a serialised origin: ${entry} (did you mean ${url.origin}?)`);
  }
  return url.origin;
}

/** Parses a HOST_ORIGINS value; throws (failing gen and build) on any refused entry. */
export function parseHostOrigins(value) {
  const out = [];
  const errors = [];
  for (const entry of value.split(/[\s,]+/).filter(Boolean)) {
    const origin = normaliseOrigin(entry);
    if (origin instanceof Error) errors.push(origin.message);
    else if (!out.includes(origin)) out.push(origin);
  }
  if (errors.length) throw new Error(`HOST_ORIGINS refused: ${errors.join('; ')}`);
  return out;
}

export function hostOrigins() {
  return parseHostOrigins(process.env.HOST_ORIGINS ?? DEFAULT_HOST_ORIGINS);
}

export function pageCsp(origins = hostOrigins()) {
  return [
    "default-src 'none'",
    `script-src 'self' '${bootScriptHash()}'`,
    "style-src 'self'",
    "img-src 'self' data:",
    "font-src 'self'",
    "worker-src 'self'",
    "connect-src 'none'",
    "manifest-src 'none'",
    "frame-src 'none'",
    "object-src 'none'",
    "base-uri 'none'",
    "form-action 'none'",
    `frame-ancestors ${origins.length ? origins.join(' ') : "'none'"}`,
  ].join('; ');
}

/**
 * Permissions-Policy (ADR-0010, NFR-01): the tool only writes to the clipboard (F-012), for
 * itself. Every other powerful feature is denied explicitly, so neither a host `allow=`
 * attribute nor a future dependency can turn it on. Only names Chromium recognises are listed.
 */
export const PERMISSIONS_POLICY = [
  'clipboard-write=(self)',
  'clipboard-read=()',
  'camera=()',
  'microphone=()',
  'geolocation=()',
  'payment=()',
  'usb=()',
  'hid=()',
  'serial=()',
  'bluetooth=()',
  'midi=()',
  'fullscreen=()',
  'display-capture=()',
  'screen-wake-lock=()',
  'idle-detection=()',
  'local-fonts=()',
  'browsing-topics=()',
  'storage-access=()',
  'publickey-credentials-get=()',
  'publickey-credentials-create=()',
  'otp-credentials=()',
  'accelerometer=()',
  'gyroscope=()',
  'magnetometer=()',
  'xr-spatial-tracking=()',
  'window-management=()',
].join(', ');

export const SW_CSP = "default-src 'none'; connect-src 'self'";
// /sw.js is `no-cache` (F-017 security review m2, docs/offline.md): with `updateViaCache: 'all'` the
// browser revalidates it each time the page opens online (a conditional request, ADR-0011's "check
// for a new version while the page opens"), so a fixed or switched-off worker is picked up on the
// next open instead of up to 24 h later.

export function genHeaders({ check }) {
  const out = `# ${GENERATED_HEADER(BOOT_SOURCE + ' and HOST_ORIGINS', 'scripts/gen-headers.mjs')}
# Every matching rule applies; "! Name" detaches a header set by an earlier rule.
/*
  Content-Security-Policy: ${pageCsp()}
  Permissions-Policy: ${PERMISSIONS_POLICY}
  Referrer-Policy: no-referrer
  X-Content-Type-Options: nosniff
  Cross-Origin-Opener-Policy: same-origin
  Strict-Transport-Security: max-age=31536000; includeSubDomains
  Cache-Control: no-cache
/assets/*
  ! Cache-Control
  Cache-Control: public, max-age=31536000, immutable
/sw.js
  ! Content-Security-Policy
  ! Cache-Control
  Content-Security-Policy: ${SW_CSP}
  Cache-Control: no-cache
`;
  return emit(OUT, out, { check });
}
