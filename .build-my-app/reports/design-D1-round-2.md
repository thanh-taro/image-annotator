# Design loop D1 — round 2 triage

Inputs:
- design-D1-round-2-audit.md (spec: 0 blocker / 3 major / 14 minor)
- design-D1-round-2-a11y.md (accessibility: 1 major / 7 minor new, plus open round-1 items)
- design-D1-round-2-ui.md (UI: 1 regression, 5 partly fixed, 6 major / 9 minor new)

## Spec changes this round (draft until G2; changelog updated, lint 0/0)
- **RULE-19:** the single-character keys ?, Shift+1 and Shift+0 act only while the canvas has focus (WCAG 2.1.4).
- **CMP-Toolbar:**
  - The narrow layout is now specified as two rows.
  - Download moves into the overflow menu and the count sits beside Copy.
  - Tools scroll with a cut-off edge.
  - Below 360 px the count shows the number only.
- **CMP-Notice:** the success timer pauses while hovered or focused (WCAG 2.2.1).
- **CMP-StylePanel and CMP-ShortcutHelp:**
  - The reuse of size_s/m/l is stated in the spec.
  - The shortcut list gets a scope note.
- **style.md:**
  - Active and selected states use a 2 px accent inset; disabled controls are transparent with muted text.
  - Dialog primary actions are outlined, and Cancel is quiet.
  - Button heights are set: 32 px, and `size.control`.
  - The touch target is 44 px.
  - Position fields use `font.size.input`.
- **copy.md:** canvas_summary, text_annotation, toolbar, style_panel, zoom_menu, new_tab, privacy.title, shortcuts.scope_note.
- **adapters/design.md:** data-copy on an aria-labelled element names the label.

## Board fixes
- **Toolbar:**
  - All 11 tools appear on narrow, scrolling with a fade edge, plus a frame scrolled to the end.
  - New frames: narrow no image, and 320 px with a compact count.
  - A button-states grid: default / hover / pressed / focus / disabled.
  - Disabled Copy is no longer filled.
  - More actions has aria-expanded; aria-keyshortcuts added; title tooltips removed.
- **StylePanel:**
  - The segmented control no longer clips the focus ring.
  - Disabled options are transparent.
  - Inputs are 16 px with inputmode; the geometry group uses fieldset/legend.
  - The "Not secure" tag uses radius 7 and a 16 px icon.
  - Use solid is accent-outlined.
  - Radiogroups and panels carry data-copy.
  - The image-size line is removed.
  - New variants: tool: arrow (no Fill), and selection: solid redaction.
- **Canvas:**
  - The padding frame border is `muted`.
  - The 24 px hit area is drawn.
  - Square handles.
  - Sample text is marked.
  - The translucent fill is a separate layer.
  - Hidden text for the canvas summary and text annotations.
- **ConfirmDialog:**
  - Cancel is quiet (no border, `surface2` on hover), fixing the round-1 regression.
  - The dialogs are alertdialogs with aria-describedby.
  - New narrow frame with 44 px buttons.
- **StatusBar:**
  - Narrow bar is 48 px with 44 px targets.
  - The privacy badge has aria-expanded.
  - The GitHub link opens a new tab and says so.
  - The privacy popover has a name and a max-width.
  - The narrow zoom button is named.
- **ShortcutHelp:**
  - Both the Windows/Linux and macOS key sets appear in both themes.
  - Headings are no longer uppercase.
  - The list is a named region with a focus style.
  - The scope note is added.
  - The dialog height has a max-height.
- **EmptyState:** the title is an h2; kbd uses radius 7; new macOS + narrow frame.
- **TextEditor:** the placeholder uses the current colour with the halo (no raw grey).
- **Notice:**
  - New frame for the singular count.
  - The narrow decode error gets an Open image action.
  - A static dotted ring when motion is reduced.

## Deferred, with reasons
- **StylePanel narrow:** goes to D3. On phones the panel becomes a bottom sheet (D-012).
- **DropOverlay and TextEditor narrow frames:** not needed. Phones don't drag files in, and the text editor looks the same at every width.
- **Cursor-per-tool variant:** goes to D2 flow steps.
- **Hover states:** shown once in the Toolbar states grid; the other boards reuse the same rules from style.md.
- **Manual QA (phase 5):**
  - screen reader;
  - rendered focus;
  - 200 % text and 320 px reflow;
  - forced colours;
  - focus clipping at the iframe edge;
  - tooltip behaviour (WCAG 1.4.13).
