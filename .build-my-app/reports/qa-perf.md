# QA phase 5: performance (NFR-02, NFR-03, NFR-04, NFR-05)

Branch build/m1 at 4e350e0. Local only. Production build (`pnpm build`, `vite preview` on :4321), Chromium (Playwright 1.63 headless shell, software GL, no real GPU), macOS 27.2, 8 cores, 16 GB, viewport 1472 x 868 (work area 1200 x 800), DPR 1. Scripts: `tests/perf/` (`lib.mjs`, `responsiveness.mjs`, `speed.mjs`, `memory.mjs`, `startup.mjs`; raw JSON goes to the git-ignored `tests/perf/out/`). Reference images are generated on first use into `tests/perf/.cache/` (screenshot-like PNGs: 5120 x 2880 = 14.7 MP, 2880 x 1800 = 5.2 MP, 4096 x 4096 = 16.7 MP RULE-02 limit, twice with different content). `pnpm check:size`: 150.8 KB of the 210 KB budget (JS 59.8/80, CSS 6.3/18, fonts 81.3/90, worker 2.6/8).

## Machine load (important)
The machine was shared with other QA agents. Load average (1 min) during the first pass was 100 to 365 (8 cores); the numbers below are from the second pass, run at load 3 to 12 (recorded per run in the JSON and below). The first pass is kept as evidence of load sensitivity. Medians are reported; N is 7 for speed and startup, 3 for responsiveness, 2 cycles of 3 for memory.

## Verdicts
| NFR | Verdict | Headline (median, low load) | Target |
|---|---|---|---|
| NFR-02 responsiveness | pass on Chromium software render; **manual** for GPU/real-display fps and iPad | 56 to 61 painted frames/s while dragging; p95 frame interval 16.7 to 16.8 ms; no long tasks, 0 frames over 20.8 ms | 60 fps, input feedback < 100 ms |
| NFR-03 speed | pass (Chromium); **manual** on the reference laptop and WebKit | open 14.7 MP 110 ms (paste), 114 ms (drop), 77 ms (file); 5.2 MP 51/52/67 ms. Export 14.7 MP 362 to 393 ms; 5.2 MP 144 to 174 ms | 1 s / 1.5 s; 0.5 s |
| NFR-04 memory | pass (Chromium footprint) | max 281 MB; replace stage within 8 % cycle to cycle; **manual** for real-GPU Chromium and WebKit | < 1 GB; released within 10 % |
| NFR-05 startup | pass | cold 267 ms (FCP 188 ms), cached 67 ms, 110 KB on the wire | 1.5 s cold, 0.5 s cached |

No misses, so no fixes are proposed. Under extreme load the margins shrink (below).

## NFR-02 Responsiveness
Method: `responsiveness.mjs`. Per run, a fresh page, the reference image opened by paste, then 100 annotations drawn with the real mouse (Rectangle, Ellipse, Line, Arrow, Pen, Highlight, 10 Steps, 5 blur + 5 pixelate redactions; count verified 100). Scenarios: draw rectangle, draw blur box, resize and move the blur box (handle, edge), resize and move a rectangle, ctrl+wheel zoom (12 notches), wheel pan (20). The button press and release are real CDP mouse events; the pointermoves are dispatched inside the page one per animation frame (Node round trips otherwise cap input at roughly 15 per second under load, which a first attempt showed: that trace undercounted draw frames). Recorded per scenario: frame intervals (rAF), long tasks, Event Timing, CDP `Performance.getMetrics`, and a Chromium trace (`DrawFrame` count and `RunTask` durations).

