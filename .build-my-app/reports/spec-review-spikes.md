# Spec review — post-spike changes (2026-11-02)

Scope: RULE-08 (NFC sentence), F-014 (WebKit edge case, D-028), F-015 (R7, AC10, paste edge case),
ADR-0016…ADR-0021, appended notes in MOD-Canvas / MOD-Render / MOD-Core, changelog 2026-11-02 entries.

**Lint:** `python3 tools/spec_lint.py` → 562 IDs, 2128 references, **0 errors, 0 warnings**.

## Verdicts
| Item | Verdict |
|---|---|
| RULE-08 | ready after fixes (M3: F-005 has no AC for it; M4: ADR-0020 misses one input path) |
| F-014 | ready after minor fixes (M5) |
| F-015 | ready after minor fixes (m1, m2) |
| ADR-0016 + MOD-Canvas/MOD-Render notes | ready after fixes (M1, M2, m3) |
| ADR-0017 | ready after fixes (M7, m6) |
| ADR-0018 | ready |
| ADR-0019 + MOD-Core note | ready after minor fixes (m5) |
| ADR-0020 + MOD-Core note | ready after fixes (M4, m4) |
| ADR-0021 | ready after fixes (M6, M8) |
| Changelog | ready after minor fixes (m7) |

No blockers.

## Major

**M1 — The image layer's content and rebuild triggers are underspecified, so the screen goes stale.**
`specs/40-technical/adr/ADR-0016-display-image-layer.md:17-20`, `modules/MOD-Canvas.md:42`, `modules/MOD-Render.md:35`.
The layer is "the surround plus the image" and is rebuilt "only when zoom, pan or the canvas size changes" (MOD-Canvas: "zoom, pan or resize").
ADR-0004 item 2 draws the **background** first, then the image clipped to the frame. The checkerboard behind transparent pixels has to sit under the image too. Read literally, `paint` with a layer either draws the background over the image or leaves it out.
The trigger list also misses several changes that alter the layer without changing the canvas size:
- a background colour change (RULE-14, an undo step)
- a frame move at the same size
- entering or leaving the crop view (whole image, no clip)
- an image load or undo/redo of a frame change
- a theme change (the surround colour)
- a device pixel ratio change
- a viewport resize

Fix: in ADR-0016 Decision, replace bullets 2–3 with:
> "`paintBase` draws exactly ADR-0004 scene steps 1–2 (the background over the canvas, then the image clipped to the frame; in the crop view, the whole image with no clip) plus the screen-only surround and checkerboard under them. `paint(…, layer)` copies the layer and skips those steps. The layer is rebuilt whenever its inputs change: zoom, pan, viewport size, device pixel ratio, theme, image, frame, padding or background, and crop view on/off."

Align the MOD-Canvas and MOD-Render notes with that list.

**M2 — The "4 px" rule contradicts RULE-05 and RULE-11.**
`ADR-0016:44-45`, `MOD-Canvas.md:42` ("Clicks under 4 screen px record no undo step").
RULE-05 says a drag under 4 px with a drawing tool **is a click that places an annotation**, and RULE-11 makes that creation an undo step. Read literally, the note stops click-to-place from recording a step.
"Moves under 4 px are dropped" is also user-visible behaviour that no rule states. At 10 % zoom it drops pointer moves of up to about 40 image px.
Fix: replace the MOD-Canvas sentence (and the ADR-0016 bullet) with:
> "With the select tool (or Alt+drag), a press on an annotation or handle that moves under 4 screen px is a selection click, not a move or resize, and records no undo step; once the pointer passes 4 px, the move follows from the press point. Drawing tools follow RULE-05."

Add the same sentence to RULE-05 so the behaviour lives in the domain layer.

