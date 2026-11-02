# Design D3 (screen states) — round 1 triage

Reviews: spec audit (0 blocker · 2 major · 4 minor), UI critique (0 · 3 · 5), accessibility (0 · 2 · 7). Full reports were returned inline; the findings and their outcomes are below.

## Fixed
| Finding | Fix |
|---|---|
| Audit M1 / a11y M2: status bar and canvas summary show the original size on a padded or cropped canvas | Spec: CMP-StatusBar and CMP-Canvas say both show the frame size (the export size, RULE-15). Boards: canvas-settings 1,966 × 1,308, cropping 1,707 × 683. **Owner to confirm at the D3 review.** |
| Audit M2: SCR selecting row says "handles", board shows outlines | SCR row now matches CMP-Canvas; the board label points to FLOW-01 step 2 for a single selection |
| a11y M1: background not inert behind dialogs | Boards: toolbar, main and footer are `inert` in shortcut-help and confirm-replace. Spec: both dialogs are modal (focus kept and returned, shortcuts off, the confirmation ignores outside clicks). Live regions go silent while a dialog is open; accepted, since nothing else can happen then |
| UI 1: drop zone runs through live text | Backdrop is now workArea at 88 % (D3 board and the D1 CMP-DropOverlay board); pill text 18 px |
| UI 2: loading notice on the dashed border | The notice sits 40 px up over the empty state; no focus ring on Open image |
| UI 3 / a11y m6: help list uses CSS columns and the region duplicates the name | Two explicit grid columns, natural height, a scroll shadow cue that shows only on overflow, a line under the header; the region role and name were dropped (tabindex kept). Narrow single column: D1 board |
| Audit titles (both) | `<title>` = `SCR-Annotator / <state> / embedded 1200` |
| Audit / a11y m1: empty focus claim, unfocused variant missing | Empty and loading show the embedded unfocused variant (COPY-load.click_to_paste); the focused hint is the D1 CMP-EmptyState board |
| Audit: loading over an image, load errors | Board labels name both cases (same notice; see CMP-Notice) |
| UI 5 / a11y m7: zoom value "–" reads as a minus | An empty, aria-hidden slot |
| UI 6: ragged crop fields | `.fl` spaces label and input apart, so the inputs align (gen_d2, D1 CMP-StylePanel) |
| UI 8: orphan word in the confirm body | `text-wrap: pretty` |
| a11y m2, m3, m4 | Spec lines: CMP-DropOverlay clears its message; CMP-Notice clears progress before the result; CMP-Canvas announces COPY-crop.size once after a crop change |
| a11y m5: multi panel claims a shared value | The values are shared in this sample (both red, Medium), so the board is right; spec line added to CMP-StylePanel: no option marked when values differ |

## Not changed
- UI 7 (chip over the arrow): D1 placed the chip space.3 below the frame; that area is dimmed and is being cut, so covering it hides nothing that will be exported. Kept.
- UI 4 (fit computed after the panel appears): build note, no visual change.
- Manual QA list from the a11y report: screen readers in the iframe with dialogs, OS file drag, keyboard crop, forced colours, 200 / 400 % zoom.

## Round 2 (re-check of the fixes)
- Accessibility and spec: all fixes landed; 0 blockers, 0 majors. Fixed 2 minors: focus ring on the scrollable help list; both dialog specs say canvas announcements wait until the dialog closes. The frame-size decision is left for the owner.
- UI (`design-D3-round-2-ui.md`): all fixes landed, nothing would look wrong if built. Not changed (cosmetic): the tall help dialog covers the toolbar under the scrim; the empty zoom slot; "be lost." wraps as two words.
- Converged in 2 rounds.
