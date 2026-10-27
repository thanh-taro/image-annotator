---
id: CMP-EmptyState
title: Empty state
status: draft
tokens: []
---

## Purpose
Tell the user how to load an image.

## Anatomy
COPY-load.empty_title; COPY-load.empty_hint, or COPY-load.click_to_paste when embedded and the
tool has no keyboard focus; COPY-action.open.

## Variants & states
| Variant / state | Description |
|---|---|
| default | Shown when no image is loaded |
| unfocused | Embedded without keyboard focus: the hint asks for a click first |

## Behavior
The whole area is a drop target and a click target that gives the tool focus; paste works
anywhere in the tool once it has focus. The tool never takes focus from the host by itself.

## Accessibility
COPY-action.open receives focus first.
