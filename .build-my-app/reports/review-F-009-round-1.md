# Review — F-009 Undo and redo, round 1

Diff: `build/m1...worktree-agent-a465408cf36496c01` (dc931fc). Paths below are relative to the worktree
`.claude/worktrees/agent-a465408cf36496c01`. New unit tests pass (17/17); `spec_lint --coverage tests`
reports no uncovered ACs; there are no sleeps in the new tests.

Verdict: **no blockers**. One major finding (focus loss), four minor findings, and one spec-gap ruling.

## Blocker
None.

## Major

**M1. Focus drops to `<body>` when the clicked history button becomes disabled.** `src/app/Toolbar.tsx:45-66`
Scenario: a keyboard user Tabs to Undo with one step and presses Enter. `canUndo` becomes false, the
native `disabled` attribute removes the focused button from focus, and focus goes to the document. The
next Tab starts again from the top of the page, so they lose their place in the toolbar. This happens
every time the user undoes back to the start, or redoes to the end. CMP-Toolbar says nothing about it,
but NFR-06 (WCAG 2.2 AA, "every action operable by keyboard"; 2.4.3 focus order) makes it a real defect,
not a nit. The history keys still work from `<body>` (`focusScope` returns `control`), which softens it.
The design also uses native `disabled` (CMP-Toolbar.dc.html), so swapping to `aria-disabled` would differ
from the design.
Fix (simplest): after an undo, Redo is always enabled, and after a redo, Undo is always enabled. So in the
onClick handlers, when the clicked button is focused and has just become disabled, move focus to the other
history button. Add one e2e test: Tab to Undo, press Enter, and assert that Redo is focused. Spec:
add to CMP-Toolbar Accessibility "when a focused control becomes unavailable, focus moves to its
counterpart (Undo ↔ Redo)".

## Minor

**m1. The toolbar Undo/Redo during a text edit ends the edit and undoes the whole text, instead of undoing typing first.**
`src/app/history.ts:139-140`, together with `src/canvas/editor.ts:81-84` (focus arriving on the toolbar ends the edit).
Scenario: the user types "Bug report" into a new text and clicks Undo. In Chromium, the button takes focus
on press, which ends the edit and commits one step. The click then removes the whole text. In WebKit,
`endTextEdit()` in `step()` gives the same result. The F-009 edge case says "Undo while editing text → undoes
typing inside the text first", without limiting it to the key. Redo brings the text back, so nothing is lost.
Fix: decide this in the spec rather than in code. The proposed edge-case wording is "The undo and redo
controls first end the edit (keeping the text), then act on the history." That matches the current code.
There is no test for the button during an edit. The unit test at `tests/unit/app.history.test.ts:923` covers
only the "can't be ended" case. Add an e2e test.

**m2. No test for the history-key no-op while a text is edited with focus in the panel.**
`src/app/keys.ts:100-102`. The guard `if (textEditing.value) return;` is the only thing that stops Mod+Z
from undoing the document. That happens when a text is being edited and focus is on a CMP-StylePanel swatch
(focus scope `control`). Neither the unit tests nor the e2e tests exercise it. Removing the line keeps the
suite green. Fix: add an e2e test. Start a text, type, focus a colour swatch, press Mod+Z, then assert the
text is still being edited and the count and history are unchanged. The behaviour itself is correct for
RULE-19 ("No key here acts while text is being edited"). Keeping the key from the browser there is harmless.

**m3. A RULE-11 coalescing chain survives zoom and other non-document actions.** `src/document/index.ts:281`, `src/app/drawing.ts:74`
Only `setTool`, `select`, undo/redo, a successful export, and any un-keyed step break the chain.
Scenario: the user nudges, presses Mod+=, then nudges again. The two nudges become one step. RULE-11 says
"with no other action in between", and ADR-0008 §3 says "Any other command … breaks the chain". Other
actions that don't break the chain:
- View: zoom, fit, 100 %, Space-pan;
- a current-style change with nothing selected, which can't happen mid-chain because a nudge needs a selection;
- a failed export.
The code is from F-008, but F-009 owns the undo semantics. Fix: call `history.breakChain()` from the view
commands in `keys.ts`. Wheel and pinch zoom could use the same hook, or the spec could say that only
document-affecting actions break a chain. A spec line is the lighter fix.

