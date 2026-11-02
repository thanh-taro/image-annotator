# Design loop D1 — round 3 triage (final round)

Inputs: design-D1-round-3-audit.md (0/0/3), design-D1-round-3-ui.md (0 blocker / 2 major / 8 minor + open round-2 items), design-D1-round-3-a11y.md (0/0/5 + m7, m12, m13, m15).
Board sources now live in `design/canvas/project/` (per adapters/design.md).

## Decision
- **D-014 (owner):** three layout widths by the tool's own width: wide ≥ 1000 px, compact 800–999 px, narrow < 800 px. The owner also approved one targeted UI check past the round limit.

## Spec changes (draft until G2; changelog updated, lint 0/0)
- style.md: new "Layout widths" bullet (D-014).
- CMP-Toolbar, CMP-StatusBar: new compact row; narrow rows state "< 800 px".
- copy.md: COPY-shortcuts.scope_note → "Single-key and editing shortcuts work while the image has focus." (RULE-19; audit R3-1, a11y NN4). COPY-load.click_to_paste adds "or choose Open image" (a11y m12).

## Board fixes
- **Toolbar:**
  - Compact 900 frame (R3-1).
  - Tool buttons drop the single-key aria-keyshortcuts (NN1 / audit R3-2).
  - Disabled Copy/Download keep icons (R3-4).
  - The narrow strip uses an 8 px gap, so the 8th tool is cut about halfway, with a chevron in the fade (R3-2).
  - The scrolled-end frame uses a real scroll offset, with Arrow cut under the left fade (R3-10).
  - The tooltip is surface + lineStrong (N13).
- **StatusBar:**
  - Compact 900 frame, with the image size hidden.
  - Privacy popover wide and narrow 390 frames (16 px gutters, 44 px targets) (audit R3-3, UI R3-6).
  - 13 px labels; 1.5 strokes; 8 px side padding (N15).
- **StylePanel:**
  - All five position-and-size groups are fieldset/legend (NN5, m13).
  - 13 px button labels (N10); 1.5 strokes (N12).
  - "2 annotations selected" is 13/600 fg with a hairline (N14).
  - The crop read-out is 13 px.
- **Canvas:**
  - `lang="vi"` on the hidden text (NN2).
  - The crop size chip sits 12 px below the frame, clear of the handle hit areas (N15).
- **TextEditor:** the placeholder is at 50 % and aria-hidden, exposed only through aria-placeholder (NN3, R3-3); the halo is 1 px to match the canvas (N7).
- **ShortcutHelp:**
  - New scope note.
  - h3 weight 600.
  - 1.5 strokes.
  - The narrow dialog is 358 px (16 px gutters) (R3-5).
  - Mac glyphs are spaced: "⌥ arrows", "⌥ drag", "⌘ wheel" (R3-7).
- **Notice:**
  - Narrow error wraps, with the action on its own row aligned to the text (R3-8).
  - The reduced-motion ring is a dashed circle with no CSS `d:path` (R3-9).
  - 13 px labels; 1.5 strokes.
- **EmptyState:** 1.5 stroke; new unfocused copy.
- **DropOverlay:** the pill has a 1 px lineStrong border (N13); 1.5 stroke.

## Recorded, not changed
- **a11y m7:** the tool group keeps the toggle-button pattern (aria-pressed inside role=toolbar, arrow-key roving). The spec's "single-choice toolbar" is met by behaviour, and toggle buttons are the expected pattern for tool palettes.
- **a11y m15:** the editing halo stays white. The outline pairing is set by RULE-07 at implementation, so this is a build note.
- **UI N6 nit:** the Copy "pressed" state looks like hover. It is left to the implementation's `:active` style.
- **UI N15:** line heights 1.45/1.5 and the 12 px mono status read-outs are polish, deferred to D3 screen review.
- Everything deferred in round 2 stays deferred (StylePanel narrow → D3; cursors → D2; manual QA list).

## Verification pass (owner-approved, Toolbar + Status bar)
UI critic measured the two boards in headless Chrome. Fixed: R3-4, R3-10 (arithmetic), N13, R3-6/audit R3-3, N10/N12. Two majors remained, and both are now fixed:
- **Compact toolbar overflowed at 800 px** (vi-VN "Sao chép" / "3 vùng che", or 10+ redactions in en).
  - CMP-Toolbar has a new "count fallback" row: in compact and narrow the count shows an icon and the number whenever its text doesn't fit. This replaces "below 360 px", which was too low (the narrow row overflowed at 360–368 px in vi).
  - New frame: compact 800 with 128 redactions (about 791 px with vi Copy).
- **Narrow strip cut was invisible** (the icon sat under the solid fade).
  - Spec: the gap is space.1–space.3, chosen so the last visible icon is about half under the faded edge. Checked at 320/340/360/375/390.
  - Board: 4 px gap at 390, so Text's icon is half under the fade; the fade gradient now reaches the surface colour at 85 %.
  - Scrolled-end frame: offset -144, with Arrow's icon half under the left fade.
Published to the canvas as version 37. Loop closed: converged.
