---
id: ADR-0009
title: Text — canvas glyphs in the tool's face, edited through a transparent text field overlay
status: accepted
date: 2026-11-02
supersedes: []
---

## Context
RULE-08: one typeface (the tool's own UI face, covering Vietnamese), sizes per RULE-04, up to
2,000 characters, anchored top-left, lines break only at typed new lines, coloured text with an
outline of width max(1, 0.08 × size) in the contrast pairing (RULE-07). F-005.R2: while editing,
the text shows at its final size and colour, and keys belong to the text field (RULE-19), with
native undo. F-005.AC7: export matches the 100 % view within 2 image pixels; F-005.AC14 and
F-018.AC10: Vietnamese letters drawn in the tool's face, offline. CMP-TextEditor is a multi-line
text field for accessibility and input methods. Canvas text silently falls back to another face if
the font is not ready.

## Decision
1. **Glyphs on the canvas**: text is drawn by `paint()` (ADR-0004) with
   `font = "600 <size>px Manrope"` (assumption A4), line height 1.25 × size, and a baseline offset
   computed from the font's own vertical metrics (constants in MOD-Core, measured once in
   SP-text) rather than engine-specific `textBaseline` values. Outline: `strokeText` with
   `lineWidth = 2 × max(1, 0.08 × size)` and round joins, then `fillText` on top. Line widths come
   from `measureText`. Step badges use the same face and outline rules (RULE-07).
2. **Editing**: CMP-TextEditor is a `<textarea>` placed exactly over the annotation with CSSOM
   (`element.style`, allowed by `style-src 'self'`), the same face, size × zoom, line height,
   `white-space: pre`, no wrapping, **transparent text** and a visible caret and selection. The
   glyphs the user sees are the canvas's, from the same `paint()` as the export; the caret,
   selection, input method composition, Vietnamese input and undo are the field's own.
3. **Length**: a character is a Unicode code point. Input beyond 2,000 is refused and a paste is
   cut in `beforeinput`, through the field's editing path so native undo stays intact; during
   composition the check runs at `compositionend`.
4. **Fonts first**: on startup `document.fonts.load('600 16px Manrope', 'Aa Đường')` runs for both
   the Latin and Vietnamese subsets in every language; the canvas accepts drawing only after
   `document.fonts.ready`, and export asserts `document.fonts.check(...)`. No font request ever
   follows startup (NFR-01, F-017, F-018.R7). Manrope `latin-ext` is not added (D-025).

**Pending condition — confirmed by spike SP-text**: caret and selection drift < 2 px at 25–800 %
zoom with Vietnamese in NFD and NFC on Chromium and WebKit; input method composition works; the
export matches the 100 % view within 2 px (F-005.AC7). If the overlay drifts beyond that, a new ADR
adopts a visible text field with a CSS stroke (`paint-order: stroke`) while editing.

## Alternatives considered
- **Visible text field with CSS stroke** — simpler, but moves the drift risk to the export, since
  the screen would no longer be drawn by `paint()`.
- **contenteditable** (as drawn in the designs) — harder to keep plain text, line breaks and
  native undo predictable; same role and name are achievable with a `<textarea>`.
- **System fonts** — the export would vary by device (NFR-08).

## Consequences
- Accessible native editing (input methods, Vietnamese, screen readers) and export equal to the
  screen.
- Text outside Latin and Vietnamese ranges falls back to a system face in the export (D-025);
  the spec requires only Vietnamese.
- The canvas is unusable for drawing for the few hundred milliseconds before fonts settle on a
  cold start; loading an image does not wait.

<!-- Accepted ADRs are immutable. Write a new ADR to change a decision. -->
