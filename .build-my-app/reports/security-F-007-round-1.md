# Security & privacy review — F-007 (Redact), round 1

Scope: diff `build/m1...worktree-agent-ad774efa417fb260e` (commit 467f180). Paths are relative to the
worktree `.claude/worktrees/agent-ad774efa417fb260e`. Context: F-007, RULE-10, INV-02, ADR-0006,
ADR-0017, ADR-0022. Export (F-012) is not built yet, so this review covers the on-screen path and the model/worker path.

**Verdict: no blockers, no majors. 6 minor findings, plus the guarantees F-012, F-010 and F-008 must provide.**

## Verified OK
- **INV-02 box:** `redactionBox` (src/core/redaction.ts:20-26) uses floor/ceil on the normalised box. Float noise
  (e.g. 10.4 + 4.6 = 15.000…02) only makes the box bigger, which is safe. The renderer, the worker, the client key and the
  reference all use the same function or formula.
- **Solid:** `drawSolid` (src/render/index.ts:213) sets `globalAlpha = 1` and `source-over` explicitly and fills the
  integer box. At 1:1 with an integer translation, it has no antialiased edge.
- **Effects read only the frame:** `effectArea` gives O = B ∩ F and a window of O ± 3b, clamped to F (redaction.ts:50-62).
  `loadPremultiplied` reads only W (algorithms.ts:83). Box passes clamp to the window, which is exact per ADR-0006.
  The fast-check comparison with an independent reference covers fractional boxes, boxes partly outside the frame, solids
  and translucent pixels (tests/property/effects.reference.property.test.ts:71-90).
- **Solids applied before sampling:** solids are stamped into the source at α 255 before any pass (algorithms.ts:106-119).
  The cache key includes every solid that touches the read window, with its colour (client.ts:188-206), so moving or
  recolouring a solid makes the cached patch stale. `drawEffect` stamps every solid again over the patch
  (render/index.ts:262-267), so the solid shows whatever the order.
- **Transparent pixels:** premultiplying turns α = 0 into RGB 0, so colour hidden in fully transparent pixels can't
  leak through the blur.
- **No patch means no image:** `drawEffect` fills the box with the background first, so the original pixels under a blur
  are never shown, even before the worker answers (render/index.ts:243-253).
- **Worker lifetime:** each `setImage` first runs `clearImage`, which posts `drop`, calls `terminate`, clears the
  pending and in-flight jobs and the timers, and closes every cached bitmap (client.ts:136-173). `feedEffects` calls
  `clearImage` as soon as a new image loads (io/effects.ts:15). Late replies and late `toBitmap` results from a
  terminated worker are dropped, and their bitmaps closed, by an identity check (client.ts:328, 335).
- **Transfer and ownership:** the image buffer is transferred to the worker, so the main-thread copy is detached
  (client.ts:153), and the temporary OffscreenCanvas is sized to 0. Each patch is a fresh, exactly sized buffer that is
  transferred back (worker.ts:37-39). The worker's scratch buffers never leave it.
- **Nothing leaves the browser:** the diff has no `fetch`, XHR, beacon, Web Storage, IndexedDB or console logging, and no new
  dependencies. The worker is a same-origin module, allowed by `worker-src 'self'` with `connect-src 'none'`
  (public/_headers:4).
