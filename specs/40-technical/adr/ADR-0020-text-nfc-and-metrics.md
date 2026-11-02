---
id: ADR-0020
title: Text input in composed form and font metrics — outcome of spike SP-text (amends ADR-0009)
status: accepted
date: 2026-11-02
supersedes: []
---

## Context
ADR-0009 chose canvas glyphs edited through a transparent-text `<textarea>` overlay, pending spike
SP-text (branch `worktree-agent-aaae27d93c6a59e33`, commit 649c80f, report
`.build-my-app/reports/spike-text.md`). The overlay passed for Latin and composed (NFC) Vietnamese.
Decomposed (NFD) Vietnamese failed: the self-hosted Manrope `latin` + `vietnamese` subsets lack
U+0302, U+0306 and U+031B. Both engines then draw some marks in a fallback face, which breaks
F-005.AC14 and puts the caret up to 3 px off on Chromium at 800 %.

## Decision
- **Composed input (RULE-08):** on `beforeinput`, and at `compositionend` for input-method text,
  CMP-TextEditor normalises the inserted text to NFC **together with the preceding characters back
  to the last starter** (the last code point that does not combine with what comes before it). This
  catches accent marks typed after an existing letter. It replaces that range with
  `execCommand('insertText')`, so native undo keeps working and the caret ends after the inserted
  text. Committed text is normalised to NFC again as a safety net. The 2,000 code-point limit (ADR-0009
  item 3) counts the NFC text. D-025 (no `latin-ext`) stands.
- **Font name:** the package's CSS names the family "Manrope Variable". The app declares its own
  `@font-face` named `Manrope` that points to the self-hosted files, so ADR-0009's font string
  stays.
- **Metrics (MOD-Core):** ascent 1.066 em and descent 0.300 em, the same in both engines. With line
  height lh = 1.25 × size, the baseline offset is (lh − 1.366 × size) / 2 + 1.066 × size.
- **Editor height:** ascent plus descent (1.366 em) exceeds the line height, so the textarea gets
  0.2 × size (CSS px × zoom) of extra height to stop it scrolling internally. This doesn't move the
  glyphs.
- **Text box:** the box used for hit-testing, selection and handles (RULE-08 "fits the content") is
  lines × line height tall and as wide as the longest line; glyph overflow above and below is not part of it.

## Evidence (SP-text; Chromium 153 and WebKit 26.6, 16 px text, zoom 25–800 %, DPR 1 and 2)
| Measure | Target | Result |
|---|---|---|
| Caret drift, Latin and NFC Vietnamese | < 2 screen px | ≤ 0.5 Chromium, ≤ 1.0 WebKit (its caret is 2 px wide) |
| Selection edge | < 2 px | ≤ 0.73 |
| Canvas glyphs vs textarea glyphs | < 2 px | ≤ 1.04, except NFD on Chromium (fixed by NFC) |
| Line breaks | identical | identical, including long words and empty lines; no overflow |
| IME composition | works | Chromium passes (CDP); WebKit can't be automated |
| Export at 100 % vs screen (F-005.AC7) | ≤ 2 image px | identical at DPR 1 on Chromium; max channel difference 1 on WebKit |
| Fonts local only | no other hosts | met; `document.fonts.check` true |

The caret inside the "fi" ligature sits halfway across it, as in any editor. That is not drift.

## Consequences
- QA adds a manual Safari check with macOS Vietnamese Telex input.
- Screenshot tests wait 2 frames for WebKit's selection repaint.
