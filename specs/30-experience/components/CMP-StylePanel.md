---
id: CMP-StylePanel
title: Style panel
status: ready
tokens: []
---

## Purpose
Change the style of the active tool or the selection, the position and size of a single
selection or the frame, or canvas settings when nothing is selected.

## Anatomy
With a multi-selection, the wide panel starts with a heading COPY-a11y.selected_count (D-035); with canvas settings it starts with the drawing colour (COPY-style.color, the shared current colour of RULE-04, D-047), then a heading COPY-canvas.title above padding and background, so those colours read as the background, not the drawing colour (D-046); the narrow sheet shows it in its summary bar (COPY-style.sheet_summary).
Colour swatches (COPY-style.color: COPY-color.red, COPY-color.orange, COPY-color.yellow,
COPY-color.green, COPY-color.blue, COPY-color.purple, COPY-color.black, COPY-color.white; from M-1b
then the custom swatch, COPY-style.color_custom or COPY-style.color_custom_value, F-019);
COPY-style.size (COPY-style.size_s, COPY-style.size_m, COPY-style.size_l; from M-1b then the
COPY-style.size_px field and, on the wide layout, a slider, F-019); COPY-style.fill;
COPY-redact.kind with COPY-redact.not_secure_short on the blur and pixelate choices,
COPY-redact.not_secure and COPY-redact.use_solid; COPY-style.strength (its choices reuse COPY-style.size_s, COPY-style.size_m, COPY-style.size_l);
selection actions; position and size fields (COPY-geometry.title: COPY-geometry.x,
COPY-geometry.y, COPY-geometry.width, COPY-geometry.height; for lines and arrows
COPY-geometry.start and COPY-geometry.end, each with X and Y); canvas settings
(COPY-canvas.padding with COPY-canvas.padding_none, then COPY-style.size_s/m/l, and, when sizes are unavailable,
COPY-canvas.padding_unavailable; COPY-canvas.background); crop size and reset.

## Variants & states
| Variant / state | Description |
|---|---|
| tool | Choices for the active drawing tool's current style |
| selection | Only choices shared by every selected annotation kind; position and size fields for a single selection |
| canvas | The shared drawing colour (RULE-04, D-047), then padding and background, when the select tool is active and nothing is selected |
| crop | Frame size (COPY-crop.size), position and size fields, reset |
| narrow | Narrow layout width (style.md, D-014, D-019): a summary bar named COPY-style.sheet_toggle sits between the work area and the status bar, showing the current colour (when the subject has one; for the canvas, a palette background colour, none when transparent) and COPY-style.sheet_summary; for a blur or pixelate redaction the summary carries the COPY-redact.not_secure_short tag (RULE-10, D-031). Tapping the bar, or the active tool again, opens the panel as a bottom sheet over the lower part of the work area, at most half its height including the bar, scrolling inside, with the bar as its header; while it is open the view moves (and refits, if it was fitted) so the canvas, or the frame while cropping, shows above it, and closing it restores the view; tapping the bar again, the active tool again, or Esc closes it. Selecting annotations updates the bar and does not open the sheet. Hidden when no image is loaded |

## Behavior
Changes apply immediately. Changes to selected annotations, padding, background or the frame
are one undo step each (RULE-11); changes to a tool's current style, or to the drawing colour in canvas settings, are not. Position and size
fields accept whole image pixels and apply on Enter or when focus leaves the field; values are
kept within the same limits as dragging (width and height at least 1 image pixel; X and Y may be negative, so an annotation can sit partly outside the canvas, RULE-14). Padding sizes that would exceed the size limit are
unavailable (RULE-14).
When the selected annotations differ in a choice (colour, size or kind), no option of that choice is marked (and the size field is empty, F-019.R7).

## Accessibility
Swatches are a labelled radio group named by their colour names, never by colour alone. On a coarse pointer the wide panel, and the narrow sheet below 386 px wide (where 8 touch-sized swatches don't fit in one row), lay the 8 swatches out in 2 rows of 4 (from M-1b, the 9 colour choices with the custom swatch in 2 rows of 5, F-019); on narrow widths or a coarse pointer the 9 background choices (transparent and the 8 colours) are laid out in 2 rows of 5 at touch size. The
position and size fields are the non-drag alternative for moving and resizing (NFR-06). On narrow widths the summary bar is a button named "COPY-style.sheet_toggle: COPY-style.sheet_summary" (its visible text), reporting whether the sheet is expanded; the sheet follows it in reading order and opening it does not move focus.
