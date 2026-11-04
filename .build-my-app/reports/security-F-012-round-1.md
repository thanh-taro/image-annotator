# Security & privacy review — F-012 (Copy and download the result), round 1

Scope: diff `build/m1...worktree-agent-a698ee9c879f0c719` (commit 32f7cb7). Paths are relative to the worktree
`.claude/worktrees/agent-a698ee9c879f0c719`. Context: F-012, INV-02, INV-03, RULE-10, RULE-15, RULE-16, ADR-0007,
ADR-0019, ADR-0021, security-F-007-round-1.md, and the build-plan notes for F-012. No code was changed.

**Verdict: no blockers. 1 major (an export that never ends; fails safe, no leak). 5 minor findings.**

## Verified OK
- **Exact patches only:** `renderPng` gets patches only from `exactPatches` (src/io/export.ts:62).
  `EffectsClient.exactPatches` reads only the `exact` map, never `approx` (src/effects/client.ts:433-458). A failed
  job, a worker `error`/`messageerror` or a `toBitmap` rejection makes it reject → `export_failed`
  (client.ts:172-179, 412-425). F-007 m2 is fixed apart from the hang in M1 below. The F-007 m1 approximation can't
  reach the export.
- **1:1 on whole pixels:** the canvas rect must be whole numbers, or the export fails (io/export.ts:56). `paint` uses
  `{scale:1, dx:-x, dy:-y}`, with no overlays, selection, backdrop or layer (io/export.ts:75). Solids use
  `redactionBox` (floor/ceil) with `globalAlpha=1` and `source-over` (render/index.ts:215-221). Effects fill B with
  the background first, then draw the patch and stamp the solids again (render/index.ts:241-279). If a patch were
  missing or empty, the area would show the background, never the image.
- **Nothing outside the canvas or frame:** the image is clipped to the frame, and its source rect is clamped to the
  frame (render/index.ts:546-555). Annotations are clipped to the canvas (render/index.ts:195-197), and the export
  canvas is exactly the canvas size. The frame is always the whole image until F-010 lands.
- **Failure means no file:** every error in `renderPng` is mapped to `ExportFailed`, and the canvas is freed in
  `finally` (io/export.ts:82-88). A download is made only from the stripped bytes. For a copy, the `ClipboardItem`
  holds a promise that rejects, so `write` rejects. Even if `write` resolves while production failed, the result is
  `export_failed` (io/export.ts:103-117). The session is marked exported only on `ok`, at the epoch taken when the
  export started (app/export.ts:73, 95-96; state.ts `exported` checks the session is the same one).
- **Chunk whitelist (ADR-0007 §3, ADR-0019):** only IHDR/PLTE/tRNS/IDAT/IEND are kept, each copied whole. The strip
  fails closed on: a bad signature, IHDR not first or not 13 bytes, a size mismatch, IEND not last, bytes after IEND,
  a bad CRC, a length past the end, IDAT chunks that are not consecutive, an unknown critical chunk, or wrong counts
  (src/core/export.ts:54-125). eXIf, tEXt, iTXt, zTXt, iCCP, tIME, sRGB, pHYs and acTL/fcTL/fdAT are dropped, so
  the result is a single image (no APNG). Unit tests cover truncation, bit flips, 2,000 random inputs and
  byte-identical output (tests/unit/core.export.test.ts).
- **Source metadata can't carry over:** the bytes are a fresh `toBlob` of a new sRGB canvas. Only the decoded
  bitmap's pixels reach it. The e2e test for a GPS/camera/date JPEG asserts IHDR/IDAT/IEND and that no needle is
  present (tests/e2e/export.spec.ts:231-241). For copies, the tool hands over the stripped bytes. Any WebKit
  `sRGB`/`eXIf` is the browser's own re-encoding, which INV-02 and ADR-0021 allow. The embedded e2e test checks the
  bytes the tool hands over (tests/e2e/host/export-embedded.spec.ts).
- **Clipboard:** a promised `ClipboardItem` is created synchronously in the gesture (io/export.ts:101-110). A
  missing API or a refusal → COPY-error.clipboard with the download action (F-012.R5). The tool only writes to the
  clipboard and never reads it here. The headers set `clipboard-write=(self)` and `clipboard-read=()`
  (public/_headers).
- **Host:** the only `postMessage` to the parent is still the ready signal (src/host/index.ts:93). No image data or
  file name goes to the host.
- **Object URL:** created after a successful strip, from the stripped bytes only. It is revoked at once on failure
  and 2 s after the click otherwise (io/export.ts:132-145).
