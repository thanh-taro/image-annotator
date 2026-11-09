# Review — F-017 Work offline, round 1

Diff: `build/m1...worktree-agent-a60de6a3cc65f58a7` (49f80a6). Worktree paths below are relative to
`.claude/worktrees/agent-a60de6a3cc65f58a7/`.

Run by the reviewer: `playwright -c playwright.host-offline.config.ts offline.spec smoke-host.spec portal-language.spec`
(both engines) → **1 failed**, 40 passed, 1 skipped. Then AC2 on WebKit with `--repeat-each=3` → 6/6
passed, and the whole host suite on WebKit → 36/36 passed. So the failure is intermittent (see M1).
`spec_lint --coverage`: no F-017 AC is missing (only F-018.AC7, which was already deferred). No new
dependency (package.json and the lockfile are unchanged). CSP, `connect-src` and `_headers` are unchanged
(gen-headers.mjs isn't touched, and the `tk-assets` meta doesn't affect the boot-script hash).

## Blocker
None.

## Major

**M1. AC2 is flaky on WebKit embedded (a font request during the session).**
`tests/e2e/host/offline.spec.ts:213`. In a two-engine run, `F-017.AC2 … (embedded) [webkit]` got
`GET /assets/manrope-vietnamese-wght-normal-*.woff2` after `resetLog`, while the text, blur,
pixelate and export were being used. It passed 6/6 in isolation. The server log can't tell who made the
request (the page or the worker). If it was the page, it breaks NFR-01 ("nothing is fetched on first
use"). If it was the worker, it's a seed race. The likely cause: under load, `settleWithin(fontsReady,
3000)` (`src/host/offline.ts:445`) times out, so the seed runs before the page's own font load has
reached the server, and that load then lands inside the measured window.
Fix: (a) have `server.mjs` log `sec-fetch-dest` (`font` from the page, `empty` from the worker's
`fetch`), and assert in AC2 that nothing comes from the page. (b) Before `resetLog`, wait for
`document.fonts.status === 'loaded'` in the frame, not only for the cache. (c) If a page request still
shows up, it's an F-018.R7 bug, so fix it there.

**M2. AC3 never exercises "update and takeover" because v2 has the same `/sw.js`.**
`tests/e2e/support/global-setup.ts:405-422` copies the build and changes only the stylesheet and the
page. `sw.js` is byte-identical, so no new worker ever installs. "Nothing reloads"
(`offline.spec.ts:229-235`) is then trivially true: nothing could reload anyway.
Fix: also append a comment to `allowed-v2/sw.js`. In the test, call `registration.update()` from the
v1 page and wait (no sleep) until `registration.waiting` is set. Assert that the window is still the
same, that `navigator.serviceWorker.controller` is still the old script, and that `waiting` stays
waiting while the tab is open. Close the tab, open again, and assert the new worker is active, the
cache is intact, and the tool opens offline.

**M3. AC3 hides the R3 contradiction (spec gap 1).**
`offline.spec.ts:238-240` opens twice and checks the version only on the second open. Under
network-first (`src/host/sw.ts:551-560`) the **first** online open already runs v2, which contradicts
the current R3 ("used from the following open"). The test passes under either reading, so it doesn't
show which one holds.
Fix: after R3 is amended (below), assert `version === '2'` on the first online open, and assert that
the offline copy is v2 only once that open has cached every file.

**M4. Sleeps in the tests.** `offline.spec.ts:231` (`setTimeout` 1500 in the page) and
`offline.spec.ts:162` (`waitForTimeout(2000)`).
Fix: AC3, see M2 (wait for `registration.waiting`, then check `stillSameWindow`). Edge case: wait for
a deterministic event instead, for example the host page's iframe `load`/`error`, or poll the request
log until the refused `/` navigation has been logged, then check `received(page)` once.

## Minor

**m1. F-018.R7 test made weaker.** `tests/e2e/host/portal-language.spec.ts:216-219` now counts
*distinct* Vietnamese files, so a real duplicate page request goes unnoticed on both engines. With
`sec-fetch-dest` in the log (M1), count only page requests (`dest=font`) and keep the exact count.

**m2. smoke-host regex is looser than it needs to be.** `tests/e2e/host/smoke-host.spec.ts:369`. The
trailing `?` makes the whole group optional, so `/` is now allowed again anywhere in the list. That's
fine for WebKit's re-fetch, but say so in the comment, or allow `/` only when it comes from the worker
(same `sec-fetch-dest` approach).

**m3. Network-first returns server errors instead of the offline copy.** `src/host/sw.ts:556`:
`fetch(req)` resolves on a 5xx/404 (for example a hosting outage page), so the stored page is never
used. Also, there's no timeout on a stalled connection. Fall back to the cache when `!res.ok`. A
timeout would be a design choice for ADR-0011, so leave it out.

**m4. Pruning can remove files an older open tab still needs.** `src/host/sw.ts:605-606` keeps only
this session's files and the stored page's files. Scenario: tab A runs v1 with no image yet, and tab B
opens v2 and prunes `worker-v1.js`. Tab A's first paste then misses the cache and goes to the network
(a request on first use, and a 404 once v1 is gone from the host). Rare. A cheap fix is to also keep
the files named by the `tk-assets` meta of every controlled client's version, or to prune only on
`activate`. Otherwise, accept it and note it in the ADR.

**m5. A schema bump leaves the offline copy empty.** `src/host/sw.ts:537-543`. There's no `install`
handler or migration: a future `CACHE_NAME` bump deletes `v1` on activation, and an offline open right
after that gets `Response.error()`. This doesn't apply today (v1 only), so a comment on `CACHE_NAME`
saying "migrate on bump" is enough.

**m6. The edge case is tested in one direction and one engine only.** `offline.spec.ts:147-167` tests
standalone → embedded on WebKit only; embedded → standalone isn't tested. Add the reverse case. It
works on Chromium too, because a top-level standalone page never sees the frame's partition.

**m7. `startOffline(loadFonts())` in development.** `src/app/main.tsx:95` and `src/host/offline.ts:465`:
when `!__TK_OFFLINE__`, the promise is never observed. `loadFonts` uses `allSettled`, so it can't
reject; nothing to fix, it's only fragile.

## Checked, no finding
- **Seeding** from the `tk-assets` meta plus resource timing (`offline.ts:407-426`). The build list
  (`scripts/lib/offline.mjs:42-47`) includes the effects worker and all four font subsets, and excludes
  maps and `.vite/manifest.json`. The page is stored last, and only when every file it names is cached
  (`pageStorable`). This prevents storing a newer page whose files aren't cached.
- **Fetch handling.** The page is network-first and matched ignoring the query; hashed files are
  cache-first; only GET requests, own origin, `/` or `/index.html` and `/assets/*` without a query are
  handled. Responses of type `basic`, not redirected, are cached only when ok. There's no `skipWaiting`
  or `clients.claim`, and nothing reloads the page. Scope is `/`.
- **INV-04.** `cacheKey` rejects `blob:`, `data:`, other origins, queries and other paths. The worker
  enforces this itself (`seedPlan`) rather than trusting the page. The stored page has no URL, and its
  key is `/`. The INV-04 e2e test checks the keys, the cache names and that the CSP header survives
  offline.
- **Embedded.** Registration and the cache live in the frame's partition, and AC1 passes embedded on
  both engines.
- **Shared files.** `main.tsx`, `env.d.ts`, `host/index.ts` (the stub that threw is removed),
  `offline.mjs` and `server.mjs` (`/__ctl/*`, connections dropped while down) have no regressions.
  `__TK_OFFLINE__` is false under Vitest and dev.
- **AC1 and F-018.AC10's offline half.** Both are solid: the server is down, every request is refused,
  the page is controlled by the worker, and the download is checked pixel by pixel.

## WebKit double download (~250 KB)
- The size is ~296 KB raw, or **~146 KB compressed** as Cloudflare serves it. It happens once per
  version and per partition (the seed skips cached keys, so an update fetches only changed files).
- **This is not an NFR-01 issue.** NFR-01 explicitly allows "the browser fetching the tool's own files
  into the offline cache", and these requests carry no user content. NFR-05's transfer budgets measure
  the page load, which is unchanged.
- **It may be a Playwright artifact.** Playwright's WebKit contexts are ephemeral (in-memory network
  cache), so the worker's `force-cache` may not see the page's entries. Check once in real Safari (Web
  Inspector → Network, with the cache enabled) before spending effort on it.
- **There's no cheap avoidance.** The first visit is not controlled, so passing files through the
  worker would need early registration plus a first-install `clients.claim()`. That changes ADR-0011
  and saves only the files loaded after the claim (fonts, the worker), not the JS and CSS. Recommendation:
  accept it and record it in the new ADR (below).

## Spec gaps

**1. F-017.R3 vs ADR-0011.** The current R3 ("used from the following open") contradicts the
network-first page that ADR-0011 chose: an online open fetches the new page and so runs the new
version immediately. The proposed R3 is **consistent with ADR-0011 and with AC3** (AC3 only asserts
the second open, which still holds) and **better for users**: fixes reach an online user on the next
open, and offline users keep the last complete version. Two wording fixes:
- In the glossary, **Session** means "from loading an image until it is replaced, cleared, or the page
  closes". So "every session using the old one has closed" says the wrong thing, and "offline worker"
  isn't a glossary term. Proposed: "**R3** A new version found while the tool opens with a connection is
  used from that open on; an open tool is never reloaded. Until every open copy of the old version has
  closed, they keep working unchanged; with no connection, the tool opens the last version whose files
  were all cached."
- Tighten AC3 so that it can fail: "…when the user opens it online, then the new version is used from
  that open; once its files are cached, opening it with no connection also uses the new version." Then
  update ADR-0011's wording, "adopted only from the next open", in the new ADR.

**2. Seeding after the effects worker starts, vs the `tk-assets` meta.** This needs a **new ADR
amending ADR-0011** (the same pattern as ADR-0021 and ADR-0022), not an edit or a note. The build
changes the decision itself, and it effectively adopts the "build-time precache manifest" that
ADR-0011 listed as a rejected alternative. The reason has also changed: ADR-0022's fresh worker per
image means the effects worker doesn't start at startup, so "seed after it starts" can't be met
without the list.
Proposed ADR (e.g. ADR-0024, "Offline seed list from the build"): the build lists every hashed file
in `<meta name="tk-assets">`; the page posts that list together with its resource entries; the worker
stores the page only when every file listed is cached; pruning happens per seed; the page is
network-first (R3 above); and the WebKit second fetch is accepted. Also update MOD-Build's
responsibility ("lists the build's hashed files for the offline seed"), and add a changelog line for
the R3 change if F-017 is `building`.
