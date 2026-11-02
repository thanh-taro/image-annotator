# Accessibility audit, design D1 (components), round 3 (final)

Scope: ten CMP-*.dc.html boards, source only (Main ignored). Criteria: NFR-06 (WCAG 2.2 AA), round-2 report and triage.
Result: 0 blockers, 0 new majors. All round-2 majors closed (N1 fixed). Round-2 minors: N1-N6 fixed, N7 decided in spec, N8 deferred to manual QA. Open round-1 items: 6 of 8 fixed/decided, 2 partly open (m12, m13), 1 undecided (m7). 5 new minors (NN1-NN5). Contrast: 0 regressions, 0 new failures.

## 1. Round-2 items
| Item | Status | Evidence |
|---|---|---|
| N1 narrow toolbar missing Step/Redact/Crop | FIXED | Two rows; row 2 is a scrolling strip of all 11 tools (44 px), fade edge, "scrolled to end" frame, no-image and 320 px frames. Manual: swipe discoverability, focus scroll-into-view. |
| N2 2.1.4 single-char keys | FIXED (spec) | RULE-19 now canvas-focus only. Residual wording: NN1, NN4. |
| N3 padding frame | FIXED | `box-shadow 0 0 0 1px muted`: 5.74 light / 6.76 dark vs workArea. |
| N4 ShortcutHelp body | FIXED | `role=region`, name, focus outline in the macOS frame. |
| N5 placeholder | FIXED | Current colour plus halo. Residual: NN3, and white/yellow text still has a hard-coded white halo (m15, carried). |
| N6 text annotation exposure | FIXED | Hidden "Text "..." at x, y" and canvas_summary (describedby). Residual: NN2. |
| N7 notice auto-hide | DECIDED | Spec: success timer pauses on hover and focus; errors persist; text is in a persistent live region. Board label still says "auto-hides after 4 s" (fine). Manual: timing with keyboard focus on canvas, not the notice. |
| N8 focus ring clipping | DEFERRED (manual QA, as triaged) | Ring on a 24 px button in a 28 px bar, and on 44 px buttons in 48 px narrow bars (52 px ring), may clip at the iframe edge. Add padding or `overflow:visible` in build. |

## 2. Open round-1 items
- Fixed: m5 (aria-keyshortcuts on wide Undo/Redo/Copy/Download/Open; `title` removed), m6 (aria-expanded on More actions), m8 (alertdialog plus describedby), m10 (narrow zoom button named "Zoom: 31 %"; wide value is readable text), m11 (aria-expanded, new-tab target and text), M7 (via N1).
- Decided/deferred: M3 global `:focus-visible` rule is an implementation requirement; Notice, DropOverlay and TextEditor have no focus example (acceptable, controls reuse the Toolbar states grid). M5 closed by RULE-19. M6 reflow deferred to phase 5 (200 % text, 320 px, text spacing); keep as build requirement: `min-height` rather than fixed `height` on `.tb` (40), `.st` (28), `.panel` (640), `.dlg` (600). Tooltip 1.4.13 (narrow `role=tooltip`) is manual.
- Still open, minor:
  - m7 tool group still `aria-pressed` toggles (spec says single-choice); no decision recorded. Fix: record "toggle buttons in a toolbar" as the decision, or use radio semantics. Count pill precedes Copy in reading order but is not in its name; acceptable if recorded.
  - m12 EmptyState: `click_to_paste` ("Click here, then press Ctrl+V") is pointer-only wording and the region has no `tabindex`; keyboard path is Open image or Ctrl+V. Fix: wording "Press Ctrl+V, or choose Open image" in the unfocused state.
  - m13 StylePanel geometry: only 1 of 6 groups uses `fieldset/legend` (selection: solid redaction); the other five (rectangle, arrow, blur, rectangle+text, crop) are `div` plus heading. See NN5. Still no min/max, unit, error or "Enter applies" text; defer states to D2 but record.
  - m15 editing halo hard-coded white; `role=textbox` without contenteditable is an implementation note.

## 3. New findings (all minor)
- NN1 CMP-Toolbar, tool buttons: `aria-keyshortcuts="V"` and "(V)" in the name advertise single-character keys that RULE-19 now limits to canvas focus. Criterion 4.1.2 / 3.3.2 accuracy. Fix: keep the hint in the name, drop `aria-keyshortcuts` for single-character tools (keep for Ctrl combos), or accept and rely on the scope note.
- NN2 CMP-Canvas annotation kinds: hidden text span "Text "Đường dẫn lỗi"..." lacks `lang="vi"` (the visual has it). Criterion 3.1.2. Fix: set `lang` on the span. The multi-select cell's "Remove?" text has no hidden text (sample only; spec rule covers it).
- NN3 CMP-TextEditor empty: placeholder "Type here" is a child inside `role=textbox`, so it is exposed as the value. Criterion 4.1.2. Fix: render via `::before`/`data-placeholder` plus `aria-placeholder` only.
- NN4 CMP-ShortcutHelp: scope note says "Tool and editing keys work while the image has focus" but `?`, Shift+1, Shift+0 (Help and View) are canvas-only too. Fix: "Single-key shortcuts work while the image has focus." (COPY-shortcuts.scope_note.)
- NN5 CMP-StylePanel: triage says the geometry group is a fieldset; 5 of 6 are not (see m13). Fix: apply to all.
Notes (no finding): handle hit areas (24 px) overlap on very small annotations; equivalent control exists through Position and size fields and arrow keys (2.5.8 equivalent, 2.5.7). Pan is Space+drag with wheel/scroll fallback, manual.

## 4. Contrast (new pairings only; dark / light)
Script: scratchpad c.py plus extra pairs. No regressions.
- accentHover on Copy (onAccent): 8.47 / 8.55.
- Focus ring accent on dangerBg: 5.20 / 5.57; on selection (dark) 5.02.
- Notice close icon muted on dangerBg: 5.43 / 5.89.
- Padding frame muted vs workArea: 6.76 / 5.74; vs white padding 2.94 (dark) / 6.92 (light), but dark frame sits against dark workArea so the edge is carried by white vs workArea.
- Narrow tooltip surface on fg: 18.5 (light).
- Step badges: white on D62828 5.01, white on 0B63E5 5.34, black on FFD60A 14.9.
- Input border lineStrong on bg: 3.54 / 3.47; kbd and quiet-button states unchanged.
Disabled controls are exempt. Round-2 marginals unchanged (handle border 3.04, lineStrong on surface 3.34).

## 5. Needs a manual pass
Screen reader (live regions, alertdialogs, radiogroup arrow-key roving, menus, kbd spoken forms, Tab through annotations); rendered focus on all controls and clipping (N8); 200 % text, 320 px reflow and text spacing; touch pass (narrow scroll strip, handles); tooltip behaviour 1.4.13; Notice timing pause (N7); selection outline on mid-tone images in both themes; reduced motion and forced colours; drag alternatives (pan).
