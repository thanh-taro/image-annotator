# Accessibility audit, design D2 (FLOW-01), round 1

Source: a11y-auditor agent (saved by the orchestrator). Static read of the markup, with contrast worked out by hand. Counts: 2 blocker, 4 major, 4 minor.

## Blockers
- **B1:** Only the text annotation has hidden text. The arrow, rectangle and redactions have none, so the summary's "5 annotations" can't be reached, and redaction security isn't exposed. Fix: a hidden per-annotation list in z/Tab order, using COPY-a11y.annotation and the kind name; the count must equal the list length.
- **B2:** Step 3 editing isn't exposed as an editable field: the textbox div is static and focus stays on the canvas. Fix: CMP-TextEditor is a real textarea over the frame. Focus goes into it on entry, the focus ring sits on the editor, and focus returns to the canvas when editing ends.

## Major
- **M1:** The DOM order is toolbar, canvas, panel, status bar; the spec says toolbar, panel, canvas, status bar. Fix: put the aside before .work in the DOM, with `order` to keep it visually on the right.
- **M2:** The canvas is a region with no item semantics for Tab-through annotations or selection. Fix: roving tabindex items with aria-selected, or aria-activedescendant. No keyboard trap.
- **M3:** Live-region content per step is incomplete or wrong. Step 1 load has no copy. Placing should use COPY-a11y.placed, then COPY-a11y.annotation on selection. COPY-a11y.tool_active is unused. Repeated messages need clear-then-set.
- **M4:** There is no assertive channel for errors, and the notice has no focus plan. Fix: a hidden role=alert used only for errors; the notice never takes focus; Close is reachable and Esc dismisses.

## Minor
- **m1:** In dark theme, the selection outline (#A47BFF) on a light image is about 2.9:1. The dashed editor frame weakens it further.
- **m2:** No main landmark; panel titles are not headings.
- **m3:** The focus location per step is not stated (step 5 Ctrl+C keeps focus on the canvas).
- **m4:** The summary doesn't mention selection or tool.

## Manual pass
- Screen-reader walk-through
- Tab exiting the canvas
- Handle contrast on dark images
- 200 % text and reflow
- Reduced motion
- IME input
