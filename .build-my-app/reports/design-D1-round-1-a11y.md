# Accessibility audit, design D1 (components), round 1

Scope: ten CMP-*.dc.html boards (source read, nothing rendered). Criteria: NFR-06 (WCAG 2.2 AA), each component's Accessibility section, D-008.
Boards dir (B): /private/tmp/claude-501/-Users-er-lap-mam3-016-Documents-personals-taro-kit-tools-developer-tools-image-annotator/0ffd0179-bd4b-4d78-94c5-801d607d1aa4/scratchpad/canvas/project/
Result: 0 blockers, 9 major, 15 minor. Token pairs in tokens.json all pass (tools/token_contrast.py: 0 failing); the failures below are pairings the boards use that the token list does not cover.

## A. Automated / computed results (source + contrast math)

### Contrast, passing (computed, dark / light)
fg, muted, accent, success, danger text on their surfaces 5.0-18.5; onAccent on accent 6.35 / 6.54; accent on selection tint 5.02 / 5.58; muted on selection 5.24 / 5.90; muted on dangerBg 5.43 / 5.89; Notice close icon, status icons, input borders (lineStrong on bg 3.54 / 3.47; on surface 3.34 / 3.60); EmptyState hint muted on workArea 6.76 / 5.74; ConfirmDialog focus ring accent on surface 5.99 / 6.54; step badges white on red 5.01, black on yellow 14.88, white on blue 5.34; palette red/blue/purple vs light image 4.7-5.0.

