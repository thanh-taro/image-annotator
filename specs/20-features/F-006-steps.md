---
id: F-006
title: Add numbered steps
status: ready
milestone: M-1
priority: P1
personas: [PER-01]
entities: [ENT-Annotation, ENT-Style]
rules: [RULE-04, RULE-07, RULE-19]
screens: [SCR-Annotator]
components: [CMP-Toolbar, CMP-Canvas, CMP-StylePanel]
nfr: [NFR-06]
events: []
depends_on: [F-001]
---

## Intent
How-to guides and bug repro steps need "1, 2, 3" badges in order, without typing numbers by hand
(PRN-03).

## Scope
- In: step badges that number themselves (RULE-07), in the palette colours and three sizes.
- Out: choosing a start number, letters instead of numbers, connecting steps with lines.

## Requirements
- **R1** With the step tool, each click places a step badge with the next number.
- **R2** Numbers stay consecutive: deleting a step renumbers the later ones (RULE-07).
- **R3** The badge's number is always readable against its colour (RULE-07).
- **R4** Badges are sized per RULE-04 and can be placed with Enter at the centre of the view (RULE-19).
- **R5** A duplicated step gets the next number (RULE-07).

## Acceptance criteria
- **AC1** Given the step tool and no steps, when the user clicks three times, then badges 1, 2 and 3 appear in click order. (R1)
- **AC2** Given steps 1, 2, 3, when the user deletes step 2, then the remaining steps read 1 and 2; when they undo, then they read 1, 2, 3 again. (R2)
- **AC3** Given steps 1, 2, when the user adds another, then it is 3. (R1)
- **AC4** Given the step tool, when the user places a yellow step and a red step, then the yellow one's number is black and the red one's is white; an orange or green step's number is black. (R3)
- **AC5** Given a 1000 × 800 image and step size M, when the user places a step, then the badge is 64 pixels across. (R4)
- **AC6** Given the step tool and canvas focus with steps 1 and 2, when the user presses Enter, then step 3 appears at the centre of the view. (R4)
- **AC7** Given steps 1, 2, 3 with step 1 selected, when the user duplicates it, then the copy is step 4. (R5)

## UX notes
COPY-tool.step in CMP-Toolbar. Size and colour in CMP-StylePanel.

## Edge cases
- More than 99 steps → numbers keep counting; the badge becomes a pill (RULE-07).

## Open questions
