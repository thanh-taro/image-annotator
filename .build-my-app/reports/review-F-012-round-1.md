# Review F-012 (Copy and download the result), round 1

Diff `build/m1...worktree-agent-a698ee9c879f0c719` (32f7cb7). Paths are relative to the worktree
`.claude/worktrees/agent-a698ee9c879f0c719`. No code was changed for this review.

## Verdict
Nearly ready. The pipeline follows ADR-0007, 0019, 0021 and 0022 closely. It paints with the same `paint()` at
scale 1 on whole pixels, uses exact patches only with no preview fallback, has a fail-closed chunk whitelist,
creates the promised `ClipboardItem` in the gesture, and frees the canvas in `finally`. RULE-18 epochs are
correct. One major problem: the export can hang forever. There are a few minor ones.

## Blocker
None.

## Major

**M1. The export never finishes when the exact-patch cache evicts what it is waiting for.**
`src/effects/client.ts:398` (eviction), `src/effects/client.ts:433` (`exactPatches`), `src/io/export.ts:62`,
`src/app/export.ts:61-92` (`busy`).
- Scenario: three blur or pixelate redactions whose outputs add up to more than `CACHE_IMAGE_AREAS` (2) image
  areas (for example three blurs of about 70 % of the screenshot each), or more than `CACHE_LIMIT` (48) effect
  redactions. Then press Copy.
- What happens: the third patch evicts and closes the first. `check()` asks for the first again, which evicts
  the second, and so on. `exactPatches` never resolves or rejects, so:
  - COPY-export.preparing stays forever;
  - `busy` stays true, so every later copy or download is silently ignored until reload;
  - the session stays unexported.
  This breaks R7: the user is never told. In practice it breaks R1 and R2 too.
- Related: between `exactPatches` resolving and `paint()` (the `await assertFonts`), a screen job arriving can
  evict and `close()` a bitmap held in the export's map. That export then fails without a real cause.
- Fix:
  1. While an `exactPatches` call is pending, pin the keys it needs: never evict them, and release the pins
     when it settles. Or collect the export's patches outside the bounded cache.
  2. Add the time bound from gap 2 below as a safety net that turns any hang into `export_failed`.
  3. Add a unit test in `tests/unit/effects.client.test.ts`: three effects whose outputs total more than 2
     image areas, and `exactPatches` resolves with all three, none closed.

## Minor

**m1. A result from a replaced session still shows a notice.** `src/app/export.ts:94-104`.
- Scenario: the user has no unexported changes, presses Copy (which takes about 1 s at 14.7 MP), then pastes a
  new image while the copy runs.
- What happens: the new session starts and the old bitmap is closed, so `paint()` throws and
  COPY-error.export_failed appears over the new image. If the copy finished first, "Copied …" appears instead.
  `exported()` correctly records nothing.
- Fix: if `ports.current()?.session !== session` when the result arrives, show nothing, or at most clear the
  progress notice.

**m2. Clicking Download in the clipboard-error notice loses focus.** `src/app/NoticeView.tsx:61-62`.
- What happens: the notice is removed while its button has focus, so focus falls to `<body>`. Keyboard users
  lose their place, and screen readers announce nothing until the result.