- **Labelling (RULE-10, F-007.R4):** the kind list tags Blur and Pixelate with COPY-redact.not_secure_short (an icon plus words,
  and part of the radio's accessible name). Picking either shows COPY-redact.not_secure inline, not in a dialog, with
  COPY-redact.use_solid (src/app/StylePanel.tsx:94-140). Solid is labelled "Solid (secure)". All of this is in en and vi.

## Blocker
None.

## Major
None.

## Minor

### m1. The instant approximation samples pixels under solids, and may sample pixels outside the frame (on screen only)
`src/effects/index.ts:35-55`. `approximate` first scales the **original** image down over O
(`drawImage(source, output…)`, line 49) and only then stamps the solids, at fractional, antialiased
coordinates on the small canvas (lines 50-53).
- **Under solids:** a small pixel that straddles a solid's edge averages original pixels from under the solid. The
  antialiased stamp then blends with that average, and scaling back up with smoothing (render/index.ts:255-260)
  spreads it outside the solid box, where the re-stamp doesn't reach. This breaks RULE-10/INV-02 ("never sample
  pixels under a solid") on screen while a redaction moves, for 100–250 ms after it stops, and **indefinitely if the
  exact job never returns** (see m2).
- **Outside the frame:** with smoothing on, the HTML spec lets `drawImage` filtering read source pixels outside the
  source rectangle, and Chromium does this when scaling down. After crop (F-010), cropped-out pixels could tint the
  preview at the frame edge.
- **Impact:** low. The leak is a b×b average that is partly covered and appears only on the user's own screen, which
  matters only when the screen is shared or recorded. It is not exported, because export waits for the exact patches
  (ADR-0006). There is no frame leak until F-010 lands.
- **Fix:** build the approximation from a 1:1 copy of O (or the window) that already has the solids stamped. For
  example, draw O at 1:1 into a scratch canvas clipped to O, `fillRect` the integer solid boxes, then scale that down.
  Or stamp the solids at integer source coordinates before scaling down. Add a unit test that the
  `approximate` request never reads outside `output` and that solids are applied before scaling.

### m2. A worker failure or a `failed` reply is never retried, and `exactPatches` never settles
`src/effects/client.ts:327-355, 361-387`. The client has no `error` or `messageerror` listener on the worker. If the
worker throws (for example, out of memory on a big window), `inflight` stays set forever, `pump` stops, and every
later exact job is blocked. A `failed` reply clears `inflight` but nothing asks again. A `toBitmap` rejection (line 334
has no `.catch`) is unhandled. In every case `exactPatches` waits forever, because its waiters run only when a patch
arrives or a new image is set.
- **Impact:** this fails safe for privacy, since nothing unredacted is shown. However, the approximation from m1 stays
  on screen, and F-012.R7 ("if the export can't be produced, the user is told") can't be met.
- **Fix:** handle `error`/`messageerror` (clear `inflight`, start a fresh worker with the retained image, or mark
  the effects as failed) and add `.catch` to `toBitmap`. Give `exactPatches` a rejection path, such as a failure flag
  and/or a timeout, so F-012 can show COPY-error.export_failed.

### m3. The worker trusts the frame to lie inside the image
`src/effects/algorithms.ts:83-90` (also `pixelate` at 334-335). Indexing is `((W.y + y) * img.width + W.x) * 4`, with
no check against `img.width`/`img.height`. A frame wider than the image reads the next row's pixels, which are
**outside the frame**. A frame past the bottom reads `undefined`, which becomes 0. Today the frame is always the whole
image (document/index.ts:188), and `clampFrame` is still `notImplemented` (core/index.ts:32).
- **Fix:** in `blur`/`pixelate`, intersect `frame` with `{0, 0, img.width, img.height}` and require integer values
  (return `null` → `failed` otherwise), or assert it in the worker. F-010 must keep RULE-13 (integer frame inside the image).

### m4. Narrow layout: when the sheet is closed, the active blur or pixelate kind is not shown at all
`src/app/drawing.ts:293-297`. The summary bar shows "Redact · Medium". It doesn't name the kind or carry the not-secure tag.
- **Impact:** a phone user who picked Blur, then closed the sheet, keeps drawing insecure redactions with no visible cue.
  RULE-10 is met literally, because the kind isn't "shown", but PRN-02 honesty is weaker here.
- **Fix (needs a spec decision):** include the kind in COPY-style.sheet_summary for redactions, with
  COPY-redact.not_secure_short for blur and pixelate.

### m5. `dragRange` is written and tested but not used yet
`src/canvas/drag.ts:182`. Canvas only passes `lo: n, hi: n - 1` (src/canvas/Canvas.tsx:395-396), which is correct
for drawing a new annotation on top. When moving or resizing a solid (F-008), the drag layers **must** use `dragRange`.
Otherwise a cached upper layer holds blur patches computed with the solid's old position, and the solid looks uncovered
during the drag (on screen only). This should be tracked as an F-008 must, not left as dead code.

### m6. `clearImage` keeps the previous image's `palette` and `shortSide`
`src/effects/client.ts:159-173`. These are not image data, so there is no leak. However, in the gap between
`clearImage` and `setImage` (up to 200 ms of idle), `spec()` still works and `exactPatches`' "wait for pixels" guard
(line 365) is skipped. This is harmless today: requests stay queued until `setImage`, which clears them and calls the
waiters again. **Fix:** reset `palette`/`shortSide`/`imageArea` in `clearImage` so the guard means what it says.

## Informational
- RULE-20 counts blur and pixelate as "redactions" (COPY-export.*_redactions). That follows the spec, but a
  "3 redactions" message can suggest that everything was hidden securely. Consider splitting the count by kind in a
  later spec revision.
- On screen, at fractional zoom and pan, a solid's edge and a blur's clip are antialiased against the image layer. Only
  screen pixels that straddle an edge are affected, with a sub-pixel blend. This is acceptable because it doesn't happen at 1:1 in the export.
- The F-007 e2e suite has no network-log assertion. F-001.AC15 and F-012.AC9 cover this elsewhere. Adding one to
  redact.spec.ts (draw a blur, wait for the exact patch, then assert no requests) would be cheap.

## What F-012 (export) must guarantee
1. It renders at scale 1 with an **integer** translation (−canvas.x, −canvas.y) on an sRGB canvas, so solid boxes and patches
   fall on whole pixels (F-007.AC3, AC11).
2. It uses **only** `exactPatches(doc)`, never `patchesFor` or the approximations, and passes no backdrop, so the transparent
   background clears (F-007.AC7, AC13).
3. A failure or timeout from `exactPatches` (see m2) shows COPY-error.export_failed (F-012.R7). It must never fall back to
   approximations or export with patches missing.
4. It draws `paint`'s redaction path unchanged: solids with `globalAlpha` 1, every solid stamped again over each patch, and
   effects that replace their box (not blend with it).
5. The PNG holds one IDAT image, with no ancillary chunks beyond what ADR-0007/ADR-0019 allow (F-007.AC7, INV-02). The export
   canvas is sized to 0 after encoding (ADR-0022).
6. Also for F-010: frames are integers and lie inside the image (m3). For F-008: moves and resizes use `dragRange` (m5).
   For "Start over" (COPY-action.clear): it must call `clearImage()` so the worker and the cached patches are freed.

## Data collected (store privacy declarations)
**None.** The image, its pixels in the worker, and the patch and approximation bitmaps live only in memory in the page and
its worker. They are freed when the image is replaced and gone when the tab closes. Nothing is sent over the network or
written to storage, and there are no logs, analytics or third-party SDKs. F-007 doesn't change this.
