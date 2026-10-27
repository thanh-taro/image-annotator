# Spec review — round 1 (2026-10-27)

5 reviewers (drawing, load/export, redact/edit/keys, host, cross-cutting). Details in spec-review-r1/.
Lint before review: 0 errors / 0 warnings.

## Blockers (5 unique)
1. Blur/pixelate over a solid redaction re-reveals hidden pixels (found by 2 reviewers — high confidence) → RULE-10, INV-02.
2. Padding can push the canvas over the size limit; no export-failure path → RULE-14, F-011, F-012.
3. Step number contrast fails on orange/green → RULE-07.
4. Esc and key ownership while editing text → RULE-19, F-005.
5. Step size meaning undefined → RULE-04.

## Majors (merged, deduplicated)
RULE-18 contradiction (3 reviewers); RULE-19 incomplete and browser conflicts (Ctrl+1, Alt+Left, Cmd+Y/[ ]) (3 reviewers); redaction kind not in current style (2); downloaded redaction count + plurals (2); embedded paste focus (2); host frame grants (downloads, modals) (2); NFR-01/INV-04 vs export; "after load" undefined; Vietnamese typeface in exports; status bar at 320 px; NFR-07 tablets (2); fractional redaction edges; INV-02 testability; Shift meaning; keyboard resize/placement/pan/Tab trap; WCAG 2.5.7; text outline, anchor, undo steps, click behaviour, box geometry; StylePanel undo; Enter collisions; RULE-06 highlight/longer side; crop move/fit below 10 %/padding-frame; missing copy strings; message origin "from embedding page".

## Owner decisions (batched)
See D-006…D-010.

## Triage
All other findings: accepted, fixed in round 1 fixes. None rejected.
