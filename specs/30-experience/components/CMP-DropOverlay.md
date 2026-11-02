---
id: CMP-DropOverlay
title: Drop overlay
status: ready
tokens: []
---

## Purpose
Show where a dragged file will be dropped.

## Anatomy
Full-area overlay with COPY-load.drop_here.

## Variants & states
| Variant / state | Description |
|---|---|
| active | A file is being dragged over the tool |

## Behavior
Appears when a file enters the tool, disappears on drop, leave or Esc.

## Accessibility
Announced politely each time it appears; the message is cleared when it disappears.
