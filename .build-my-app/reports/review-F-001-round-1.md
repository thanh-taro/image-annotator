# Review — F-001 Load an image, round 1

Branch `worktree-agent-a62c1c9ee658ac29c` (b1c7bf3, ef8e1b8) vs `build/m1`. Specs: F-001, RULE-01/02/03/11/12/14/18/19, ADR-0005, ADR-0008, ADR-0016, ADR-0018, MOD-IO/Document/Render/Canvas/Core.

**Verdict: approve after the four majors.** No blockers. Unit tests (87) and `tsc` pass.

What is sound: the check order (size, then magic bytes, then decode, then limits, then scale-down, then replace confirmation); the HEIC refusal by brand (the e2e runs on WebKit, per ADR-0018); `scaleDownSize` (6000 × 3400 gives 5441 × 3083, with a float guard); bitmaps are closed on cancel, on scale-down and on replace; the RULE-18 epoch (export, undo, redo stays unexported); the `busy` and dialog guards against a second paste or drop; the clipboard is read only from `paste` `clipboardData`, with `image/*` file items only; no `innerHTML`, `fetch` or object URLs; icons are built from static strings; filenames are never shown; `paint`/`paintBase` are imported from MOD-Core only; module boundaries hold.

## Major

### M1 — History records a stale "selection before", so undo restores the wrong selection (F-009.R3)
`src/document/index.ts:303-321`
- **Scenario:** draw A, which records `selectionAfter=[A]`. Then click B; selection is MOD-App state and isn't a step. Then delete B, and `apply` records `selectionBefore = current = [A]`. Undo restores B but selects A. F-009.R3 requires the selection that went with the change.
- The same blind spot breaks ADR-0008 §3: "any other command (including undo, selection or tool change) breaks the [coalescing] chain". History never hears about selection or tool changes, so F-009 has nothing to break the chain with.
- **Fix:** add `History.noteSelection(sel)` (or `breakChain()`), which MOD-App calls whenever the selection or tool signal changes. It sets `current` and clears the coalescing key. Alternatively, change `apply(op, { before, after }, coalesceKey?)`. Add a unit test for this scenario now, because this API is what F-003 to F-011 build on.

### M2 — Session changes aren't observable, so the canvas won't repaint after an edit
- **Where:** `src/app/state.ts:15` holds `loaded = signal({ image, session })`. `Shell.tsx` reads `current.session.doc`, which is a mutable getter.
- **Scenario:** `session.history.apply/undo/redo` replaces `doc` inside the same `Session` object, so no signal fires and `<Canvas doc>` keeps the old document. ADR-0008 §6 specifies `doc` and `history` signals, plus computed `unexported` (F-014 needs that to be reactive too).
- **Fix:** in MOD-App, keep `doc = signal<Doc>` and `epoch = signal(0)`, or use one `sessionVersion` signal. A single `commit(restore)` helper sets them from every `Restore`, and `unexported` becomes a `computed`. Keep MOD-Document free of DOM and signals, as it is now. Do this before F-003 so each drawing feature doesn't invent its own path.

### M3 — Parallel builders collide on fixed ports, and the default config can silently test another worktree's build
- **Where:** `tests/e2e/support/urls.ts:6-11` fixes ports 4290–4293. `playwright.config.ts` uses 4173 with `reuseExistingServer: !CI`, and `pnpm preview --port` has no `--strictPort`.
- **Scenario A:** two builders run `pnpm test:e2e:host`. The second fails with EADDRINUSE, or it attaches to the other worktree's `dist-e2e` server and tests the wrong code.
- **Scenario B:** builder 2's `pnpm test:e2e` finds builder 1's preview on 4173 and reuses it, so the tests pass against the wrong build. If 4173 is busy, Vite also falls back to 4174, but Playwright waits on 4173.
- **Fix:**
  1. In `urls.ts`, read the base from `E2E_HOST_PORT_BASE`. Otherwise derive it per worktree: `20000 + (hash(repoRoot) % 2000) * 4`. That range is above WebKit's blocked-port list (all ≤ 10080), so the reason the 429x range was chosen still holds.
  2. Build `HOST_ALLOWED` and the others, `PORTS`, and the `HOST_ORIGINS` passed to the `dist-e2e` build in `global-setup.ts` from that one value.
  3. Set the same variable at the top of `playwright.host-offline.config.ts` so workers inherit it.
  4. In the default config, derive `PORT` the same way (`E2E_PORT` still overrides). Use `pnpm preview --port ${PORT} --strictPort`, and `reuseExistingServer: !!process.env.E2E_REUSE`.
  5. Update the tables in `docs/local-dev.md` and `adapters/tests.md`.

