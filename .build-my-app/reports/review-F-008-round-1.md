# Review — F-008 Select and edit annotations, round 1

Diff `752a3f2...worktree-agent-acc88506a08c1e51d` (commit e3dffda). Paths are relative to the worktree
`.claude/worktrees/agent-acc88506a08c1e51d`. The F-008 unit tests pass (53/53). `spec_lint --coverage`
lists no F-008 ACs, and none of the deferred F-006/F-007/F-012 ACs this change took on.

Verdict: **no blockers, 3 majors, 9 minors.** Select, marquee, move, nudge, delete, duplicate, reorder,
RULE-07 renumbering, coalescing (chain broken by `noteSelection`, tool change, undo and redo), the
AC17 no-step click, the keys scope (AC16), COPY and tokens are all correct.

## Blocker
None.

## Major

**M1. Moving a solid redaction over an earlier blur or pixelate rebuilds the drag layers every frame (NFR-02, ADR-0022).**
`src/canvas/Canvas.tsx:523` calls `effects().patchesFor(now, ids)` for every annotation. An effect
*below* `lo` that reads the moved solid gets a new spec key each frame (the solid's box is part of the
key, `src/effects/client.ts:258-270`), so it gets a new approximation object. `DragLayers.ensure` keys on the
patches outside `[lo, hi]` (`src/canvas/drag.ts:130`). The lower layer is therefore stale every frame:
a full rebuild plus `getImageData` on every frame, and an approximation computed for every reading
effect. Scenario: a blur at index 0 and a solid at index 1 that overlaps it; drag the solid on the
14.7 MP image, and the split layers give no benefit.
The draw path avoided exactly this ("no approximation is rebuilt per frame for effects that read a
solid being drawn", `Canvas.tsx:437-440`).
*Fix:* for indexes outside `[lo, hi]`, use the `stillPatches` entries (only the middle range uses the
fresh `patchesFor`). Add a test that a solid moved over an earlier blur builds the layers once
(`drag.builds`).

**M2. Small or thin selected annotations can't be moved by dragging their body.**
`src/canvas/select.ts:143` tests handles before the body. Handle hit areas are ±`size.targetMin/2`
(12 screen px) and are checked in the order nw, n, ne… (`src/core/shapes.ts:482`). Scenario at 100 %: a
selected 100 × 20 solid redaction over one line of text, pressed at its centre (50, 10). That point is
within 12 px of the `n` handle, so the drag resizes the top edge instead of moving the box. Any box
under about 24 screen px on an axis is covered entirely, and the same happens to a short arrow (its
tail and head cover it). Below 100 % (fit) zoom this hits most redactions.
*Fix:* inside the annotation's hit area, count a handle only within its visible square
(`look.handleSize / 2`); outside the shape, keep the full target. Or let the body win when the box's
screen size is under 2 × targetMin. Add a unit test with a 100 × 20 box.

**M3. Focus is lost when the panel's Delete button removes the selection (NFR-06, WCAG 2.4.3).**
`src/app/StylePanel.tsx:282-284`: `deleteSelection` empties the selection, so `<Actions>` and
`<Geometry>` unmount with the focused button. Focus falls to `<body>`, the Edit keys stop working
(`focusScope` returns `control`), and a keyboard or screen-reader user has to start Tab navigation
again from the top.
*Fix:* after a panel Delete, focus the canvas region (`main.tk-work-area`, the Tab stop when nothing
is selected, CMP-Canvas a11y). Add an e2e test that checks `document.activeElement` after a click on
Delete.

## Minor

**m1. A drag-resize has no minimum size, and a path collapses for good.**
`resized` (`src/core/shapes.ts:516-541`) allows width or height 0, while the fields and Alt+arrows
clamp to 1 × 1. CMP-StylePanel says the fields are "kept within the same limits as dragging".
Scenario: drag a pen stroke's `e` handle onto its `w` edge. `scalePoints` sets every x equal; after
that `handlesOf` drops e/w and `sizedTo` keeps W at 0, so the stroke can't be widened again except
by undo. *Fix:* clamp handle resizes to `MIN_EDIT_SIZE`, as the fields do.

**m2. Shift has no effect on edge handles and line end handles.**
RULE-06 says "resizing with a handle keeps the aspect ratio", but `h.length === 2` limits it to
corners (`shapes.ts:531`). A line or arrow end handle ignores Shift, although drawing snaps it to 45°.
*Fix:* make edge handles with Shift scale the other axis about the centre (or keep corners only, and
propose that wording). For line ends, snap to 45° about the fixed end (RULE-06). Either way it needs
a spec line.

**m3. A no-op drag leaves the drag layers allocated.**
`select.ts:235`: a move or resize that returns to its start commits an unchanged document, so nothing
schedules a paint. The layers (about 41 MB) are not released until the next unrelated repaint
(ADR-0022 "dropped when the drag ends"). *Fix:* call `this.callbacks.preview()` after `commit` too.

**m4. An exact patch that arrives mid-move is not shown until release.**
During a non-redaction move, `paintMove` reuses `stillPatches` (`Canvas.tsx:523`), so an exact patch
that `onPatch` delivers is ignored until the release. Reusing the cached patches is otherwise
correct (effects never read non-redaction annotations). *Fix (optional):* refresh `stillPatches`
from `patchesFor(scene)` when `onPatch` fires.

**m5. Alt+press acts with the crop tool too.**
`select.ts:125` treats any tool other than select as "a drawing tool". RULE-05 and RULE-19 limit
Alt+drag to drawing tools. Once F-010 lands, Alt+press with crop would move annotations.
*Fix:* `if (!select && !(input.alt && isDrawingTool(s.tool))) return false`.

**m6. A key arrives during a pointer move.**
Arrow, Delete or Mod+D pressed while a pointer move is in progress acts at once. The release then
commits annotations based on the press-time copies (`g.dragged`), which overwrites the nudge.
*Fix:* ignore nudge, resize and reorder while `select.active` (or cancel the drag first).

**m7. Missing tests.**
- Nothing checks that a move uses `dragRange` in `<Canvas>`: no move of a solid under a later blur
  showing the solid live, and no `builds === 1` check for a move.
- Nothing checks that a moving redaction sends no exact job until it has been still for 100 ms.
- The e2e for AC6 runs Mod+D before Delete, so the AC's order (Delete, undo, Mod+D at (110, 110))
  is only unit-tested.
- The undo halves of F-006.AC2, F-008.AC6 and AC17 depend on F-009. Add them to the build-plan
  deferred table, not only to file comments.

**m8. The field compare uses the rounded value.**
`NumberField` compares against the rounded value (`StylePanel.tsx:209`). For a box at x = 100.4
(drawn or moved at a non-100 % zoom), retyping 100 is a no-op, so a fractional position can't be
snapped to a whole pixel by retyping the shown number. Accept it, or compare with the unrounded
value.

**m9. No keep-in-view scrolling.**
RULE-19 says "the view scrolls to keep a newly placed or selected annotation visible". Nothing in
`src/` does this. With F-008, Mod+D (+10 px) and arrow nudges can push the selection out of view.
Acceptable to defer, but record it in the build-plan notes for F-013 (Tab selection needs it too).

## Builder's spec gaps — judgement

1. **Zero-height stroke or highlight shows only the handles along its length.** Agree. Also specify
   the fields for this case: W or H shows 0, and setting it does nothing (today it fails silently),
   and a dot shows no handles. Proposed wording for F-008.R3: "a stroke or highlight with no height
   (or width) has handles only along its length; its zero dimension cannot be changed".
2. **`marqueeHits(annotations, box, shortSide, measure)` with "touches" meaning the bounds
   intersect.** The signature change is needed: update MOD-Core.md:37. The bounds test over-selects
   long diagonal lines and arrows: a box in the empty corner of their bounds selects them. Either
   accept it and write "touches its bounding box" into F-008.R1, or test the segment against the box
   for lines and arrows (cheap). Recommend the segment test.
3. **Nudge and Alt-resize in MOD-App, not MOD-Canvas.** Agree: they are document edits, and the
   coalescing lives in MOD-App and MOD-Document. MOD-Canvas.md:33 still lists
   `canvasCommands.nudge/altResize`; amend it and add them to MOD-App's command list.
4. **Field limits: minimum 1 × 1, negative X and Y allowed.** Agree, consistent with RULE-19 and the
   off-canvas edge case. The drag must then share the 1 × 1 minimum (m1).
5. **A Shift marquee replaces the selection.** This follows R1 literally, but most editors add
   with Shift+marquee, which is consistent with Shift+click adding. Owner decision; proposed wording
   for F-008.R1: "Shift+drag on empty canvas adds what the box touches".

## Uncertain points — judgement

- **Cached patches reused while a non-redaction moves:** correct (RULE-10: effects read only the
  image and solids). Only staleness when an exact patch arrives (m4).
- **Fractional move offsets kept:** fine. It matches drawing (F-007.AC11 uses x = 10.4), and the
  fields round for display (m8).
- **No keep-in-view on select:** defer to F-013 with a recorded note (m9).
- **Focus lost when the panel's Delete button disappears:** a defect, not a judgement call (M3).
