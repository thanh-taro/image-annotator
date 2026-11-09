---
id: F-013
title: Work from the keyboard
status: shipped
milestone: M-1
priority: P1
personas: [PER-01]
entities: []
rules: [RULE-19]
screens: [SCR-Annotator]
components: [CMP-Toolbar, CMP-Canvas, CMP-ShortcutHelp, CMP-ConfirmDialog]
nfr: [NFR-06]
events: []
depends_on: [F-008]
---

## Intent
Frequent users switch tools and act without reaching for controls (PRN-03); keyboard-only users
can do everything (NFR-06).

## Scope
- In: the keyboard map (RULE-19); a list of shortcuts the user can open; every action reachable
  without a pointer.
- Out: custom key bindings.

## Requirements
- **R1** Every key in RULE-19 does its action whenever focus is in the tool, within RULE-19's focus scope.
- **R2** Tool controls show their shortcut key in their name or tooltip.
- **R3** The user can open a list of all shortcuts, in the active language.
- **R4** Every action that can be done with a pointer can also be done with the keyboard, including creating, selecting (one or all), moving and resizing annotations, cropping and exporting.
- **R5** Shortcuts never trigger while the user is typing in a text annotation or any text field, and never override the browser's own keys outside RULE-19; keys in RULE-19 are always kept from the browser while the tool has focus.

## Acceptance criteria
- **AC1** Given an image is loaded, when the user presses A, then the arrow tool is active; R → rectangle; X → redaction. (R1)
- **AC2** Given the toolbar, when the user hovers or focuses the arrow tool, then its tooltip names the key A. (R2)
- **AC3** Given an image is loaded, when the user presses ? (or chooses COPY-action.shortcuts), then CMP-ShortcutHelp lists every RULE-19 key with its action. (R3)
- **AC4** Given keyboard only, when the user picks the rectangle tool, presses Enter to place one, resizes it with Alt+arrows, moves it with arrows, then presses Mod+C, then the clipboard holds the image with that rectangle. (R4)
- **AC5** Given a text annotation being edited, when the user types "rat", then the letters are typed and no tool changes. (R5)
- **AC6** Given the canvas has focus, when the user presses Tab, then focus moves to the next annotation in drawing order, which becomes selected; Shift+Tab goes back; after the last annotation, Tab moves focus to the next control. (R4)
- **AC7** Given the tool has focus on Windows with nothing selected, when the user presses Alt+Left arrow, then the browser does not go back and the session is unchanged. (R5)
- **AC8** Given CMP-ShortcutHelp is open, when the user compares it with RULE-19, then every key in RULE-19 is listed, including ? itself. (R3)
- **AC9** Given focus on the colour swatches with a rectangle selected, when the user presses Right arrow, then the next colour is chosen and the rectangle does not move. (R1, R5)
- **AC10** Given CMP-ConfirmDialog is open, when the user presses Delete or R, then nothing happens behind the dialog; Esc closes it. (R5)

## UX notes
COPY-action.shortcuts opens CMP-ShortcutHelp; each tool's tooltip uses COPY-tool.shortcut_hint.

## Edge cases
- Keyboard layouts → per RULE-19 (Latin layouts by typed character, non-Latin by US key position).

## Open questions
