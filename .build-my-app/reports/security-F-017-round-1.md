# Security & privacy review — F-017 (Work offline), round 1

Scope: diff `build/m1...worktree-agent-a60de6a3cc65f58a7` (commit 49f80a6). Paths are relative to the worktree
`.claude/worktrees/agent-a60de6a3cc65f58a7`. Context: F-017, NFR-01, NFR-09, INV-04, ADR-0010, ADR-0011, ADR-0021,
security-F-007-round-1.md, security-F-012-round-1.md. No code was changed. Unit tests
(`tests/unit/host.offline.test.ts`, 13/13) pass and `eslint src/host` is clean.

**Verdict: no blockers. 1 major (the privacy statement is no longer literally true). 4 minor findings.**

## Verified OK
- **Only the tool's own files can be cached.** `cacheKey` (src/host/offline-policy.ts:46-51) accepts only http(s) URLs
  on the tool's origin, and only the page (`/`, `/index.html`) or a single `/assets/<name>` with no query, no `..` and no
  `.map`. `blob:`, `data:`, cross-origin URLs, `/sw.js` and other paths get no key (unit-tested,
  tests/unit/host.offline.test.ts:36-49). Pasted and dropped images are `File`/`blob:` objects. They never go through the
  fetch handler or the seed.
- **Opaque, cross-origin and redirected responses are refused.** `usable` requires `ok && type === 'basic' &&
  !redirected` (src/host/sw.ts:45). It is applied to the seed (sw.ts:97-98) and to cache-miss stores (sw.ts:81). The
  worker's own CSP `default-src 'none'; connect-src 'self'` (scripts/gen-headers.mjs:106, 122-126) also stops it from
  fetching anywhere else. Unknown paths return 404 (`not_found_handling: "none"`, wrangler.jsonc), so an SPA fallback
  can't be cached under an asset key.
- **Query strings aren't stored.** The page is always keyed `${origin}/` (offline-policy.ts:48). The seed keeps only a
  validated `theme`/`lang` query for its HTTP-cache lookup and drops any other query (offline-policy.ts:111-135, 163).
  The stored page is a new `Response` with no URL (offline-policy.ts:233-235, sw.ts:114). The e2e test at
  tests/e2e/host/offline.spec.ts:251 checks that the cache holds no image and no address.
- **Interception scope.** `routeOf` (offline-policy.ts:59-70) handles only GET requests on the tool's origin: page
  navigations and query-less hashed assets. Everything else falls through to the network untouched. The origin is
  dedicated to the tool (custom domain only), so the default `/` scope covers nothing else.
- **The host can't hijack the update or seed path.** The worker accepts messages only from its own origin
  (sw.ts:124), and `seedPlan` re-validates every URL and caps the list at 64 (offline-policy.ts:142-172). A host page
  is cross-origin and has no reference to the worker. The tool's window `message` listener accepts only
  `taro:theme`/`taro:language` and forwards nothing to the worker. A fetched page replaces the stored one only if its
  `tk-assets` meta names only valid own assets, all already cached (offline-policy.ts:180-209).
- **No mid-session takeover.** There is no `skipWaiting`, no `clients.claim` and no reload (grep of src). The page is
  network-first (sw.ts:66-70), so an online open always gets the current HTML and its new hashed asset names. A stale
  cache can't pin old page or asset versions while online. Old assets are pruned after each complete seed
  (sw.ts:115-117), and caches of other schemas are deleted on activate (sw.ts:48-54).
- **The CSP survives offline.** The stored page copies the original headers (CSP with `frame-ancestors`, nosniff,
  and so on) (offline-policy.ts:233-235, unit test :141). The page CSP keeps `connect-src 'none'` and `worker-src 'self'`
  (gen-headers.mjs:54-70). There is no `importScripts` in src or dist/sw.js. The worker CSP `default-src 'none'`
  would refuse it anyway. `sw.js` is checked to be a classic script with no imports (scripts/lib/offline.mjs:45-52).
- **The page makes no requests.** The page only calls `register` and `postMessage` (src/host/offline.ts:56-72).
  Fetching stays limited to sw.ts by lint (eslint.config.js:152-160). No localStorage, sessionStorage, IndexedDB or
  cookies are added. Registration is compiled in only for production builds (`__TK_OFFLINE__`).
- **Partitioning (ADR-0021).** The embedded registration and its cache belong to the frame's partitioned storage. The
  e2e test at offline.spec.ts:147 checks that a standalone copy doesn't serve the embedded tool. A disallowed embedder is
  refused by `frame-ancestors` before any script runs, so it never gets a registration.
- **Test hooks don't ship.** `/__ctl/*` and `/__log/*` exist only in tests/e2e/support/server.mjs. Source maps are
  `hidden`, never cached (`.map` has no key) and not uploaded (`.assetsignore`).

