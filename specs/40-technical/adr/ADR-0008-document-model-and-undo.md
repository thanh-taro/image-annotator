---
id: ADR-0008
title: Document model and undo — immutable snapshots, coalescing, a change epoch for unexported
status: accepted
date: 2026-11-02
supersedes: []
---

## Context
RULE-11 lists what is one undo step (including a multi-selection change, a frame change together
with the padding reduction it causes, and coalesced repeated nudges or Alt-resizes), keeps at
least 200 steps, and starts a new history per image. F-009.R3: undo and redo restore the selection
that went with the change. RULE-07: deleting a step renumbers the rest, and undo restores the old
numbers. RULE-18 and D-010: the session is unexported when any undo step was made, **undone or
redone** since load or the last successful export (undoing back to the exported state still
counts, F-014.AC5). The effects cache (ADR-0006) needs a cheap way to know what changed.

## Decision
1. **Document** = `{ annotations: readonly Annotation[], frame, padding }` of frozen plain objects
   (ENT-Annotation, ENT-Frame, ENT-Padding); the image (ENT-Image) is referenced, never copied.
   Every edit operation in MOD-Document returns a new document that shares every unchanged
   object (structural sharing), so a step costs a few references even with 200 strokes.
2. **History** = a list of steps `{ before, after, selectionBefore, selectionAfter, coalesceKey }`
   and a cursor; a new step after undo discards the redo steps (F-009.R2). **500 steps** are kept
   (≥ 200, RULE-11). Step numbers (RULE-07) and kinds are part of the snapshots, so undo restores
   them without inverse logic.
3. **Coalescing**: arrow-key nudges and Alt-resizes carry a key (operation + selected ids); a step
   with the same key as the top step, with no other command in between, replaces the top step's
   `after` instead of adding one. Any other command (including undo, selection or tool change)
   breaks the chain.
4. **Composite steps**: a frame change computes the padding step-down (RULE-14, F-011.R6) in
   MOD-Core and records both as one step; creating a text and finishing its first edit is one step;
   ending an edit that empties a new text adds none; emptying an existing text is one deletion step
   (RULE-11).
5. **Unexported** (RULE-18): a **change epoch** counts every do, undo and redo; MOD-Document keeps
   the epoch at load and at the last successful export; unexported = an image is loaded and the
   current epoch differs. (A cursor comparison would wrongly clear the flag after export → undo →
   redo.)
6. **UI state** in `@preact/signals` (ADR-0002): `doc`, `history`, `selection`, `tool`,
   `currentStyles` (page lifetime, RULE-04), `view`, `notices`, and computed `unexported` and
   `redactionCount` (RULE-20). Transient drag state lives outside signals in MOD-Canvas.
7. **Text typing undo** stays native to the text field while editing (RULE-19, ADR-0009); the
   committed result becomes one document step.

## Alternatives considered
- **Command pattern with inverse operations** — ~20 operations each needing a correct inverse; more
  code and a drift risk. Rejected.
- **Immer** — convenient, but a runtime dependency for what frozen objects and spreads already do.

## Consequences
- Undo cannot desync from the document; selection restore is data, not logic.
- The effects cache invalidates by object identity.
- Memory per step is small; 500 steps of 200 annotations stay well inside NFR-04.

<!-- Accepted ADRs are immutable. Write a new ADR to change a decision. -->
