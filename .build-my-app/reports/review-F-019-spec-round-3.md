# Spec review: F-019 custom colour and size, round 3 (final)

Commit d34c530, branch build/1.1. Lint: `625 IDs, 2629 references, 0 errors, 0 warnings`.
This round checks the round-2 findings in the specs commit d34c530 changed and looks for new blockers or majors.

## Status of the round-2 findings
| Round 2 | Status |
|---|---|
| N1 native radio checks on arrow | **Resolved.** F-019.R1 now ends: arrowing onto an unused custom swatch moves focus only. AC14 has the matching clause. CMP-StylePanel says the swatch is "checked only when its colour is applied". platform-mapping makes the colours an ARIA radio group with a roving tabindex. |
| N2 swatch apply and picker undo / cancel | **Resolved.** R8, RULE-11 and the edge case all say the same: the apply and its picker session are one step, and cancel returns to the colour from before the swatch was chosen. AC16 has the remembered-colour precondition. |
| N3 AC15 against the shared colour | **Resolved.** AC15 uses the redaction tool (solid, black), which keeps its own current style. |
| N4 R9 focus return | **Resolved.** Focus returns to the text only after Enter in the field or when the picker closes. Tab and Shift+Tab work as usual. |
| n1 cancel has no AC or mapping | **Resolved.** New AC23; platform-mapping handles `cancel`, with a fallback. |
| n2 AC5 outline width | **Resolved.** It is now checked on the rendering parameter: 5.12 = max(1, 0.08 × 64). |
| n3 undo of style changes during a first text edit | **Resolved as the coordinator chose.** AC19 defers to the shipped behaviour for palette and preset changes during an edit. Nothing new is invented. |

## New findings
No new blockers or majors.

The fixes are consistent with RULE-04 (shared colour, D-045), RULE-11, F-005.R3, CMP-StylePanel and NFR-06. Every requirement R1–R9 has at least one AC.

## Final verdicts
| Item | Verdict |
|---|---|
| F-019 | ready |
| RULE-21, RULE-04, RULE-07, RULE-08, RULE-10, RULE-11 | ready |
| ENT-Style | ready |
| CMP-StylePanel | ready |
| copy.md (COPY-style.color_custom, color_custom_value, size_px, size_value) | ready |
| style.md, glossary | ready |
| platform-mapping.md | ready |
| F-005, F-006, F-008 wording updates | ready |
| roadmap M-1b, changelog | ready |

F-019's frontmatter still says `status: draft`. It can be moved to `ready`.
