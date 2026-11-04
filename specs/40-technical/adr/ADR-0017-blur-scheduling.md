---
id: ADR-0017
title: Blur and pixelate implementation and scheduling — outcome of spike SP-blur (amends ADR-0006)
status: accepted
date: 2026-11-02
supersedes: []
---

## Context
ADR-0006 defined the exact reference blur and pixelate, pending spike SP-blur. The spike (branch
`worktree-agent-aefdcf9623a3a9798`, commit bc838fc, report `.build-my-app/reports/spike-blur.md`)
confirmed the definition and RULE-10's strengths. It found two conditions for meeting NFR-02.

## Decision
- ADR-0006's definition stands unchanged. RULE-10's S/M/L sizes stand: S already hides text.
- **Implementation:** the worker uses the SWAR integer blur, which packs two channels into each
  32-bit sum and loads each pixel once. The straightforward interleaved version ran at 60 ms/MP and
  is kept only as a fallback for b > 128, where the packed sums would overflow. The slow, independent
  reference is a test-only module (`src/effects/reference.ts`); lint forbids importing it from app code.
- **Scheduling:** no exact job is sent while a redaction, or a solid it depends on, is moving or
  resizing. The screen shows the GPU approximation. One exact job is queued on release, or after
  100 ms without movement; the latest job wins. MOD-Effects owns this rule.
- The worker reuses its window buffers between jobs; the large box allocates about 25 MB otherwise.
- WebGL is not needed.

## Evidence (SP-blur; Apple M3, headless Chromium 153 and WebKit 26.6)
| Measure | Target | Result |
|---|---|---|
| 12–16 px text (and 24–32 px) unreadable at S, M and L | unreadable | met for blur and pixelate; OCR finds 0 tokens (147 of 219 on the original) |
| Optimised blur speed | ≤ 40 ms/MP | Chromium 24.4–24.7, WebKit 22.6–24.5; pixelate about 8 |
| Preview while dragging a 2000 × 1200 box over 10 blurs | ~60 fps | WebKit 59.5–60.1; headless Chromium 54–58 on an idle machine, dropping even with no worker jobs (the headless compositor, not the effects code) |
| Exact patch after release | ≤ 250 ms | max 146 ms on Chromium, 108 ms on WebKit, with the scheduling above (it failed, at up to 429 ms, when jobs were sent every frame) |
| Optimised equals reference | exact | fast-check, 3000 runs per property, exact; 400 in-engine cases with 0 mismatches |
| Nothing outside the frame or under solids is sampled | RULE-10, F-007.AC13 | met (fast-check) |

## Alternatives
- Exact jobs during the drag: rejected; a running stale job can't be cancelled, so release latency
  failed and Chromium fps dropped to 38–40 under load.
- WebGL: kept as the escape hatch, not needed.

## Consequences
- QA re-measures Chromium preview fps headed, with a GPU (NFR-02). If it is below 60 fps, a new
  ADR adopts a WebGL approximation (the ADR-0006 escape hatch); the exact patches don't change.
- Blur still shows line positions, line lengths and coloured headings. That is why blur and
  pixelate are labelled "not secure" (RULE-10).
