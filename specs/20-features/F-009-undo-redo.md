---
id: F-009
title: Undo and redo
status: draft
milestone: M-1
priority: P0
personas: [PER-01]
entities: [ENT-Session]
rules: [RULE-11, RULE-19]
screens: [SCR-Annotator]
components: [CMP-Toolbar]
nfr: [NFR-02]
events: []
depends_on: [F-008]
---

## Intent
Mistakes must cost nothing (PRN-04).

## Scope
- In: undo and redo of every change in RULE-11.
- Out: a history list; undo across sessions.

## Requirements
- **R1** Undo reverts the last change in RULE-11; redo re-applies it; both are available by keyboard (RULE-19) and as controls.
- **R2** Making a new change after undoing discards the redo steps.
- **R3** Undo and redo restore the selection that went with that change, so the user sees what changed.
- **R4** At least the last 200 changes can be undone (RULE-11).

## Acceptance criteria
- **AC1** Given the user drew a rectangle and moved it, when they press Ctrl+Z twice, then first the move and then the rectangle are undone; Ctrl+Shift+Z twice brings both back. (R1)
- **AC2** Given the user undid a change, when they draw a new arrow, then redo is unavailable. (R2)
- **AC3** Given the user recoloured two annotations, when they undo, then both get their old colour back and are selected. (R3)
- **AC4** Given 250 changes, when the user undoes 200 times, then each one reverts one change in order. (R4)
- **AC5** Given a newly loaded image, when the user looks at the toolbar, then COPY-action.undo and COPY-action.redo are disabled; after one change and one undo, then undo is disabled and redo is enabled. (R1)
- **AC6** Given a selected arrow, when the user holds the Right arrow key until it has moved 40 pixels and then undoes once, then the arrow is back where it started. (R1)

## UX notes
COPY-action.undo and COPY-action.redo in CMP-Toolbar.

## Edge cases
- Undo while editing text → undoes typing inside the text first (browser text undo); after
  editing ends, undo reverts the whole edit as one step.

## Open questions