Results (3 runs each, load 6 to 9 for 14.7 MP and 3 to 5 for 5.2 MP; ranges across the 3 runs):
| Scenario | 14.7 MP frame p95 / max (ms) | 14.7 MP painted fps | 5.2 MP frame p95 / max | 5.2 MP painted fps |
|---|---|---|---|---|
| draw rectangle | 16.7-16.8 / 16.8 | 59.3-61.1 | 16.7 / 16.8 | 59.4-60.4 |
| draw blur box | 16.7-16.8 / 16.8 | 59.5-59.6 | 16.7-16.8 / 16.8 | 59.4-59.5 |
| resize blur box | 16.7-16.8 / 16.8 | 59.3 | 16.7-16.8 / 16.8 | 59.9-60 |
| move blur box | 16.7-16.8 / 16.8 | 57.5-57.7 | 16.7-16.8 / 16.8 | 57.6-57.8 |
| resize rectangle | 16.7-16.8 / 16.8 | 57.0-57.2 | 16.7 / 16.8 | 57.1-57.2 |
| move rectangle | 16.7 / 16.8 | 57.6-57.8 | 16.7-16.8 / 16.8 | 57.6-57.7 |
| zoom, pan | 16.7-16.8 / 16.8 | (input-limited: 13 to 20 fps, one notch per Node round trip) | same | same |

Every scenario: 0 long tasks, 0 intervals over 20.8 ms, synchronous pointermove handler cost at most 0.8 ms (one outlier 2 ms), no trace `RunTask` over 16.7 ms. The 57 to 61 fps figure is the trace's `DrawFrame` count over the scenario time; the few percent below 60 are the first and last frames of each scenario, not dropped frames. Input feedback (tool button click to checked state plus a frame, through Playwright, so it includes driver overhead): first click 39 to 48 ms, later clicks about 50 ms, all well under 100 ms. Nothing in the 100-annotation drags takes more than 0.5 s, so the progress rule was not exercised here (blur exact patch is computed in the worker after release; no UI stall seen).

Environment limits: headless software rendering on a 60 Hz virtual display. The spikes (ADR-0016, ADR-0022) flagged **GPU Chromium drag at 60 fps with the largest images as open, to be confirmed headed on idle hardware**. That is not measurable here and stays a manual item. Prior spike figures (software Chromium 2.0 to 7.4 ms repaint, 15 to 18 ms zoom/pan frames) are consistent: the current build's zoom and pan frames never exceeded 16.8 ms here, better than the spike (ADR-0016 only required 100 ms).

Confidence: high that the main thread has no long task and the repaint fits a frame in software Chromium; medium-low that this carries over to a GPU-accelerated display (readback and compositing differ).

## NFR-03 Speed
Method: `speed.mjs`. Open: image staged as a `File` in the page; the clock runs from dispatching paste (or drop) to the canvas summary showing the new size plus two animation frames (image decoded, laid out and painted). File chooser: Playwright wall clock from `setFiles` to the same state (adds file read). Export: wall clock from the Download click to the browser's download event; Copy from the click to `navigator.clipboard.write` resolving (recorded by an init-script wrapper). Export measured with an empty document and with 100 annotations (10 redactions), 3 runs for the latter.

| Action (median ms) | 14.7 MP, target | 5.2 MP, target |
|---|---|---|
| open by paste | 110 (max 130), 1000 | 51 (max 58), 500 |
| open by drop | 114 (max 152) | 52 (max 67) |
| open by file chooser | 77 (max 126) | 67 |
| download, empty doc | 393 (max 549), 1500 | 174 (max 182), 500 |
| copy, empty doc | 383 (max 393) | 147 |
| download, 100 annotations | 362 | 158 |
| copy, 100 annotations | 369 | 144 |
Loads per series: 3.3 to 7.4 (14.7 MP), 7.4 to 12 (5.2 MP). Verdict pass with large margins (open 11 % of target, export about 25 to 37 % of target).

Load effects (first pass, load average 100 to 365 on 8 cores, N=5): 14.7 MP open 285 to 381 ms, export 902 to 1294 ms (download) and 1052 to 1288 ms (copy), 5.2 MP export 474 to 500 ms (download; borderline against 0.5 s). Even at that load nothing exceeded its target, but the 5.2 MP export reached the limit. Spike figures (ADR-0007: 14.7 MP 324 ms, 5.2 MP 118 ms Chromium) match the idle results here. On a mid-range laptop with a slower CPU or a busy machine the 5.2 MP export (0.5 s target) has the least headroom; confirm on the reference laptop (manual).

Manual: real reference laptop; WebKit (spike: 14.7 MP export 515 ms, 5.2 MP 194 ms, fine) not re-measured; real OS drag-and-drop and OS clipboard paste (synthetic events used, the image data path is identical after the event).

