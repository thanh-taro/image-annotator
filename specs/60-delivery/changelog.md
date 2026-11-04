# Changelog

Spec changes to items that are `building` or `shipped`. Newest first.

## 2026-10-27
- Initial specs written in phase 1 (all items draft).

## 2026-10-27 — Specs ready
- Spec review converged in 2 rounds (reports: `.build-my-app/reports/spec-review-round-1.md`, `spec-review-round-2.md`).
- The owner approved gate G1 and delegated setting every feature, screen, component and flow to `ready`.
- Deferred by design: UI theme/typography tokens (phase 2 style tile); reference blur and pixelate definition for F-007.AC7 (phase 3 architecture).

## 2026-10-27 — Design D1 round 1 (approved at G2, 2026-11-02)
- copy.md: added COPY-redact.not_secure_short (short "not secure" tag on the blur and pixelate choices, RULE-10) and COPY-canvas.padding_unavailable (why some padding sizes are unavailable, RULE-14).
- CMP-StylePanel: anatomy lists the two new strings.
- CMP-ShortcutHelp: key labels are shown as printed and are not translated; aliases are listed; spoken key names are provided as text.
- Round 2: RULE-19 scopes the single-character View/Help keys (?, Shift+1, Shift+0) to canvas focus (WCAG 2.1.4). CMP-Toolbar narrow variant now describes the two-row layout (Download in overflow, count beside Copy, scrolling tools). CMP-Notice success timer pauses on hover/focus. CMP-StylePanel states the size_s/m/l reuse. style.md principle 2 and Type updated to match the designs. copy.md: COPY-a11y.canvas_summary, COPY-a11y.text_annotation, COPY-a11y.toolbar, COPY-a11y.style_panel, COPY-a11y.zoom_menu, COPY-a11y.new_tab, COPY-privacy.title, COPY-shortcuts.scope_note.
- Round 3: copy.md COPY-shortcuts.scope_note now covers every single-key shortcut (RULE-19: ?, Shift+1, Shift+0 too); COPY-load.click_to_paste offers Open image as the keyboard path (WCAG 2.1.1). Layout widths (D-014): style.md defines wide ≥ 1000 px, compact 800–999 px, narrow < 800 px; CMP-Toolbar and CMP-StatusBar gain a compact row and their narrow rows state the width. CMP-Toolbar: the redaction count falls back to icon + number whenever its text doesn't fit (replaces "below 360 px"); the narrow tool gap is chosen so the last visible icon is half under the fade.

## 2026-11-02 — Design D2 (approved at G2, 2026-11-02)
- CMP-Toolbar behavior: the select tool is active when the page opens and stays active across image loads (gap found while drawing FLOW-01 step 1).
- style.md: notice placement (bottom centre of the work area); canvas edge outline.
- copy.md: COPY-a11y.loaded. CMP-Canvas accessibility: annotations exposed as a multi-selectable list with roving focus; assertive region for errors. CMP-TextEditor: focus in and out. SCR-Annotator editing-text: panel styles the edited text.
- Round 2: copy.md COPY-a11y.annotations_list, COPY-a11y.annotations_hint; CMP-Canvas: the list has its own name and hint, the region is the Tab stop when nothing is selected; CMP-Notice: text goes to persistent live regions, never takes focus, Esc closes it when focused. Round 3: CMP-Canvas focus ring on the region; no list Tab stop while editing text.

## 2026-11-02 — Design D3 (approved at G2, 2026-11-02)
- SCR-Annotator: empty state hides the style panel and fills the work area; loading shows over the current state.
- Round 1: CMP-StatusBar and COPY-a11y.canvas_summary show the export size once padding or a crop exists (the canvas size after D-020); CMP-Canvas announces COPY-crop.size once after a crop change; CMP-ShortcutHelp and CMP-ConfirmDialog are modal (background inert, focus kept and returned, shortcuts off; the confirmation ignores outside clicks; canvas announcements wait until the dialog closes); CMP-DropOverlay clears its message when it disappears; CMP-Notice clears progress text before the result; CMP-StylePanel marks no option when selected annotations differ; SCR-Annotator selecting row matches CMP-Canvas.

