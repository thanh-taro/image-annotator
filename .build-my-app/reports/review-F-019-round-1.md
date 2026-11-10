# Code review: F-019 Custom colour and size, round 1

- Diff: `git diff 26b81af..b5ee333` in worktree `.claude/worktrees/agent-a89167cb9e179b450` (branch worktree-agent-a89167cb9e179b450)
- Specs: build/1.1 at d5cd84c (F-019 ready; RULE-21, RULE-11, RULE-19, CMP-StylePanel, CMP-Toolbar)
- `spec_lint --coverage`: 0 errors, every F-019 AC has a test name.

**Counts: 0 blocker, 4 major, 8 minor.**

What checks out: undo coalescing per picker opening and per slider drag; `discardChain` (it refuses a chain that is broken or stale, and a no-op apply never sets `chain`); cancel restoring the current styles and the remembered colour; the shared colour group (D-045, via `withToolStyle`); multi-selection marking and the field rules (R7); palette match ignoring case; RULE-07 pairing for custom colours; render, export and the effects worker (the solid rgb is in the effects cache key); custom sizes kept across images; the roving tabindex and F-013.AC9; Esc in a changed field (preventDefault and stopPropagation, so neither the sheet nor the global handler acts); module surfaces match MOD-Core, MOD-Canvas and MOD-Document.

---

## Major

### M1. The picker does not start at the subject's colour when no custom colour has been picked (F-019.R1, settled in d5cd84c)
- `src/app/StylePanel.tsx:240-246` (`openPicker`): `const start = customSwatch(currentModel()).colour; if (start) input.value = start;`
- Scenario: fresh page, a selected green arrow, click the custom swatch. The picker opens at `#000000`, the input's default. After an earlier cancelled opening, it opens at whatever colour was last shown. R1 says it should open at the subject's colour (green, `#2db84d`).
- Fix: when `start` is null, use the subject's colour, either a hex colour or `PALETTE_HEX[name].toLowerCase()`. The subject is `model.canvas?.drawColor ?? model.color`. With a mixed multi-selection there is no shared colour; use the first selected annotation's colour or leave the input as it is, and say which in a comment. Add a unit or e2e check of `input.value` on opening.

### M2. Clicking a custom swatch that is already checked swaps the subject's custom colour for a different remembered one
- `src/app/custom.ts:63-73` (`beginCustomPick`): `if (choose && remembered) apply(target, remembered, session.key)`.
- Scenario (the AC15 setup): pick `#1e90ff` with the rectangle tool, then `#00ff00` with the highlight tool, so the remembered colour is `#00ff00`. Back on the rectangle tool, the swatch shows `#1e90ff` and is checked (R2). Click it to fine-tune. The rectangle colour jumps to `#00ff00` and the picker opens at `#00ff00`, not at "the swatch's colour" (R1). With a selected rectangle this is also an undo step the user never asked for.
- Fix: choosing the swatch applies the colour the swatch shows. When `customSwatch(model).checked`, apply nothing: it is already the subject's colour, and the picker starts there. Otherwise apply `customSwatch(model).colour`, which is the remembered colour. The same applies to `chooseCustomSwatch`, although arrowing onto a checked swatch can't happen. Add a test for this AC15 follow-up. If the owner meant something else, settle R1's wording ("applies the remembered custom colour") in the spec.

### M3. Esc in an unchanged size field does nothing on wide and compact layouts; R5 says RULE-19 applies
- `src/keys/index.ts:193`: `if (scope.focus === 'text') return NONE;`. A focused number field is scope `text` (`src/app/keys.ts:40`). The only Esc special case (`keys.ts:66-77`) covers a text annotation being edited.
- Scenario: wide layout, a selected rectangle, focus in the size field (untouched), press Esc. Nothing happens. Per F-019.R5 (settled in d5cd84c) and RULE-19 ("only Esc and Mod+S keep their meaning"), the Esc chain should run and clear the selection; with nothing selected, it should switch to the select tool. The comment in `resolveKey` ("Mod+S … the one key besides Esc that keeps its meaning there") already says Esc should act, but the code doesn't. On narrow layouts it only works because the panel's own `onKeyDown` closes the sheet. No test covers Esc with the text unchanged.
- Fix: in `resolveKey`, return `act('edit', 'escape')` for a plain Escape in the `text` scope, as the `textAnnotation` scope does. The field's handler for changed text already calls `preventDefault`, so `onKeyDown` returns early on `defaultPrevented`. Add an e2e test: an untouched field, Esc, and the selection is cleared. This also fixes the F-008 position fields.

