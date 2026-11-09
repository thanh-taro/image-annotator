# Accessibility audit F-013 (Work from the keyboard), round 1

Standard: NFR-06 (WCAG 2.2 AA, every action by keyboard, a non-drag alternative for every drag). Change under audit: `build/m1...worktree-agent-aadfff635c001fd6c` (bcdc963). Paths below are relative to the worktree `.claude/worktrees/agent-aadfff635c001fd6c`. No code was changed. The preview server I started was stopped.

Verdict: no blockers. 1 major, 7 minor. The annotation list, the shortcut dialog and the menu are well built. The one real defect is CMP-ConfirmDialog losing focus on close.

## Automated results

- `pnpm exec playwright test tests/e2e/keyboard.spec.ts` (Chromium and WebKit): 44 of 44 pass.
- That run includes axe with wcag2a, wcag2aa, wcag21a, wcag21aa and wcag22aa on CMP-ShortcutHelp (wide and narrow), the More menu and the annotation list, in both themes. There were no violations.
- A scripted Chromium probe (pnpm preview on port 4599, 1472 px and 390 px viewports) measured the following.
  - Focus after CMP-ConfirmDialog closes (see M1).
  - Focus after CMP-ShortcutHelp closes, opened from `?` and from the More menu: returns correctly.
  - Menu keys: Enter opens it and focuses the first item. Esc closes it and returns focus to the button. Tab closes it.
  - Target sizes: every control is 24 px or larger, except the checked colour-swatch radios and the segmented choices, which measure 20 to 22 px (m7).
  - Tab through the narrow layout with the style sheet open: no focused control was fully covered.
  - Inert scope: with the help open, toolbar, panel, work area and status bar are all `inert`, and so are the live regions.
  - The menu stays inside the 390 px viewport.
- Contrast was computed from tokens, not measured on screen. `--tk-color-muted` on surface is about 6.5:1 in dark and 7:1 in light, so the xs-size note and group titles pass 1.4.3. The focus ring (accent) against the surface is at least 3:1 in both themes (1.4.11).
- Motion: `keyboard.css` adds no transitions or animations (2.3.3 and prefers-reduced-motion are not affected). The forced-colors overrides are present.

## Findings

### Major