## 2026-11-02 — Design D4 (approved at G2, 2026-11-02)
- CMP-StylePanel narrow variant (D-019): a summary bar opens the panel as a bottom sheet; copy.md COPY-canvas.title, COPY-style.sheet_toggle, COPY-style.sheet_summary.
- **Model change (D-020, owner-approved):** padding wraps the frame instead of the image, so a cropped image can be padded (FLOW-02 found the conflict). RULE-02 (limits apply to the image and to the canvas), RULE-13 (frame is a rectangle of the image; padding never moves it), RULE-14 (padding sized from the frame's longer side; the canvas is the frame plus padding; padding steps down when a frame change would exceed the limits), RULE-15 (export covers the canvas; image pixels only inside the frame); ENT-Frame and ENT-Padding; glossary Frame and Canvas; F-011 R1, R2, R4, AC4, AC7; F-010 R2, R3, AC4; CMP-Canvas cropping; CMP-StatusBar shows the canvas size. D1–D3 designs are unaffected (none combines a crop with padding).
- D-020 review fixes: RULE-10 blur and pixelate sample only inside the frame (no cropped-out pixels in the padding; F-007 edge case, AC13); RULE-11 step wording; RULE-12 Fit shows the whole image while cropping, view kept on tool switch (F-010 AC10); RULE-20 counts redactions overlapping the canvas; F-011 R3 wording, new R6 padding step-down (AC7); F-012 R3 and F-010 AC2 export the canvas; glossary Padding and Frame; CMP-Canvas clipping outside the crop tool; COPY-a11y.canvas_summary says "canvas"; layout rows name the layout width instead of pixel values.
- D4 round 1: CMP-Toolbar narrow (fade only while more tools follow; active or focused tool scrolled into view); CMP-StylePanel narrow (sheet cap includes the bar; the view keeps the canvas or frame above the open sheet; the bar's name includes its visible summary); copy.md COPY-a11y.step_annotation (CMP-Canvas), canvas detail of COPY-style.sheet_summary.

## 2026-11-02 — Technical specs (phase 3)
- 40-technical written from the owner-approved architecture proposal (D-022 own rendering engine, D-023 own exact blur and pixelate, D-024 an undecodable large image uses COPY-error.decode_failed, D-025 no extra Latin subset): ADR-0001…ADR-0015, modules, dependency registry (all rows proposed until the license audit), architecture and platform mapping.
- The reference blur and pixelate required by F-007.AC7 are defined in ADR-0006 (deferred from phase 1). No other spec layer changed.
- RULE-10: the part of a blur or pixelate box outside the frame covers earlier annotations with the background (gap found while writing ADR-0006; matches F-007.AC9).
- Spike SP-engine passed with an adaptation: ADR-0016 (amends ADR-0004) adds a cached display image layer to MOD-Canvas, built by MOD-Render `paintBase` and never used by the export. No feature, screen or rule changed.
- Spike SP-blur passed with an adaptation: ADR-0017 (amends ADR-0006) requires the packed integer blur and sends no exact job while a redaction moves. RULE-10 sizes confirmed. Spike SP-decode passed: ADR-0018 confirms ADR-0005. No feature, screen or rule changed.
- Spike SP-png-export passed with an adaptation: ADR-0019 (amends ADR-0007) hardens the chunk whitelist and decodes export test files outside the browser. No feature, screen or rule changed.
- Spike SP-text passed with an adaptation: ADR-0020 (amends ADR-0009). **RULE-08** now keeps typed, pasted or dropped text in composed form (Unicode NFC), because decomposed Vietnamese accents fell back to another typeface (F-005.AC14). The 2,000-character limit counts the composed text. Font metrics added to MOD-Core.
- Spike SP-host passed with adaptations: ADR-0021. **F-014** edge case: embedded in a WebKit-based browser the leave-page warning never shows; accepted for M-1 (D-028, owner). **F-015** R7 notes the WebKit behaviour; AC10 applies in browsers that enforce the clipboard grant; new edge case for paste without host focus. The portal change request gained the findings.
- Spike SP-large-image passed with an adaptation: ADR-0022 (amends ADR-0016) adds split drag layers, a fresh effects worker per image, and freeing the export canvas. NFR-04 method now defines tool memory.
- Spike spec review (`.build-my-app/reports/spec-review-spikes.md`, 0 blockers, 8 major, 8 minor), all fixed. **RULE-05**: with the select tool, a press that moves under 4 screen px is a selection click with no undo step. **INV-02**: covers the image handed to the clipboard and allows a browser's re-encoding tags. **F-005** AC15 (decomposed accents, limit) and a text-drop edge case. **F-014** AC7 and Scope scoped to browsers that show dialogs from an embedded page. **F-015** R7 and AC10 point to ADR-0021. **F-012** edge cases for the clipboard grant and re-encoding. **F-017** R1 and AC1 say "in the same way"; new edge case. ADR-0016, 0017, 0019, 0020 and 0021 clarified; module notes aligned (`paint` signature in MOD-Render).
- Spike spec review round 2 (4 major, 8 minor, all fixed): **RULE-05** covers Alt+drag with a drawing tool, resizes and short presses on empty canvas; **F-008** AC17 and RULE-05 in its rules; **F-007** AC7 checks the downloaded file; ADR-0022 defines the split layers (interleaved selections, solids over blur, rebuilds, drawing); MOD-IO frees the export canvas; module "Decided by" lists updated; architecture.md reflects SP-large-image.
- Spike spec review round 3 (final; 2 major, 2 minor, all fixed): F-008.AC17 says no undo step was added; ADR-0022 draws every blur and pixelate above the lowest dragged solid each frame.
- Foundations (phase 3.3): rounding to the nearest whole pixel rounds halves up (rules preamble); MOD-Render takes a `Scene` view type from MOD-Core; DEP-19 approved after the lockfile licence audit (666 packages, all within ADR-0001).

## 2026-11-03 — Build (phase 4)
- F-001 gaps found while building: F-001 edge cases (a folder-only drop is refused; input during a load or dialog is ignored); CMP-Notice lists COPY-load.first_only as a success notice; style.md sets the Fit margin to `space.6`.
- F-016 gaps: CMP-StatusBar accessibility describes the privacy popover; new token `size.popover` (360 px).
- F-001 review: ADR-0023 (amends ADR-0005) reads image dimensions from the header before decoding, so an over-limit image is never fully decoded. F-001 edge case: from several files, the first supported one loads.
- F-002 gaps: F-002.R4 centres a small canvas and limits panning to the Fit margin; RULE-19 arrow pan is 40 screen px (Shift: 200) and Mod++ also zooms in; copy.md COPY-status.zoom_none.
- F-003 gaps: RULE-19 Esc closes the narrow style sheet after cancelling a drag; CMP-StylePanel coarse-pointer swatches in 2 rows of 4.
- F-003 review: CMP-Toolbar's tool group is a radio group named by the new COPY-a11y.tool_group.
- F-004 gaps: RULE-09 highlight ends are square and a Shift highlight is a straight run; MOD-Core stores stroke points as sampled.
- F-006 gaps: RULE-07 pill width; a press that moves with the step tool places one step at the press point.
- RULE-07: step badges have no outline (D-029, owner; ADR-0009's "outline rules (RULE-07)" therefore means none).
- F-006 review: RULE-07 numbers several duplicated steps in drawing order.
- F-005 review: a text-tool click outside the canvas does nothing (D-030, owner; F-005.R1, new AC16); F-005.R1 edits the topmost text under the pointer; F-005.R3 editing also ends when focus leaves the text and CMP-StylePanel; F-005 edge case for a moved press; MOD-Core `hitTest`/`boundsOf` take a required `TextMeasure`; MOD-Document `commitText(text, isNew)`.
- F-007 gaps and review: MOD-Effects `setImage` takes the source and palette, `patchesFor` a `moving` set, `exactPatches` rejects on a failed job; ADR-0017 reference is a test-only module; F-007.AC8 means the redact tool's solid colour; COPY-style.sheet_summary for redactions (kind · strength).
- F-012 gaps and review: RULE-15 cleans the source name (control and bidi characters, leading dots removed, 100 characters) and falls back to the pasted-image name when empty; F-012.R7 bounds the wait for effects and fonts at 10 s, with an edge case.
- F-012 review round 1: MOD-Effects `exactPatches` holds the patches it collects until released and rejects when the image is replaced or the wait aborts; MOD-IO bounds the effects and font wait at `EXPORT_WAIT_MS` (10 s).
- Portal applied the frame-grant change request (taro-kit 4c4ae94, its D-070/D-071): architecture.md A2 records the grants, the first-ready focus rule and the catalog permissions (adds `file-pick`); the e2e stub host mirrors the portal frame.
- D-031 (owner): the narrow summary bar shows COPY-redact.not_secure_short after the kind for blur and pixelate (COPY-style.sheet_summary, CMP-StylePanel narrow; security review F-007 m4).
- F-008 gaps and review: Shift + drag a box adds to the selection (D-032, owner; F-008.R1); F-008 edge cases for strokes with no height and for boxes too small to tell handles from body; CMP-StylePanel field limits (at least 1 × 1, negative X/Y allowed); MOD-Core `marqueeHits(annotations, box, shortSide, measure)` tests the drawn shape; `nudge` and `altResize` move from MOD-Canvas to MOD-App commands.
- F-008 review fixes: RULE-06 Shift on an edge handle scales the other axis about the centre, and on a line or arrow end snaps to 45° about the fixed end; MOD-Canvas `canvasCommands.dragging()`.
- F-009 gaps and review: CMP-Toolbar tools name their shortcut, other controls state it as keyboard shortcuts; focus moves to the other history button when the clicked one becomes disabled; F-009 edge case for the history buttons while editing text.
- F-009 review fixes: edge case for a new text before any step exists.
