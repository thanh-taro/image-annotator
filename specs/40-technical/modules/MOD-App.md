---
id: MOD-App
title: App — shell, components, signals wiring, commands, announcements
status: draft
depends_on: [MOD-Core, MOD-Document, MOD-Canvas, MOD-Keys, MOD-IO, MOD-Host, MOD-Copy]
---

## Responsibility
The single-screen shell (SCR-Annotator) and the orchestrator between the user, the document, the
canvas and IO. It renders CMP-Toolbar (tools with shortcut names, undo/redo, zoom, copy/download
with the live redaction count, F-012.R8), CMP-StylePanel (current style or the selection's shared
choices, redaction kind with the not-secure label and the solid offer, position and size fields,
crop fields and reset, canvas padding and background with unavailable sizes; on narrow widths the
**summary bar and bottom sheet** of D-019, telling MOD-Canvas the sheet's height),
CMP-StatusBar (zoom and the canvas size once a crop or padding exists, D-017), CMP-Notice,
CMP-ConfirmDialog (scale-down, replace, clear), CMP-ShortcutHelp, CMP-EmptyState (including the
click-to-paste hint when it has no focus, F-001.R9) and CMP-DropOverlay. It holds the signals of
ADR-0008 (document and history from MOD-Document, selection, tool, page-lifetime current styles,
view, notices, computed unexported and redaction count), dispatches MOD-Keys actions, runs the
load flow (checks → replace confirmation only when unexported → new session) and the export flow
(result notice with the count, RULE-20), and owns the polite and assertive live regions
(NFR-06). It shows the privacy statement, explanation and source link (F-016).

## Not responsible for
- Canvas painting and pointer input (MOD-Canvas, MOD-Render).
- File, clipboard and `beforeunload` transport (MOD-IO); host messages and offline (MOD-Host).

## Public surface
- The app root and the components above, bound to the signals.
- Commands: `load`, `clear`, `undo`, `redo`, `setTool`, `setStyle`, `setFields`, `resetFrame`,
  `setPadding`, `setBackground`, `copy`, `download`, `showShortcuts`.

## Implements
SCR-Annotator, FLOW-01, FLOW-02; F-001.R7/R8/R9, F-007.R4/R6, F-008.R4/R5/R8, F-009.R1,
F-010.R3/R4/R6, F-011.R1/R2/R5, F-012.R4/R5/R7/R8, F-013.R2/R3/R4, F-014.R3, F-016.R1/R2/R3,
F-018.R7; RULE-04, RULE-18, RULE-20; NFR-06, NFR-07.