### M4 — A small file with huge dimensions is fully decoded before RULE-02 is checked (proposes a spec change)
`src/io/decode.ts:445-453`
- **Scenario:** the user has unexported annotations and drops a 2 MB PNG of 40000 × 40000 (a decompression bomb, or simply a big flat scan). `createImageBitmap` tries to allocate about 6.4 GB. The tab crashes or hits OOM, and the work is lost. D-024 assumed the engine would *reject* such a file (giving `decode_failed`), but a crash is not that outcome. MOD-IO also says RULE-02 is "never left to the browser". The accepted 6000 × 3400 path also keeps two bitmaps alive at once (the full one, then the resized one).
- **Fix (needs a new ADR that amends ADR-0005):**
  - Read the width and height from the sniffed header for each format: PNG IHDR, GIF LSD, BMP header, WebP VP8/VP8L/VP8X, and the JPEG SOFn scan (needs more than 64 bytes; read up to 64 KB).
  - Refuse or offer the scale-down **before** decoding, and decode once with `resizeWidth/resizeHeight`.
  - Swap the dimensions for EXIF orientations 5–8, or let a spike confirm the resize-after-orientation semantics on both engines.
  - Until then, record it as a known risk in the build plan.

## Minor

### m1 — The "Image opened" announcement is lost when COPY-load.first_only follows
`src/app/state.ts:37-46` and `loader.ts:52-53`. `announce(polite, loaded)` schedules a 50 ms write. `notify(firstOnly)` then calls `announce(polite, …)`, which clears that timer. AC12 users hear only "Opened the first image only."
- **Fix:** queue the polite messages, or join the two into one announcement.

### m2 — Mod+O while a dialog is open reaches the browser
`src/app/loader.ts:85`: the guard `if (dialog.value || isEditingText) return` comes before `preventDefault`. On Windows and Linux, Chromium's Ctrl+O then opens the browser's own "Open file" dialog, and picking a file navigates the tab away mid-confirmation. RULE-19 keeps Load keys from the browser within scope, and only Esc acts in a dialog.
- **Fix:** call `preventDefault()` when a dialog is open, and do nothing else.

### m3 — `openImage` ignores `busy`
`loader.ts:92`. During a slow decode, Open (or Mod+O) still opens the picker. The chosen file is then silently dropped by the `file` guard.
- **Fix:** export `isBusy()` and check it in `openImage` and `onKeyDown`.

### m4 — A no-op `apply` still counts as a step and marks the session unexported
`document/index.ts:313`. When `op(doc) === doc` (for example a restyle to the same value, or a zero nudge), it still pushes a step and bumps the epoch. That breaks RULE-18 and F-014 ("a completed change").
- **Fix:** `if (after === doc) return { doc, selection }` without a step. Add a unit test.

### m5 — Canvas edge cases
`src/canvas/Canvas.tsx`
- **(a)** `loader.replace` closes the old bitmap synchronously, but the old effect's `ResizeObserver` stays connected until Preact's after-paint effect pass. A resize in that frame calls `drawImage` on a closed bitmap, which throws `InvalidStateError`.
  - **Fix:** close the previous bitmap in a microtask or after the next effect, or skip painting when `image.width === 0`.
- **(b)** A device-pixel-ratio change, for example moving the window to another monitor, doesn't rebuild the layer, but ADR-0016 lists DPR as an input. `ResizeObserver` doesn't fire for it.
  - **Fix:** add a `matchMedia('(resolution: …dppx)')` listener, or leave it for F-002's rAF loop and note it there.