**m4. Test gaps that are now testable.**
- `F-005.AC4` says "and no undo step is added". `tests/e2e/text.spec.ts:325` does not assert it. Now that
  Undo exists, add `await expect(undoButton).toBeDisabled()`.
- `F-009.AC5` (`tests/e2e/undo.spec.ts:675`) checks `aria-keyshortcuts` on Undo only. Redo's value
  (`Control+Shift+Z Control+Y` / `Meta+Shift+Z`) is untested.

## Checked and fine
- **Undo/redo correctness and R3:** snapshots with `selectionBefore`/`selectionAfter` (`src/document/index.ts:295-313`) are restored together through `commit` (`src/app/state.ts:44`). AC3's "selected again after clicking away" works because `noteSelection` keeps the selection out of history. R2 redo discard is at `:283`. R4 keeps 500 steps.
- **RULE-18 / epoch:** every do, undo and redo bumps the epoch, and an export records the epoch it started at (`src/app/export.ts:101`). So copy → undo → redo stays unexported (unit test at `app.history.test.ts:930`, `document.session.test.ts:39`), and an edit during an export stays unexported (`document.session.test.ts:104`). An undo during an export is covered the same way.
- **Coalescing scope:** only `nudge` and `resize` pass a key (`src/app/editing.ts:66,79`). Undo breaks the chain, and coalescing applies only at the top of the history (`cursor === steps.length`).
- **RULE-19 keys:** "Ctrl+Y redo on Windows/Linux" is in RULE-19's History group, so it is in the spec. Mod+Z and Mod+Shift+Z resolve before the canvas-only gate, so they work wherever focus is in the tool (`src/keys/index.ts:158-162`). A text annotation or a text or number field returns NONE, so the field handles its own undo. A dialog or menu also returns NONE. `preventDefault` is applied even with nothing to undo. Letter by position works on non-Latin layouts. Alt is excluded, which covers AltGr. On macOS, Cmd+Y is not redo.
- **In-progress drag:** `step()` returns while `canvasCommands.dragging()` (`src/app/history.ts:138`). Toolbar clicks can't happen during a captured drag.
- **Announcements:** COPY-a11y.undone and COPY-a11y.redone exist (copy.md:162-163) and are required by CMP-Canvas Accessibility (line 30-32). Nothing is announced when there is nothing to undo or redo.
- **Toolbar placement:**
  - wide and compact: after the tools, behind a separator;
  - narrow: on the actions row after Open, as icons (matches CMP-Toolbar and the artboards).
  - Both buttons are disabled with no image and whenever there is nothing to undo or redo.
  - `aria-keyshortcuts` values match the design markup.
  - Reusing the `tk-tool` class doesn't leak into the radio group's arrow navigation, which is scoped to its own strip ref.
- **COPY and tokens:** all strings go through `t()`. No new CSS. The lucide icons come from the already-registered `lucide-static`.
- **Deferred halves:** F-005.AC12, F-006.AC2 (undo restores 1, 2, 3, read from pixels), F-008.AC6 (Delete → undo → selected → Mod+D at 110), F-008.AC17 (one Undo removes the rectangle), F-015.AC2, F-016.AC4 and F-018.AC2 (history undo/redo after the change) are now exercised end to end with real assertions.
- **Shared files:** the changes to `commands.ts`, `icons.tsx`, `state.ts`, `keys.ts` and `src/keys/index.ts` are additive. The history branch sits before Mod+C and the zoom keys without shadowing them. No regressions found.

## Spec gap: CMP-Toolbar "each control's name includes its shortcut"
The builder's reading matches the existing code and the design. Open, Copy and Download are all named by
their plain labels and carry `aria-keyshortcuts` (`src/app/Toolbar.tsx:43`, `src/app/ExportActions.tsx:80,97,165`).
The CMP-Toolbar artboard does the same for Undo (`Control+Z`) and Redo (`Control+Shift+Z Control+Y`). Only the
tools use COPY-tool.shortcut_hint names. The current spec sentence is therefore already violated by F-012,
not only by F-009. **Accept the proposed wording**, slightly tightened:
> "Each tool's name includes its shortcut (COPY-tool.shortcut_hint); every other control with a RULE-19 key
> states it as a keyboard shortcut (`aria-keyshortcuts`)."
Also add the focus rule from M1. aria-keyshortcuts is not shown to sighted users. The shortcut list
(F-013, COPY-action.shortcuts) remains the way they discover these keys, which is acceptable under NFR-06.
