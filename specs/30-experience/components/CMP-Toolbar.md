---
id: CMP-Toolbar
title: Toolbar
status: ready
tokens: []
---

## Purpose
Load, pick a tool, undo/redo and export.

## Anatomy
COPY-action.open; tool group (COPY-tool.select … COPY-tool.crop, one active); COPY-action.undo,
COPY-action.redo; the live redaction count (COPY-export.redaction_count, RULE-20, hidden at 0);
COPY-action.copy (primary), COPY-action.download; COPY-action.more overflow holding
COPY-action.clear and COPY-action.shortcuts.

## Variants & states
| Variant / state | Description |
|---|---|
| no image | Tools and export disabled; open enabled |
| narrow | Tools collapse to icons with names as tooltips (COPY-tool.shortcut_hint) |

## Behavior
Exactly one tool is active. Picking a tool clears nothing; the selection stays until the user
draws or clicks elsewhere.

## Accessibility
Tool group is a single-choice toolbar with arrow-key navigation; each control's name includes its
shortcut (NFR-06).