## NFR-04 Memory
Method: `memory.mjs`. macOS `footprint -p` of the page's renderer process plus the GPU process minus the GPU process of a blank page (25 MB), after `HeapProfiler.collectGarbage` twice and a 2 s settle. Image 4096 x 4096 (16.7 MP, at the RULE-02 limit) pasted; 200 annotations drawn (10 blur/pixelate); Download; replace by paste of a second limit-size image (confirmation clicked if shown); three cycles, two repeats. Dedicated worker memory is inside the renderer footprint.

Tool memory (MB), run 1 / run 2: empty tool 44/45; c1 load 220/220, edit 268/266, after export 274/266, replace 249/244; c2 load 244/239, edit 280/272, export 281/276, replace 256/251; c3 load 251/246, edit 262/276, export 264/265, replace 236/236. JS heap stays at 2 to 5 MB (pixels live in bitmaps and the worker). Peak 281 MB, 28 % of the 1 GB limit. Release: replace stage cycle 2 to cycle 3 is -7.8 % / -6.0 % and cycle 1 to cycle 2 is +2.8 % / +2.9 %, all within 10 %; the footprint does not grow with repeated replace. Loads 4 to 10 (memory pressure on the machine was high in the first pass, so only the low-load pass is reported).

Verdict pass for Chromium (software GPU). Manual / not covered: Chromium with a real GPU (ADR-0022 saw a 155 to 311 MB GPU process even on a blank page, which would add to the figure but leave about 450 MB spare), WebKit (spike peak 890 MB, the tightest case, measured without split layers; a re-check on Safari with `footprint` is a manual item), iPadOS limits (device).

## NFR-05 Startup
Method: `startup.mjs`. Fresh browser context, CDP `Network.emulateNetworkConditions` (latency 40 ms, 1.25 MB/s each way = 10 Mbit/s), cache enabled. Cold: no storage; cached: second navigation in the same context after the service worker has seeded its cache (8 entries in `image-annotator-v1`). "Interactive" = `SCR-Annotator` mounted, the Open image button attached and two animation frames after it (the app has no deferred JS; everything is on the critical path), measured from navigation start. 7 repeats, load 3.2 to 3.4.

| | Median | Range | Target |
|---|---|---|---|
| cold, interactive | 267 ms | 265 to 268 | 1500 ms |
| cold, first contentful paint | 188 ms | 180 to 192 | |
| cold, transfer | 109,969 B in 7 requests | | budget 210 KB (gate: 150.8 KB) |
| cached, interactive | 67 ms | 57 to 83 | 500 ms |
| cached, FCP | 44 ms | 32 to 56 | |

Pass with 5x and 7x margins. First pass (load 100 to 360, N=5): cold 266 to 319 ms, cached 59 to 119 ms, so load barely changes it. Caveats: `vite preview` compresses differently from the production host (transfer is the compressed size reported by CDP; the size gate is the authority on the budget); the cached visit makes 7 requests with 0 network bytes (served from the service worker cache or HTTP cache; not separated); throttling is applied at the CDP level, not a real link. Lighthouse CI (`pnpm lhci`) was not run.

## Manual checks to keep on the release list
1. GPU Chromium (headed, idle, real display) drag fps with 100 annotations on 14.7 MP and on 16384 x 1024 (ADR-0022 open item).
2. WebKit memory (footprint) at the RULE-02 limit with 200 annotations; WebKit open/export times and drag fps.
3. iPad and Android tablet: memory ceiling and single-finger drawing smoothness.
4. Reference laptop run of `speed.mjs` and `responsiveness.mjs`, especially 5.2 MP export (0.5 s).
5. Production-host startup (real CDN compression, real cache headers) against NFR-05.

## Reproduce
`pnpm build && pnpm preview --port 4321 --strictPort`, then `RUNS=7 node tests/perf/speed.mjs`, `RUNS=3 node tests/perf/responsiveness.mjs`, `RUNS=2 node tests/perf/memory.mjs`, `RUNS=7 node tests/perf/startup.mjs` (macOS only for `footprint`; PERF_URL overrides the address). Check `uptime` first and prefer a quiet machine.
