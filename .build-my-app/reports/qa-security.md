# QA phase 5: security and privacy audit (build/m1 at 4e350e0, 2026-11-09)

Scope: the whole tool (src/, scripts/, public/_headers, wrangler.jsonc, history). Context: NFR-01, NFR-08,
NFR-09, INV-02/03/04, RULE-10/15/16, architecture A2, ADR-0010/0011/0021/0024, docs/offline.md, and the
open items of security-F-007/F-012/F-017-round-1.md. Local only, and no app code was changed.

## Verdict
**No blockers. 1 major** (WebKit: blur and pixelate exports fail when an image is opened before the offline
copy holds the effects worker. It fails closed, so nothing leaks). **6 minor**, plus notes. No user content
reaches any network or storage on either engine, embedded or standalone.

## What was run
- New tests, all passing on Chromium and WebKit (the M1 case is marked `test.fail` on WebKit):
  - `tests/e2e/qa/security-network.spec.ts`: multi-origin harness, real headers and real `/sw.js`. Run with
    `pnpm exec playwright test -c tests/e2e/qa/security-harness.config.ts`. It uses its own build in
    `dist-e2e/qa-security` and ports 28800–28803, and skips under the default config.
  - `tests/e2e/qa/security-content.spec.ts`: default config (`pnpm test:e2e tests/e2e/qa/security-content.spec.ts`).
- `pnpm audit` (prod and all), and a secrets scan of every commit on every branch (125 commits).
- Code review of src/host, src/io, src/core/export.ts, src/effects/client.ts, src/render (redaction path),
  scripts/gen-headers.mjs, scripts/lib/offline.mjs and the dist bundle (grep for network, storage and HTML sinks).

### Check 1: build-plan "security m3" (F-017 m3), paste before the offline copy is saved
Fresh context, so a real first visit. `/sw.js` is active and the page is not controlled. Neither the page nor
`/assets/worker-*.js` is in Cache Storage yet. A 400 × 300 noise image is pasted, then a blur, a solid and
Copy. The test logs every request at the harness server and at the browser context.
- **No image data reaches the network.** Every request is a body-less GET of `/`, `/sw.js` or
  `/assets/<hashed file>`. The only query is `?theme&lang` on `/`. Nothing goes to any other origin, and the
  host page gets only `taro:ready`. Chromium logs 9 tool requests and WebKit 16–17 (WebKit fetches the files
  twice, as ADR-0024 accepts).
- **The offline copy still completes** (page plus every `tk-assets` file). It then opens with the server down,
  and pixelate and download work there, so the effects worker came from the offline copy.
- **The copy completes on Chromium.** **It fails on WebKit** with "The image couldn't be exported…", 4 of 4
  runs, standalone and embedded. This is M1.
- m3 as such: the page itself fetches `/assets/worker-*.js` on first use (`sec-fetch-dest: worker`) when the
  paste comes before the seed. That request carries no content (minor m1).

### Check 2: NFR-01, a full-session network log
The M-1 tour (`tests/e2e/support/tour.ts`) runs from a first visit, standalone and embedded, on both engines,
with server and browser logs. It covers open, drop and paste, every tool, all three redactions, crop, padding,
the privacy details, copy, download and start over. Result: only body-less GETs of the tool's own files and
the stub host page. The other tool origin gets 0 requests. Storage afterwards: Cache Storage
`image-annotator-v1` holds only `/` and `/assets/*`. localStorage, sessionStorage, cookies and IndexedDB are
all empty. The page's CSP refuses fetch (own and other origin, POST with a body), `sendBeacon`, a
cross-origin `<img>` and a WebSocket, and no such request reaches either server.

## Verified OK
- **Secrets:** no secret is in the tree or the history of build/m1. `.env*` is git-ignored except
  `.env.example`, which has empty `CLOUDFLARE_*` values. `wrangler.jsonc` has no account ID or token.
- **CSP and headers** (scripts/gen-headers.mjs:54-70, public/_headers): `connect-src 'none'`,
  `frame-ancestors` from a validated HOST_ORIGINS list (https only, no wildcard, path or keyword; refused
  entries fail the build, gen-headers.mjs:17-50), the boot script allowed by hash, no `unsafe-*`, no
  `wasm-unsafe-eval`, and `base-uri`/`form-action`/`object-src` set to `'none'`. Permissions-Policy denies
  everything except `clipboard-write=(self)`. Also nosniff, `no-referrer`, COOP and HSTS.
