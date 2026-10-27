# Market research — Image Annotator (2026-10-27)

Confidence: medium-low (one search per topic; several rows from the researcher's memory, marked unverified). Verify pricing on vendor sites.

## Summary
- Desktop tools are mature and cheap but OS-bound, mostly paid on Mac (CleanShot X, Shottr, Snagit).
- Cloud/web tools (Zight, Markup Hero) are built around uploads, accounts, quotas and paid tiers.
- A few free "local" web tools/extensions exist (Annotely, SnapMark, Highlark); fully-offline not verified.
- Gap: zero-signup, no-upload web annotator with fast keyboard use, clipboard paste, safe redaction, iframe-friendly.

## Competitors
| Tool | Platform | Pricing | Uploads? |
|---|---|---|---|
| CleanShot X | Mac | ~$29 one-time + optional $19/yr; Cloud Pro $8/user/mo ([Toolradar](https://toolradar.com/tools/cleanshot/pricing)) | Local by default |
| Snagit | Win/Mac | ~$39–69, sources disagree ([ScreenSnap](https://www.screensnap.pro/blog/snagit-pricing)) | Local, optional share |
| Shottr | Mac | ~$8–30, free with nag ([Bitdoze](https://www.bitdoze.com/shottr-mac-screenshot-tool/)) | Local |
| Greenshot / ShareX / Flameshot | Win / Win / cross | Free OSS (GPL, unverified) | Local; ShareX can upload |
| Skitch, macOS Markup | Mac | Free (unverified) | Local |
| Markup Hero | Web | Free tier, then ~$4+ ([Capterra](https://www.capterra.co.uk/software/205064/markup-hero)) | Yes, cloud |
| Zight (CloudApp) | Win/Mac/web | Free tier, paid teams ([Capterra](https://www.capterra.com/p/154298/CloudApp/reviews)) | Yes, share links are the product |
| Annotely | Web | Free, no signup ([Flypix](https://flypix.ai/annotely-tool-review/)) | Unclear |
| SnapMark, Highlark | Chrome ext | Free / $39 one-time; Highlark OSS ([Product Hunt](https://www.producthunt.com/products/snapmark-5)) | Claimed local |
| Awesome Screenshot | Ext/web | Unverified | Claimed yes (user comment) |

## What users say (thin evidence)
- Praise: Shottr blur/erase/crop comfortable; Annotely no signup; Zight annotation + sharing.
- Complaints: Zight stagnant, upload speed, broken links, price doubled; Flameshot can't easily open existing images.
- No sourced evidence on watermarks / sign-up walls / keyboard speed — hypotheses only.

## Table stakes vs differentiators
- Table stakes: arrow, rectangle, ellipse, line, freehand, text, highlighter, blur/pixelate, crop, undo/redo, PNG export, copy to clipboard; numbered steps common.
- Differentiators: provable local-only (offline, strict CSP, visible claim); no signup/watermark/quota; paste-on-load + one-key copy; single-key tool shortcuts; safe redaction (solid fill) + flattened export; metadata stripped; works on any OS; iframe-friendly.

## Technical pitfalls
- Pixelation and blur are reversible (Depix, Unredacter, UnPixel — [THN](https://thehackernews.com/2022/02/this-new-tool-can-retrieve-pixelated.html), [PortSwigger](https://portswigger.net/daily-swig/new-tool-can-uncover-redacted-pixelated-text-to-reveal-sensitive-data)). Solid bars recommended; export must be flattened, original pixels never kept under a redacted region.
- Canvas limits: iOS Safari ~16.7 MP area cap ([PQINA](https://pqina.nl/blog/canvas-area-exceeds-the-maximum-limit/)); DPR multiplies size; browsers fail silently → probe and step down.
- EXIF: canvas re-encode drops metadata (privacy win) but orientation must be applied on load; ICC profile lost.
- HEIC: not natively decodable outside Safari (unverified) → WASM fallback, lazy-loaded, patent concerns.
- Iframe: clipboard-read/clipboard-write permissions needed from the portal.

## Licensing
GPL tools (Flameshot/Greenshot/ShareX) — don't copy code. Client-only → low GDPR/CCPA exposure. HEVC decoder patent concerns. Font licensing for text annotations.