**M1. CMP-ConfirmDialog does not return focus on close (the builder's suspicion is confirmed).**
- Criteria: WCAG 2.4.3 Focus Order, 3.2.1 and NFR-06. CMP-ConfirmDialog "Accessibility" says focus "returns on close".
- Where: `src/app/ConfirmDialog.tsx:27` records `returnTo`. `:44-47` restores focus in the effect cleanup. `src/app/Shell.tsx:84` (`inert`) and `:111-129` (the `inert` attributes) make the rest of the tool inert.
- Cause: the cleanup runs before the render that removes `inert`, so `returnTo.focus()` hits an inert element and does nothing. CMP-ShortcutHelp avoids this with `queueMicrotask` at `src/app/ShortcutHelp.tsx:44-52`; the confirm dialog lacks the same fix.
- Measured: `document.activeElement` is `BODY` after Esc and after clicking Cancel. This held when focus started on the canvas region and when it started on a toolbar radio. The next Tab restarts from the top of the page.
- Why the tests miss it: F-013.AC10 (`tests/e2e/keyboard.spec.ts:351`) never asserts where focus lands.
- Fix: restore focus after inert is cleared, as ShortcutHelp does, with a fallback to `.tk-work-area` when the opener is gone (for example after Replace). Add an assertion to AC10 and to the F-001 confirm tests.
- This predates F-013 (F-001 code). F-013 AC10 and NFR-06 still rely on it.

### Minor

**m1. The More menu button lacks arrow-key opening and menu navigation keys (WAI-ARIA APG menu button).**
- Criteria: 2.1.1 (best practice, not a failure), 4.1.2.
- Where: `src/app/MoreMenu.tsx:67-86` and `:88-97`.
- Measured: ArrowDown or ArrowUp on the closed button does not open the menu (`aria-expanded` stays false). Home and End do nothing inside the menu. There is no `aria-controls` on the button.
- Fix: open on ArrowDown (first item) and ArrowUp (last item), add Home and End, and add `aria-controls`.
- Note: the wide layout has a single item, so this is invisible there. It matters more when F-014 adds Clear.

**m2. The annotation list is a listbox, but it follows the listbox pattern only in part.**
- Criteria: 4.1.2, 1.3.1 (manual screen-reader check needed).
- Where: `src/canvas/list.tsx:58-81`.
- Details: `role="listbox"` has `aria-multiselectable`, a name, `aria-describedby` and a roving tabindex, which is all correct. But arrows do not move between options (they move the annotation, as RULE-19 requires). Space and Enter do not toggle selection. Only a click or screen-reader activation selects, and it selects alone (`onPick`).
- Risk: NVDA or JAWS in focus mode may pass arrows through, and VoiceOver may announce "1 of N" navigation that does not work.
- Fix: nothing required by spec. Verify with the screen readers listed under the manual items. Keep the hint text honest about this (`COPY-a11y.annotations_hint` already says arrows move the annotation).

**m3. The listbox is nested inside `<main aria-label="Image canvas" tabindex>`, which is also the Tab stop.**
- Criteria: 1.3.1, 4.1.2.
- Where: `src/app/Shell.tsx:122-129` and `src/canvas/list.tsx:58-66`.
- Details: the region is a focusable landmark (an interactive `main`), and its role is not the listbox's, which differs from what the CMP-Canvas spec's earlier "its role becomes the annotation list's" suggested. axe passes, but some screen readers treat a focusable `main` oddly.
- Fix: none needed unless the manual pass shows a problem. Record it as a decision.

**m4. Spoken key names in CMP-ShortcutHelp are good, but there are two small gaps.**
- Criteria: 1.3.1, 4.1.2.
- Where: `src/app/ShortcutHelp.tsx:97-103` and `src/keys/index.ts` (`shortcutList`).
- Details: `<kbd aria-hidden>` plus a `tk-sr` span gives "Control Z", "question mark" and so on, which is the right approach. But the label and the spoken keys are adjacent spans with no separator, so a screen reader reads "Delete Delete, or Backspace" and "Pan Space plus drag, or Left, Up, Right or Down arrow" as one run.
- Also: the structure is `section`, `h3` and `ul`, not a table or `dl`. That is acceptable. The `ul` rows would read better with a visually hidden ": " between label and keys, or as `dl`.
- Also: `⌥` and `⌘` are hidden from assistive technology by `aria-hidden`, which is correct, and the spoken text covers them.

**m5. The scrolling region in CMP-ShortcutHelp repeats the dialog's name.**
- Criteria: 4.1.2 (best practice).
- Where: `src/app/ShortcutHelp.tsx:88`: `role="region" aria-label={t('shortcuts.title')}`.
- Details: this creates a second landmark named "Keyboard shortcuts" inside the dialog of the same name. It is needed for the keyboard-scrollable region, since axe requires it to be focusable.
- Fix: give it a distinct name or none (`tabindex` with an `aria-labelledby` on the h2 is enough).

**m6. Reading order and visual order differ between the style panel and the canvas.**
- Criteria: 1.3.2 and 2.4.3 (manual).
- Where: `src/app/Shell.tsx:117` (panel) before `:122` (work area).
- Details: the DOM order is toolbar, style panel, canvas, status bar. On wide layouts the panel is shown on the right of the canvas. After selecting by Tab, the style fields come before the canvas, so a keyboard user must Shift+Tab back to them. This is workable, and it matches the earlier features. Confirm it in the manual pass and decide whether to keep it.

**m7. Some pointer targets are under 24 px.**
- Criterion: 2.5.8 (Target Size, Minimum).
- Where: the checked colour swatch and the segmented radios, in `src/app/styles/drawing.css:169-200` (`.tk-choice` is inset 0 inside a 1 to 2 px border).
- Measured: 20 px for the checked swatch radio and 22 px for the others, inside 24 px boxes (`--tk-size-swatch: 24px`).
- Impact: the spacing exception applies (the 24 px circles do not overlap), so this is not a failure. The visible box is 24 px but the input is smaller, so a click on the border does not hit the input.
- Fix (optional): make the whole `.tk-swatch` the click target, for example with a `label` or by inset -1 px.
- Everything F-013 added is fine: the More button is 32 px, menu items are 44 px, Close is 32 px (44 px narrow), and shortcut rows have a 24 px minimum height.

**m8. Selecting a chosen subset of annotations has no keyboard equivalent.**
- Criteria: NFR-06 (every action operable by keyboard), WCAG 2.1.1.
- Where: F-008.R1 against F-008 Scope "Out: adding to a selection from the keyboard (select all only)".
- Details: the marquee and Shift+click have no keyboard alternative other than Mod+A. This is a documented spec decision, so I did not mark it as a defect. The user can still reach every annotation one at a time.
- Suggestion: record it as an accepted deviation in NFR-06 or revisit it in M-2.

## Checked and passing

- **Listbox (spec items):**
  - Listbox, name, description and multiselectable are present (`src/canvas/list.tsx:58-66`).
  - Options use `aria-selected`.
  - Roving tabindex puts the Tab stop on the last selected option, or on the region when nothing is selected, and the list has no Tab stop while text is edited.
  - Focus follows the selection after delete, undo or Esc (`useLayoutEffect`), so a removed option does not strand focus.
  - Names use the spec'd COPY strings (step number, text content, position).
  - Tab and Shift+Tab leave the canvas after the last or before the first annotation. There is no keyboard trap (2.1.2).
- **Announcements:**
  - Pointer selection announces the name or the count.
  - Tab selection is announced by the focus move itself, so there is no double announcement.
  - Select all gives `selected_count`.
  - Delete, duplicate, place, tool change and undo or redo announce politely.
  - The live regions go inert with the rest of the tool while the help is open, so nothing is read behind it.
- **CMP-ShortcutHelp:**
  - `role="dialog"`, `aria-modal`, and `aria-labelledby` are in place.
  - Focus lands on Close.
  - The Tab trap covers Close and the scroll region, in both directions.
  - Esc closes it (document capture, stopPropagation).
  - Focus returns to the opener: the canvas region when opened by `?`, and the More button when opened from the menu. The fallback goes to `.tk-work-area`.
  - There is a scope note for RULE-19.
  - Group headings are `h3`. The focus ring on the scroll region is visible.
- **More menu:**
  - It has `aria-haspopup="menu"`, `aria-expanded`, `role="menu"` with a name, and `menuitem` buttons.
  - Disabled items (Download with no image) are skipped by Up and Down.
  - Esc returns focus to the button. Tab closes it. Choosing an item closes the menu first, so the dialog's opener is the button.
  - `aria-keyshortcuts` is set on Download but not on `?` (correct, since `?` is canvas-only).
- **Focus-visible:**
  - Menu items, the More button, the Close button and the scroll region show a 2 px accent ring.
  - An option's focus is shown as an inset ring on the whole work area (`src/app/styles/keyboard.css:116-123`, with a forced-colors override). The selected annotation shows its handles, so the pair identifies the item.
- **2.1.4 Character Key Shortcuts:** satisfied by the focus-scope rule (RULE-19). Letters, `?`, `[`, `]`, Delete, Backspace, Shift+1 and Shift+0 act only with the canvas or an option focused. All other keys use a modifier or are modifier-held arrows. The scope note appears in the help dialog.
- **2.4.11 Focus Not Obscured (Minimum):** no focused control was fully covered in the narrow layout with the sheet open. The canvas region is partly covered by the sheet (97 to 684 px), but its ring stays visible above it. Notices have no focus and are not focus targets.
- **Every M-1 action by keyboard:** open (Mod+O, button), paste (Mod+V), choose tools (letters, toolbar), place (Enter), select (Tab, Mod+A), move, resize, crop (arrows and Alt+arrows), restyle (panel fields and swatches), duplicate, delete, reorder, undo and redo, zoom, pan (arrows), copy and download (Mod+C, Mod+S, buttons), shortcut list (`?`, menu), and edit text (Enter). The only gaps are freehand strokes, which are essential (the keyboard places a dot), and m8.
- **Drags with a non-drag alternative:** move and resize (arrows, Alt+arrows, position and size fields), crop frame (arrows), and pan (arrows). Pointer-only: Alt+drag (the arrows replace it) and Space+drag.

## Needs a manual pass (not automated)

1. Screen readers: NVDA with Firefox and Chrome, JAWS, and VoiceOver on macOS and iOS.
   - Does the listbox inside `main` read well (name, hint, "selected", position)?
   - Do arrows work in focus mode (m2, m3)?
   - Does Tab-selecting an option read once, not twice?
   - Are the shortcut rows read as intended (m4)?
2. Reflow and zoom: 200% text and 400% zoom (1.4.10) for CMP-ShortcutHelp (fixed 640 by 600 box, max 100%). Check text spacing (1.4.12).
3. Windows High Contrast and forced colours: the focus ring, the shortcut dialog border and the menu border.
4. Notices and the narrow sheet: whether a long error notice or the sheet covers a focused annotation or control (2.4.11), including at 400% zoom.
5. Touch: coarse-pointer sizes for the More button and the Close button, and a real-device check of the 390 px layout.
6. Voice control and dictation: single-letter shortcuts while the canvas has focus (2.1.4 is met by scope, but check it feels safe).
7. Reading order (m6) and the keyboard-only walk of the whole M-1 flow on Windows and Linux, including the Alt+Left check (AC7) in a real browser.
