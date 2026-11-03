---
id: CMP-StatusBar
title: Status bar
status: ready
tokens: []
---

## Purpose
Privacy statement, image size and zoom.

## Anatomy
COPY-privacy.badge (opens COPY-privacy.details with COPY-privacy.notices and COPY-action.close);
source link COPY-privacy.source_label; COPY-status.image_size; zoom controls (COPY-action.zoom_out,
COPY-status.zoom, COPY-action.zoom_in, COPY-action.zoom_fit, COPY-action.zoom_actual).

## Variants & states
| Variant / state | Description |
|---|---|
| compact | Compact layout width (style.md, D-014): as the wide layout, with COPY-status.image_size hidden |
| narrow | Narrow layout width (style.md, D-014). Privacy statement as an icon named COPY-privacy.badge_label; source link as an icon named COPY-privacy.source_label; image size hidden; COPY-action.zoom_fit and COPY-action.zoom_actual move into a menu opened from COPY-status.zoom |
| no image | Size hidden, zoom disabled |

COPY-status.image_size shows the canvas size, which is the export size (RULE-15): the frame plus its padding (RULE-14).

## Behavior
Zoom level updates live.

## Accessibility
Zoom changes are not announced on every step; the level is readable on focus.
Privacy details: a non-modal popover (`size.popover` wide at most); focus moves into it when it opens; Esc or Close dismisses it and returns focus to the statement; a press outside it, or focus leaving it, also dismisses it.