### m6 — Source-name rule lives in MOD-App, and two paste/edit helpers diverge
`loader.ts:25-29` (`forPaste`, `withoutSourceName`).
- **Source name:** MOD-IO owns "records the source name only for picked or dropped files". **Fix:** have `onImageInput` pass `sourceName` (null for paste) and `decodeInput(file, sourceName)` use it. Then delete `forPaste` and `withoutSourceName`.
- **Duplicate helpers:** `isEditing` (`io/input.ts:593`) and `isEditingText` (`loader.ts:73`) disagree about `file` and `submit` inputs. Keep one, in MOD-IO now and MOD-Keys later.
- **Simpler result type:** the `too_large` variant is `ok: false` but carries a usable image. `{ ok: true, image, scaleDownOffer? }` would remove a branch in `load.ts`.

### m7 — `paintBase` drifts from MOD-Render's spec
`src/render/index.ts:753`. The spec signature has `view` as a parameter, but here it is optional. ADR-0016 says the layer includes the "screen-only surround", but this leaves the surround transparent so the CSS background shows through, and it adds an outline the spec doesn't mention.
- **Fix:** either make `view` required and paint the surround from it, or update MOD-Render and ADR-0016's wording through a spec change (surround = CSS, plus outline). Don't leave the two silently different.

### m8 — Test gaps
- **AC10** (`tests/unit/app.load.test.ts:43`) uses a fresh session that was never edited, so it doesn't test "just exported". **Fix:** apply a step, call `markExported()`, then load.
- **NFR-04:** nothing checks that the previous bitmap is closed on replace (`loader.ts:53`). **Fix:** extract `replace` into a testable function, or add an e2e check through a test hook.
- **Untested edge cases:**
  - input ignored while busy or while a dialog is open;
  - a drop of folders only gives `unsupported_format`;
  - a clipboard with an image and text uses the image;
  - a transparent PNG shows the checkerboard.

  All of these are cheap with the existing helpers. Note that `DataTransfer.items.add` can't add folders, so cover the folders case with a unit test of `droppedFiles`.
- **AC9, AC10 and AC14** have unit tests only (fakes). Add them to the build plan's "Deferred acceptance criteria" table (needs F-003 and F-012) so they get e2e tests later.
- **Real Mod+V on WebKit** is never exercised; only a synthetic `paste` is. Add it to the M-1 manual-check list (Safari, paste with nothing editable focused).

### m9 — Spec question: "first image" vs "first file"
`io/input.ts:667-669` uses the first dropped *file*. RULE-01 says "only the first **image** is used". If the user drops `report.pdf` and then `shot.png`, the code refuses with `unsupported_format`.
- **Fix:** decide this in the spec (RULE-01 or MOD-IO). If "first image" is meant, try the files in order until one passes the sniff.

---

# Round 2

Commit 0987e1b on `build/m1` 2ccf68d (ADR-0023 and the new multi-file edge case). The MOD-Render outline edit is uncommitted in the main checkout.

**Verdict: approve.** No blockers or majors remain. The three new minors below can go into the next feature's commit.

**Checks:**
- `pnpm check:full` passes (all 11 steps): unit 111 of 111, spec lint 0 errors, default e2e 58 of 58 and host e2e 42 of 42, on Chromium and WebKit.
- I checked one more thing by hand: a 6000 × 3400 quadrant JPEG with EXIF orientation 6, decoded with `createImageBitmap(..., { imageOrientation: 'from-image', resizeWidth: 5441, resizeHeight: 3083 })`, comes out upright with the correct quadrants on **both** engines. So the browsers orient first and resize after, as ADR-0023 §2 assumes.

## Round-1 findings

