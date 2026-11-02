# Design loop D1 — round 1 triage

Inputs: design-D1-round-1-audit.md (spec), design-D1-round-1-a11y.md (accessibility), design-D1-round-1-ui.md (UI critique).
Totals before merging duplicates: 2 blockers, 29 major, 45 minor. Duplicates merged below.

## Decisions taken in this round (orchestrator, balanced autonomy; listed for G2 review)
- **Letter shortcuts (WCAG 2.1.4):** RULE-19 already limits the Tools, Canvas and Edit keys to when the canvas has focus. That is the WCAG "active only on focus" exception, so no spec change.
- **Dialog primary actions:** to keep "one filled button" (style.md), dialog primary actions are outlined. Replace and Start over use `danger` text and border; Open scaled down uses `accent`. Cancel is plain and has focus first.
- **New copy keys** (spec change, draft until G2): COPY-redact.not_secure_short and COPY-canvas.padding_unavailable.
- **Key labels in the shortcut list** stay as printed on the keyboard and are not translated (CMP-ShortcutHelp note). The macOS variant uses ⌘ ⌥ ⇧.
- **Canvas chip** showing the screen-reader-only COPY-a11y.annotation is removed. The canvas gets a hidden polite live region instead (COPY-a11y.*).
- **Drop overlay** uses `scrim`, not `cropDim`.

## Fix list (all applied in round 1)
### Shared across boards
- Selected/active state: `accent` border on tool buttons, segmented controls and redaction kinds, plus `aria-pressed` or `aria-checked`.
- Focus style: `border.width.focus` 2 px `accent` outline with a 2 px offset, shown on at least one control per board.
- Swatch selected ring is drawn inside (inset), so it differs from the focus ring.
- No text below 12 px. Dialog headings 17 px (`font.size.lg`).
- Radii only 7 / 10 / pill.
- Spacing snapped to the 4/8/12/16/20/24 scale.
- Icons 16 or 20 px.
- Selection outline and crop frame: 2 px `selectionOutline` with a 1 px `workArea` halo outside (accent alone is 2.86:1 on a light screenshot in dark).
- Labels follow `CMP-X / variant / theme`.
- Board background and label colour declared as roles.
- `data-copy` on every aria-only label.

### StylePanel
Variants added or fixed:
- **Tool states:** tool: rectangle (colour, size, Fill); tool: redact solid / blur / pixelate.
- **Selections:** selection: single rectangle (Position and size X/Y/Width/Height); selection: single arrow (Start / End X and Y); selection: blur redaction with Use solid.
- **Canvas:**
  - canvas normal case (Medium padding, white background);
  - canvas at the limit, where the unavailable sizes get a note instead of a strike-through.
- **Crop:** Width/Height labels.
- **Labels and sizing:**
  - "Not secure" tag on the Blur and Pixelate options;
  - the "Not secure:" prefix is bold;
  - fields are 56 px;
  - swatches use fixed 24 px columns.

### Toolbar
- **Narrow toolbar:** keeps Undo and Redo as icons. Download moves to its overflow menu, the count pill sits beside Copy, and a tooltip frame is added. Narrow targets are 44 px (`touchTarget`).
- **Wide overflow menu:** Clear and Shortcuts only.
- **Text buttons:** 32 px tall, the same as tool buttons.

### Canvas
- Add an arrow with a head and a distinct blur swatch.
- Add a multi-selection frame.
- Apply the translucent fill opacity to the fill only.
- Checker squares 8 px; the sample greys are marked `data-sample`.
- Add a padding frame.
- Name the region on every variant, with `tabindex="0"`.
- Handles keep their 10 px visual size and get a 24 px hit area.

### Other boards
- **TextEditor:** add an empty state with the placeholder; the vi-VN sample gets `lang`.
- **Notice:**
  - one persistent live region per politeness level;
  - `max-width: 100%`, plus a narrow frame and a loading frame;
  - the spinner has a reduced-motion note;
  - the button border uses `danger` on `dangerBg` (6.86 dark / 5.03 light; `lineStrong` was 2.90).
- **ShortcutHelp:**
  - list semantics, with spoken names in visually hidden text;
  - a macOS variant, plus the Backspace and Ctrl+Y aliases;
  - the list scrolls, and there is a narrow frame.
- **StatusBar:** data-copy on everything, an SVG chevron and a narrow no-image frame. Badge and link are at least 24 px tall.
- **EmptyState:** a focus ring on Open image, and a dashed border in `muted` (`lineStrong` was 2.99 in light).
- **DropOverlay:** a `scrim` backdrop and a dashed border in `fg` (7.1 dark / 6.72 light over the scrim on a light image).

## Deferred
- vi-VN UI strings across regions go to D4 (plan).
- The 200 % text and 320 px reflow checks are manual in QA. The boards show the 390 px narrow layout.
- Screen reader, forced-colors and real-image outline contrast checks are manual in QA (phase 5).