### M4. Known issue, confirmed: picking the active tool again does not clear the selection (CMP-Toolbar D-043)
- `src/app/Toolbar.tsx:164-169`: `if (name === active) { if (narrow) sheetOpen.value = !sheetOpen.value; return; }`. This predates F-019 and is not in the diff.
- Scenario: draw a rectangle, so it is selected and the rectangle tool stays active (F-003.R6). Click the Rectangle tool. The selection stays, and a colour choice still restyles the rectangle. CMP-Toolbar says picking any tool except select, "including the one already active, clears the selection". `setTool` already does this (`drawing.ts:104-107`) but is never reached. The narrow layout has the same problem: tapping the active tool toggles the sheet but keeps the selection.
- Fix: `if (name === active && narrow) sheetOpen.value = !sheetOpen.value; setTool(name);`. `setTool` clears the selection and returns early for the same tool. Add a test, for example F-008.AC19's flow with the same tool.

---

## Minor

### m1. A picker colour reported after the chain ended is applied to whatever is current now
- `src/app/custom.ts:83`: `else apply(lastTarget, color)`.
- Scenario: the picker is open on a selected arrow. Focus moves first (a click on the canvas selects another annotation, and `focusin` ends the chain), then the browser fires `change` when the picker closes. `onChange`, then `previewCustomColour`, then `apply(lastTarget, …)` restyles the newly selected annotation as its own undo step.
- Fix: ignore values when no session is open. `input` already applied every colour. If browsers that fire `change` for each colour need handling, keep the session open across `change` and end it on focus leaving or on the next opening.

### m2. A stale slider drag key splits keyboard steps
- `src/app/StylePanel.tsx:399-411`: `drag.current` is set on `pointerdown` and cleared only in `onChange`.
- Scenario: press on the thumb without moving it, so no `input` or `change` fires, then press Right arrow 3 times. The first key applies under the drag key, and its `change` breaks the chain. The next keys chain under `:keys`. That makes 2 undo steps where RULE-11 says repeated slider keys on the same selection are one.
- Fix: clear the drag key and break the chain on `pointerup` or `lostpointercapture`, not on `change`. Or start the drag key at the first `input` after a `pointerdown`.

### m3. A cancelled picker bumps the change epoch, so the session reads as unexported
- `src/document/index.ts:374` (`discardChain`): `epoch++`.
- Scenario: export, select an arrow, open the picker, move to a colour, cancel. The document is identical to the exported one, but RULE-18 now treats it as changed, and leaving warns (F-014). R8 says "no step is recorded".
- Fix: record the epoch when the chain's first step is pushed, and restore it on discard. Or add a session-level check of `doc === exportedDoc`. Add a unit test.

### m4. Dead "unavailable" state for the size field, and AC22 is tested against the old wording
- `src/app/drawing.ts:401-403` (`available`), `src/app/StylePanel.tsx:366,397` (`disabled={!field.available}`), and the `:disabled` rules in `custom.css`. The panel is only mounted with an image (`Shell.tsx:173`, `current && …`), so `shortSide` is never null in the UI.
- `tests/unit/app.custom.test.ts:366` ("F-019.AC22 … unavailable") tests that dead path. The restated AC22 (the panel is hidden with no image; after loading, the field shows the custom 7 and no preset is marked) has no test.
- Fix: drop `available`, the `disabled` props and the CSS. Rewrite the AC22 test as an e2e: no image means no `complementary` "Style" region; then load an image, set a custom 7, load a new image, and the field shows 7 with no preset checked.

### m5. The slider's chain handling reaches into the session from the component
- `src/app/StylePanel.tsx:410`: `loaded.value?.session.history.breakChain()`. Other history handling lives in `drawing.ts` and `custom.ts`.
- Fix: add `endSizeDrag()` next to `setCustomSize` in `drawing.ts`, or a small `beginSizeDrag`/`endSizeDrag` pair that owns the key and counter. That also makes m2 unit-testable.

### m6. Duplicate hex parsing
- `src/effects/client.ts:127` (`hexRgb`) is the same code as `src/core/custom.ts:31` (`hexChannels`). MOD-Effects already imports MOD-Core.
- Fix: use `hexChannels` in the effects client and drop `hexRgb`, or re-export it from core under one name.

### m7. Slider layout: comments and two specs still say "wide" only
- Code comments at `src/app/StylePanel.tsx:26` and `:330`, and the header of `src/app/styles/custom.css`, say "on the wide panel". The code correctly shows the slider on wide and compact (`slider={!narrow}`).
- Specs: CMP-StylePanel "Anatomy" ("and, on the wide layout, a slider") and platform-mapping ("`<input type="range">` (wide layout)") contradict F-019.R3 as settled in d5cd84c.
- Fix: update the comments, and propose a spec fix to CMP-StylePanel and platform-mapping ("on the wide and compact layouts"), then run `spec_lint`.

### m8. `paletteColour` now returns any colour
- `src/render/index.ts:731-733`: the name no longer matches what it does, since it is called with custom hex values at 6 call sites and in `Canvas.tsx:363`.
- Fix: rename it to `colourValue` (or similar) in this feature, while there are few call sites.
