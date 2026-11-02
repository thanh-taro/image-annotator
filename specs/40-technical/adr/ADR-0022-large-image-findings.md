---
id: ADR-0022
title: Large images — split drag layers, fresh effects worker, export memory (outcome of spike SP-large-image; amends ADR-0016)
status: accepted
date: 2026-11-02
supersedes: []
---

## Context
SP-large-image (branch `worktree-agent-a087fbcfb23419a55`, commit cb46231, report
`.build-my-app/reports/spike-large-image.md`) tested the RULE-02 limits: 4096 × 4096 with 200
annotations, and 16384 × 1024. Memory and export passed. Drag repaint on the ADR-0016 path failed
the 8 ms budget at 16384 × 1024, mainly because of filled shapes, which SP-engine never benchmarked.

## Decision
- **Split drag layers (amends ADR-0016):** when a draw, move or resize starts, MOD-Canvas caches,
  over the image layer, every annotation below the lowest dragged one (lower layer) and every
  annotation above the highest dragged one (upper layer). Each frame copies the lower layer, draws
  the dragged annotations and any undragged ones between them in drawing order, then copies the
  upper layer. While drawing, the new annotation is on top, so only the lower layer is used.
  When a solid redaction is dragged, every blur and pixelate redaction above the lowest dragged
  solid is drawn each frame, not cached, so the solid shows wherever it moves (RULE-10). The drag layers are rebuilt when any image-layer input
  (ADR-0016) changes, and are dropped when the drag ends. This costs about 41 MB more during a
  drag.
- **Fresh effects worker:** MOD-Effects terminates its worker and starts a new one whenever the image
  is replaced or cleared. Just dropping the buffer kept 65 MB more on Chromium and 250–320 MB more
  on WebKit.
- **Export memory:** MOD-IO frees the export canvas (sets its size to 0) right after encoding.
  Encoding at the limits takes up to 1.4 s, so the export shows progress (NFR-02's 0.5 s rule;
  SCR-Annotator exporting state).
- **Limits are ours:** no engine refused any canvas tried, up to 32768 × 1024 and 8192 × 8192. RULE-02
  is enforced by MOD-Core and MOD-IO, never left to the browser.
- **NFR-04 method:** measured as NFR-04 now defines it (page-process footprint plus GPU-process
  share, minus the blank-page GPU process; release compared at the same stage after a warm-up).

## Evidence (Apple M3; machine loaded by parallel agents, so timings are noisy)
| Measure | Target | Result |
|---|---|---|
| Memory, 4096², 200 annotations, load/edit/export | < 1 GB | software Chromium ≤ 400 MB; WebKit 570–682 MB (sampled peak 890); GPU Chromium page process ≤ 418 MB, plus a GPU process of 155–311 MB even on a blank page |
| Released on replace | within 10 % | met with a fresh worker: Chromium 180–184 MB released each cycle, WebKit 156–157 |
| Export at 4096² and 16384 × 1024 | allowed, correct | all three setups; 0.27–0.86 s Chromium, 0.43–1.4 s WebKit |
| Drag p95 at 16384 × 1024, single image layer | ≤ 8 ms | failed: up to 22 ms software Chromium, 15.5 GPU Chromium, 26 WebKit |
| Drag p95 with split layers | ≤ 8 ms | WebKit 5.2–5.8, software Chromium 7.4; GPU Chromium 7.2–19, an upper bound because the timing forced a pixel read-back costing 2–10 ms (0–2 dropped frames per 120) |

## Consequences and open risks
- **Open:** GPU Chromium drag at 60 fps with the largest images is not confirmed. QA measures it
  headed on an idle machine, from dropped frames rather than read-backs. If it fails, the next step
  is to draw the display layers at a lower resolution while dragging. Export is unaffected.
- WebKit memory has the least headroom: the 890 MB peak was measured without split layers, so the
  worst case during a drag is about 931 MB. QA watches it, and the iPadOS limits are a
  QA check.
- Process RSS is unreliable on macOS under memory pressure, so measurements use `footprint`.
