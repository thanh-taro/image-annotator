# Changelog

Spec changes to items that are `building` or `shipped`. Newest first.

## 2026-11-10 — M-1c fill colour and text background (version 1.2)
- Owner's change request after 1.1.1 (D-051, D-052, D-053: ships as 1.2.0). New F-020 (draft) and RULE-22: rectangles and ellipses get a fill colour of their own (automatic, the outline colour, until one is picked); texts get a background (none, solid or 70 % translucent) on a rounded box with its own colour (automatic: the contrast pairing of the text colour), without the outline. RULE-04 fill and current style, RULE-08 outline, ENT-Style `fill` and new `fillColor`, F-003.R3, F-005 scope and R5, CMP-StylePanel anatomy and accessibility, style.md, MOD-Render, MOD-Core, copy COPY-style.fill_color, text_background, text_background_color, glossary fill colour and text background; roadmap milestone M-1c (text with background boxes moved out of M-2).
- Spec review round 1 of F-020: choosing the marked swatch of an automatic colour applies nothing (R2); a press in the background box's margin while editing places the caret, and the box surrounds the placeholder of an empty text (R8, RULE-22, CMP-TextEditor, F-005.R3); one remembered custom colour across the three colour choices (R1); ACs made concrete and AC17–AC21 added; RULE-07 pairing also used by RULE-22; fill drawn under the outline (MOD-Render); bounds and hit-testing by the box (MOD-Core); CMP-StylePanel differing choices; glossary automatic and text background colour.
- Spec review round 2 of F-020: AC11, AC18 and AC21 state their setup; F-020 `ready`.

## 1.1.1 — 2026-11-10 (release candidate 1.1.1-rc.1)
Bug fix, no spec change: CMP-TextEditor shows a visible selection again (ADR-0009 §2).

## 1.1.0 — 2026-11-10 (milestone M-1b, release candidate 1.1.0-rc.1)
Custom colour and size (F-019 `shipped`): a custom swatch opening the browser's colour picker and a size in pixels next to S, M and L. Fixes: clicking the active tool clears the selection on wide layouts (CMP-Toolbar, D-043); Esc in an unchanged panel field follows RULE-19 and focus moves to the canvas region (CMP-StylePanel).

## 2026-11-10 — M-1b custom colour and size (version 1.1)
- Owner's change request after 1.0.0-rc.4 (D-048: ships as 1.1, after 1.0.0). New F-019 (draft) and RULE-21: a custom swatch opening the browser's colour picker for every annotation colour (not the background, D-049); a size field in pixels next to S, M and L, with a slider on the wide layout (D-050). RULE-04 palette and sizes, RULE-07 contrast pairing for a custom colour, RULE-10 solid colour, RULE-11 picker and slider steps, ENT-Style `color` and `strokeSize`, CMP-StylePanel anatomy and layout, copy COPY-style.color_custom, color_custom_value, size_px, size_value; roadmap milestone M-1b; platform mapping rows.
- Spec review round 1 of F-019: the custom swatch is the ninth radio of the colour group (choosing applies the remembered colour; click, Enter or Space open the picker; arrows never do), live preview and cancel (R8), editing text keeps editing (R9), field applies only when changed, Esc restores; ACs 14–22. Shipped specs reworded for custom sizes: RULE-08, F-005 and F-006 scopes, F-008.R3. RULE-21 compares hex ignoring case and rounds the highlight width after the stroke size; glossary: custom colour, custom size, custom swatch.
- Spec review round 2 of F-019: the colour group checks an option only when a colour applies (arrowing onto an unused custom swatch moves focus only); the swatch's apply and its picker session are one undo step, cancel returns to the colour before it (R8, RULE-11, new AC23); focus returns to the text only after Enter or the picker closes (R9); AC15 uses the redaction tool.
- Builder questions (F-019 build): the picker starts at the subject's colour when none is remembered (R1); slider on the wide and compact layouts (R3); Esc in a changed field only restores, else RULE-19 (R5); cancel also restores the remembered colour (R8); AC22 and its edge case restated for the hidden panel with no image. MOD-Document `discardChain`, MOD-Canvas `focusTextEdit`, MOD-Core custom-style functions.
- Code review round 1 of F-019: choosing the custom swatch applies the colour it shows, nothing when already checked (R1); the slider is on the wide and compact layouts in CMP-StylePanel, style.md and platform-mapping.
- Accessibility audit of F-019: with differing sizes in a multi-selection the slider is not shown (R7).
- F-019 fix round 1: CMP-StylePanel focus moves to the canvas region when the focused panel control is removed; MOD-Render `colourValue` replaces `paletteColour`.

