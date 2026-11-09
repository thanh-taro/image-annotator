# Review — F-013 Work from the keyboard, round 1

Diff: `build/m1...worktree-agent-aadfff635c001fd6c` (bcdc963). Paths below are relative to the worktree.
Checks run: vitest 653/653 green; e2e keyboard, zoom-pan, text, load, export and edit specs green in chromium and webkit (264 passed, 4 skipped).
Probes: Playwright against `vite` on localhost, run for the findings marked "verified".

## Blockers
None.

## Major

**M1 — Shift+Tab out of the canvas lands on an unchecked radio (regression, verified).**
`src/canvas/list.tsx:92-116` (`tabbables`, `leaveRegion`).
Before this change, Shift+Tab from the region was handled by the browser. MOD-Keys now takes it (`act('canvas','previous')`), and when nothing is selected `nextIndex` returns null, so `leaveRegion(area, false)` focuses the last element in the `tabbables()` list before the region. That list includes every radio input. The browser only stops on the checked radio of a group.
Scenario (verified): load an image, focus the canvas, press Shift+Tab. With the select tool, focus lands on the *White* background radio (`checked=false`). With the rectangle tool, it lands on *Translucent* fill (`checked=false`). The screen reader announces an option that isn't chosen, and the radio group's roving focus is broken. The same happens on every Shift+Tab out of the canvas while nothing is selected, the most common way to leave it. Forward leaving also skips focusables inside the region after the list, such as the CMP-Notice buttons.
The AC6 Shift+Tab test (`tests/e2e/keyboard.spec.ts:304`) only checks that focus is "in the panel", and it runs with a selection, where the panel ends with buttons, so it misses this.
Fix (simpler): let the browser move focus whenever it can. Return `false` from `selectStep` when `i === null`, except in one case: the region itself has focus, an option inside it holds the Tab stop, and the direction is forward. Handle only that case manually. Alternatively, keep `leaveRegion` and filter radios down to each group's checked one (or the group's first/last when none is checked). Add an e2e test: nothing selected, rectangle tool, Shift+Tab → the *checked* fill radio is focused.

**M2 — Paste (and drop) replace the image behind an open CMP-ShortcutHelp (verified).**
`src/app/loader.ts:67-77` checks `busy || dialog.value` but not `shortcutsOpen`.
Scenario (verified): open ? → paste an image → the canvas becomes 300 × 200 while the help dialog stays open. MOD-Keys correctly never keeps Mod+V, but the load path ignores the new modal. This breaks CMP-ShortcutHelp "the rest of the tool is inert and RULE-19 shortcuts are off" and RULE-19 "while a dialog … is open, only Esc acts". With unexported work, the replace confirm unmounts the help instead (`Shell.tsx` `help = shortcutsOpen && !modal`), which consumes its opener and then re-shows it.
Fix: add a single `modalOpen()` in `state.ts` (`dialog.value || shortcutsOpen.value`). Use it in the loader's `file`, `noImage` and `dragging` handlers and in `openImage`. Add an e2e test: paste while ShortcutHelp is open → the session is unchanged.

**M3 — CMP-ConfirmDialog does not return focus on close (pre-existing, verified; fix in F-013).**
`src/app/ConfirmDialog.tsx:46`.
The builder's diagnosis is wrong. The opener *is* read correctly: the layout effect runs before the browser drops focus from inert content (Chromium and WebKit both still report the opener synchronously). The bug is on close. The cleanup's `returnTo.focus()` runs during the same commit, before Shell removes `inert` from the toolbar and work area, so the call is ignored and focus falls to `<body>`.
Trace: `focus(tk-tool) inert=true` → `activeElement=BODY`, for a dialog opened with focus on COPY-action.more, in both browsers. Keyboard users are thrown out to the start of the document.
Where to fix: F-013. It lists CMP-ConfirmDialog among its components and owns modal focus (AC10, NFR-06). The fix is the same deferred return that `ShortcutHelp.tsx:49` already uses (`queueMicrotask`, with the canvas region as fallback). Share one helper between the two dialogs. Add an e2e test: replace-confirm → Esc → the previously focused control is focused. This must be fixed before F-014, whose Clear is opened from the More menu and must return focus to the More button.

**M4 — English text shown in vi-VN in CMP-ShortcutHelp (F-013.R3; COPY-only rule).**
`src/keys/index.ts:271-329`.
The visible key cells contain English words that are not keys: `arrows` (`Alt+arrows`, `⌥ arrows`), `drag` (`Space+drag`, `Alt+drag`) and `wheel` (`Ctrl+wheel`). The spoken names are all English literals: "Control Z", "question mark", "plus drag", "Left, Up, Right or Down arrow". A vi-VN user sees "Đổi kích thước vùng chọn — Alt+arrows", and a Vietnamese screen-reader voice reads English. CMP-ShortcutHelp only exempts *key labels as printed*. Printed arrow keys are ← ↑ → ↓, not the word "arrows".
Fix now: show `Alt+← ↑ → ↓` (and `⌥← ↑ → ↓`) for resize, as the move row already does.
Spec gap: propose COPY IDs for the non-key words and the spoken names, e.g. `COPY-key.drag`, `COPY-key.wheel` and `COPY-key.spoken.*` (control, command, option, shift, plus, arrow keys, question mark, left/right bracket, equals, minus). MOD-Keys would return IDs and MOD-App would translate them, keeping MOD-Keys free of copy. Until the spec decides, list this as an open gap rather than shipping English as final.

