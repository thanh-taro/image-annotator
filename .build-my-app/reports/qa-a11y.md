# QA phase 5: accessibility audit of the whole Image Annotator (NFR-06, WCAG 2.2 AA)

Branch build/m1 at 4e350e0 plus the working tree. Production preview (`pnpm build`, `vite preview`), Chromium (Playwright), local only. No app code was changed. Added `tests/e2e/qa/a11y-matrix.spec.ts`.

**Verdict: 0 blockers, 0 majors, 5 minors.** Every earlier blocker and major is fixed (table below). What was not run: WebKit (the audit is Chromium only; WebKit already runs the per-feature axe tests), any real assistive technology, and real touch.

## 1. Automated results

### 1.1 axe matrix (`tests/e2e/qa/a11y-matrix.spec.ts`, 12 tests, all pass)
Rules: wcag2a, wcag2aa, wcag21a, wcag21aa, wcag22aa and best-practice, which includes `color-contrast`. Run for dark and light x 1200, 390 and 320 px wide x en-US and vi-VN (themes and languages set through `?theme=` and `?lang=`). In each run axe scanned these states:
- empty state, empty + More menu, empty + shortcut help
- notice (an undecodable file, so the assertive notice)
- image loaded
- each of the 11 tools (V R O A L P H T N X C)
- a selected rectangle (position and size fields)
- text editing
- the style sheet open (390 and 320 px only)
- crop
- More menu with an image, and the Start over confirm dialog

Result: no violations in any state, theme, width or language. One rule is switched off in the test: `page-has-heading-one` (a best-practice whole-page rule that fired on every state, 39 times). See m1.

### 1.2 Scripted probes (Chromium, run and removed)
| Check | Result |
|---|---|
| 2.5.8 target size, every visible control, 3 widths x 2 languages, loaded and rect tool (swatches measured by their label box) | none under 24 px |
| 1.4.10 reflow at 320 px, 390 px, and 200 % / 400 % zoom (viewports 600x400 and 320x256, vi-VN) | no horizontal page scroll (`scrollWidth == clientWidth`) |
| `prefers-reduced-motion` | `reset.css:28` collapses every animation and transition to 0.01 ms; computed durations 1e-5 s |
| Live regions after keys (see 1.3) | all spec-listed announcements present |
| Focus rings in the tab order | solid 2 px on every button and link; the canvas region uses an inset accent border (`components.css:110`) |
| `document.documentElement.lang` | set on language change (`src/host/index.ts:50`) |
| Forced colours (`forced-colors: active` screenshots, 1200 px) | usable: every control is outlined, the selected tool, swatch and segment are marked by a heavier border, focus is visible. Not conclusive, see manual item 6 |

### 1.3 Live-region and keyboard run (keyboard only, 1200 px)
Announced, in the polite `role=status`: tool change ("Rectangle tool"), placing with Enter ("Rectangle added"), duplicate ("1 annotation duplicated"), select all ("2 annotations selected"), delete ("2 annotations deleted"), Undone, Redone, text added, pen, step and redact placing, crop size ("999 × 800 px" after Alt+Arrow), Copied and Downloaded (both with "with 1 redaction applied"). Errors go to the assertive `role=alert` (`state.ts:215`). Start over announces `a11y.cleared`. Focus stays on the canvas region after every command. The text editor (Enter after choosing the Text tool) takes focus and Esc returns it to the region. The position and size fields (X, Y, Width, Height, labelled) are Tab-reachable for a selected annotation and for crop.

