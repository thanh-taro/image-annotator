# Spec review — round 2 (2026-10-27)

2 reviewers (domain + F-001..F-012; F-013..F-018 + experience + NFR). Details: spec-review-r2-core.md and below.
All round-1 blockers verified fixed; all numeric ACs verified.

## Findings and triage
| # | Sev | Finding | Action |
|---|---|---|---|
| N1/A1 | major | RULE-19 key scope vs controls, fields, dialogs (2 reviewers) | Fixed: focus scope in RULE-19, F-013 R1, AC9/AC10, F-008 AC16 |
| N2 | major | Position fields undefined for text/step/stroke/highlight | Fixed: F-008 R8, AC14/AC15; RULE-19 Alt+arrows scale strokes |
| N3/B1 | major | Shift+1/Shift+0/punctuation by layout (2 reviewers) | Fixed: RULE-19 layout clause |
| N4 | major | F-007 AC9 untestable | Fixed: rewritten with observable outcome |
| A2 | major | CSP could block the offline cache | Fixed: NFR-01 own-origin only |
| A3 | major | Offline version switch / complete visit | Fixed: F-017 R1, R3, AC2, AC3 |
| A4 | major | Shortcut help missing Pointer group and labels | Fixed: copy + CMP-ShortcutHelp |
| A5 | major | Plural placeholder parity | Fixed: en-US one forms use {count} |
| A6 | major | No UI theme/typography tokens | **Deferred to phase 2** — the design phase creates the style tile and UI tokens before any screen; tokens.json description says so. Not needed to mark behaviour specs ready. |
| B2 | medium | "Frame" overloaded | Fixed: glossary "Host frame"; wording in RULE-16, F-014, F-015, F-016, F-018 |
| B3 | medium | Announcements untestable | Fixed: NFR-06 list + COPY-a11y.* strings, CMP-Canvas |
| B4 | medium | White on red/blue < 4.5:1 | Fixed: red #D62828 (5.01), blue #0B63E5 (5.34); RULE-07 states ≥ 4.5:1 |
| B5 | medium | F-015 R7 fallback overpromise | Fixed: R7 states which grants have no fallback |
| N5 | minor | Reference blur undefined | **Deferred to phase 3**: architecture defines the reference blur/pixelate (e.g. Gaussian σ = r/2, clamped edges) before F-007 AC7 is tested |
| N6 | minor | Crop arrows vs pan; "frame focus" | Fixed: RULE-19, F-010 AC7 |

No blockers remain. Lint: 0 errors / 0 warnings.