- **Empty HOST_ORIGINS** produces `frame-ancestors 'none'` and a compiled allow-list of `[]`. Tested: the
  stub host is refused and no ready signal is sent. A host not in the list is refused by the normal build too.
  Standalone still works.
- **postMessage (NFR-09):** src/host/messages.ts:29-41 requires an allow-listed origin and
  `event.source === parent`, and checks type and value. The only outbound message is the frozen
  `{type:'taro:ready'}`, sent only to the allow-listed origins, never `'*'` (src/host/index.ts:94). The M-1
  embedded tour confirms it is the only message the host ever receives.
- **Injection:** the bundle has no app HTML sink. `innerHTML` appears only inside Preact's
  `dangerouslySetInnerHTML` path, which the app never uses. Icons are built as elements. There is no eval,
  `new Function` or `importScripts`. Tested: a file name holding `<img onerror>`, U+202E and BEL, and a text
  annotation holding `<img onerror>` and `<script>`, stay text, nothing executes, and the saved name has no
  controls, bidi characters, separators or leading dot. An SVG with a script and an external `<image>` is
  refused by the magic-byte check (src/core/format.ts:34-43) and nothing is fetched. Pasted HTML and links are
  never parsed (src/io/input.ts:53-61).
- **Service worker:** scope `/` on a dedicated origin. Only same-origin `/`, `/index.html` and single-segment
  `/assets/*` are routed or stored (src/host/offline-policy.ts:28-72). Only `ok`, `basic`, non-redirected
  responses are cached (sw.ts:48). A page is stored only when its `tk-assets` files are all cached. The seed
  accepts messages only from its own origin (sw.ts:150). The stored page keeps its CSP and not its URL. There
  is no `skipWaiting` or `clients.claim`. `/sw.js` is served `no-cache`. The revocation rule (sw.ts:84-90)
  and the kill switch (docs/offline.md) cover F-017 m1 and m2.
- **Clipboard and download:** `clipboard-read=()`, so the tool only writes, and only from a gesture. The
  download is an `<a download>` on a `blob:` URL, revoked after 2 s (src/io/export.ts:164-186). The export
  has no fallback: exact patches only, with a 10 s bound (src/io/export.ts:54-86).
- **Metadata (INV-03, NFR-08):** tested with a PNG that has iCCP, eXIf with a GPS IFD, iTXt XMP, tEXt, zTXt
  and tIME, and with a JPEG that has an APP1 Exif GPS block, APP1 XMP, APP2 ICC_PROFILE and COM. The
  download and the recorded copy are IHDR/IDAT/IEND only. No marker is found, even after inflating every
  non-IDAT zlib stream. The same holds for what Chromium's system clipboard returns. The whitelist
  (src/core/export.ts:82-125) fails closed.
- **Solid redaction (INV-02):** on a noise image, a fractional-drag solid with a blur drawn over half of it
  exports with every box pixel exactly `0,0,0,255`. The box is grown outward to whole pixels and covers the
  fields' rectangle. The 1 px ring outside it equals the source pixel for pixel, so there is no bleed. The
  solid wins over the later blur (src/render/index.ts:336-342, 395-399). Blur and pixelate are labelled
  "Not secure" and solid is "Solid (secure)", including in the narrow summary (D-031, F-007 m4).
- **Logging:** the bundle has no `console.*`, no analytics and no third-party script.
- **Earlier review items:** F-007 m1–m6, F-012 M1 and m1–m4, and F-017 M1, m1 and m2 are fixed in the code.
  F-012 m5 is accepted by the spec. F-017 m3 is checked above, and F-017 m4 is on the manual checklist.

## Blocker
None.

## Major

### M1. WebKit: an image opened before the offline copy holds the effects worker can never get exact blur or pixelate, so every copy or download of it fails
- **Where:** scripts/gen-headers.mjs:106 (`SW_CSP = "default-src 'none'; connect-src 'self'"`),
  src/host/sw.ts:103 (asset cache miss → `fetch(req)`), and src/effects/client.ts:187-188 (`lost` returns
  when no job is in flight).
