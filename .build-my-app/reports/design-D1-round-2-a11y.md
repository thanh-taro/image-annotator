# Accessibility audit, design D1 (components), round 2

Scope: ten CMP-*.dc.html boards, source only (Main.dc.html ignored). Criteria: NFR-06 (WCAG 2.2 AA), component Accessibility sections, round-1 report and decisions.
Result: round 1 had 24 findings (9 major, 15 minor). Round 2 status: 11 fixed, 3 reasonably decided or deferred to manual QA, 4 partly fixed, 6 open. New: 1 major, 7 minor. Contrast: 0 regressions, 1 new marginal pairing.

## 1. Round-1 findings, status

### Fixed (11)
- M1 narrow tool buttons now have `aria-pressed`.
- M2 `.ib.on`, `.seg button.on`, `.kind button.on` have an inset or border 2 px accent (accent on surface 5.99 / 6.54). Selected swatch is a 2 px accent border plus inset surface ring (not the focus look). Reasonable; no check glyph, but colour plus width difference.
- M4 `kbd` is `aria-hidden` with a visually hidden spoken form; `ul/li` and `h3` semantics; macOS variant added with spoken names.
- M8 persistent `role=status` / `role=alert` containers in Notice, status region in DropOverlay (pill `aria-hidden`), polite live region in every Canvas cell; reduced-motion rule on the spinner.
- M9 `role=region`, `tabindex=0` and name on all Canvas cells. (Residual in N6.)
- m1, m2, m3 (DropOverlay dash, Notice button border, selection outline: see contrast section). m3 is fixed by the 1 px workArea halo, which flips with theme, so the outline has a contrasting neighbour on light and dark screenshots.
- m4 handle hit area is stated in the board label only; the CSS `.h` is still 10 px with no drawn 24 px area. Accepted as documentation; verify in build.
- m9 ShortcutHelp uses `aria-labelledby` (wide), focus on Close shown, h3 is 12 px. Narrow variant still uses `aria-label`, which is fine.
- m14 padding-unavailable text linked with `aria-describedby`; swatch names carry `data-copy`; selected count is a live region.

### Decided or deferred, acceptable (3)
- M3 focus style: 2 px accent, offset 2, shown on at least one control per board (decision recorded). Passes on every surface (5.99 / 6.54 on surface, 6.48 / 5.42 on workArea). No board has a global `:focus-visible` rule, so the implementation must add one; boards Notice, DropOverlay, TextEditor have no focus example (Notice Download and Close are focusable). Manual: rendered focus on every control.
- M5 (2.1.4): accepted for Tools, Canvas and Edit keys per RULE-19 (active only with canvas focus). Residual, see N2.
- M6 reflow: widths now `max-width`; Notice `min-height`; dialog body scrolls. Still fixed: `.tb` height 40, `.st` height 28, `.panel` height 640, `.dlg` height 600, px type, no 320 px board. Deferred to manual QA as decided; recommend `min-height` on `.tb`, `.st`, `.panel` before build.

### Partly fixed (4)
- M7 Undo/Redo are in the narrow bar now, but see N1 (three tools unreachable).
- m12 EmptyState: focus ring and `muted` dashed border done (muted on workArea 6.76 / 5.74). Still open: title is a `p`; "Click here, then press Ctrl+V" copy is pointer-only wording (COPY-load.click_to_paste); no Cmd+V on the board (copy key `{paste_key}` may cover it).
- m13 single rectangle and arrow boards now show X/Y/Width/Height (D-008 verifiable). Still open: inputs have no `inputmode`, unit, min/max, error or "Enter applies" text; the group is a div + heading, not `fieldset/legend`.
- m15 spinner reduced motion and copy keys done. Still open: editing halo is hard-coded white (fine for the red and blue samples, not demonstrated for white or yellow text); `role=textbox` has no contenteditable (implementation note).

### Open (6)
- m5 Undo, Redo, Copy, Download, Open image names lack the shortcut (`aria-label` or `aria-keyshortcuts`). Default toolbar uses `title` for tool tooltips (not keyboard reachable); narrow uses a custom `role=tooltip`. Pick one keyboard-reachable tooltip pattern (dismissible with Esc, hoverable, persistent: 1.4.13).
- m6 "More actions" has `aria-haspopup` but no `aria-expanded` (wide and narrow). Menu keyboard behaviour is manual.
- m7 tool group still `aria-pressed` toggles (spec says single-choice); no decision recorded. Redaction count pill still not in Copy/Download names.
- m8 ConfirmDialog: no `aria-describedby`, no `role=alertdialog` for destructive actions; initial focus on Cancel is shown.
- m10 StatusBar: zoom value not exposed in Zoom in/out names or focusable; narrow zoom button ("31 %" + chevron) has no "Zoom" name.
- m11 privacy badge has `aria-haspopup=dialog` and no `aria-expanded`; GitHub link has no `target=_blank rel=noopener` or "opens in new tab" (Enter would navigate the iframe away from unsaved work).

