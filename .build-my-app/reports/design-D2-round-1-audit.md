# Design audit — D2 FLOW-01, round 1

Source: design-auditor agent (saved by the orchestrator). Counts: 1 blocker, 3 major, 5 minor. These checks pass:
- copy IDs and literal text;
- tokens in both themes;
- 50 % fit;
- image-pixel fields;
- arrowhead construction;
- flow state (tool path, counts, pill, undo);
- notice placement.

| Frame | Finding | Severity |
|---|---|---|
| Main, steps 2–5 | RULE-04 sizes must use the shorter side `s` = 1,098: stroke M is 7 px and text M is 44 px, not 10.5 and 70. | blocker |
| Steps 3–5, Main | The RULE-08 outline is max(1, 0.08 × 44) ≈ 4 image px, but the boards use a 1 px text-shadow. | major |
| Steps 4–5 (and D1) | The solid-redaction selection has no Bring forward / Send backward, which F-008.R5 requires. | major |
| Steps 1–5 | The boards zigzag on the canvas with no visible order. Fix: one column. | major |
| Step 3 | The style panel's variant while editing text is unspecified. | minor |
| All | The palette uses raw hex instead of `--ann-*` custom properties (adapter). | minor |
| Step 5 | The notice text is repeated in a separate live region, so it could be announced twice. The notice should be the live region. | minor |
| All | Titles and labels drift from the adapter form; the step 2 label is unclear. | minor |
| D2 | No vi-VN board for this region. Covered by D4 "vi-VN default". | minor |
