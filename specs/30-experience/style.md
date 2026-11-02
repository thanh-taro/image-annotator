---
title: Style — Workbench
status: ready
---

# Style — "Workbench" (decision D-011, layout D-012)

The annotator is a workbench inside the portal's night market: the same palette, fonts, spacing
and motion as the host and its sibling tools. The image is the hero; chrome stays thin. All
values live in `tokens.json`; no hard-coded colours, sizes or fonts in components.

## Principles
1. **Image first.** A thin toolbar (`size.toolbar`) on top, the style panel (`size.panel`) docked
   on the right, the status bar (`size.statusbar`) at the bottom; the work area (`workArea`)
   takes everything else. Hairlines (`line`) separate regions; no cards, shadows or glow.
   Floating menus and dialogs are set apart by a `lineStrong` border on `surface`.
2. **One filled button.** Copy is the only filled control (`accent` / `onAccent`). Every other
   action is a quiet icon or text+icon button that fills with `surface2` on hover. The active tool
   and selected choices are shown with `selection` fill plus a `border.width.focus` `accent` inset
   border, never colour alone; disabled controls are transparent with `muted` text. Dialog primary
   actions are outlined (`accent`, or `danger` when they discard work) and Cancel stays quiet.
   Buttons are 32 px in the toolbar, dialogs and menus and `size.control` in the panel and status
   bar; on a coarse pointer every target grows to `size.touchTarget`.
3. **Chrome never competes with annotations.** UI colours come from the theme; annotation colours
   (`annotation.color.*`) appear only in swatches and on the canvas. Selection, handles and the crop
   frame use `selectionOutline`, `handleFill` and `handleBorder`, which read on any image.
4. **Dense but targetable.** Tool buttons are `size.toolButton`; every interactive element is at
   least `size.targetMin`, and `size.touchTarget` when the primary pointer is coarse. Handles are
   drawn at `size.handle` with a `size.targetMin` hit area. Text never goes below `font.size.xs`.
5. **Honest safety.** The not-secure note for blur and pixelate uses `accent2Fg` on `warnBg` with
   an icon and words; solid redaction carries a small check icon. The privacy badge uses `success`.
6. **Same in both themes.** Dark and light are both first-class; every text and UI pair in
   `contrast.pairs` passes WCAG AA (`tools/token_contrast.py`).
7. **Crisp shapes.** `radius.sm` for buttons, fields and swatches; `radius.pill` only for the
   redaction count; the canvas itself is square-edged.

## Type
- **UI:** Manrope 500/600 at `font.size.sm`–`md` for buttons, labels and panel text.
- **Numbers:** zoom level and sizes in JetBrains Mono at `font.size.sm`; position fields at
  `font.size.input` so phones don't zoom on focus.
- **Text annotations:** drawn on the canvas in Manrope 600 (covers Vietnamese, RULE-08), sizes
  from RULE-04, not from the UI scale.
- The portal's display face is not used inside the tool.

## Regions
- **Layout widths** (D-014), measured on the tool's own width (the iframe when embedded): **wide**
  at 1000 px and up; **compact** from 800 to 999 px (one-row toolbar with Open image and Download as
  icons, status bar without the image size, style panel on the right); **narrow** below 800 px
  (two-row toolbar, bottom-sheet style panel, icon status bar).
- **Toolbar:** groups separated by hairline dividers: open · tools (select, shapes, pen,
  highlight, text, step, redact, crop) · undo/redo · (right-aligned) redaction count pill, Copy
  (filled), Download, overflow. On narrow widths labels hide, tools scroll horizontally in their
  group, and Download moves into the overflow.
- **Work area:** `workArea` background, canvas centred with a 1 px `lineStrong` outline so its edge shows on light images; transparent areas show a `checkerA` /
  `checkerB` checkerboard of `size.checker` squares; outside the crop frame `cropDim` while cropping.
- **Style panel:** sections with small `muted` headings: colour swatches (8, in RULE-04 order) ·
  size S/M/L segmented control · fill or redaction kind · position and size fields · selection
  actions. When nothing is selected with the select tool: padding and background. On narrow
  widths the panel becomes a bottom sheet that opens from the active tool.
- **Notices:** CMP-Notice floats at the bottom centre of the work area, `space.4` above its edge, up to 680 px wide; it never covers the toolbar, style panel or status bar.
- **Status bar:** privacy badge (`success`) and source link at the start; image size; zoom
  controls at the end.

## Motion
Only `motion.duration.fast` hover/press fades and `base` panel or sheet open/close. Under
reduced motion, opacity changes only. Drawing and dragging are never animated.

## Iconography
1.5 px stroke icons at `size.icon.md` in the toolbar and `size.icon.sm` elsewhere, rounded caps,
from the same open-licensed set as the portal (chosen in the architecture).
