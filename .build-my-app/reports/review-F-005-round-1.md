# Review F-005 (Text): round 1

Diff: `build/m1...worktree-agent-abfa464f1c503ce77` (5137e6b). Paths are relative to the worktree.
Checks run: 39 unit test files, 326 tests, all pass. `spec_lint --coverage tests` gives 0 errors and lists no F-005 ACs.

## Blockers
None.

## Major

### M1. The edit stays open once keyboard focus is in the style panel, and Esc there does nothing
- `src/canvas/editor.ts:455-464`: only the textarea's `focusout` is watched.
- `src/app/Shell.tsx:40`: `inPanel` keeps the edit open when focus moves into the panel.
- `src/keys/index.ts:139` (the `scope.focus !== 'canvas'` gate) runs before the Esc line at about :153.

**Scenario:** the user is editing and presses Shift+Tab. Focus moves to a swatch and the edit stays open, which is intended. Then:
- Esc resolves to NONE because the scope is `control`, so the edit doesn't end.
- Shift+Tab again moves focus to the toolbar, or Tab moves it on to the status bar. The edit is still open: `data-state=editing-text`, and the canvas has `tabIndex=-1`, so it has no Tab stop. SCR-Annotator "editing-text" says CMP-TextEditor has focus. CMP-TextEditor says focus returns to the canvas when editing ends, but it never ends.
- Once History keys and buttons act from any focus (F-009), an undo while the edit is open can remove the text being edited. `draft()` then returns null, which leaves an orphaned, invisible field.

**Fix:**
- While an edit is open, also listen for `focusout` on the panel, or for `focusin` on the document. End the edit with `'focus'` when focus lands outside the textarea and the panel.
- Make Esc in the panel during an edit end the edit and return focus to the canvas, or return focus to the field. Add that one line to RULE-19 or CMP-TextEditor.
- Add an e2e test: Shift+Tab twice, then expect the edit to have ended and the text to be kept.

### M2. Text placed outside the canvas is invisible while typing (builder gap 6, needs a spec decision)
- `src/canvas/text.ts:626-630` places the text at any press point, including the surround.
- `src/render/index.ts` clips annotations to the canvas, as CMP-Canvas says.

**Scenario:** the user clicks in the surround and types. Only the caret and the dashed border show. This defeats F-005.AC1 and R2 ("appears at its final size and colour") for that case. See gap 6 below.

## Minor

### m1. A two-finger pinch or pan while editing ends the edit
`src/canvas/text.ts:599-604`: the first finger's `down` ends the edit before the second finger arrives. R3 asks for a click, and CMP-Canvas says two fingers zoom and pan.

**Fix:** for touch, end the edit on that pointer's `up` if no second finger came. A cancelled gesture keeps the edit.

### m2. Wheel input over the editor field doesn't reach the view
`src/canvas/Canvas.tsx`: `onWheel` is only on the `<canvas>`, and the textarea is a sibling. Ctrl or Cmd+wheel over the text being edited zooms the browser page, and a plain wheel doesn't pan. Elsewhere on the canvas, the page never zooms (F-002.R3).

**Fix:** add the same wheel listener to the textarea, or move it to the work area.

### m3. WebKit composition input types aren't excluded
`src/canvas/editor.ts:418` filters out only `insertCompositionText`. WebKit fires `insertFromComposition` (and `deleteCompositionText`) at commit. If they arrive with `isComposing === false`, the NFC and limit path runs both there and in `compositionend`, and calls `execCommand` mid-commit. ADR-0009 §3 says composition is checked at `compositionend`.

**Fix:** also skip `insertFromComposition` and `deleteCompositionText`. Keep the manual Safari Telex check from ADR-0020.

### m4. `TextMeasure` is optional but throws at runtime
`src/core/shapes.ts:131-135, 140, 159, 437`: `boundsOf`, `hitTest` and `hitTopmost` take `measure?` and throw for a text when it's missing. Future callers (F-008 hit and marquee, F-013 scroll into view, F-007/RULE-20 counts) will type-check but crash only when a text exists.

**Fix:** make it a required parameter, or pass one geometry context `{ shortSide, measure }`, so `tsc` catches a missing one. See gap 2.

### m5. The panel's `mousedown` `preventDefault` will block text and number fields
`src/app/Shell.tsx:46-48`: every left press in `.tk-body__panel` is `preventDefault`ed while editing. When F-008 adds position and size fields (CMP-StylePanel "selection" shows them for a single selection, which is the case when an existing text is edited), a mouse click can't focus them.

**Fix:** skip it when `isEditing(e.target)`, or limit it to buttons and radios.