- **Scenario:** in WebKit, a dedicated worker's script request goes through the active `/sw.js` even when the
  page is not controlled. On a cache miss the worker calls `fetch(req)` with the original `worker`-destination
  request. WebKit checks that request against the service worker's *own* CSP, and `default-src 'none'`
  refuses it: `FetchEvent.respondWith received an error: TypeError: Load failed`. The effects worker dies
  before its first job. `lost` ignores this, because nothing is in flight. Later jobs go to a dead worker,
  `exactPatches` never settles, and after `EXPORT_WAIT_MS` (10 s) every Copy and Download of that image fails
  with COPY-error.export_failed. The blur stays the on-screen approximation. Retrying fails again until a new
  image is opened after the seed has cached the worker.
- **When:** in the window between `/sw.js` activating and the seed caching the worker script, on a first
  visit. The same happens on the first open after any release that changes the worker's hash (the stored
  copy does not have the new file yet) and after the cache is evicted. Reproduced 4 of 4 with the paste right
  after `navigator.serviceWorker.ready`, and 8 of 8 on a controlled page with the worker entry deleted. About
  3 of 8 with the paste as soon as the shell shows. Chromium is not affected. Script, style and font cache
  misses are not affected.
- **Impact:** privacy is safe (fail closed, nothing unredacted is exported). It breaks F-012.R1/R2 and F-007
  for Safari users exactly when they start working right away, which is the tool's main flow, and it loses
  work unless they reload.
- **Verified fix:** with `worker-src 'self'` (or `script-src 'self'`) added to `SW_CSP`, the same case
  passes 3 of 3.
- **Fix:**
  1. Set `SW_CSP = "default-src 'none'; connect-src 'self'; worker-src 'self'"` (ADR-0010 amendment). Or, in
     sw.ts:103, re-fetch by URL (`fetch(req.url, { credentials: 'same-origin' })`), which WebKit treats as a
     plain fetch.
  2. In client.ts, treat `error` or `messageerror` with no job in flight as a dead worker. Either start a
     fresh worker with the retained source pixels, or reject every pending `exactPatches` at once with
     `export_failed`, so the export does not wait 10 s and a retry can recover.
  3. Remove the `test.fail` in tests/e2e/qa/security-network.spec.ts, add a unit test for a worker that
     errors before its first job, and check once in real Safari (ADR-0021 manual list).

## Minor

### m1. NFR-01 literal: on a first visit the effects worker script is fetched on the first image (F-017 m3)
- **Where:** src/effects/index.ts:77-80 (the worker starts per image, ADR-0022) and src/host/offline.ts:56-72
  (the seed waits for `load`, `sw.ready` and fonts).
- **Scenario:** if the paste comes before the seed, the page itself requests `/assets/worker-*.js` (WebKit
  logs `dest=worker`, and Chromium does too when the seed is late). It is a body-less GET of the tool's own
  hashed file, with no user content, so INV-04 holds. NFR-01 still says "nothing is fetched on first use of
  a feature".
- **Fix:** record the first-visit exception in NFR-01, or seed the worker earlier: post the seed for the
  `tk-assets` list as soon as `sw.ready` resolves, and the page separately once the fonts have settled. A
  preload can't help: `connect-src`/`default-src 'none'` blocks `prefetch`, and a document `modulepreload`
  does not fill a worker's module map.

### m2. `img-src 'self' data:`: `data:` is not used
- **Where:** scripts/gen-headers.mjs:58 (and architecture.md "Security headers").
- **Scenario:** no `data:` URL exists in src, CSS or the bundle, and images are drawn on canvases from
  `ImageBitmap`. `data:` only widens the policy: it sends nothing (`connect-src` covers that), but a
  future CSS or markup injection could display arbitrary inline images, for example a fake prompt.
- **Fix:** use `img-src 'self'` (ADR-0010 amendment), regenerate `_headers`, and run the e2e suite.

### m3. The open-source notices are not in the offline copy
- **Where:** src/app/PrivacyStatus.tsx:14 (`/third-party-notices.txt`), src/host/offline-policy.ts:36-53
  (only `/` and `/assets/*` get a cache key), scripts/lib/offline.mjs:17-22.
