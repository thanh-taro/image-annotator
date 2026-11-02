# Accessibility audit, design D2 (FLOW-01), round 2

Source: a11y-auditor agent (saved by the orchestrator). Counts: 1 blocker, 1 major, 4 minor new.

## Round-1 items
- **Fixed:** B1, B2, M1.
- **Partly fixed (gaps listed under New):** M2, M3, M4.
- **Recorded:** m1, m4.
- **m2 partly fixed:** main and aside landmarks added, but panel titles are not headings.
- **m3 fixed** in the board labels.

## New
- **N1 (blocker):** on Main, nothing is selected, so the canvas has no tab stop and is unreachable by keyboard (2.1.1).
- **N2 (major):** the region and the listbox are both named "Image canvas".
- **N3 (minor):** step 3 has no live message.
- **N4 (minor):** the notice is inserted already filled as role=status, which some screen readers ignore. Better: one persistent polite region.
- **N5 (minor):** the listbox role implies arrow-key browsing, but arrow keys move annotations, so the list needs a usage hint. The editor needs its own focus ring.
- **N6 (minor):** Esc to close the notice is not stated.

Structure checks pass: nested roles, the textbox outside aria-hidden, and DOM order matching the spec's reading order.
