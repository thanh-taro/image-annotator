# Review F-014 (Warn before losing work), round 1

Commit 90b7c96 (base e2053a3), checked against F-014, RULE-18, RULE-11, CMP-Toolbar and CMP-ConfirmDialog, plus the spec update in build/m1 7884965 (the overflow order, Clear unavailable with no image, COPY-a11y.cleared).

**Verdict:** no blockers. One major finding (from the new spec), two minors.

## Findings

### M1 (major, new spec 7884965): COPY-a11y.cleared is not announced after starting over
- `src/app/clear.ts:17` / `src/app/state.ts:107-116` (`endSession`): nothing is announced. CMP-Canvas now has to announce COPY-a11y.cleared after starting over.
- Scenario: a screen-reader user confirms Start over. Focus goes back to More actions and they hear nothing. The empty state is never announced.
- This was added to the spec after the build, so the builder did not miss it.
- Fix:
  - add `a11y.cleared` (en-US and vi-VN) to the copy catalogue;
  - call `announcePolite(t('a11y.cleared'))` after `endSession()` in `clearImage`;
  - add a unit test (polite region has the text after clear, with and without the dialog) and an e2e check on `#tk-canvas-live` or wherever the polite region lives;
  - cite it as `// Implements: F-014.R3, CMP-Canvas a11y (COPY-a11y.cleared)`.

### m1 (minor): a stale notice stays after clearing, and its action can do nothing
- `src/app/state.ts:107-116`: `endSession` leaves `notice` alone.
- Scenario: Copy fails, so COPY-error.clipboard shows with its COPY-action.download action (`src/app/export.ts:108`). The user then starts over. The notice stays over the empty state. Clicking Download calls `exportResult`, which returns at once because there is no image (`export.ts:70`): a visible action that silently does nothing. A success notice such as "Copied… 2 redactions" also lingers and describes an image that no longer exists.
- The specs don't cover this; the builder noted it.
- Fix: call `setNotice(null)` in `endSession`, except for a progress notice (clear is blocked while loading anyway). Or propose a one-line spec addition (F-014 or SCR-Annotator "empty"): "Starting over dismisses the notice."

### m2 (minor): the narrow style sheet stays open across clear
- `src/app/state.ts:107-116`: `sheetOpen` is not reset.
- Scenario: on a narrow width the user opens the style sheet, then More actions → Start over. In the empty state the panel is hidden, but `sheetOpen` is still `true`. The next image loads with the sheet already open, covering half the work area.
- This already happens on replace (`startNewSession`), but clear is a "fresh start".
- Fix: set `sheetOpen.value = false` in `endSession`. Optionally do the same in `startNewSession`.

## Checked and found correct
- **Leave-page warning** (`src/io/leave.ts`, `src/app/leave.ts`): one stable handler, registered only while `unexported` is true, idempotent, nothing leaks. The effect lives as long as the app. Exporting turns the warning off. Undo or redo after an export turns it back on, because `version` is bumped and `session.unexported` follows RULE-18. AC5 has both a unit and an e2e test.
- **Clear resets state:** document, selection, history (a new empty state, so there is no undo/redo), bitmap closed, effects worker terminated and a pending feed dropped (`releaseEffects`). The view resets to null when the canvas unmounts (`Canvas.tsx:884`). The tool is kept, which matches CMP-Toolbar: the tool belongs to the page, not the session. Clear is guarded against busy loads, open dialogs, drags and text edits. A load that replaced the session during the dialog wins (`loaded.value === current`).
- **Focus:** the menu returns focus to More actions before `run()`. The dialog focuses Cancel and returns focus to More actions on close or confirm. The e2e test asserts both.
- **`askConfirm`:** shared by replace and clear; behaviour unchanged for replace and scale-down.
- **ConfirmDialog:** the clear variant uses COPY-confirm.clear_title, COPY-confirm.clear and COPY-action.clear, with the danger style.
- **Overflow** (`src/app/MoreMenu.tsx:70-76`): shortcuts, separator, clear, and clear is disabled with no image. This now matches the specs (7884965).
- **Tests:**
  - every AC (AC1–AC7) has a test with the spec ID in its name; there are no sleeps (only `settle()` = setTimeout 0, used to flush a promise);
  - the "no warning" cases give the page a user gesture first, so they can't pass for the wrong reason;
  - the WebKit no-op `beforeunload` listener in `tests/e2e/leave.spec.ts:562` never cancels, so it can't produce a false "warned";
  - AC7 runs on Chromium only, which matches ADR-0021 / D-028.
- **Vocabulary and citations:** glossary terms used, and `Implements:` lines are present in the new files.