## 2. New issues (round 2)

Major
- N1 CMP-Toolbar narrow 390: `toolsN = tools.slice(0,8)`. Step, Redact and Crop (and their shortcuts) have no control on narrow. The row is exactly full (8 x 44 + gaps), `overflow:visible`, and the overflow menu does not list them. Touch users cannot redact on narrow (NFR-07; redaction is the core feature). Criterion: 2.1.1 equivalent / NFR-07. Fix: scrollable strip with peek and scroll-into-view, or a "More tools" menu item group, or a second row; add to the board.

Minor
- N2 2.1.4 residual: `?`, Shift+1, Shift+0 are character-key shortcuts that RULE-19 keeps active wherever focus is in the tool (Help and View groups), so the focus exception does not cover them. Fix: scope them to canvas focus too (buttons already exist for each), or add a disable/remap setting. Also add a line in CMP-ShortcutHelp that Tools, Canvas and Edit keys need canvas focus (users pressing V on the toolbar get nothing).
- N3 CMP-Canvas padding frame: 1 px `lineStrong` around white padding on workArea is 2.99 in light (3.62 dark); white padding vs workArea light is 1.21. Fix: use `muted` (5.74) for the frame, as done for EmptyState.
- N4 CMP-ShortcutHelp `.body` is `tabindex=0` with `aria-label` but no role (name ignored on a generic div), and no focus style for it. Fix: `role="region"` and a focus outline.
- N5 CMP-TextEditor placeholder: fixed `#6B7280` on #F6F7F9 is 4.51 (passes only on this sample); on a dark screenshot it fails, and the empty variant has no halo or backing. Fix: placeholder inherits the text colour at reduced opacity with the same halo, or a small backing chip.
- N6 CMP-Canvas: COPY-a11y.annotation is "{kind} at {x}, {y}", so text annotation content (e.g. "Remove?") is never exposed (annotations are `aria-hidden` bitmap). Fix (spec): for text, "{kind} at {x}, {y}: {text}". Also no accessible description (image size, annotation count) on the region.
- N7 Notice success "auto-hides after 4 s" (2.2.1): not decided. Fix: pause on hover and focus, or persist until Close; errors persist. Text is also in the live region, so announcement is not lost. Manual.
- N8 StatusBar focus ring (24 px control, 2 px offset) extends beyond the 28 px bar. Manual: check it is not clipped at the iframe edge (2.4.11).

## 3. Contrast, new issues or regressions only
All pairings used in the boards recomputed (dark / light). No regressions. Round-1 failures now pass: DropOverlay dash `fg` on scrim over workArea 17.07 / 6.09, over a light image 7.10 / 6.72; Notice error border and button `danger` on dangerBg 6.86 / 5.03; EmptyState dashed `muted` on workArea 6.76 / 5.74; `selectionOutline` has a contrasting halo (A47BFF vs 0B0812 6.48; 6837E0 vs ECE8F4 5.42); handle border 6837E0 on dark workArea 3.04; focus ring accent on surface 5.99 / 6.54.
Marginal passes to keep: accent on selection 5.02 (dark); handle border 3.04; `lineStrong` on surface 3.34; placeholder 4.51; red text on light image 4.67 (20 px bold, large text rule anyway).
New: N3 (2.99 light) and N5 above. Informational, not WCAG-scoped (user content, RULE-07): orange, green, yellow on #F6F7F9 are 2.29, 2.43, 1.32; the transparent-PNG sample adds them to the board.
Tool: /private/tmp/claude-501/-Users-er-lap-mam3-016-Documents-personals-taro-kit-tools-developer-tools-image-annotator/0ffd0179-bd4b-4d78-94c5-801d607d1aa4/scratchpad/c.py

## 4. Needs a manual pass (unchanged from round 1, plus)
Screen reader (live regions, kbd spoken names, menus, dialogs, Tab through annotations); rendered focus on all controls and over scrim; 200 % text, 320 px reflow, text spacing; touch pass (handle hit areas, narrow toolbar); selection outline on mid-tone and dark screenshots in both themes; reduced motion, forced colours; Notice timing (N7); tooltip behaviour (1.4.13); focus clipping (N8).
