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
| cropping | Frame handles over the whole image; the area outside the frame is dimmed and the padding is not drawn (F-010.R2). Outside the crop tool only the canvas shows: annotations and handles are clipped to it, and annotations entirely outside it stay in the list, the Tab order and Select all. With the crop tool, annotations are drawn over the whole image and dimmed with it outside the frame; parts beyond the image are not shown, and selection handles are hidden |

## Behavior
Pointer events for mouse, pen and touch; one finger draws, two fingers pan and zoom (F-002).
Keys per RULE-19. Clicks hit the visible mark of an annotation, with a tolerance that grows when
zoomed out.

## Accessibility
One focusable region named COPY-a11y.canvas. Tab moves through annotations (RULE-19); the
selected annotation is announced with COPY-a11y.annotation, and multi-selections with
COPY-a11y.selected_count, when the selection is made with the pointer or Select all; a selection made with Tab is not announced, because focus moves to its option, which is read instead. Tool changes, placing, deleting, duplicating, undo and redo are announced
politely with COPY-a11y.tool_active, COPY-a11y.placed, COPY-a11y.deleted_count,
COPY-a11y.duplicated_count, COPY-a11y.undone and COPY-a11y.redone (NFR-06). Image loads are announced with COPY-a11y.loaded, and starting over with COPY-a11y.cleared. Inside the region, annotations are exposed in drawing order as the options of a multi-selectable list (named COPY-a11y.annotations_list, described by COPY-a11y.annotations_hint), each named with COPY-a11y.annotation, COPY-a11y.step_annotation (steps) or COPY-a11y.text_annotation, selected ones marked selected; Tab and Shift+Tab move between them with a roving focus and leave the list after the last or before the first (RULE-19). The region shows the focus ring (style.md) inset when it has keyboard focus. While CMP-TextEditor is open, the list has no Tab stop. When nothing is selected, the region itself is the Tab stop, and Tab from it selects the first annotation. The canvas count in COPY-a11y.canvas_summary always equals the number of options, and its size is the canvas size shown in CMP-StatusBar. When a change to the crop frame ends (drag released or field committed), COPY-crop.size is announced politely once. Errors are announced in a separate assertive region.
