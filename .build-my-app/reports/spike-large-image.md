# Spike SP-large-image — memory and canvas limits (ADR-0004, ADR-0016, NFR-04)

**Question:** at the RULE-02 limits (16,777,216 px, 16,384 px side), do the image, the display canvas, the ADR-0016 image layer, the worker copy and the export canvas fit NFR-04, and are the canvases allowed on WebKit?
**Hypothesis:** yes, with a display canvas sized to the viewport × DPR (DPR capped at 2) and memory released on replace.
**Success measures:**
- tool memory < 1 GB with a 4096 × 4096 image and 200 annotations (incl. 10 blur/pixelate) after load, edit and export, on Chromium (CDP `Performance.getMetrics` / `performance.measureUserAgentSpecificMemory`, plus process memory) and WebKit (process memory, as far as measurable);
- replacing the image releases memory (`ImageBitmap.close()`, dropped buffers): memory after replace returns to within 10 % of a first load;
- an export canvas at the limit (4096 × 4096 and 16384 × 1024) is allowed and encodes on Chromium and WebKit; note any engine refusal;
- a display canvas at viewport × DPR (cap 2), plus the image layer, keeps drag repaint p95 ≤ 8 ms for the 16384 × 1024 image;
- iPadOS cannot be automated here: record what desktop WebKit shows and leave the iPad check to QA.
**Fail →** spec change to RULE-02 limits, or a tiled export, via a new ADR.
**Time box:** about 1.5 hours of agent work.
**Not built:** UI, real tools beyond drawing test annotations.

## Outcome (2026-11-02)
**Adapt** (ADR-0022). Memory < 1 GB on all setups (WebKit peak 890 MB); replace releases memory with a fresh effects worker; exports at the limits work (up to 1.4 s, so progress shows); no engine refuses oversize canvases, so RULE-02 is enforced by the app. Drag at 16384 × 1024 needed split drag layers: WebKit 5–6 ms, software Chromium 7.4 ms, GPU Chromium unconfirmed (QA, headed, idle). Code: branch `worktree-agent-a087fbcfb23419a55` (cb46231), `spikes/large-image/`.