## Minor

**m1 — Keep-in-view only on Tab.** `src/canvas/Canvas.tsx:793-815`; `src/app/editing.ts:40` (`duplicateSelection`).
RULE-19 says "a newly placed or selected annotation". Enter places at the centre, so it is visible, and a pointer selection is visible by definition. Mod+D, however, creates a *newly placed and selected* duplicate, 10 px off, which can fall outside the view near an edge. A screen-reader activation of an option (`list.tsx:76`, `onPick`) selects without revealing it.
Fix: call `view.reveal` for the duplicate's bounds and in `onPick`.
For nudges, the builder's choice is fine: the annotation isn't newly selected.
Propose the spec wording: "…newly placed (Enter, Mod+D) or selected (Tab, or activating its option)…".

**m2 — Spec gap 1 (Shift in the move and resize rows): accept, but it isn't implemented.**
The builder lists it as a gap, but `keys/index.ts:295-296` show plain arrows and no Shift. RULE-19's Shift modifiers (10 px; pan 200) are keys, so AC8 "every key in RULE-19 is listed" arguably needs them.
Proposed CMP-ShortcutHelp wording: "The move, resize and pan rows also show Shift for the larger step." The crop keys sharing the move and resize rows is fine: the keys are identical, and the spec says crop keys reuse COPY-shortcut.move and COPY-shortcut.resize.

**m3 — Menu keyboard is minimal.** `src/app/MoreMenu.tsx:67-81`.
There is no Home/End, and the button doesn't open on ArrowDown/ArrowUp. These are APG-recommended, though not required by the spec. Wide, compact and narrow layouts, focus on open, focus on Esc, Tab-to-close and the narrow download item are all correct and tested.
F-014 extensibility is good: Clear is one more group in `moreItems()` (line 42), and the separator already exists. Note that CMP-Toolbar's anatomy lists "clear and shortcuts" in that order, while the code comment puts Clear after shortcuts. Let F-014 confirm the order against the artboard.

**m4 — MOD-Keys surface drift.** `src/keys/index.ts:265`.
`shortcutList(mac)` now takes a platform parameter and returns groups with `spoken` strings. MOD-Keys.md still says `shortcutList()` returns "key labels plus COPY IDs". Update the module spec (or adopt the M4 shape).

**m5 — Paste while the More menu is open** also loads, the same root cause as M2. That is acceptable if the menu is not treated as modal; mention it in the M2 fix for consistency.

## Spec gaps raised by the builder

1. **Shift in the move and resize rows, crop keys sharing those rows.** Accept. Add the wording in m2 and implement it.
2. **Mod+O kept while a dialog is open.** Accept. Keeping is not "acting": it stops the browser's open-file from navigating away behind the dialog, matching the F-001 loader. Proposed RULE-19 addition: "…only Esc acts, closing it; Mod+O is still kept from the browser."
3. **Pointer selections announced, Tab selections not.** Accept. The focused option is read with its name and selected state, so announcing as well would double it. Proposed CMP-Canvas wording: "A selection made with the pointer or Select all is announced …; a selection made with Tab is not, because focus moves to its option, which is read instead."

## Uncertain points

- **Redaction option names from COPY-redact.\* ("Solid (secure) at …").** Correct. COPY-a11y.annotation's note says `{kind}` is "the redaction kind name", which is COPY-redact.solid/blur/pixelate.
- **English spoken key names.** Not acceptable as final: see M4. Needs a spec decision and COPY IDs.
- **Keep-in-view only on Tab.** Acceptable for nudges; add it for Mod+D and option activation (m1).
- **CMP-ConfirmDialog focus return.** It is a real bug, but the cause is the return running while the toolbar and work area are still inert, not the read. Fix in F-013 (M3).

## Verified OK

- **RULE-19 audit** (`keys/index.ts:163-257`):
  - Tools, Enter, Tab, Edit, arrows, Alt+arrows, crop arrows, Esc, Shift+1/0, Space and ? act on the canvas only.
  - History, Mod+=/-, Load and Export work anywhere outside text.
  - While text is edited, only Esc and Mod+S act.
  - In a dialog or menu, nothing acts (Esc is the dialog's own).
  - Mod+V is never kept, in any scope.
  - Mod+C yields to page text.
  - Tab is not kept when focus leaves.
- **Mod+O** moved from the loader into MOD-Keys and `keys.ts:102`; `load.spec` F-001.R3 still passes.
- **Annotation list:** roving tabindex; the region is the Tab stop only when nothing is selected (`Shell.tsx:128`); no Tab stop while editing; the name and hint are present; Delete and Esc return focus to the region; drawing order is kept; Tab before/after the ends works.
- **Selection announcements:** pointer and Select all are announced; Tab is not.
- **ShortcutHelp:** inert background; focus on Close; Tab trapped; Esc closes; focus returns (via the deferred return); RULE-19 keys off; key labels as printed; aliases listed; spoken text present; vi-VN headings work.
- **Styles:** CSS uses tokens only, except the artboard box size 640 × 600 (same precedent as `.tk-dialog` 420px).
- **Tests:** no sleeps (only `frame()` rAF waits and `expect.poll`). Every AC has a test.
- **`text.spec.ts` changes (605-625):** justified. CMP-Canvas now makes the selected option, not the region, the Tab stop.