- **Nothing leaves the browser:** the diff adds no fetch, XHR, beacon, storage, IndexedDB, caches, `console` or
  `innerHTML`, and no new dependency (`tests/support/png.ts` uses Node's built-in zlib, test only). `connect-src
  'none'` still applies. AC9 asserts that no request is made during copy and download.
- **Keys:** Mod+C defers to the browser when text is selected on the page, and Mod+S works while editing, as
  RULE-19 says (src/keys/index.ts:716-729). While a dialog is open nothing exports (app/exporter.ts:419).

## Blocker
None.

## Major

### M1. Exact-patch cache thrash: `exactPatches` never settles, the export hangs for good, and later exports are ignored
`src/effects/client.ts:397-402` (eviction) together with `:433-458` (`exactPatches`), and `src/app/export.ts:61-92`
(`busy`).
- **Cause:** the exact cache evicts its oldest entry once there are more than 48 patches or more than 2 image areas
  of pixels. `exactPatches` needs *all* patches of the document at once. Each new arrival evicts one the export
  already counted. `check()` then sees it missing and asks for it again, which evicts another, and so on.
- **Reproduced** with the client's unit harness (scratch test, not committed): three whole-frame effect redactions
  (blur M, blur S, pixelate) → 31 jobs sent in 30 answers, and the promise never settles. The same happens with
  more than 48 effect redactions, or effect boxes whose areas add up to more than 2 × the image.
- **Impact:** privacy is safe (nothing is exported), but F-012.R7 is broken. The user sees "Preparing image…"
  forever, while the worker keeps recomputing large blurs (CPU and battery). `busy` never resets, so every later
  Copy, Download, Mod+C and Mod+S does nothing for the rest of the session. The only way out is a reload, which loses
  the work: the opposite of PRN-03 and F-014. There is also no overall timeout, so a worker that hangs without
  crashing has the same effect.
- **Fix:**
  - Pin the patches an in-flight `exactPatches` has collected so they are not evicted: keep them in a local map in
    the waiter, or keep a per-export reference set that the eviction loop skips. If needed, let the budget be
    exceeded for the duration of the export (NFR-04 already allows the export canvas).
  - Add a timeout or failure path, for example no progress for N seconds, so the promise rejects with
    `export_failed`.
  - Make sure `busy` is cleared even then.
  - Add a unit test for the thrash case (3 × whole-frame effects) and for a worker that never replies.

## Minor

### m1. Patch bitmaps can be closed between `exactPatches` and `paint`
`src/io/export.ts:62-75`. After `exactPatches` resolves, `renderPng` awaits `assertFonts`. Meanwhile an on-screen
exact job (for example the user nudging another blur during the export) can evict and `close()` a bitmap the export
holds (client.ts:394, 401). `drawImage` of a closed ImageBitmap throws, so the export fails closed with
COPY-error.export_failed: a spurious failure, no leak. **Fix:** this is the same pinning as in M1, or await fonts
before `exactPatches` and paint in the same task.

### m2. Image replaced during an export: the export's waiters run against the new image's pixels
`src/effects/client.ts:186-204` with `exactPatches:433`. `clearImage` doesn't reject the waiters. After `setImage`,
the old export's `check()` computes keys from the *old* document's geometry but asks the worker, which now holds the
*new* image. The old bitmap was closed (state.ts:86), so `paint` throws and the export fails. Today this fails safe
only because of that `close()`. **Fix:** reject every pending `exactPatches` in `clearImage` (an image generation
id), and check `image.bitmap.width !== 0` again after the awaits in `renderPng`.

### m3. The download name passes the source name through unchanged
`src/core/export.ts:143-148`. `File.name` is a basename, so path traversal isn't possible, and browsers sanitise
`a.download` (separators, reserved characters). However:
- control and bidi characters (for example U+202E) and very long names reach the file name and the notice text
  (COPY-export.downloaded), so `x‮gnp.exe` displays misleadingly;
- a name like `.png` gives `.png-annotated.png`, which is a hidden file on Unix;
- the name shown in the notice may differ from the one the browser actually saves (sanitised, or with "(1)" added).

**Fix:**
- strip C0/C1 controls and bidi/format characters (`\p{Cc}\p{Cf}`) and `/\\:*?"<>|`;
- trim leading dots and whitespace;
- cap the base at about 200 characters;
- fall back to the timestamp name when nothing is left.

Add unit tests. Rendering is through Preact text nodes, so there is no XSS.

### m4. The export path paints the image with smoothing on
`src/render/index.ts:550` (`crisp=false` from `paint`, io/export.ts:75). At scale 1 with whole-pixel offsets,
bilinear sampling returns exact pixel values, so nothing outside the frame is mixed in today. As defence in depth for
F-010 (crop), where browsers can filter across the source-rect edge when smoothing is on, have the export paint with
`imageSmoothingEnabled=false`: pass `crisp` through `paint`, or set it in `renderPng`. Add the planned F-007.AC13
export test with a cropped frame next to high-contrast pixels outside it.

### m5. A download blocked by the host frame counts as success
`src/io/export.ts:133-146`. In a frame without `allow-downloads`, `a.click()` is blocked silently, but the result is
`ok`. The session is marked exported, which turns off the leave-page warning, and the notice says "Downloaded …".
The spec accepts this (F-012 edge case, RULE-16), so it is not a defect. Note it in the portal change request or QA
checklist as a data-loss risk if the portal ever drops the grant.

## Informational
- A 2 s revoke delay is enough on Chromium and WebKit, which resolve the blob when the download starts. Firefox
  should get a manual check with an export at the RULE-02 maximum size (part of the ADR-0014 release check).
- The source file name ends up in the downloaded file's name (RULE-15). That is intended, but it is the one piece of
  source information that leaves the editor. It isn't file metadata (INV-03 covers the contents).
- `REVOKE_DELAY_MS` and the object URL are reachable only from same-origin script. CSP `script-src 'self'` plus a
  hash keeps that set to the tool itself.

## Data collected (store privacy declarations)
**None collected or transmitted.** The export:
- reads the in-memory image and annotations;
- writes a PNG to the system clipboard (on user action);
- or hands a PNG file to the browser's downloads (on user action).

No network, analytics, identifiers or persistent storage are used, and no third-party SDK is involved. The source
file name is used locally to name the download. Permissions used: `clipboard-write` only; host frame grants:
`allow-downloads` and the clipboard-write allow (RULE-16).
