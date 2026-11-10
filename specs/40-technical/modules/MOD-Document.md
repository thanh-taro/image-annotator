---
id: MOD-Document
title: Document — immutable session document, edit operations, history, unexported state
status: draft
depends_on: [MOD-Core]
---

## Responsibility
The session's editable state and its history (ADR-0008). It holds the document
(`annotations`, `frame`, `padding`) as frozen plain objects with structural sharing, and offers
every edit as a pure operation returning a new document: add, update (move, resize, restyle,
change redaction kind or strength, set text), delete, duplicate (offset 10 image pixels, steps get
the next number), bring forward / send backward, set frame (with the padding step-down from
MOD-Core in the same step, F-011.R6), set padding and background. It keeps the snapshot history
with selection before/after, 500 steps, coalescing of nudges and Alt-resizes, and redo discard
(RULE-11, F-009). It tracks the change epoch for RULE-18 (every do, undo and redo counts) and
records successful exports. It implements the text commit rules (create + first edit = one step;
empty new text = no step; emptied existing text = one deletion step).

## Not responsible for
- Pointer and key interpretation (MOD-Canvas, MOD-Keys) or rendering (MOD-Render).
- Zoom, pan, tool and current-style state, which are not undo steps (MOD-App signals, RULE-11).
- Any DOM API; it imports MOD-Core only.

## Public surface
- `Doc` type; operations `add`, `update`, `remove`, `duplicate`, `reorder`, `setFrame`,
  `setPadding`, `setBackground`, `commitText(text, isNew)` (a new text carries its anchor and style).
- `History`: `apply(op, selection, coalesceKey?)`, `discardChain(coalesceKey)` (drops a coalesced chain without a step, for a cancelled colour picker, F-019.R8), `undo()`, `redo()`, `canUndo`, `canRedo`,
  each returning the document and the selection to restore.
- `Session`: `startSession(image)` (empty history), `markExported()`, `unexported` (RULE-18).

## Implements
F-005.R6, F-006.R2/R5, F-007.R6, F-008.R2/R4/R5/R7, F-009.R1/R2/R3/R4, F-010.R3/R5,
F-011.R4/R6, F-014 (state for R1/R2/R3); RULE-07, RULE-11, RULE-18. Decided by ADR-0008.