### m6. Mod+S isn't routed while editing
`src/keys/index.ts:126-130`: the `textAnnotation` branch returns NONE for everything except Esc. That is correct now, but RULE-19 keeps Mod+S while editing and F-012 has to remember it.

**Fix:** add `TODO(F-012)` there and a pending keys unit test.

### m7. Raw values instead of tokens
`src/app/styles/drawing.css:422` (`opacity: 0.5`) and `:355` (`tab-size: 8`), and `src/canvas/Canvas.tsx` `CARET_ROOM_PX = 2`. The brief says values go only through tokens. No token exists for the 50 % placeholder opacity.

**Fix:** add a token, for example `opacity.placeholder`, or record a justified exception. `CARET_ROOM_PX` is a spike measurement: cite SP-text and ADR-0020 next to it, or move it to MOD-Core constants.

### m8. Test gaps
- No automated input-method test. ADR-0020 says Chromium works through CDP. Add `Input.imeSetComposition` and `insertText` tests for NFC and the limit at `compositionend` (the `editor.ts:435-444` path).
- AC15's e2e test uses `keyboard.insertText`, not a paste. The `insertFromPaste` and `dataTransfer` path is exercised only with ASCII text (the AC8 test, Chromium only). Add a Chromium clipboard paste of the decomposed "Đường".
- No test for the edge case of dropping text onto the field.
- AC12 is tested only at model level. That is honest and explained in the header; it needs an e2e test once F-009 wires Mod+Z.
- The `fixme` tests for AC6, AC7, AC14 and the AC15 export half are honest: they need F-012.

## Checked and fine
- **RULE-08:** NFC back to the last starter, the 2,000 code-point limit counted on composed text, and the outline width. Blank or whitespace-only text is removed.
- **ADR-0020:** metrics and baseline, editor height of lines × lh + 0.2 em × zoom, and the text box of lines × lh by the widest line.
- **Editing start and end:** click, Enter, double-click with the caret where clicked, AC10 (the press is consumed), Esc chain order, and the RULE-11 commit steps (no step for an unchanged or empty new text).
- **Focus:** focus goes into the field and back to the canvas after Esc or a press. The IME is guarded (`isComposing`) in `keys.ts`.
- **COPY:** only COPY IDs are used (`tool.text`, `text.placeholder`, `a11y.placed`, `a11y.deleted_count`).
- **NFR-02:** compliant. The text tool never drags, and `draw.dragging` still prepares the layers at pointerdown.
- **Shared files:** no regressions found in Shell, Canvas, keys, state, Toolbar, render, document, core, shapes or fonts.

## Builder's spec gaps: verdicts
1. **`commitText(text, isNew)`: matches the spec.** MOD-Document names the operation without parameters. Optionally update the surface to `commitText(text, isNew)`.
2. **`boundsOf` and `hitTest` take a `TextMeasure`: needs a spec change.** MOD-Core's surface lists `hitTest(annotation, point, tolerance, shortSide)` and `boundsOf(annotation, shortSide)`, but MOD-Core has no DOM, so text needs a measure. Proposed wording: "…`hitTest(annotation, point, tolerance, shortSide, measure)`, `boundsOf(annotation, shortSide, measure)` (text widths are measured by the caller in the tool's face, ADR-0020)". Make the parameter required (m4).
3. **A press in the style panel keeps the edit open: matches the spec.** SCR-Annotator "editing-text" says panel changes apply to the edited text, and the FLOW-01 step 3 design says "panel styles the edited text". It still conflicts with the literal F-005.R3 wording. Proposed: "…clicks outside the text and the style panel (which only ends the edit)…". Also see M1 for keyboard focus.
4. **A press that moves places the text at the press point: needs a spec change.** RULE-07 states this for steps only. Proposed addition to RULE-08: "With the text tool, a press that moves places the text at the press point."
5. **A click edits the topmost text, even under a shape: needs a spec change.** This is reasonable for unfilled shapes, but under a solid fill it edits text the user can't see, which conflicts with CMP-Canvas "clicks hit the visible mark". The owner should choose:
   - (a) the builder's behaviour, worded "a click within an existing text's box edits the topmost such text, even under other annotations"; or
   - (b) edit only when the topmost hit annotation is a text.
6. **Text in the surround is clipped while typing: needs a spec change (major, M2).** It matches CMP-Canvas clipping literally but breaks F-005.R2 and AC1 there. Proposed: "With the text tool, a click outside the canvas does nothing," or "the anchor is clamped to the canvas." The alternative, "while editing, the edited text is drawn unclipped," is less consistent with export.
7. **The design's 120 px minimum editor width isn't applied: acceptable.** It is a design-only value with no token, and no spec requires it. The empty field is as wide as the placeholder. Either add a token (`size.text-editor-min`) and apply it, or record it as a design difference. No spec change.