Not announced, and not required by CMP-Canvas: arrow-key nudge and Alt+arrow resize (the list option's name carries the new position), zoom.

## 2. Findings

### Blocker
None.

### Major
None.

### Minor

**m1. No level-1 heading in the document.**
- WCAG 1.3.1 and 2.4.6 (best practice, not an AA failure). axe `page-has-heading-one`.
- `src/app/Shell.tsx` and `src/app/EmptyState.tsx:20` (the empty state's title is an `h2`; dialogs use `h2` at `ConfirmDialog.tsx:70`, `ShortcutHelp.tsx:64`).
- The tool is an iframe in the portal, so the portal's `h1` may be enough. Fix: either a visually hidden `<h1>` ("Image Annotator", the `<title>`) as the first child of `<main>`'s ancestor, or record the decision. The empty-state `h2` with no `h1` above it also skips a level.

**m2. Tab order: the style panel comes before the canvas, but is drawn to its right.**
- WCAG 1.3.2, 2.4.3. `src/app/Shell.tsx:117` (panel) before `:122` (work area). The measured tab order is toolbar, panel fields, canvas region, privacy, zoom. This is the open F-013 m6. It is workable and consistent, so record it as an accepted decision or move the panel after the canvas in the DOM (the visual position is CSS).

**m3. The embedded "unfocused" empty-state hint is pointer-only wording.**
- WCAG 3.3.2 / 2.1.1 wording. `src/app/EmptyState.tsx:12-13`, copy `load.click_to_paste` ("Click here, then press Ctrl+V…"). The open D1 m12. Open image is a keyboard path, so nothing is blocked. Fix: "Focus this tool, then press Ctrl+V…" or reuse `load.empty_hint`.

**m4. At 400 % zoom with the narrow sheet open, little remains visible.**
- WCAG 1.4.10 (no content is lost, but the usable area is small). At 320x256 CSS px (400 % on a 1280x1024 window) the open style sheet leaves about one row of controls above the status bar (`drawing.css:349`, `max-height: var(--tk-sheet-max, 50vh)`). Not verified: whether the sheet scrolls inside. Fix: if it does not, make the sheet `overflow-y: auto` with a focusable name, and consider letting it take up to 100 % of the height below the toolbar at heights under 400 px. Manual item 5.

**m5. An out-of-range value in a position or size field is corrected silently.**
- WCAG 3.3.1. `src/app/StylePanel.tsx:294-350`. Entering 99999 in a crop X field snaps to a valid value; the field shows the new value and crop size is announced, but there is no `aria-invalid`, no message and no min/max text (open D1 m13 part). Fix: announce the correction politely ("Adjusted to {n}") or describe the range with `aria-describedby`.

(Also kept from earlier rounds as accepted decisions: no keyboard way to select a chosen subset, only Select all, F-013 m8; the disabled swatch hairline contrast is exempt.)

## 3. Earlier findings, checked
| Report | Item | Status now |
|---|---|---|
| a11y-F-014 M1 | no announcement after Start over | Fixed: `a11y.cleared` announced; confirmed on screen |
| a11y-F-014 M2 | disabled Start over hidden from arrow keys | Fixed: `aria-disabled` kept in order (`MoreMenu.tsx:33,155`) |
| a11y-F-014 m2 | Shift+Tab with focus outside the dialog | Fixed (`ConfirmDialog.tsx:44-47`) |
| a11y-F-014 m1 | focus fallback in the empty state | Not reproduced: focus returns to the opener (More) after Esc |
| a11y-F-013 M1 | confirm dialog loses focus on close | Fixed (`returnFocusLater`, `ConfirmDialog.tsx:54`) |
| a11y-F-013 m1 | More button arrow keys, Home and End, `aria-controls` | Fixed (`MoreMenu.tsx:98-135`) |
| a11y-F-013 m7 | checked swatch under 24 px | No control under 24 px measured |
| a11y-F-013 m6 | panel before canvas in DOM | Open, now m2 |
| D1 r3 m12 / m13 | click-to-paste wording; geometry validation | Open, now m3 and m5; the geometry group is now a fieldset with a legend (`StylePanel.tsx:308`) |
| D1 r3 NN5 | five of six geometry groups were not fieldsets | Fixed |
| D2 r3 | canvas focus ring, list has no Tab stop while editing | Fixed (`Shell.tsx:128`, `components.css:110`) |

## 4. Manual checklist for the user

Use the production preview (`pnpm build && pnpm preview`, http://localhost:4173). Set the language with `?lang=vi-VN` and theme with `?theme=light`. Pass criterion for each step: the announced text matches the quoted copy, nothing is read twice, and focus is where stated.

**VoiceOver (macOS, Safari), Cmd+F5**
1. Load the page. Rotor (VO+U) landmarks: expect the toolbar "Tools and actions", main "Image canvas", complementary "Style", status. Check that the empty state is read as "Paste, drop or open an image".
2. Press Cmd+V with an image copied. Expect "Image opened, W × H px". Move to the canvas region: expect "Image canvas", then the summary "W × H px canvas, 0 annotations".
3. VO to the toolbar and arrow through the tools: each reads "name (key), radio, n of 11". Press T, Enter-place a text, type, Esc: expect "Text tool", "Text added".
4. Press R then Enter, then Tab: the option reads "Rectangle at x, y"; arrows move it. Check the hint "Tab moves to the next annotation…" is read once on entering the list.
5. Open the position and size fields (the group is "Position and size"): X, Y, Width, Height read with their values. Type a bad value and confirm what is spoken (m5).
6. Delete, Cmd+Z, Cmd+Shift+Z: expect "1 annotation deleted", "Undone", "Redone". Cmd+C and Cmd+S: expect the Copied or Downloaded message.
7. Open More actions with VO+Space: menu, "Keyboard shortcuts", "Start over". Choose Start over: expect the alert dialog title and message read on open, focus on Cancel; Esc returns to More; Confirm announces "Image cleared…".
8. Drop an invalid file: expect the error read at once (assertive) without moving focus.
9. Repeat 2 to 4 in vi-VN and check the voice reads the Vietnamese text with the correct language (`lang="vi"`).

**NVDA (Windows, Firefox and Chrome)**
10. Repeat steps 1 to 8. In browse mode, check the canvas list is reachable (Tab from the region) and the listbox is read as a multi-selectable list. Check the status messages are not read twice when focus is in the canvas (NVDA reads live regions even in focus mode).
11. Check the colour swatches are read by name ("Red", not "radio 1") and that Fill, Size and Padding choices read their selected state.

**TalkBack or VoiceOver on a tablet (touch)**
12. Swipe through the narrow toolbar: the tool strip scrolls and each tool has a name. Open the style sheet from the summary bar: the sheet reads as expanded, Back or Esc closes it, and the double-tap targets are easy to hit (all measured at least 24 px, menu items 44 px).

**Visual and system settings**
13. Windows High Contrast (Edge or Firefox, "Aquatic" and "Desert" themes), or macOS "Increase contrast": check that the active tool, selected swatch and segment, danger button, canvas focus ring, crop frame handles and the keyboard-shortcut chips remain visible, and that the separator in the More menu shows. The Download button and the undo and redo icons looked reddish in the emulated screenshot; confirm in a real high-contrast mode.
14. Browser zoom 200 % and 400 % (Cmd/Ctrl +) in en-US and vi-VN, at a window of 1280 px: no horizontal page scroll; the sheet at 400 %; the dialogs; the More menu; shortcut help scrolls by keyboard. Also set the browser's minimum or default font size to 200 % (Chrome Settings, Appearance) and check the text still fits (the app uses px font sizes, so this setting may have no effect: if so, record it).
15. OS "Reduce motion" on: check the sheet opens without sliding, the toast does not animate, and scrolling the tool strip is not smooth.
16. Windows text spacing (a text-spacing bookmarklet with line-height 1.5, letter spacing 0.12em): nothing is clipped in the toolbar, panel or dialogs (1.4.12).
17. Keyboard only, the whole tool with no mouse: Tab from the browser address bar, check the order, that every focus ring is visible against the canvas and panel in both themes, and that no key traps focus (menu, help, confirm, text editor).
18. A real touch device (WebKit tablet and Chromium tablet): single-finger drawing, tapping the active tool to open the sheet, and the position and size fields as the non-drag alternative.