| Finding | Status | Notes |
|---|---|---|
| M1 selection before / coalescing | Resolved | `noteSelection`, `breakChain`, coalescing by key; undo and redo break the chain; tests for F-009.R3 and coalescing |
| M2 observable session | Resolved | `doc` and `version` signals, `commit()`, `exported()`, computed `unexported`; Shell reads `doc` |
| M3 ports | Resolved | `tests/e2e/support/ports.ts`: FNV hash of the worktree path. Preview port 30000–31999, host ports 20000–27996, both outside WebKit's blocked list and the OS ephemeral ranges. `--strictPort`, opt-in reuse; the env is set in the host config so workers inherit it. `dist-e2e` is rebuilt each run, so the baked `HOST_ORIGINS` always match. Docs updated |
| M4 huge dimensions | Resolved | ADR-0023 is implemented: header read, scale-down asked before decode, one resized decode, lying-header re-check. There is a residual risk, accepted in ADR-0023 §4 and its Consequences: an unparseable header, for example a JPEG whose SOF lies beyond 256 KB, still decodes in full |
| m1 lost announcement | Resolved | The polite region is now a short queue |
| m2 Mod+O in a dialog | Resolved | Prevented while a dialog is open or a load is running |
| m3 open while busy | Resolved | |
| m4 no-op step | Resolved | |
| m5 closed bitmap and DPR | Resolved | 0 × 0 guard; `matchMedia` resolution watcher |
| m6 source name and helpers | Resolved | `sourceName` comes from MOD-IO; one `isEditing`; `Oversize` result |
| m7 `paintBase` | Resolved | `view` is required and paints the surround and outline. The spec now matches, but that spec edit is still uncommitted: commit it with this merge |
| m8 test gaps | Resolved | AC10 after an export; bitmap closed on a new session; edge cases tested end to end; AC9, AC10 and AC14 e2e added to the build plan's deferred table |
| m9 first image vs first file | Resolved | In the spec (F-001 edge case) and in `loadFile`'s loop |

## Header parser (`src/core/header.ts`)

**Bounds:** every read goes through `?? 0` helpers, so nothing reads out of range. The JPEG walker guards zero lengths, fill bytes, RST markers and SOS/EOI, and checks `at + 9` before SOF. The EXIF IFD and its entries are bounded by the segment end. `size()` rejects 0 and negatives, which covers a signed BMP width and VP8 dimensions of 0. The VP8, VP8L and VP8X bit layouts are correct.

**Lying headers:**
- If the header claims a small size but the image is huge, the bitmap's real size is re-checked, the bitmap is closed, and the scale-down is offered (tested).
- If the header claims a huge size but the image is small: see n3.

## New minor findings

### n1 — The rotated scale-down e2e can't detect the bug it guards against
`tests/e2e/load.spec.ts:347` and `tests/fixtures/make-fixtures.sh` (`large-rot6.jpg`).
- **Problem:** the fixture is one flat colour, and the size check reads `bitmap.width/height`, which equal `resizeWidth/Height` whatever the order of orientation and resize. A squashed, sideways image would still pass. This path is common: 48 MP phone portraits are over RULE-02 and carry orientation 6.
- **Fix:** generate the fixture from the four-quadrant pattern (as in `fmt.png`, scaled to 6000 × 3400, then `-rotate -90` plus EXIF 6). Assert the four quadrant colours, as the AC8 test does. I confirmed by hand that both engines pass this today.

### n2 — An export doesn't break the coalescing chain
`src/document/index.ts`, `markExported`.
- **Scenario:** nudge, copy, nudge. The second nudge merges into the first step. One undo then jumps past the exported state, and ADR-0008 §3 says any other command breaks the chain.
- **Fix:** set `chain = undefined` in `markExported`. It is in the same closure. Add a test for nudge, export, nudge, then undo.

### n3 — The AVIF `ispe` scan runs over the whole 256 KB, including `mdat`
`src/core/header.ts:117-131`.
- **Problem:** compressed pixel data can contain the bytes `ispe`, and the "largest wins" rule would then take a random size. The result is a bogus scale-down offer, and on acceptance the image is resized to the wrong aspect ratio. The same distortion happens with any crafted header that claims an over-limit size for a small image. `scaleDown` can't detect this, because it never sees the real size.
- **Fix:** walk the boxes properly: `meta`, then `iprp`, then `ipco`, then `ispe`/`irot`. Or, simpler, stop scanning at the first `mdat` box header. For crafted files in general, accept the risk; it is self-inflicted and leaves the session unchanged until the user confirms.