### Contrast, failing or marginal
| ID | Pair (where used) | Dark | Light | Need |
|---|---|---|---|---|
| C1 | accent dashed border over cropDim-dimmed work area/image (CMP-DropOverlay .zone) | 6.58 on work, 2.27 over dimmed image | 1.40 on work, 1.52 on image | 3:1 |
| C2 | lineStrong border of Notice "Download" button on dangerBg (CMP-Notice .btn in .err) | 2.90 | 3.07 | 3:1 |
| C3 | selectionOutline 1px on a light screenshot (#F6F7F9) (CMP-Canvas selected/crop, CMP-TextEditor .ed) | 2.86 | 6.10 | 3:1 |
| C4 | selected-state fill/border vs unselected: selectionLine on surface (Toolbar .ib.on, StylePanel .seg .on) | 1.84 | 1.74 | 3:1 (state indicator) |
| C5 | EmptyState dashed border lineStrong on workArea | 3.62 | 2.99 | 3:1 (marginal) |
| C6 | checkerA/checkerB (transparency) | 1.14 | n/a | decorative, ok |

### Target sizes (2.5.8 min 24 px)
Toolbar .ib 32, .tbtn 28, Notice/ShortcutHelp close 28, swatches 24 (gap 4), StatusBar .zb 24 and .tbtn 24, segmented buttons 28, inputs 28, dialog buttons 32, menu items 32: all meet 24 px. Canvas/crop handles are 10 px (see M8).

## B. Findings

### Major
**M1. Narrow toolbar tool buttons carry no state.** B CMP-Toolbar.dc.html, "narrow 390" block: `<button class="{{k.cls}}" aria-label=...>` has no `aria-pressed` (default variant has it). 4.1.2. Fix: add `aria-pressed="{{k.on}}"` (or make the group role=radiogroup with role=radio/aria-checked) in the narrow variant.

**M2. Active state conveyed by a faint tint plus a hue shift only.** CMP-Toolbar `.ib.on`, CMP-StylePanel `.seg button.on` (C4), and swatch `.sw.on`. 1.4.1/1.4.11. Fix: add a non-colour, >=3:1 indicator: 2px accent bottom bar or inset 2px accent border on `.ib.on`/`.seg button.on` (accent on surface 5.99 / 6.54); a check glyph on the selected swatch.

**M3. No designed focus indicator.** No `:focus-visible` rule exists in any board; only ConfirmDialog has a static `.btn.focus` mock (2px accent, offset 2). 2.4.7 / 2.4.11. Fix: add to every board's shared CSS `button,a,input,[role=radio],[role=menuitem],[tabindex]:focus-visible{outline:2px solid var(--accent);outline-offset:2px}` (passes against every surface used, incl. selection tint 5.02 and dangerBg 5.2). Do not reuse the same look for selected swatches (`.sw.on` is the same 2px accent outline); give the selected swatch a check mark instead so focus and selection are distinguishable.

**M4. Shortcut help key names not reliably readable.** B CMP-ShortcutHelp.dc.html `<kbd aria-label="{{r.spoken}}">`: aria-label on `kbd` (no role) is not exposed by most screen readers, so "Control Z" will be read as "Ctrl+Z" or skipped. Fix: `<kbd><span aria-hidden="true">Ctrl+Z</span><span class="sr-only">Control Z</span></kbd>` and render each group as `<h3>` + `<dl>` (label `dt`, keys `dd`) or `<ul>` so rows have list/definition semantics (rows are bare `div`s today). Single letters (V, R, O, A, L, P, H, T, N, X, C) should have spoken "letter V" etc. since "A" reads as the article. Also add Mac variants (board only shows "Windows / Linux keys"; Cmd/Option names need spoken forms too).

**M5. Single-character shortcuts (2.1.4, level A).** ShortcutHelp lists bare V R O A L P H T N X C ? as global shortcuts. Fix (spec + design): active only when the canvas/toolbar has focus (not in inputs, dialogs, or when the iframe host has focus), or provide a setting to turn off/remap. Add the rule to CMP-Canvas/CMP-Toolbar spec and a setting entry in the "More actions" menu or help dialog.

**M6. Fixed heights/widths break text resize and 320 px reflow (1.4.4, 1.4.10, 1.4.12).** CMP-ShortcutHelp `.dlg{width:640px;height:600px}`, `.r{height:21px}`, `columns:2`; CMP-ConfirmDialog `.dlg{width:420px}`; CMP-Notice `.n{width:680px}`; CMP-StylePanel `.panel{width:272px;height:620px}`; chrome heights 24-40px on Toolbar/StatusBar; all font sizes in px. Fix: `max-width:calc(100vw - 16px)`, `min-height` instead of `height` on rows/dialogs, 1 column below ~480px, `max-height:90vh;overflow:auto` on dialogs, rem units for type, and verify at 200 % text and 320 px. No 320 px variant exists (narrow boards are 390); add one for Toolbar and StatusBar.

**M7. Narrow toolbar drops Undo/Redo and has no route to them.** CMP-Toolbar "narrow 390": no Undo/Redo, overflow menu holds only Download, Keyboard shortcuts, Start over. Touch users (NFR-07 tablets) cannot undo. Fix: add Undo and Redo to the overflow menu (with disabled states) or keep them in the bar and scroll the tool group. Also give the horizontally scrolling `.tools` strip a visible scroll affordance (fade or peek) and keep the active tool scrolled into view.

**M8. Live-region mechanics for Notice, DropOverlay and the canvas announcements.** (a) CMP-Notice: `role="status"`/`role="alert"` is on the element that appears with its content, so most screen readers will not announce it; `role=alert` plus `aria-live="assertive"` is redundant. Fix: one persistent, visually present container (`role=status`, `aria-live=polite`, plus a separate persistent `role=alert` one for errors) that stays in the DOM and gets its text inserted; the Close and action buttons sit outside the live region or the region is `aria-atomic="false"`. (b) CMP-DropOverlay: same issue, `role=status` pill is created with the overlay; mount an empty status region at app start and set its text on dragenter. (c) CMP-Canvas: the spec requires polite announcements for tool_active, placed, deleted_count, duplicated_count, undone, redone; no board contains a live region for them, and the selected-annotation chip ("Rectangle at 16, 168", COPY-a11y.annotation) is a plain `span` that is not announced. Fix: add one persistent visually hidden `aria-live="polite"` region to the Canvas/app shell design, and have the chip mirror it.

**M9. Canvas region not specified as focusable or fully named.** CMP-Canvas `role="region" aria-label="Image canvas"` appears only on the first (drawing) cell; selected and crop cells have none, and no `tabindex`. Spec says "one focusable region" with Tab moving through annotations. Fix: `tabindex="0"` on the one canvas container (roving or `aria-activedescendant` over annotation proxies, each with the COPY-a11y.annotation name), same markup on all variants, plus an accessible description with image size and annotation count; text annotation content must be exposed in the proxy name since the canvas is a bitmap (1.1.1/1.3.1).

### Minor
- m1. CMP-DropOverlay C1: dashed accent border fails 3:1 in light theme (1.40) and over the dimmed image in dark (2.27). Fix: dash colour `#FFFFFF` (4.67 on dimmed light work area; high on dark dim), keep the pill.
- m2. CMP-Notice C2: error-variant "Download" button border (lineStrong on dangerBg) 2.90 dark. Fix: border `var(--fg)` at 0.6 opacity or use `--danger` border/text for this button, or fill with surface2.
- m3. C3 selection/crop/text-editor outline 1-1.5px accent on light screenshots 2.86 in dark theme. Fix: two-tone outline (1px #FFFFFF inner + 1.5px accent, or accent plus dark `#0F0B16` shadow) so it holds 3:1 on any image.
- m4. Handles (CMP-Canvas `.h` 10 px) are below 24 px and closer than 24 px on small boxes. Passes 2.5.8 only via the equivalent-control exception (X/Y/W/H fields; crop has them on the panel). Fix: keep a visual 10 px handle but a >=24 px hit area (44 px for coarse pointers); document that fields are the alternative.
- m5. CMP-Toolbar: spec says every control's name includes its shortcut; only tools do. Undo, Redo, Copy, Download, Open image lack it. Fix: `aria-label="Undo (Ctrl+Z)"`, or `aria-keyshortcuts="Control+Z"`; show shortcut in a keyboard-reachable tooltip (`title` is not).
- m6. CMP-Toolbar: "More actions" (default variant) lacks `aria-haspopup="menu"`/`aria-expanded`; the narrow variant has no state either. Menu needs arrow-key roving, focus to first item on open, Esc to close, focus return to the button (state in spec).
- m7. CMP-Toolbar: spec calls the tool group "single-choice"; markup uses `aria-pressed` toggles. Prefer `role=radiogroup` > `role=radio aria-checked` (matches StylePanel pattern) or document roving tabindex with arrow keys. Redaction pill "3 redactions" is a plain span; fine, but should be in the `aria-label`/description of Copy and Download so the count is read where it matters.
- m8. CMP-ConfirmDialog: add `aria-describedby` to the paragraph; consider `role="alertdialog"` for the destructive Replace/Start over. Initial focus on Cancel and focus return are only shown as a static class; capture in spec/implementation notes. Esc = cancel.
- m9. CMP-ShortcutHelp: `aria-label` duplicates the visible `h2`; use `aria-labelledby` pointing to the h2. Specify initial focus (heading with tabindex=-1 or Close) and focus return (More actions button). `h3` at 11 px uppercase muted is readable (6.25) but small; raise to 12.
- m10. CMP-StatusBar: zoom level "readable on focus" is not met: the 31 % value is a non-focusable span and Zoom in/out names omit it. Fix: `aria-label="Zoom out, 31 percent"` or make the value a focusable `output`/`role=status` with `tabindex=0` (not live). Narrow "31 % ▾": hide the glyph (`aria-hidden`) and name it "Zoom, 31 percent".
- m11. CMP-StatusBar: privacy button has `aria-haspopup="dialog"` but no `aria-expanded`; popover dialog needs Esc/focus return. GitHub link points off-site inside an iframe: add `target="_blank" rel="noopener noreferrer"` and "(opens in new tab)" in the name, otherwise a keyboard Enter drops the user's work.
- m12. CMP-EmptyState: title is a `p`; use a heading level consistent with the page. "Click here, then press Ctrl+V" (unfocused variant) is pointer-only phrasing: reword to "Click or focus here, then press Ctrl+V (Cmd+V on Mac)". Dashed border C5 is 2.99 in light: use `--lineStrong` darker or 2px. Add visible focus state for Open image (spec says it takes focus first).
- m13. CMP-StylePanel: inputs need `inputmode="numeric"`, unit (px), min/max and an error/clamp message, and a statement that Enter/blur applies (3.3.1/3.3.2). Visible labels "X Y W H" vs names "Width/Height" are acceptable (label-in-name) but the group is not a `fieldset/legend` named COPY-geometry.title. The D1 selection board shows only a multi-selection (correctly no fields); D-008 position/size fields are designed for crop (D1) and line/arrow (Main.dc.html) but there is no single-selection board for rectangle/ellipse/text/step/redaction showing X/Y/W/H. Add one so D-008 coverage can be verified.
- m14. CMP-StylePanel: disabled Padding options give no reason; add `aria-describedby` text ("Unavailable for images over 4,096 px" via copy). Swatch names are hard-coded, not copy keys (localisation, vi-VN): add COPY ids. "N annotations selected" (`COPY-a11y.selected_count`) is not a live region; announce via the app live region (M8c).
- m15. Motion and text editor: CMP-Notice progress spinner `animation:spin` has no `@media (prefers-reduced-motion: reduce)` fallback (use a static icon or pulse-free ellipsis). CMP-TextEditor: `role=textbox` div has no `contenteditable`/`tabindex` in the board (implementation note), label "Text" is hard-coded rather than COPY-tool.text, and the editing halo is always white, so white or yellow text is illegible while editing (the Canvas sample uses a black halo for white text): choose the halo from the text colour.

## C. Needs a manual pass (not decidable from source)
1. Screen-reader pass (VoiceOver+Safari, NVDA+Firefox/Chrome): announcements of all NFR-06 status changes, notice/overlay live regions after M8 fix, `kbd` spoken names (M4), radiogroup-of-buttons arrow behaviour, role=menu behaviour, dialog open/close focus movement and return, Tab order through annotations.
2. Rendered focus visibility on every control in both themes and over the dimmed overlay; UA default ring is the fallback until M3 is fixed.
3. 200 % text, 400 % zoom/320 px reflow, 1.4.12 text-spacing override for dialogs, panel and toolbars (M6).
4. Touch pass on a WebKit and a Chromium tablet: handle hit areas, 24-32 px controls, horizontally scrolling tool strip, drag-free path (draw, then set X/Y/W/H) for every annotation kind.
5. Real-image contrast of selection outline, handles and crop frame on varied screenshots (dark UI, photos); annotation palette vs user images is RULE-07, not testable from boards.
6. Reduced motion (OS setting) behaviour, and forced-colors/high-contrast mode (borders using transparent/`outline` fallbacks, SVG `currentColor` icons).
7. Timing: whether Notices auto-dismiss (2.2.1) or move focus; errors should persist until closed.
8. Pointer cancellation and no path-based gestures other than pen/highlight (accepted as essential); keyboard drawing (Enter place, Alt+arrows) behaviour once built.
