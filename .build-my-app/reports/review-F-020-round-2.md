# Review F-020 round 2: fill colour and text background

Fix diff: `git diff 88473b3 314fbfa -- src tests` (commit 314fbfa on feature/F-020; the merge 88473b3 only
brings in spec/copy changes from build/1.2). Module surfaces: build/1.2 commits 7785af9, c6fb4eb.
Checks run in the worktree: `pnpm typecheck` clean, `vitest tests/unit/core.fill.test.ts` 11/11,
`spec_lint` 0 errors. The builder reports `check:full` passed (11 steps); I did not re-run the e2e tests.

**Counts: 0 blocker, 0 major, 0 minor, 2 nits. All round 1 findings are resolved. F-020 can merge.**

## Round 1 findings

### M1: resolved
- `editorPadding` (`src/core/text.ts:135`) gives the margin m = 0.25 × size × zoom on the top and left,
  m − extra on the bottom and m − caretRoom on the right, clamped at 0. `Canvas.tsx:354-356` applies it.
  `extra` is now computed once and also used for the height (`:369`), so the two values cannot drift apart.
- **Anchor.** `left`/`top` still subtract `clientLeft + paddingLeft` / `clientTop + paddingTop`, read
  back with `getComputedStyle` after the padding is set. Fractional padding is read back exactly, so the
  content box's top-left stays at the anchor (the text box's top-left, `textLayout`) at every zoom.
- **No background.** `editorPadding` returns null, so `s.padding = ''` and the stylesheet's
  `var(--tk-space-1)` applies. This is the same as before F-020.
- **Content box against the background box** (`textBackground`: text box ± m on every side):
  - left = anchor − m and top = anchor − m: exact;
  - bottom = anchor + lines × lh × z + extra + (m − extra) = the box bottom: exact;
  - right = anchor + ceil(w × z) + 2 + (m − 2) = the box right plus less than 1 px of ceil.
  - An empty field uses the placeholder width, and so does the placeholder's background box.
  - The ADR-0020 scroll guard is kept: the content height is unchanged.
  - Only when m < extra (or m < 2), that is, a very small zoom, does the field stay a little larger
    than the box. The test covers that clamping.
- **The e2e clicks now tell the two apart.** `TextTool.down` (`src/canvas/text.ts:103-111`) ends the
  edit on any canvas press, so a click outside the field ends editing. Without the margin code the field
  reaches only 6 CSS px (4 px padding + 2 px border):
  - AC18 at 100 %, click at (93, 120): 7 px left, beyond 6. `End` is pressed first, so `selectionStart 0`
    really comes from the click. Without the margin it would fail.
  - AC18 at 100 %, click at (103, 93): 7 px above, beyond 6. It would fail.
  - The new AC18 at 200 % checks the padding is 16 directly, and clicks 14 CSS px left (beyond 6). It
    would fail.
  - The `editorBox` checks (left/top within 92−3…92, bottom within 148…151, right within the measured
    white edge +4) would fail with the old 6 px reach (left 94 > 92).
- Unit coverage: `core.fill.test.ts:103` covers 100 %, 200 %, the clamping at 10 % and none → null.

### m1: resolved
Both the select-tool and the text-tool paths of AC11 now click at x = 93, which is 7 px from the text box
and beyond `HIT_TOLERANCE_PX` = 6. A plain text would not be hit there. The AC's literal clicks at 96 are
kept as well.

### m2: resolved
The bottom padding now subtracts the extra height, so the bottom edge matches the other sides (the box
plus the 2 px border). The editing outline is no longer lopsided.

### m3: resolved
The test is renamed to "a rectangle and a text selected together offer neither fill nor text background".

### m4: resolved
- `contrastPair` is deleted. `drawStep` and `drawText` call MOD-Core `contrastPairing`.
- The tests import it under an alias. No `contrastPair` remains in `src`.
- The `textArea` parameter `placeholder` is dropped. Its callers, `shapes.ts:272` and `text.ts:158`, never
  passed it.

## New problems in the fix diff
None found. The copy change "Background" → "Text background" is consistent in `messages.gen.ts`, `copy.md`
and the e2e locator and title. The `rightEdge` change (device-pixel ratio `k`, sub-pixel `(last+1)/k`)
is a test helper only and is correct for 1× and 2×.

## Module surfaces
- **MOD-Core.md:32** matches the code:
  - `contrastPairing(colour)` (`custom.ts:64`);
  - `fillColourOf(kind, style)` (`custom.ts:74`);
  - `textBackground`, `textArea`, `editorPadding(style, size, zoom, extra, caretRoom)` (`text.ts`), all
    exported through `export *`.
- **MOD-Render.md:29** matches the code. `contrastPair` is gone and `colourValue` remains. The pairing is
  attributed to MOD-Core.

## Nits (optional)
- n1. `specs/40-technical/modules/MOD-Core.md:32` lists `textBackground(annotation, shortSide, measure)`.
  The code also takes an optional `placeholder` (`text.ts:102`), which MOD-Render uses for the screen-only
  placeholder box. Add `placeholder?` to the listed signature.
- n2. The "Implements" lists of MOD-Core, MOD-Render and MOD-Canvas don't name F-020 or RULE-22. F-019 and
  RULE-21 are missing in the same way, so this is a known gap in the lists, not something F-020 introduced.
  Add F-020.R1–R8 / RULE-22 (and F-019 / RULE-21) when those lists are next updated.
