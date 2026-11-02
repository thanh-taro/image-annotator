# Design audit — D1 components, round 1

Source: design-auditor agent (saved by the orchestrator; the agent can't write files).
Scope: the 10 CMP-* boards on the canvas, against the CMP specs, copy.md, tokens.json and adapters/design.md.
Counts: 1 blocker, 14 major, 22 minor. Token values: all `--role` values match tokens.json in both themes.

## Blocker
- **CMP-StylePanel**: no single-selection variant with the position fields. X, Y, Width and Height are missing, and so are Start/End X and Y for lines and arrows. These fields are the only way to move or resize without dragging (NFR-06, D-008). Fix: add "selection: single rectangle" (COPY-geometry.title, X/Y/Width/Height) and "selection: single arrow" (COPY-geometry.start/end).

## Major
1. **CMP-StylePanel**: the Fill control (None / Solid / Translucent, F-003.R3) isn't designed.
2. **CMP-StylePanel**: there's no "tool" variant for a drawing tool (colour, size, fill).
3. **CMP-StylePanel**: missing redaction states: solid (no warning, with a colour choice), pixelate, and a selected blur redaction with "Use solid" (F-007.R4, AC5, AC8).
4. **Crop panel**: the field text reads "W" and "H" but the copy is "Width" and "Height". The heading has no data-copy (COPY-tool.crop).
5. **Canvas panel**: the "Canvas:" prefix isn't in copy.md. Drop it.
6. **Canvas panel**: missing the normal case, a 1000 px image with Medium selected and a white background (F-011).
7. **Toolbar, narrow**: Undo/Redo, Download and the redaction count are missing (RULE-20).
8. **Toolbar, narrow**: the tooltip state (COPY-tool.shortcut_hint) isn't designed.
9. **Canvas, annotation kinds**: there's no arrow (the purple stroke has no head), and blur isn't distinct from pixelate.
10. **Canvas**: no multi-selection variant (outline, no handles).
11. **TextEditor**: no empty state showing COPY-text.placeholder.
12. **ShortcutHelp**: only Windows/Linux keys are shown, and there's no ⌘ (Mac) variant.
13. **ShortcutHelp and Notice**: the fixed widths don't fit at narrow (NFR-07), the list will probably clip, and there are no narrow frames.
14. **StatusBar, no image**: Fit to view and Actual size have no data-copy, the "–" placeholder isn't marked as sample, and there's no narrow no-image frame.

## Minor
- **Raw hex for board background and labels**: the board background and label colour use raw hex. Declare them as roles.
- **Label naming**:
  - "overflow menu open", "zoom menu (narrow)", "privacy details (popover)" and "annotation kinds (…)" need the `CMP-X / variant / theme` form.
  - Extra notes such as "(multi-line)", "(vi-VN text)" and "(focus on Cancel)" belong in the variant slot, not the theme slot.
- **TextEditor**: the vi-VN sample needs `lang="vi"` and `data-sample`.
- **vi-VN UI strings**: not shown yet. The plan covers this in D4.
- **Aria-only labels without data-copy**:
  - Toolbar: Undo/Redo (no-image row), More actions, narrow Open image, the tool buttons.
  - StatusBar: narrow source link, zoom in/out.
  - StylePanel: the swatches need COPY-color.*.
- **Wide overflow menu**: it contains Download, but the spec lists only Clear and Shortcuts.
- **StatusBar**: the narrow zoom button uses a "▾" glyph; use an SVG chevron. The no-image source link is missing its icon.
- **StylePanel copy reuse**: Padding and Strength reuse size_s/m/l. Confirm this in the spec.
- **StylePanel sizes**: the field is 64 px; use 56 px. The 9-column background grid overflows by 2 px.
- **Canvas**:
  - The checker square is 16 px; use 8 px.
  - The visible chip uses the screen-reader-only string COPY-a11y.annotation.
  - The translucent rectangle's opacity also fades its border (RULE-04 says fill only).
  - The blur/pixelate greys aren't tokens or marked as sample.
  - No padding frame.
- **DropOverlay**: uses cropDim; it should use scrim.
- **EmptyState**: the focus ring on Open image isn't shown.
- **Notice**: the progress variant for COPY-load.loading is missing.
- **Off-scale values**: radii (12, 4/5, 2), font sizes 11 and 16, and spacing 6/10/14/18. Snap them to the tokens.
- **ShortcutHelp**:
  - Key names (Delete, Esc, Enter, …) have no COPY IDs.
  - The Ctrl+Y and Backspace aliases aren't shown.