- Fix: before `setNotice(null)`, move focus to the canvas region (or to the toolbar's Copy button).

**m3. The count fallback is untested and its measurement is unverified.** `src/app/ExportActions.tsx:17-72`,
`src/app/styles/export.css:42`.
- No test reaches the icon-and-number form.
- The probe is `position: absolute` with no positioned ancestor in the row. Whether it adds to the row's or the
  page's scroll width is engine-dependent, and at 320 px it sits by the right edge.
- Fix: add a test that forces the fallback in compact or narrow (vi-VN with 10 or more redactions, or a fixed
  width). It should assert the short form, `role="img"` with the full accessible name, and no horizontal
  scrollbar (F-018.R7). Consider measuring the full text with `measureText` instead of a DOM probe.

**m4. Nothing tests ADR-0022 (freeing the canvas) or the 2 s revoke.** `src/io/export.ts:66-90`,
`src/io/export.ts:145`.
- Neither is covered by a test, and `renderPng` and `downloadResult` have no unit test at all.
- Fix: add a unit test with a fake canvas and fake timers:
  - width and height are 0 after success, after a `toBlob(null)` and after a strip failure;
  - `revokeObjectURL` is not called before `REVOKE_DELAY_MS` and is called once after it;
  - it is called immediately when `click()` throws.
  The 2 s value is fine. The browser has read the blob URL by the time `click()` returns, and 2 s leaves room
  for WebKit's asynchronous start.

**m5. F-007.AC11 does not assert what the AC says.** `tests/e2e/redact.spec.ts:491`.
- Accepting column 9 or 10 is justified, because WebKit rounds the pointer to whole CSS pixels (x ≈ 9.1).
  The hard-edge check (column `first` fully black, `first-1` untouched) is the valuable part.
- But the AC says "pixel column 10 … entirely the redaction colour", and when `first` is 9 that is never
  checked.
- Fix: always assert `pngRegion(png, 10, 305, 1, 290)` is entirely black. On Chromium (fractional pointer
  coordinates) also require `first === 10`, so the floor of INV-02 is pinned on at least one engine.

**m6. F-015.AC9 grants the clipboard permission to every origin.** `tests/e2e/host/export-embedded.spec.ts:19`,
`:41`.
- This is acceptable. AC10 runs with the same global grant and still gets `NotAllowedError` without
  `allow="clipboard-write"`, so together they show the frame grant is what decides.
- Fix (cheap and tighter): grant only to the tool's origin, `grantPermissions([...], { origin: TOOL_ALLOWED })`.
  On Chromium, read the system clipboard back (`clipboardImage(frame)`) as AC1 does, because AC9 says "the
  clipboard holds the image". Recording the write does not show that.
- Real Chrome without Playwright's grant stays the headed QA check of ADR-0021.

**m7. The redaction-count pill differs from the design.** `src/app/ExportActions.tsx:50-61`.
- Every artboard (wide, embedded, narrow) shows the pill as a filled-bar icon followed by the text. The
  fallback uses the same filled-bar icon followed by the number (`SCR-Annotator_default_narrow-vi`).
- The build shows text only in the full form and uses `RectangleEllipsis` (the redact tool icon) in the
  fallback.
- Judgement: the tool icon is a reasonable choice, but use one icon in both forms. Either add the icon to the
  full form, or record the difference in `adapters/design.md` or as a token or icon decision. Keeping the tool
  icon is fine if it is recorded.

**m8. Hidden-file output name for dot-files.** `src/core/export.ts:146`.
- A source named `.png` or `.env.png` downloads as `.png-annotated.png` or `.env-annotated.png`, which are
  hidden on macOS and Linux.
- This follows the stated rule ("a leading dot is not an extension"), but the specs don't state that rule.
  See gap 1.

**m9. Duplicate `node:zlib` typings.** `tests/support/zlib.d.ts` and `tests/e2e/support/env.d.ts:33-36`.
- Fix: keep one.

## Checked, no finding
- **Canvas only, 1:1, whole pixels, same `paint()`:** `src/io/export.ts:54-75`. There are no overlays and no
  layer, and the origin is the canvas's top-left. F-002.AC7, F-005.AC7 and F-018.AC10 compare against the
  view.
- **Exact patches only:** a failed job rejects, so `export_failed` is reported (R7). There is no preview
  fallback.
- **Chunk whitelist:**
  - The promoted strip covers every ADR-0019 condition, plus the IHDR size check against the canvas.
  - Downloads are asserted IHDR/IDAT/IEND on both engines.
  - AC4 searches for Exif, GPS and date bytes.
- **Clipboard:**
  - The `ClipboardItem` is created synchronously in the click or keydown task, before any await (unit-tested).
  - A refusal leads to R5. A production failure while the write is refused correctly reports `export_failed`.
- **RULE-18:**
  - The epoch is read after `endTextEdit()`.
  - `markExported(at)` with the old epoch keeps an edit made during the export unexported (unit tests in
    document and app).
  - A replaced session records nothing.
- **Keys:**
  - Mod+S works everywhere, including in text fields and while a text is edited.
  - Mod+C stays the field's or the page's when text is selected.
  - Neither key acts while a dialog or menu is open.
  - Unit and e2e tests cover these.
- **Narrow overflow:** it is an APG-style menu, Esc returns focus, and an e2e test covers it.
- **Notices:**
  - All text goes through `t()` with COPY IDs, and the styles use tokens.
  - Progress shows after 0.5 s and is cleared before the result.
  - The error action uses COPY-action.download.
  - axe passes.
- **Network:** the export makes no requests (AC9).
- **Deferred ACs, now real tests:**
  - F-001.AC10;
  - F-002.AC7;
  - F-005.AC6, AC7, AC14 and AC15, decoded in Node against a reference;
  - F-007.AC3, AC7, AC9, AC10 and AC11 (see m5);
  - F-015.AC9 and AC10;
  - F-018.AC5, and AC10's download half.
  AC8 (F-008), the F-007 order cases, AC13 and F-018.AC10 offline remain named `fixme` placeholders, as
  planned. Coverage lint lists no F-012 AC.
- **Shared files:**
  - The `zoom-pan` tab-order change is correct: Download is now the last toolbar stop.
  - `keys.text` todo is resolved.
  - `server.mjs` `clipboard=0` is additive.
  - `markExported()` with no argument keeps its old behaviour.
  - No regressions found.

## Spec gaps (builder's)
1. **RULE-15, empty name without its extension, use the pasted-image name: accept.** Add the leading-dot
   rule too, so behaviour is not invented in code. Proposed RULE-15 addition: "The extension is the part after
   the last dot, unless that dot is the first character. If nothing is left, the pasted-image name is used."
   In practice the code can only reach the fallback with an empty `File.name`.
2. **F-012.R7, bound the wait for blur patches: yes, at 10 s.**
   - Inputs:
     - exact blur runs at 23–25 ms/MP (spike-blur), one job at a time;
     - the cache allows at most about 2 image areas of patches;
     - at the RULE-02 limit (16.7 MP) that is about 0.85 s of blur on the M3;
     - encoding takes up to 1.4 s on WebKit (spike-large-image, ADR-0022).
   - Worst case: about 2.3 s on the reference machine, and roughly 7–9 s on a machine 3–4× slower.
   - Recommendation:
     - bound only the patch-and-font wait (not `toBlob`, which can't be cancelled) at 10 s, as a named
       constant in MOD-IO;
     - count reaching it as `export_failed`;
     - put the wording in the F-012 edge cases and the MOD-IO note: "If the exact blur and pixelate
       effects are not ready within 10 s, the export counts as not produced (R7)."
   - The bound is a safety net (a hung worker, or pixels that never arrive). It does not replace the M1
     fix: without that fix the M1 scenario would always fail after 10 s.

## Design differences (builder's)
- **No "More actions" on wide and compact yet: accept.**
  - Its only items, clear (F-014) and shortcuts (F-013), aren't built, and an empty menu would be worse.
  - Add a build-plan note: F-013 and F-014 must add COPY-action.more on wide and compact, and move the overflow
    out of `ExportActions` into `Toolbar` (it is not an export control). The zoom-pan tab-order test will
    change again then.
- **Count fallback icon: accept with a record.** See m7: use one icon consistently in both forms.
- **The fallback never shows at 320 px yet: accept.**
  - Without undo and redo (F-009) the row fits "1 redaction".
  - The narrow vi-VN artboard shows the fallback because undo and redo are on that row.
  - The logic is still unverified (m3), so a forced test is needed now rather than when F-009 lands.
