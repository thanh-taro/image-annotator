---
id: F-014
title: Warn before losing work
status: ready
milestone: M-1
priority: P1
personas: [PER-01]
entities: [ENT-Session]
rules: [RULE-11, RULE-16, RULE-18]
screens: [SCR-Annotator]
components: [CMP-ConfirmDialog]
nfr: []
events: []
depends_on: [F-012]
---

## Intent
Nothing is saved (PRN-01), so closing the tab by mistake would lose the work. Warn only when
there is something to lose (D-004).

## Scope
- In: warning on leaving or reloading the page, and on replacing the image (F-001), when there
  are unexported changes (RULE-18).
- Out: saving drafts; warnings when the portal itself navigates to another page inside the
  portal (the host frame is removed with no prompt, and the tool sends the host nothing but the
  ready signal, RULE-16). Closing or reloading the tab still warns when the host frame allows
  leave-page dialogs (RULE-16).

## Requirements
- **R1** Closing, reloading or navigating away from the tool while the session has unexported changes shows the browser's leave-page warning.
- **R2** Without unexported changes, leaving shows no warning.
- **R3** Clearing the image (starting over) while there are unexported changes asks for confirmation first.

## Acceptance criteria
- **AC1** Given an annotated image not yet exported, when the user reloads the tab, then the browser asks whether to leave. (R1)
- **AC2** Given the user copied the result and changed nothing since, when they close the tab, then no warning is shown. (R2)
- **AC3** Given an image loaded with no annotations, when the user closes the tab, then no warning is shown. (R2)
- **AC4** Given unexported changes, when the user chooses COPY-action.clear, then CMP-ConfirmDialog shows COPY-confirm.clear; confirming returns to the empty state. (R3)
- **AC5** Given the user copied, when they undo once and close the tab, then the browser asks whether to leave. (R1)
- **AC6** Given an image with no unexported changes, when the user chooses COPY-action.clear, then the empty state shows at once with no dialog. (R3)
- **AC7** Given the tool embedded in a host frame that allows leave-page dialogs, with unexported changes, when the user closes the tab, then the browser asks whether to leave. (R1)

## UX notes
The leave-page warning text is the browser's own and can't be changed. COPY-action.clear lives
in the toolbar's overflow.

## Edge cases
- Undo back to the loaded state → still counts as changed until exported (RULE-18).

## Open questions
