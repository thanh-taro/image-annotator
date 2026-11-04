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
| compact | Compact layout width (style.md, D-014): one row as in the wide layout, but COPY-action.open and COPY-action.download show as icons named by their labels; the redaction count follows the fallback below |
| narrow | Narrow layout width (style.md, D-014). Two rows. Actions row: COPY-action.open, COPY-action.undo and COPY-action.redo as icons, the redaction count, COPY-action.copy, COPY-action.more (which then also holds COPY-action.download). Tools row: all tools as icons with names as tooltips (COPY-tool.shortcut_hint), scrolling sideways when they don't fit, with the cut-off edge showing that more tools follow: the gap between tools (space.1 to space.3) is chosen for the width so the last visible tool's icon is about half under the faded edge; a fade shows on each edge only while tools are hidden beyond it, and the active or focused tool is scrolled into view. The redaction count follows the fallback below |
| count fallback | In compact and narrow, whenever the count's full text would not fit on its row (for example in vi-VN, or at 10 or more), it shows an icon and the number only, with its full text as the accessible name |

## Behavior
Exactly one tool is active. The select tool is active when the page opens; the active tool is kept when a new image loads. Picking a tool clears nothing; the selection stays until the user
draws or clicks elsewhere.

## Accessibility
Tool group is a single-choice radio group named COPY-a11y.tool_group, with arrow-key navigation; each tool's name includes its
shortcut; other controls state theirs as keyboard shortcuts (NFR-06). When a clicked Undo or Redo becomes disabled, focus moves to the other of the two (NFR-06).