## 1.0.0 — 2026-11-10 (milestone M-1, release candidate 1.0.0-rc.4)
First release. All 18 features of M-1 are `shipped`. After the owner's hand test of rc.2: picking a drawing tool clears the selection (D-043), highlight and stroke handles sit on the drawn mark (D-044), one drawing colour is shared across tools (D-045), canvas settings have a Canvas heading (D-046), and the select tool's panel offers the drawing colour too (D-047).
- Open an image by paste, drop or file picker (F-001); zoom and pan (F-002).
- Draw rectangles, ellipses, lines and arrows (F-003); pen and highlighter strokes (F-004); text (F-005); numbered steps (F-006).
- Redact with solid fill (secure) or blur and pixelate (labelled not secure); the exported file never holds the hidden pixels (F-007).
- Select and edit every annotation (F-008); undo and redo (F-009).
- Non-destructive crop (F-010); padding and background (F-011).
- Copy to the clipboard or download as a flattened PNG with no metadata from the original (F-012).
- Keyboard map with a shortcut help (F-013); a warning before losing unexported work (F-014).
- Fits the portal: embedded or standalone, the portal's theme (F-015), the privacy statement (F-016), offline use after one visit (F-017), the portal's language, English and Vietnamese (F-018).
- Known gaps carried into 1.0.0: the leave-page warning does not show in an embedded WebKit frame (D-028, ADR-0021); a Safari first-visit blur export and the other manual checks wait for the owner's sign-off (D-038).

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
- F-010 gaps and review: a drag inside a whole-image frame draws a new frame (D-033, owner; F-010.R1, new AC); RULE-11 frame nudges and resizes coalesce; RULE-12 keeps the frame's place within the pan limits; CMP-Canvas crop view dims annotations outside the frame and hides selection handles; CMP-StatusBar shows the size once the canvas differs from the image (D-017).
- F-011 review: CMP-StylePanel lays the 9 background choices in 2 rows of 5 on narrow widths or a coarse pointer; the narrow summary bar shows a palette background's colour (none when transparent).
- D-034 (owner): COPY-privacy.details says nothing the user adds is uploaded, stored or tracked, and that the tool keeps a copy of its own files in the browser to work offline and makes no other network requests (security review F-017 M1).
- F-013 gaps and review: copy.md COPY-key.drag, COPY-key.wheel, COPY-key.or and COPY-key.spoken_arrows, plus, minus, equals and question (pointer words and spoken key names in both languages); CMP-ShortcutHelp prints arrows as ← ↑ → ↓, shows Shift on the move, resize and pan rows, crop keys share them, and spoken names use those strings; MOD-Keys `shortcutList(mac)` returns COPY IDs; RULE-19 keeps Mod+O from the browser while a dialog is open and keeps Mod+D duplicates and activated options in view. CMP-Canvas: Tab selections aren't announced (the focused option is read).
- F-017 gaps and review: ADR-0024 (amends ADR-0011): the build lists every hashed file for the offline seed, the page is network-first, WebKit's second download is accepted. F-017.R3 uses a new version from the first online open and keeps open copies unchanged; F-017.AC3 checks the first online open and the cached copy. MOD-Build lists the seed files.
- F-014 gaps and review: CMP-Toolbar orders the overflow as COPY-action.shortcuts, a separator, then COPY-action.clear; COPY-action.clear is unavailable while no image is loaded (F-014 UX notes); copy.md COPY-a11y.cleared, announced by CMP-Canvas after starting over; F-014 edge case: starting over closes any notice and the narrow style sheet.
- End of M-1 (F-015.AC6/AC7, F-018.AC7): CMP-StylePanel lays the 8 swatches in 2 rows of 4 in the narrow sheet below 386 px (F-018.R7).

## 2026-11-09 — QA (phase 5)
- QA decisions D-035 (CMP-StylePanel: a multi-selection heading COPY-a11y.selected_count atop the wide panel, as on the artboard), D-036 (SCR-Annotator: reading and focus order toolbar, canvas, style panel, status bar; a visually hidden level-1 heading COPY-app.title), D-037 (OFL subsetting and MPL-2.0 build/dev exceptions accepted).
- ADR-0025 (amends ADR-0001, ADR-0010, ADR-0024): `/sw.js` policy adds `worker-src 'self'` (WebKit refused the effects worker through the offline copy); a worker error is fatal at any time; `img-src 'self'`; the notices ship as a hashed file in the offline copy; the seed list is posted as soon as the service worker is ready. architecture.md "Security headers" updated.
- RULE-15: the download name replaces `/ \ : * ? " < > |` with `_` and trims surrounding spaces, so the notice names the saved file.
- dependencies.md: DEP-07 pinned to portal `27ea733`; stale notes corrected; test fixtures recorded as own work.
- QA fix round 1 gaps: F-017 edge case (offline, the notices open only from a standalone copy; embedded copies are partitioned, ADR-0021); architecture.md and MOD-Host: the service worker is registered after first render, not on `load`, with the early seed per ADR-0025.

## 2026-11-10 — Release candidate feedback
- Owner's manual test of 1.0.0-rc.2: CMP-Toolbar picking any tool other than select clears the selection, so a style choice changes only what is drawn next (D-043; was "picking a tool clears nothing"); F-008.R3 stroke and highlight handles sit on the box of the drawn mark (points' box grown by half the line width), so a thin highlight can be scaled (D-044). New F-008.AC18, AC19. Builder gaps: re-picking the active drawing tool also clears the selection; the selection outline uses the drawn-mark box; RULE-06 Shift keeps a stroke's points proportions.
- Owner's manual test (2): RULE-04 one current colour shared by rectangle, ellipse, line, arrow, pen, text and step; highlight and redaction keep their own (D-045). CMP-StylePanel canvas settings start with the heading COPY-canvas.title (D-046). New F-003.AC10, AC11.
- Owner's manual test (3) of rc.3: with the select tool and nothing selected, the panel starts with the shared drawing colour (COPY-style.color), then the Canvas heading, padding and background, so green picked there is the next rectangle's colour (D-047, refines D-046; was background only). RULE-04, RULE-11, CMP-StylePanel, F-003.AC11 changed; new F-003.AC12.
