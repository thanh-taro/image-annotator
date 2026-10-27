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
| narrow | Privacy statement as an icon named COPY-privacy.badge_label; source link as an icon named COPY-privacy.source_label; image size hidden; COPY-action.zoom_fit and COPY-action.zoom_actual move into a menu opened from COPY-status.zoom |
| no image | Size hidden, zoom disabled |

## Behavior
Zoom level updates live.

## Accessibility
Zoom changes are not announced on every step; the level is readable on focus.
