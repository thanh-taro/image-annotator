# Spike SP-blur — reference blur and pixelate (ADR-0006, D-023)

**Question:** is the exact integer reference (triple box blur, σ ≈ r/2; block-average pixelate; sampling only inside the frame) strong enough to hide text, and fast enough to stay live?
**Hypothesis:** an optimised worker implementation reaches ≤ 40 ms/MP, and a GPU preview keeps dragging smooth.
**Success measures:**
- 12–16 px UI text on a 2880×1800 screenshot is unreadable at strength S, M and L (RULE-10 radii on s = 1800), judged from saved images; if S doesn't hide text, propose new S/M/L values;
- the optimised worker blur is ≤ 40 ms per megapixel (Chromium and WebKit, measured);
- 10 blur redactions while dragging a 2000×1200 box: the preview holds ~60 fps, and the exact patch arrives ≤ 250 ms after release;
- a fast-check property test shows the optimised implementation equals a slow, independent reference exactly;
- edges are clamped to the frame; nothing outside the frame is sampled (RULE-10, F-007.AC13).
**Fail →** WebGL shader via a superseding ADR.
**Time box:** about 2 hours of agent work.
**Not built:** UI, solid redactions beyond what the source needs, export, app structure.

## Outcome (2026-11-02)
**Adapt** (ADR-0017). S/M/L hide 12–32 px text (OCR 0 tokens), so RULE-10 sizes stand. SWAR blur runs at 23–25 ms/MP; fast-check is exact. No exact jobs while moving; one on release (≤ 146 ms). WebKit preview 60 fps; Chromium needs a headed GPU check in QA. Code: branch `worktree-agent-aefdcf9623a3a9798` (bc838fc), `spikes/blur/`.
