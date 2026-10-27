# Product strategist review — 2026-10-27

## Differentiation
Loses to macOS Markup/Shottr on Mac. Wins on: same tool on every OS incl. no-install machines; trustworthy redaction (solid, flattened; blur/pixelate labelled not secure); metadata always stripped; verifiable local (CSP connect-src 'none', offline, public source); lives next to sibling tools.
Adoption test: (a) owner uses as default 2 weeks; (b) 5 Win/Linux users paste→2 arrows→1 redact→1 label→copy in < 20 s, not worse than Snipping Tool; (c) ≥ 3/5 would bookmark. If (b) fails, narrow to redact-before-share.

## Scope (recommended split)
- M-1: paste/open/drop; rect, arrow, Redact, single-line text; select/move/delete, resize rect+redact; undo/redo; non-destructive crop; copy/download PNG native res, metadata stripped; desktop pointer.
- M-2: ellipse, line, step badges, highlighter, pen; recolour, presets, resize all, multi-line text, shortcuts; touch polish.
- M-3: canvas resize/padding; blur + pixelate (with warnings); HEIC; very large images; JPEG/WebP.
Main cost driver: editable-object system × tool types.

## Risks
1. No reason to switch → adoption test before M-2.
2. Editor engine eats project → 2-day spike hand-rolled vs Konva.
3. Clipboard in iframe → paste event (no permission), test ClipboardItem write in portal, download fallback.
4. Redaction leaks (opacity < 1, moved box, soft edges) → force opacity 1, pixel test on export, pre-export summary.
5. Lost work (no persistence) → beforeunload warning when unexported changes.

## Non-goals
Saving/projects, share links/upload, accounts, screen capture, OCR/AI auto-redact, layers panel, multiple images, PDF/video, SVG export, collaboration, analytics.

## Spikes
Clipboard in iframe · rendering engine · large images / iOS canvas cap · text overlay fidelity · strict CSP from Cloudflare · EXIF orientation · blur performance (M-3).