- **Scenario:** offline, "Open-source notices" in the privacy details opens the browser's error page.
  F-017.R1 says every M-1 feature works offline, and F-016 includes this link. Low impact, but it is a
  licence-notice availability gap.
- **Fix:** emit the notices as a hashed asset (`/assets/third-party-notices-<hash>.txt`, listed in
  `tk-assets`), or add `/third-party-notices.txt` to the allow-list as a network-first route like the page.

### m4. Dev-dependency advisories (production: none)
- **Where:** package.json devDependencies, pnpm-lock.yaml.
- **Scenario:** `pnpm audit --prod` finds no known vulnerabilities. Overall it reports 3 low, 13 moderate and
  10 high, all in dev or build tools:
  - `vite` 8.3.1 (direct, fix 8.3.3): dev-server `fs.allow` bypass, launch-editor command issues on Windows.
  - `vitest` 5.0.2 → `@vitest/mocker` (fix 5.0.3): code injection through manual-mock registration.
  - `wrangler` → miniflare → `undici` < 7.30.1, including a TLS certificate validation bypass. This matters in
    phase 7.
  - `@lhci/cli` → `tmp`, `extract-zip` (no fix), `zod`, `basic-ftp`, `uuid`.
  - `eslint` → `minimatch`, and `style-dictionary` → `glob`, `deepmerge`.

  None of them ships in dist. Exposure is a local dev or preview server, and the deploy tool's TLS.
- **Fix:** bump vite to ≥ 8.3.3, vitest to ≥ 5.0.3 and wrangler to a release with undici ≥ 7.30.1 before
  phase 7. Add `pnpm.overrides` for the transitive ones where compatible, update the DEP registry, and
  re-run `pnpm check:licenses`.

### m5. The download name keeps `/\:*?"<>|`, so the notice can name a file other than the one saved
- **Where:** src/core/export.ts:148-152 (RULE-15 as written); the notice is COPY-export.downloaded.
- **Scenario:** `File.name` is a basename and browsers sanitise `a.download`, so there is no traversal
  (tested). But the browser replaces reserved characters as it saves (which ones depends on the browser
  and OS), so for a name like `a:b?.png` the notice says `a:b?-annotated.png` while the saved file can be
  named differently. This is the remainder of F-012 m3.
- **Fix (spec change to RULE-15):** replace those characters with `_` and trim surrounding whitespace, so
  the notice matches the saved name. Add unit cases.

### m6. Real-browser checks still outstanding
- **Where:** docs/offline.md "Manual checks", ADR-0021.
- **Scenario:** these are not automated: Firefox partitioning of the embedded and standalone offline copies
  (F-017 m4), real Safari for M1 and the second download, and real Chrome's clipboard prompt behaviour.
- **Fix:** keep them on the release-candidate checklist, and add "Safari: paste right after first open, then
  blur and copy" (M1).

## Notes (no action needed for M-1)
- **Secret-like strings outside build/m1:** spike commit bc838fc (branch
  `worktree-agent-aefdcf9623a3a9798`, `spikes/blur/`) contains synthetic `sk_live_…` strings drawn into a
  test image (spikes/blur/src/page.ts:63 and its OCR evidence). They are not credentials, but they will trip
  secret scanners or push protection. Don't push that branch, or delete it once it is no longer needed.
- **Defence in depth to consider later:** `Cross-Origin-Resource-Policy: same-origin`, and
  `require-trusted-types-for 'script'` (Chromium). The app has no HTML sink, so it should not break, but it
  needs an e2e run.
- **The host grants (A2)** `allow-scripts allow-same-origin` are safe only because the tool is on its own
  origin (`image-annotator.tarokit.app`, not `tarokit.app`). Keep that invariant in the portal catalog.
- **Clipboard on WebKit** re-encodes the copy and adds `sRGB` and `eXIf` holding only the export's own size
  (ADR-0021). No source data is involved, so INV-03 holds.
- **The source link** (F-016) opens github.com in a new tab, with no referrer and no opener, only when
  clicked. That is the only third-party contact the tool can cause, and it is a user navigation.

## Store / catalog privacy declaration
See `.build-my-app/reports/privacy-declaration.md`. Data collected: **none**.
