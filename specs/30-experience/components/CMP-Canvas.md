---
id: CMP-Canvas
title: Canvas
status: ready
tokens: []
---

## Purpose
Show the image, padding and annotations at the current view, and take drawing and editing input.

## Anatomy
Checkerboard behind transparent areas; image; padding; annotations; selection handles; frame
with dimmed outside while cropping; pointer cursor per tool.

## Variants & states
| Variant / state | Description |
|---|---|
| drawing | Live preview of the annotation being drawn |
| selected | Handles on a single selection, outline on a multi-selection |
| cropping | Frame handles; the area outside the frame is dimmed only while the crop tool is active |

## Behavior
Pointer events for mouse, pen and touch; one finger draws, two fingers pan and zoom (F-002).
Keys per RULE-19. Clicks hit the visible mark of an annotation, with a tolerance that grows when
zoomed out.

## Accessibility
One focusable region named COPY-a11y.canvas. Tab moves through annotations (RULE-19); the
selected annotation is announced with COPY-a11y.annotation, and multi-selections with
COPY-a11y.selected_count. Tool changes, placing, deleting, duplicating, undo and redo are announced
politely with COPY-a11y.tool_active, COPY-a11y.placed, COPY-a11y.deleted_count,
COPY-a11y.duplicated_count, COPY-a11y.undone and COPY-a11y.redone (NFR-06).
