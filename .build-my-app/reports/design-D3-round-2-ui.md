# Design D3: UI re-check, round 2

Scope: only the round-1 fixes. Rendered all 7 embedded state boards (dark and light) plus CMP-DropOverlay and CMP-StylePanel, and a shortcut-help copy with `.app` set to 480 px high to force the list to overflow.

## Verdict per fix
| Round-1 item | Landed? | New visible problem? |
|---|---|---|
| UI 1: drop zone runs through live text (workArea 88 %, 18 px pill) | Yes. In light the image fades to a faint ghost. In dark the checkout reads as a dim grey card. The solid pill stands clear in both. CMP-DropOverlay board matches. | None that blocks. In dark the dimmed redaction bars and the blue button still show at about 12 %, which is acceptable for a short-lived drag state. |
| UI 2: loading notice on the dashed border | Yes. The notice sits about 40 px above the dashed edge, clear of the border and the Open image button. There's no focus ring on Open image. | None |
| UI 3: help list (2 grid columns, natural height, line under header, scroll cue) | Yes. Two clean columns, groups top-aligned, and a hairline under the intro. At 760 px nothing overflows and no cue shows, which is correct. | Minor: at natural height the dialog fills almost all of the 760 px app. Its top edge sits over the toolbar and cuts the "2 redactions" chip ("…tions"). The scrim covers it, so this is cosmetic. It's fine to keep the 16 px inset (`max-height: calc(100% - 32px)`). |
| Help scroll cue on overflow | Yes. With `.app` at 480 px the list scrolls inside the dialog, the header and Close stay fixed, and a soft lineStrong shadow shows at the bottom edge over the half-hidden "View" heading. No top shadow shows at scroll 0, which is correct. Visible in both themes. | None. The cue is a centred elliptical glow, not a full-width band. That's OK as a hint. |
| Audit titles | Yes (checked in the file heads) | None |
| Empty / loading show the unfocused click_to_paste hint | Yes, in both | None |
| UI 5: zoom value "–" | Yes. Empty slot between − and + in empty and loading | Minor: the gap between − and + now looks like a missing value rather than a disabled state. Acceptable because both buttons are dimmed. No change needed. |
| UI 6: ragged crop fields (`.fl` space-between) | Yes. In cropping the X and Width inputs line up, and so do Y and Height. CMP-StylePanel lines up in rectangle, arrow (Start/End), blur and solid-redaction selections. | None. The label-to-input gap in the X / Y column is wide (about 40 px), but rows stay clearly paired. |
| UI 8: orphan word in the confirm body | Partly. `text-wrap: pretty` leaves "be lost." as a two-word last line, not a single orphan. | None |
| Frame size in status bar and canvas (audit M1) | Yes. canvas-settings shows 1,966 × 1,308 px, and cropping shows 1,707 × 683 px in the panel, chip and status bar alike. | None (the owner still needs to confirm, as round 1 noted) |

## Would look wrong if built
Nothing blocks. One optional polish item: the help dialog covering the toolbar chip at full height (see UI 3). Leaving it as is is fine.

Renders: /private/tmp/claude-501/-Users-er-lap-mam3-016-Documents-personals-taro-kit-tools-developer-tools-image-annotator/1c1bc6a9-6825-4cff-9cda-ba55cceb312c/scratchpad/r2/ (help overflow test: help_short.png, help_short_crop.png)
