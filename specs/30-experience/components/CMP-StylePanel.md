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
Colour swatches (COPY-style.color: COPY-color.red, COPY-color.orange, COPY-color.yellow,
COPY-color.green, COPY-color.blue, COPY-color.purple, COPY-color.black, COPY-color.white);
COPY-style.size (COPY-style.size_s, COPY-style.size_m, COPY-style.size_l); COPY-style.fill;
COPY-redact.kind with COPY-redact.not_secure and COPY-redact.use_solid; COPY-style.strength;
selection actions; position and size fields (COPY-geometry.title: COPY-geometry.x,
COPY-geometry.y, COPY-geometry.width, COPY-geometry.height; for lines and arrows
COPY-geometry.start and COPY-geometry.end, each with X and Y); canvas settings
(COPY-canvas.padding with COPY-canvas.padding_none, COPY-canvas.background); crop size and reset.

## Variants & states
| Variant / state | Description |
|---|---|
| tool | Choices for the active drawing tool's current style |
| selection | Only choices shared by every selected annotation kind; position and size fields for a single selection |
| canvas | Padding and background, when the select tool is active and nothing is selected |
| crop | Frame size (COPY-crop.size), position and size fields, reset |

## Behavior
Changes apply immediately. Changes to selected annotations, padding, background or the frame
are one undo step each (RULE-11); changes to a tool's current style are not. Position and size
fields accept whole image pixels and apply on Enter or when focus leaves the field; values are
kept within the same limits as dragging. Padding sizes that would exceed the size limit are
unavailable (RULE-14).

## Accessibility
Swatches are a labelled radio group named by their colour names, never by colour alone. The
position and size fields are the non-drag alternative for moving and resizing (NFR-06).
