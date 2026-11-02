# Spike SP-text — transparent textarea over canvas glyphs (ADR-0009)

**Question:** can a transparent-text `<textarea>` overlay (caret and selection from the textarea, glyphs from the canvas `paint()`) stay aligned with the canvas text at every zoom, with Vietnamese input and IME?
**Hypothesis:** yes, if both use the same font, size, line height and letter spacing, and line breaks come from one shared wrap function.
**Success measures:**
- caret and selection drift < 2 screen px from the canvas glyphs at 25 %, 100 %, 400 % and 800 % zoom, for Latin and Vietnamese (NFD and NFC), on Chromium and WebKit (measure glyph positions with screenshots or `measureText` vs DOM ranges);
- line breaks in the textarea and on the canvas are identical, including for long words and explicit newlines (F-005);
- IME composition works: drive `compositionstart/update/end` (Playwright `insertText` or CDP `Input.imeSetComposition` on Chromium); note what cannot be automated on WebKit;
- export at 100 % matches the on-screen text within 2 image px (F-005.AC7);
- the outlined text (`strokeText` then `fillText`, lineWidth 2·max(1, 0.08·size)) renders the same on screen and in export;
- fonts: Manrope 600 loaded from local files; the canvas waits for `document.fonts.load`.
**Fail →** a visible textarea with `paint-order: stroke` via a superseding ADR.
**Time box:** about 2 hours of agent work.
**Not built:** UI beyond the editor, styling panel, undo.

## Outcome (2026-11-02)
**Adapt** (ADR-0020). Overlay drift ≤ 1 px for Latin and NFC Vietnamese at 25–800 % on both engines; export equals screen. NFD Vietnamese fell back to another face (subset lacks combining marks), so inserted text is converted to NFC (RULE-08 clarified); D-025 stands. Metrics and font-face naming recorded. WebKit IME is a manual QA check. Code: branch `worktree-agent-aaae27d93c6a59e33` (649c80f), `spikes/text/`.