**M3 — RULE-08's new NFC behaviour has no acceptance criterion.**
`specs/10-domain/rules.md:15`; `specs/20-features/F-005-text.md` (AC8 and AC14 don't cover it).
Fix: add to F-005:
> "**AC15** Given a text being edited, when the user pastes 'Đ', 'u', U+031B, 'o', U+031B, U+0300, 'n', 'g' (decomposed), then the text holds 'Đường' as 5 characters, and in the export every letter is drawn in the tool's own typeface. (R2, R5)"

Add the length case:
> "Given a text holding 1,999 characters, when the user pastes 'e' + U+0302 + U+0301, then 'ế' is kept and the text holds 2,000 characters."

**M4 — Per-insert NFC misses combining marks typed after the base letter, and composition.**
`ADR-0020:18-21`.
Normalising only the *inserted* string leaves a lone combining mark undecomposed when it is typed after an existing base letter. The Windows Vietnamese layout types tone marks this way. RULE-08 then fails for typed text, and glyphs fall back to another face until the edit ends.
`insertCompositionText` is not cancelable, and the ADR doesn't say how NFC applies during or after input-method composition.
Fix: replace the first Decision bullet with:
> "On `beforeinput` (and at `compositionend` for composed input), CMP-TextEditor normalises the inserted text **together with the preceding characters back to the last starter** (the last code point that does not combine with what comes before it). It replaces that range with `execCommand('insertText')`, so native undo keeps working and the caret ends after the inserted text. The 2,000 limit is checked on the normalised result."

**M5 — F-014.AC7 and the Scope line are false on a supported engine.**
`F-014-unexported-warning.md:26-27, 41, 49`.
NFR-07 supports WebKit-based browsers, but AC7 has no qualifier, and the Out line still says closing the tab "still warns when the host frame allows leave-page dialogs".
Fix: change AC7 to:
> "Given the tool embedded in a host frame that allows leave-page dialogs, **in a browser that shows them from an embedded page (ADR-0021)**, with unexported changes, when the user closes the tab, then the browser asks whether to leave. (R1)"

Change Scope Out's last sentence to:
> "Closing or reloading the tab still warns when the host frame allows leave-page dialogs, except in browsers that never show them from an embedded page (edge case, D-028)."

**M6 — Copies on WebKit contradict INV-02.**
`ADR-0021:20-24` vs `specs/10-domain/model.md:62-68` and `F-007.AC7` ("no extra data blocks"). INV-04 counts the clipboard copy as an export.
ADR-0021 argues that INV-03 holds but doesn't address INV-02. WebKit's re-encoded clipboard PNG carries `sRGB` and `eXIf` data blocks, which INV-02 forbids, and the tool can't prevent them.
Fix: amend INV-02's last sentence to:
> "The file the tool produces (the download, and the image it hands to the clipboard) holds exactly one flattened picture: no extra frames, layers, thumbnails or data blocks (PRN-02). A browser may re-encode a clipboard copy and add colour-space or size tags; these carry nothing from the source (INV-03)."

Note in F-012 Edge cases that a copy on some browsers is re-encoded by the browser (ADR-0021).

**M7 — ADR-0017's scheduling has no owning module.**
`ADR-0017:20-23`.
No module note records:
- the rule that no exact job is sent while a redaction (or a solid it depends on) moves, with one job queued on release or after about 100 ms idle
- the SWAR implementation
- buffer reuse

`MOD-Effects.md` says the client "sends jobs" with latest-wins, which would still send a job every frame (the case that failed at 429 ms).
Fix: append to MOD-Effects:
> "SP-blur outcome (ADR-0017): the main-thread client sends no job for a redaction while it, or a solid it depends on, is being dragged; it queues one job on release or after 100 ms without movement. The worker uses the packed (SWAR) blur for b ≤ 128 and reuses its window buffers."

Replace "about 100 ms" with a fixed 100 ms so it can be tested.

**M8 — Storage partitioning changes what F-017 promises.**
`ADR-0021:29-30` ("Embedded storage is partitioned, so the frame keeps its own cache") vs `F-017.R1/AC1` ("after one visit … embedded or standalone").
A standalone visit does not make the embedded tool work offline, and the reverse is also true. A builder or tester would read AC1 as covering both.
Fix: in F-017 R1, insert "in the same way (embedded in the portal, or standalone)" after "with a connection". Change AC1's Given to:
> "Given the tool was opened once online in the same way (embedded or standalone)…"

Add the edge case:
> "Opened standalone once, then embedded offline for the first time → not available offline (each way keeps its own copy, ADR-0021)."

## Minor

**m1 — Neutrality and "one fact, one place".** `F-015:33`, `F-014:49`.
Engine names now sit in the feature layer. NFR-07 already uses engine families, so this is tolerable, but the same WebKit fact appears in F-015.R7, F-014's edge case and ADR-0021.
Fix: change F-015.R7's last sentence to:
> "Some browsers never show the leave-page warning from an embedded tool (F-014 edge case, D-028), and some allow clipboard writing without the grant (AC10); ADR-0021 lists which."

Change F-014's edge case to begin:
> "Embedded in a browser that never shows leave-page dialogs from an embedded page (ADR-0021: WebKit-based) → …"

**m2 — Testability and neighbours of F-015.AC10.** `F-015:45`.
"A browser that enforces that grant" doesn't say which one. Append "(ADR-0021)".
F-012's edge case (`F-012-export.md:60`, "host hasn't granted clipboard writing → R5 applies") and `platform-mapping.md:42` ("Needs … `clipboard-write` in the frame") are now false on WebKit. Add "in browsers that enforce the grant (ADR-0021)" to both.
F-015's paste edge case says "until the user clicks". Keyboard users can also Tab into the frame, so use "until focus moves into the tool (a click, or Tab from the host)".

**m3 — The `paint` signature differs in three places.**
- ADR-0004: `paint(ctx, doc, transform, patches, overlays?)`
- ADR-0016: `paint(ctx, doc, transform, patches, overlays, layer)`
- MOD-Render: `paint(ctx, doc, image, transform, patches, overlays?)`

Fix: make MOD-Render's Public surface the single source:
> "`paint(ctx, doc, image, transform, patches, overlays?, layer?)`; `paintBase(ctx, doc, image, transform, view)`"

ADR-0016 then refers to it without repeating the parameters.

**m4 — Vague builder values in ADR-0020.** `ADR-0020:27-28`.
"About 0.2 em of extra height" isn't exact. Use "extra height of 0.2 × size (CSS px × zoom)".
The ADR also doesn't say whether the text box used for hit-testing and selection (RULE-08 "fits the content") is lines × 1.25 × size or the glyph extent. With ascent plus descent at 1.366 em, glyphs overflow the line box by 0.058 em top and bottom. Fix: "The text box is lines × line height; glyph overflow is not part of the box."
MOD-Core's Implements list lacks RULE-08, and its Public surface lacks `toNFC`.

**m5 — The WebKit export test fallback weakens transparency checks.** `ADR-0019:22-24`.
"Or compare only opaque pixels when decoding in WebKit" lets RULE-15 (transparent areas stay transparent) and F-011's transparent background go untested on WebKit.
Fix: "Export pixel tests decode the PNG outside the browser. Decoding in WebKit is allowed only for assertions about opaque pixels."

**m6 — ADR-0017 records Chromium preview fps below target as passed.** `ADR-0017:31, 42`.
Chromium measured 54–58 fps against the 60 fps of NFR-02.
Fix: state the condition and its fallback:
> "If the headed Chromium QA run is below 60 fps, the WebGL approximation (ADR-0006 escape hatch) is adopted by a new ADR."

**m7 — Unverified claim, and "dropped" text.**
F-014's edge case says "standalone, the warning works in every supported browser", but SP-host tested only frames. Drop the claim, or cite AC1 run on both engines.
RULE-08 and ADR-0020 say "dropped" text, but no feature defines dropping text into a text being edited. CMP-DropOverlay reacts to files only, and a document-level drop handler may block text drops. Either add to the F-005 edge cases "Dropping text onto a text being edited inserts it as plain text (as a paste)", or remove "dropped".

**m8 — SP-large-image is still open.**
ADR-0016's 20 MB layer "counts towards NFR-04", but `.build-my-app/reports/spike-large-image.md` has no recorded outcome and no ADR or changelog entry. Add a line to ADR-0016's Consequences: "Confirmed against NFR-04 by SP-large-image (pending)."

---

# Round 2 (2026-11-02)

Scope: the round-1 fixes, ADR-0022 (SP-large-image) and the last two changelog entries.

**Lint:** `python3 tools/spec_lint.py` → 564 IDs, 2183 references, **0 errors, 0 warnings**.

## Round-1 findings
| ID | Status | Note |
|---|---|---|
| M1 | resolved | ADR-0016:17-24 and MOD-Canvas:42 list the layer's content and every rebuild input |
| M2 | **partly open** | RULE-05 now has the select-tool sentence. The Alt+drag case from the suggested wording was left out, and no acceptance criterion was added (see N3, N4) |
| M3 | resolved | F-005.AC15 and the text-drop edge case |
| M4 | resolved | ADR-0020:18-24 |
| M5 | resolved | F-014.AC7, Scope, edge case |
| M6 | resolved in INV-02 and F-012:61 | F-007.AC7 still conflicts (n1) |
| M7 | resolved | MOD-Effects:34; fixed 100 ms in ADR-0017:22 |
| M8 | resolved | F-017.R1, AC1; ADR-0021:30 |
| m1, m2, m5, m6, m7, m8 | resolved | |
| m3 | resolved | MOD-Render:27 is the single source. ADR-0004:22 keeps the old signature, but ADR-0016:21 overrides it |
| m4 | **partly open** | the ADR-0020 values are fixed and `toNFC` is in MOD-Core:39, but MOD-Core "Implements" (:42-45) still lacks RULE-08 (n7) |

## Verdicts
| Item | Verdict |
|---|---|
| RULE-05 / F-008 | ready after fixes (N3, N4, n2) |
| INV-02 / F-007 / F-012 | ready after minor fixes (n1) |
| ADR-0022 + module notes | ready after fixes (N1, N2, n4, n5, n8) |
| ADR-0016 | ready after minor fixes (n3) |
| architecture.md | ready after minor fixes (n6) |
| All other round-1 items | ready |

No blockers.

## Major

**N1 — ADR-0022 doesn't say how annotations are split between the drag layers.**
`specs/40-technical/adr/ADR-0022-large-image-findings.md:16-19`, `modules/MOD-Canvas.md:42`.
"Below the dragged ones" and "above" are undefined in three cases, and each leads to a wrong screen during a drag:
- **Interleaved selection.** A multi-selection can have unselected annotations between its members in drawing order (F-008.R2). If those go in either cached layer, painter's order changes on screen.
- **Solid over blur.** RULE-10 and INV-02 say a solid shows over a blur or pixelate whatever their order. If a solid is dragged under a blur cached in the upper layer, the blur patch covers the solid's new position.
- **Inputs that change mid-drag.** Mod+wheel zoom, the view scrolling to keep the selection visible (RULE-19), a theme or dpr change: the drag layers are built once at drag start, and ADR-0016's rebuild list only covers the image layer.

Fix: replace the first Decision bullet with:
> "When a move or resize starts, MOD-Canvas caches, over the image layer, every annotation below the lowest dragged one (lower layer) and every annotation above the highest dragged one (upper layer). Each frame copies the lower layer, draws the dragged annotations and any undragged ones between them in drawing order, then copies the upper layer. Blur and pixelate redactions that overlap a dragged solid redaction are drawn per frame, not cached, so the solid shows (RULE-10). The drag layers are rebuilt when any image-layer input (ADR-0016) changes, and are dropped when the drag ends."

Mirror this in the MOD-Canvas note.

**N2 — ADR-0022's export-memory decision has no owning module.**
`ADR-0022:23-25` vs `modules/MOD-IO.md` (no note; "Decided by" lists only ADR-0005 and ADR-0007).
This is the same class of gap as round-1 M7: the module that frees the export canvas doesn't record it.
Fix: append to MOD-IO:
> "SP-large-image outcome (ADR-0022): after encoding, the export canvas is freed (its width and height set to 0) whether the export succeeded or failed. RULE-02 is enforced here and in MOD-Core, never left to the browser."

Add ADR-0022 to the "Decided by" lists of MOD-IO, MOD-Canvas, MOD-Render and MOD-Effects.

**N3 — RULE-05's select-tool sentence has no acceptance criterion, and F-008 doesn't cite RULE-05.**
`specs/10-domain/rules.md:12`, `specs/20-features/F-008-edit-annotations.md:9, 29-30`.
This is user-visible behaviour (no move and no undo step under 4 px; the move then follows from the press point), but no test covers it.
Fix: add RULE-05 to F-008's `rules:`, and add:
> "**AC17** Given the select tool and a rectangle at (100, 100) at 100 % zoom, when the user presses on it, moves the pointer 3 screen px and releases, then the rectangle is selected, still at (100, 100), and Undo is unavailable; when they press again and move 10 screen px right, then the rectangle ends at (110, 100). (R1, R2, R7)"

**N4 — Alt+drag with a drawing tool contradicts RULE-05.**
`rules.md:12` (first sentence) vs `F-008.R6`, RULE-19 Pointer.
RULE-05 says any drag under 4 px with a shape, highlight, pen or redaction tool is a click that **places an annotation**. An Alt+press on an annotation with a small jitter would therefore create a new annotation, where F-008.R6 means it to move one. The round-1 wording included "(or Alt+drag)", but it was dropped.
Fix: in RULE-05, change the third sentence to begin:
> "With the select tool, or with Alt held on an annotation while a drawing tool is active (RULE-19), a press on an annotation or handle that moves less than 4 screen pixels …"

## Minor

**n1 — F-007.AC7 fails for copies on WebKit.** `specs/20-features/F-007-redact.md:41`.
"When the result is exported … no extra data blocks" covers copies too (INV-04), but WebKit adds `sRGB` and `eXIf` (INV-02 now allows this).
Fix: change it to:
> "… when the result is downloaded, then each pixel … and the file holds one image and no extra data blocks (INV-02)."

**n2 — RULE-05's select sentence covers only moves.** `rules.md:12`.
"The move follows from the press point" leaves out handles (a resize). A short press-and-drag on empty canvas also falls between F-008.R1's "clicking empty canvas" and "dragging on empty canvas".
Fix: end the sentence with:
> "…; once the pointer passes 4 pixels, the move or resize follows from the press point. A press on empty canvas that moves less than 4 screen pixels is a click (it clears the selection); beyond that it draws a selection box."

**n3 — The RULE-05 fact is now in three places, and they already differ.** `ADR-0016:48-50`, `MOD-Canvas.md:42`.
MOD-Canvas leaves out "on an annotation or handle".
Fix: in both places, replace the sentence with "Pointer thresholds follow RULE-05."

**n4 — ADR-0022 restates the NFR-04 method differently.** `ADR-0022:28-29` vs `nfr.md:12`.
The ADR leaves out "minus the GPU process on a blank page", which decides the pass or fail on GPU Chromium (155–311 MB).
Fix:
> "**NFR-04 method:** measured as NFR-04 now defines it (page-process footprint plus GPU-process share, minus the blank-page GPU process)."

**n5 — Split layers don't cover drawing a new annotation.** `ADR-0022:16`.
NFR-02 covers drawing too. A large filled rectangle drawn at 16384 × 1024 hits the same fill cost that failed on the ADR-0016 path.
Fix: "When a draw, move or resize starts …; while drawing, the new annotation is on top, so only the lower layer is used."

**n6 — architecture.md still states what SP-large-image did not confirm.** `specs/40-technical/architecture.md:216, 222, 237`.
It says "well under 1 GB … SP-large-image confirms, including iPad limits", but ADR-0022 reports a WebKit peak of 890 MB, makes iPadOS a QA check, and leaves 60 fps on GPU Chromium open.
Fix (line 216):
> "SP-large-image (ADR-0022) measured up to 890 MB on WebKit; iPadOS limits and GPU Chromium drag fps are QA checks."

Mark row 3 of the spike table "passed with adaptation, ADR-0022".

**n7 — MOD-Core "Implements" lacks RULE-08.** `modules/MOD-Core.md:42-45`. Add it, as round-1 m4 asked.

**n8 — WebKit memory headroom may be overstated.** `ADR-0022:19, 34, 44`.
It isn't stated whether the 890 MB peak included the 41 MB of split layers. If not, the worst case is about 931 MB, against 1 GB.
Fix: "The 890 MB peak was measured without split layers; with them the worst case is about 931 MB." Or state that they were included.

## Checked, no issue
- RULE-05 vs RULE-11: "records no undo step" matches RULE-11 (selection is not an undo step).
- RULE-05 vs F-003 and F-004: drawing-tool clicks are unchanged.
- INV-02 vs F-012: R3, AC4 and the edge case at :61 are consistent, as is ADR-0021:20-24.
- ADR-0022 vs ADR-0016: amends it; ADR-0016:51 points back.
- ADR-0022 vs NFR-02: the 0.5 s progress rule matches F-012's UX notes; the fps risk is recorded as open with a fallback.
- ADR-0022 vs MOD-Effects: the fresh-worker note is present (:34).

# Round 3 (2026-11-02, final)

**Lint:** `python3 tools/spec_lint.py` → 565 IDs, 2215 references, **0 errors, 0 warnings**.

## Round-2 findings
| ID | Status | Note |
|---|---|---|
| N1 | resolved | ADR-0022:16-24 and MOD-Canvas:42. See R3-M2 for one remaining gap |
| N2 | resolved | MOD-IO:35, :37; ADR-0022 is in the "Decided by" lists of MOD-IO, MOD-Canvas, MOD-Render and MOD-Effects |
| N3 | resolved | F-008 `rules:` lists RULE-05; AC17 added (but see R3-M1) |
| N4 | resolved | rules.md:12 covers Alt with a drawing tool; matches F-008.R6, AC8 and RULE-19 Pointer |
| n1 | resolved | F-007:41 checks the downloaded file (INV-02) |
| n2 | resolved | rules.md:12 covers resize and short presses on empty canvas; matches F-008.R1 |
| n3 | resolved | ADR-0016:48 and MOD-Canvas:42 say "Pointer thresholds follow RULE-05" |
| n4, n5, n6, n7, n8 | resolved | ADR-0022:33-34, :16-20, :49-50; architecture.md:216, :237; MOD-Core:43 |

## Verdicts
| Item | Verdict |
|---|---|
| RULE-05 / F-008 | ready after minor fixes (R3-M1) |
| F-007 | ready |
| ADR-0022 + MOD-Canvas | ready after minor fixes (R3-M2) |
| ADR-0016, MOD-IO, MOD-Render, MOD-Effects, architecture.md | ready |

No blockers.

## Major

**R3-M1 — F-008.AC17 can't pass as written.** `specs/20-features/F-008-edit-annotations.md:55`.
"Undo is unavailable" is false whenever the rectangle was drawn in the session: drawing it was an undo step (RULE-11). An end-to-end test can't set up the precondition.
Fix: "… then the rectangle is selected, still at (100, 100), and no undo step was added (one Undo removes the rectangle) …"

**R3-M2 — ADR-0022 doesn't say when "overlap a dragged solid" is checked.** `ADR-0022:21-22`, `MOD-Canvas.md:42`.
The overlap changes while the solid moves. If it is checked at drag start, a blur in the upper layer that the solid moves under covers the solid on screen until release, which breaks RULE-10.
Fix (both places): "Every blur and pixelate redaction above the lowest dragged solid redaction is drawn each frame, not cached, so the solid shows (RULE-10)."

## Minor
- MOD-Core "Decided by" (:44-45) lacks ADR-0022, though ADR-0022:31-32 says MOD-Core enforces RULE-02.
- MOD-Build "Decided by" (:28-29) lacks ADR-0021 (the `/sw.js` seed filter and offline end-to-end method).

## Checked, no issue
- RULE-05 vs F-008.R1, R6, AC8 and RULE-19 (Pointer, Esc): consistent. A press with Alt and a drawing tool on empty canvas still places an annotation, as the first sentence says.
- RULE-05 vs RULE-11: "records no undo step" is consistent.
- F-007.AC7 vs INV-02, ADR-0021 and F-012: consistent.
- ADR-0022 vs ADR-0016: the rebuild inputs are the same as ADR-0016:23-24; ADR-0016:49 points to ADR-0022; the MOD-Canvas note mirrors both.
- MOD-IO note vs ADR-0022:28: consistent ("right after encoding", success or failure).

## Closure (2026-11-02)
Round 3 findings R3-M1, R3-M2 and both minors fixed by the orchestrator. Loop closed after 3 rounds; lint 0 errors, 0 warnings.
