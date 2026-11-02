# Design D1 (components): UI critique, round 3

Source: ui-critic agent (saved by the orchestrator), from HTML/CSS of design/canvas/project/CMP-*.dc.html.
Totals: round-2 (15): 8 fixed, 5 partly, 2 open (N10, N14); regression #15 fixed. New: 0 blocker, 2 major, 8 minor.

## Round-2 still open / partly
- N2 narrow tools: all 11 present, but at 390 px 8 buttons fit exactly; nothing is visibly cut (-> R3-2).
- N7 placeholder full strength (-> R3-3); editor halo 1.5 px vs canvas 1 px.
- N10 12 px button labels in StylePanel .seg/.kind/.btn, Notice .btn, StatusBar .tbtn, privacy Close -> 13 px/600.
- N12 icon strokes: 2 in StylePanel/Notice/StatusBar/ShortcutHelp/DropOverlay, 1.2 EmptyState -> 1.5 everywhere.
- N13 narrow tooltip inverted (fg fill); drop pill no border -> surface + 1px lineStrong.
- N14 "2 annotations selected" uses muted heading -> sm/600 fg with line hairline.
- N15 line heights 1.45/1.5; mono read-outs 12/15 vs sm 13; status bar padding 4 vs 8; crop chip y=188 inside the bottom-middle handle's 24 px hit area -> move >= 12 px below frame.
- Nit: Copy "pressed" cell looks like hover.

## New
| # | Sev | Board | Issue | Fix |
|---|---|---|---|---|
| R3-1 | major | Toolbar/StatusBar wide | No width defined for wide -> narrow; wide toolbar needs ~980 px (more in vi), status bar ~800 px; overflows in 800–980 px iframes | Define container-width thresholds (spec), add an intermediate frame |
| R3-2 | major | Toolbar narrow 390 | Cut-off falls exactly between buttons; Step/Redact/Crop look absent | Runtime gap so last visible tool is ~half shown; chevron in fade; redraw with Text ~50% cut |
| R3-3 | minor | TextEditor empty | Placeholder looks like committed text | 50% opacity; editor halo 1 px |
| R3-4 | minor | Toolbar no image | Disabled Copy/Download lose icons -> layout shift | Keep icons in muted |
| R3-5 | minor | ShortcutHelp narrow | Dialog flush to screen edges | max-width calc(100% - 32px) |
| R3-6 | minor | StatusBar privacy narrow | 32/24 px targets | 44 px (same as audit R3-3) |
| R3-7 | minor | ShortcutHelp macOS | "⌥arrows", "⌘wheel" glued | "⌥ arrows", "⌘ wheel" |
| R3-8 | minor | Notice error narrow | Text squeezed to ~170 px | wrap: action on row 2 aligned with text |
| R3-9 | minor | Notice reduced motion | CSS d:path() unsupported in Safari | second circle with dasharray |
| R3-10 | minor | Toolbar scrolled-end | flex-end fakes scroll; Arrow fully visible under fade | note "scrollLeft = max"; Arrow partly cut |