## Major

### M1 — The privacy statement says nothing is stored and all requests are blocked after load
- **Where:** COPY-privacy.details, specs/30-experience/copy.md:181 (generated into src/copy/messages.gen.ts:140); F-016.R2.
- **Issue:** The statement reads "Nothing is uploaded, stored or tracked, and the tool blocks all network requests
  after it loads." Since F-017, the tool keeps a service-worker registration and a Cache Storage entry
  (`image-annotator-v1`) in each partition, and these outlive the page. The worker also makes requests after load:
  - the seed (sw.ts:97) goes to the network on an HTTP-cache miss, for example `/` refetched when the query was dropped,
    or the effects worker on first visit;
  - the next open checks for a new version.
  No user content is involved, so INV-04 and NFR-01 hold. But a user who opens DevTools → Application/Network sees
  storage and post-load requests the statement denies. F-016's intent is a claim that is "true by construction".
- **Fix (spec change, owner approval needed, F-016 is shipped):** reword both languages. For example: "Your images are
  opened and edited only in this browser and are never uploaded or stored. The tool keeps only its own files in the
  browser so it works offline, and the page blocks all network requests after it loads." Update the vi-VN text the
  same way and re-run the F-016 tests.

## Minor

### m1 — A revoked host keeps a working offline copy with the old `frame-ancestors`
- **Where:** src/host/sw.ts:66-70 (offline fallback) and offline-policy.ts:233 (stored headers).
- **Scenario:** An origin is removed from HOST_ORIGINS. Online, the network-first page carries the new CSP and the
  frame is refused. But in that host's partition the old worker and stored page remain. The refused page never runs,
  so no seed ever prunes them. Offline, the old version (with its old `frame-ancestors`) still opens embedded in the
  revoked host. Only the tool's own code is exposed, never user data, but it can be a known-vulnerable old build.
- **Fix:** Compile the page CSP (or a build marker) into sw.js. On `activate`, delete the stored page if its CSP
  differs from the one the worker was built with. A worker update in a client-less partition activates at once.

### m2 — Updates can lag up to about 24 h, and there's no documented kill switch
- **Where:** src/host/offline.ts:60 (`updateViaCache: 'all'`) and scripts/gen-headers.mjs:122-126
  (`/sw.js` `Cache-Control: public, max-age=86400`).
- **Scenario:** A fixed sw.js can take up to 24 h (the browser's cap) to be picked up, and longer until every old tab
  closes. Page and assets aren't pinned (network-first page, hashed assets), so the exposure is bounded and was chosen
  by ADR-0011. But there is no rollback procedure for a bad worker.
- **Fix:** Document a kill switch in docs/deploy/: either a sw.js that deletes `image-annotator-*` caches and calls
  `registration.unregister()`, or a temporary `Clear-Site-Data: "cache", "storage"` header on `/`. Optionally lower
  `/sw.js` max-age (for example to 3600).

### m3 — First visit: the effects worker script can be fetched on first use of a feature
- **Where:** src/effects/index.ts:79 (the worker starts with the first image, ADR-0022) and src/host/offline.ts:62-63
  (the seed waits up to 2 × 3 s for fonts).
- **Scenario:** On the very first visit, a user who pastes before the seed runs triggers a network request for
  `/assets/worker-*.js`. Literally, NFR-01 forbids fetching on first use of a feature. The request carries no user
  content and is the tool's own file, which the worker then caches (sw.ts:80-81). This existed before F-017 and is
  not a regression.
- **Fix:** Preload the worker at startup (`<link rel="modulepreload">` for it, or start the worker at boot), or note
  the first-visit exception in NFR-01. Check that F-017.AC2's test also covers paste-before-seed.

### m4 — Partitioning and offline behaviour in Firefox aren't verified
- **Where:** ADR-0021 (Chromium and WebKit only).
- **Scenario:** If an engine doesn't partition third-party service workers, a standalone visit could serve the
  embedded tool, or the reverse. The impact is low: same tool, same origin, no user data. Registration failure is
  already silent (offline.ts:89).
- **Fix:** Add a Firefox offline check (embedded vs standalone partition) to the manual release-candidate checklist
  (ADR-0014).

## Store privacy declaration (unchanged by F-017)
- **Data collected or transmitted:** none. No analytics, no third-party SDKs, no accounts. Images and annotations
  never leave the device (NFR-01, INV-04).
- **On-device storage:** a service-worker registration and Cache Storage `image-annotator-v1`, holding only the
  tool's own page and hashed JS, CSS and font files. No user content, no query strings, no identifiers. The browser's
  HTTP cache holds the same files.
- **Exports:** only the PNG file or clipboard copy the user explicitly makes.
- **Network:** only fetches of the tool's own files from its own origin, while the page opens or while caching.
