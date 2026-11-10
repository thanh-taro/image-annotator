# Spec review: F-019 custom colour and size, round 2

Commit fe4bcea, branch build/1.1. Lint: `624 IDs, 2625 references, 0 errors, 0 warnings`.
Only the specs changed in fe4bcea were re-reviewed.

## Verdicts
| Item | Verdict |
|---|---|
| F-019 | **not ready**: 3 of the 4 majors are here (N2, N3, N4); each needs only a short wording change |
| platform-mapping.md (custom colour row) | **not ready** (N1) |
| RULE-21, RULE-11, RULE-08 | ready (RULE-11 also picks up the N2 wording) |
| CMP-StylePanel | ready after minor fixes (it follows N1: "radio" must not imply a native radio) |
| copy.md, style.md, glossary, F-005, F-006, F-008, changelog | ready |

## Status of the round-1 findings
| Round 1 | Status |
|---|---|
| B1 swatch interaction | Resolved in F-019.R1 and AC14. The platform mapping it introduced creates N1 |
| M1 swatch display | Resolved in R2 and RULE-21. AC15 is wrong, see N3 |
| M2 live preview and cancel | Resolved in R8 and RULE-11. How the swatch's own apply fits into one step creates N2 |
| M3 unchanged field | Resolved in R5 and AC17 |
| M4 drawing colour vs background | Resolved in R1, AC18 and CMP-StylePanel |
| M5 swatch layout | Resolved in CMP-StylePanel; F-019 now points to it |
| M6 text editing | Resolved in R9 and AC19. The focus-return wording creates N4 |
| M7 edge-case ACs | Resolved in AC20–AC22; the edge cases agree with AC11 |
| m1 – m10 | All resolved (AC5 now states the unrounded 5.12, which matches RULE-08; see n2) |

## Major

### N1 — A native radio cannot be focused by arrow keys without being checked (platform-mapping.md:29; F-019.R1 line 31; R2 line 32)
**Problem.** R1 says that before any custom colour is picked, "arrowing onto the swatch applies nothing". R2 says the swatch is marked only when the subject's colour is custom. Arrowing onto a native radio checks it. With "the ninth native radio … arrow keys only check the radio", the custom swatch would be checked while the subject is still, say, red. Two swatches would then read as selected: the checked custom swatch and the marked Red. A screen reader announces "Custom color, checked" for a red subject. F-019 also does not say what checked/marked means in that state.

**Proposed wording.**
- F-019.R1, last sentence: "Before any custom colour is picked, arrowing onto the swatch moves focus to it without checking it or changing the subject; Enter or Space then opens the picker."
- platform-mapping:29: "The colour group is an ARIA radio group with a roving tabindex (the custom swatch is its ninth `role="radio"`), so the app checks an option only when it applies a colour. Clicking the custom swatch, or Enter/Space on it, opens a visually hidden `<input type="color">` …"

Add to AC14: "given no custom colour picked yet and focus on White, when the user presses Right arrow, then focus is on the custom swatch, it is not checked, White stays checked, and the subject is unchanged."

### N2 — Undo and cancel when the swatch first applies the remembered colour and then opens the picker (F-019.R1, R8 line 38, edge case lines 70–71; RULE-11 line 18)
**Problem.** Clicking the swatch applies the remembered colour and opens the picker. AC14 counts the apply alone as one undo step. R8 groups "all colours from one opening of the picker" into one step. It is undefined whether the apply is part of that step. AC16 ("one undo makes it red") only holds if it is, or if no colour was remembered.

On cancel, R8 says the subject "returns to its colour from when the picker opened, and no step is recorded". By then the remembered colour has already been applied, which is an undo step (AC14). So either a step is recorded, or the subject should return to the colour it had before the click. The edge case ("keeps the colour it had when the picker opened") and R8 also use different words for the same moment.

**Proposed wording.**
- R8: "Choosing the custom swatch and the colours from that one opening of the picker, until it closes or focus moves to another control, form one undo step for a selection (RULE-11). Closing the picker without a choice keeps the colour the swatch applied. If the picker reports a cancel, the subject returns to the colour it had before the swatch was chosen, and no step is recorded."
- Edge case lines 70–71: "The picker is closed without a choice → the subject keeps the remembered custom colour the swatch applied, or its earlier colour if there was none (F-019.R8)."
- RULE-11: "…so are choosing the custom swatch and the colours from that one opening of the picker (F-019.R8)…".
- AC16: begin with "Given #1e90ff remembered and a selected red arrow, when the user clicks the custom swatch, moves through 3 colours…, then … one undo makes it red."

### N3 — AC15 contradicts the shared drawing colour (F-019 line 56; RULE-04, D-045)
**Problem.** The pen shares one current colour with the rectangle. After #1e90ff is picked with the rectangle tool, the pen is #1e90ff, not red. "With the pen tool at red" cannot be set up without making the rectangle red too, so the AC cannot be tested as written.

**Proposed wording:** "…when the user picks the rectangle tool again, then the custom swatch shows #1e90ff and is marked; when they pick the redaction tool (solid, black), it shows #00ff00 and Black is marked." The redaction tool keeps its own current style.

### N4 — R9 sends focus back to the text whenever the field or slider is left (F-019 line 39)
**Problem.** "When the field or slider is left, focus returns to the text" also applies to Tab. Tab from the field could then never reach the slider, or any other panel control, while a text is being edited. The text would grab focus again: a wrong implementation and a keyboard-navigation fault (NFR-06).

**Proposed wording:** "…keeps editing (F-005.R3) and changes that text. After the field applies with Enter, or the picker closes, focus returns to the text; Tab and Shift+Tab move between panel controls as usual, and editing ends only as F-005.R3 states."

## Minor

### n1 — Picker cancel has no AC and no platform mapping (F-019.R8; platform-mapping:29)
**Problem.** The platform row maps `input` and `change` but not cancel, and no AC tests a cancel.

**Proposed fix.** Add to platform-mapping: "`cancel` event where the browser fires it; otherwise closing counts as closing without a choice". Add an AC: "Given a selected red arrow and no remembered colour, when the user opens the picker, moves to #2f4f4f and cancels, then the arrow is red and no undo step is added (in browsers that report a cancel)."

### n2 — AC5's outline width can only be checked on the model, not by measuring pixels (F-019 line 46)
**Problem.** 5.12 px cannot be measured in rendered pixels.

**Proposed wording:** "…with an outline width of 5.12 in the annotation's rendering parameters (RULE-08: max(1, 0.08 × 64))". Or test the rendered outline within ±1 pixel.

### n3 — Undo of style changes made while a new text is first edited (F-019.R9, AC19; RULE-11)
**Problem.** RULE-11 makes "creating a text and finishing its first edit" one step. AC19 restyles during that first edit, and it is not stated whether this is a separate step.

**Proposed wording** (append to AC19): "when editing ends and the user undoes once, the text is removed (the colour and size changes are part of its creation step)". Mirror this in RULE-11 if that is the intent.
