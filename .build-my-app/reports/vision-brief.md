# Vision brief — Image Annotator (taro-kit tools)

Status: approved 2026-10-27 (D-001…D-004 answered)
Inputs: [market-research.md](market-research.md), [strategy-review.md](strategy-review.md).

## Problem
People who write bug reports, docs, design feedback, or who share screenshots in chat need to
mark up an image quickly: circle the problem, add an arrow and a label, and hide anything
sensitive. Today they use OS-bound tools (macOS Markup, Shottr, CleanShot X, Snipping Tool),
which differ on every machine and often aren't installable on locked-down work laptops. The
other option is a web editor that uploads the image, asks for an account, or adds a watermark.
Most of these tools only offer blur or pixelate to hide secrets, and both can be reversed
(Depix, Unredacter).

## Who
PER-01 (assumed): developers, QA and technical writers using the taro-kit tools portal, often on
Windows/Linux/ChromeOS or managed machines. Jobs: bug reports/tickets, docs & tutorials,
redact-before-sharing, design feedback.
Adoption test (qualitative, no analytics): (a) the owner uses it as their default for 2 weeks;
(b) 5 Win/Linux users run paste → 2 arrows → 1 redaction → 1 label → copy in < 20 s, no slower
than Snipping Tool; (c) ≥ 3 of 5 would bookmark it.

## Pitch
**A private screenshot annotator that works in any browser: paste an image, mark it up with
shapes, highlights, text and steps, redact what matters, and copy it back. Nothing leaves your
browser.**

## Differentiators
1. **Verifiably local**: a browser rule blocks every network request (CSP `connect-src 'none'`),
   it works offline, and a visible "Runs locally, nothing uploaded" note links to the
   explanation (D-003). No account, no watermark, no limits.
2. **Redaction you can trust**: a solid-fill Redact tool is the safe option. Blur and
   Pixelate are labelled "not secure". Exports are always flattened, so no original pixels
   survive under a redaction.
3. **Clean exports**: re-encoding strips EXIF/GPS metadata, and the UI says so.
4. **Same tool on every OS**, fast from the keyboard, sitting next to the other taro-kit tools.

Requirements, not differentiators: editable objects, undo/redo, fits the portal look, smooth on
Retina/4K screenshots.

## Non-goals (for now)
Server of any kind, upload or share links, accounts, saving or projects, history between
sessions (sessions are one-shot), analytics, screen capture, OCR/AI auto-redaction, layers
panel, multiple images per session, PDF/video, SVG export, collaboration.

## Platform
Web app at its own URL, embedded by the React portal in an iframe; must also work standalone.
Desktop first (mouse + keyboard); touch works through pointer events, with no dedicated mobile
layout. Portal ↔ tool: theme and sizing via the shared taro message contract.

## Business & legal
No monetization and no paid services. Client-only, so no data-processing obligations. Only
MIT/Apache/BSD-style dependencies; no code copied from GPL tools (Flameshot, Greenshot, ShareX).
Fonts for text annotations come from the system stack or OFL-licensed fonts. Avoid bundled HEVC
decoders (patents). Copy-to-clipboard inside the iframe needs the portal's `clipboard-write`
grant, which it already gives the siblings. Paste uses the `paste` event, so it needs no
`clipboard-read`.

## Milestones
- **M-1: Full annotator** (D-001: the owner chose everything in M-1, against the strategist's
  advice to split it):
  - Input: paste (Ctrl/Cmd+V), open file, drag-and-drop; PNG/JPEG/WebP/GIF (first frame);
    EXIF orientation applied.
  - Tools: rectangle, ellipse, arrow, line, freehand pen, highlighter, text, numbered step
    badges, Redact (solid), Blur, Pixelate (both labelled not secure).
  - Editing: every annotation is an object: select, move, resize, recolour, change stroke,
    delete, reorder front/back; a current style (colour, stroke width) applied to new objects.
  - Canvas: non-destructive crop as an adjustable export frame (D-002); padding/background
    around the image.
  - Undo/redo; single-key tool shortcuts; zoom and pan.
  - Output: copy PNG to clipboard, download PNG at native resolution, flattened, metadata
    stripped; pre-export redaction count.
  - Leave-site warning when changes haven't been exported (D-004); "Runs locally" note (D-003);
    theme sync; works in the iframe and standalone.
- **M-2: Reach and polish**: HEIC input (lazy-loaded decoder), very large images
  (downscale/tiling beyond the safe canvas size), JPEG/WebP export, style presets, touch
  polish (pinch-zoom vs draw).
- **M-3+ candidates**: local OCR-assisted redaction suggestions, image comparison, templates.

## Quality targets (proposed)
Open a 5K Retina screenshot (≈ 15 MP) in < 1 s. Drawing, moving and resizing at 60 fps on that
image. Copy/export in < 1 s. Images up to the safe canvas limit (≈ 16.7 MP, spike to confirm)
are fully supported; larger ones get a clear message (M-2 lifts this). WCAG 2.2 AA, with a
keyboard alternative for every action that matters. Latest Chrome, Edge, Firefox, Safari.

## Risks
1. **M-1 is large** (editable objects × 11 tools + crop + padding). Mitigations: an engine spike
   decided in ≤ 2 days; build in dependency order (object engine → shapes → text → effects) so
   a usable subset exists early; run the adoption test on that subset.
2. **No reason to switch** from OS tools: dogfood early and run the adoption test.
3. **Clipboard in the iframe**: rely on the `paste` event; test ClipboardItem PNG writes in the
   real portal on all engines; download is always the fallback.
4. **Redaction leaks** (opacity < 1, soft edges, a box moved before export): Redact is always
   opaque with hard edges; a pixel test of the exported file under each redaction; pre-export
   summary.
5. **Canvas limits and memory** on large images and high-DPR screens: spike decides whether
   the display and export canvases are separate.
6. **Lost work** (nothing persists): leave-site warning.

## Spike candidates (for architecture)
Clipboard/paste/download in the portal iframe · object engine (hand-rolled vs library, e.g.
Konva) · large images and iOS canvas cap · text overlay vs canvas fidelity · strict CSP on
Cloudflare with embedding · EXIF orientation · live blur/pixelate performance and Safari
`ctx.filter` support.
