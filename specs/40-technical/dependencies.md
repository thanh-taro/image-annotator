# Dependencies & assets

Policy: ADR-0001 (the same allow-lists and exceptions as the portal and the sibling tools). Every
direct dependency, every transitive **runtime** dependency, and every asset pack is registered here
before it enters the lockfile. Versions and licenses follow the sibling tools' registries (checked
there on 2026-10-19); the license audit re-verifies them on the registry before approval.

Kinds: **runtime** = shipped to the browser (main bundle or the effects worker; there are no lazy
chunks, ADR-0003, ADR-0011); **asset** = shipped non-code file; **build** / **dev** = never shipped.
Status: `proposed` → `approved` → `removed`. Every row below is `proposed` until the license audit
approves it. M-1 adds **no runtime package** beyond the suite's Preact + signals: rendering
(ADR-0004), decoding (ADR-0005), blur/pixelate (ADR-0006) and PNG chunk handling (ADR-0007) are our
own code on platform features.

## Runtime (shipped)
| ID | Name | Version range | License | Kind | Purpose | Status | Decided by |
|---|---|---|---|---|---|---|---|
| **DEP-01** | preact | ~10.29 (10.x, like the suite) | MIT | runtime | UI shell rendering (~4.5 KB gzip) | approved | ADR-0002 |
| **DEP-02** | @preact/signals | ^2.11 | MIT | runtime | App state: document, history, selection, tool, view, notices (~3 KB gzip with DEP-03) | approved | ADR-0002, ADR-0008 |
| **DEP-03** | @preact/signals-core | transitive of DEP-02 (^1.x) | MIT | runtime | Signals runtime | approved | ADR-0002 |

## Assets (shipped)
| ID | Name | Version range | License | Kind | Purpose | Status | Decided by |
|---|---|---|---|---|---|---|---|
| **DEP-04** | @fontsource-variable/manrope | ^5 | OFL-1.1 (copyright + licence text in the notices file) | asset | UI face and canvas text face (weight 600), self-hosted `latin` + `vietnamese` subsets (~40 KB); no `latin-ext` (D-025) | approved | ADR-0009, ADR-0013, ADR-0015 |
| **DEP-05** | @fontsource-variable/jetbrains-mono | ^5 | OFL-1.1 (copyright + licence text in the notices file) | asset | Numbers per style.md (zoom, sizes, fields), `latin` + `vietnamese` subsets (~40 KB) | approved | ADR-0013, ADR-0015 |
| **DEP-06** | lucide-static | ^1.55 | ISC (+ Feather MIT notice in the notices file) | asset | Icons, only used SVGs inlined at build (~3 KB in HTML) | approved | ADR-0013 |
| **DEP-07** | Portal design tokens (`tokens.json`) | copy pinned to a portal commit, plus the image-editor roles (D-011) | Owner's own work | asset (source) | Colours, spacing, radii, motion shared with the portal | approved (owner's own work; record the pinned portal commit) | ADR-0013 |

## Build, dev, test (never shipped)
| ID | Name | Version range | License | Kind | Purpose | Status | Decided by |
|---|---|---|---|---|---|---|---|
| **DEP-08** | typescript | ~6.0 (match the suite) | Apache-2.0 | dev | Type checking | approved | ADR-0003 |
| **DEP-09** | vite | ^8.3 | MIT | build | Dev server, bundling, the module worker; no lazy chunks | approved | ADR-0003 |
| **DEP-10** | @preact/preset-vite | ^2.10 | MIT | build | Preact JSX/HMR for Vite | approved | ADR-0003 |
| **DEP-11** | lightningcss (via vite) | native binary dependency of vite | MPL-2.0 (build-only exception) | build | CSS transforms in Vite | approved | ADR-0001 |
| **DEP-12** | caniuse-lite (via browserslist) | transitive | CC-BY-4.0 (data not shipped; no notice needed) | build | Browser target data | approved | ADR-0001 |
| **DEP-13** | style-dictionary | ~5.5 | Apache-2.0 | dev | Compile DTCG tokens to CSS variables (same as the suite) | approved | ADR-0013 |
| **DEP-14** | vitest | ^5.0 | MIT | dev | Unit, integration and bench | approved | ADR-0012 |
| **DEP-15** | fast-check | ^4.10 | MIT | dev | Property tests: effects vs reference, undo round trips, geometry | approved | ADR-0012 |
| **DEP-16** | @playwright/test | ~1.63 | Apache-2.0 | dev | E2E on Chromium and WebKit, perf and memory traces, request log | approved | ADR-0012, ADR-0014 |
| **DEP-17** | Playwright browser binaries (Chromium, WebKit) | via DEP-16 | Chromium BSD; WebKit LGPL-2.1 (test-only exception) | dev | E2E engines (no Firefox, ADR-0014) | approved | ADR-0001, ADR-0014 |
| **DEP-18** | @axe-core/playwright (pulls axe-core) | ^4.13 | MPL-2.0 (dev-only exception) | dev | Automated accessibility audit | approved | ADR-0001, ADR-0012 |
| **DEP-19** | @lhci/cli | ^0.15 | Apache-2.0 | dev | Startup budgets for NFR-05 | approved (lockfile licence audit 2026-11-02: whole tree within ADR-0001; `parse-cache-control` reviewed by hand as BSD-3-Clause) | ADR-0012 |
| **DEP-20** | eslint | ^10 | MIT | dev | Linting incl. network/storage API ban and module boundaries | approved | ADR-0003 |
| **DEP-21** | typescript-eslint | ^8.71 | MIT | dev | TypeScript lint rules | approved | ADR-0003 |
| **DEP-22** | eslint-plugin-jsx-a11y | ^6.10 | MIT | dev | Accessibility lint for TSX | approved | ADR-0003 |
| **DEP-23** | prettier | ^3.9 | MIT | dev | Formatting | approved | ADR-0003 |
| **DEP-24** | wrangler | ^4 (pinned, newest allowed by `minimumReleaseAge`) | MIT OR Apache-2.0; its sharp pulls LGPL-3.0 libvips binaries, deploy-only, never in `dist/` (D-026) | dev (deploy) | Deploy static assets by hand (phase 7) | approved | ADR-0010 |
| **DEP-25** | pnpm | 11.x | MIT | dev | Package manager, license report | approved | ADR-0003 |

## Evaluated, not adopted (recorded fallbacks)
| ID | Name | Version range | License | Kind | Purpose | Status | Decided by |
|---|---|---|---|---|---|---|---|
| **DEP-26** | konva | ^9 | MIT | runtime (not adopted) | Fallback scene/hit-testing engine if SP-engine fails (~50 KB gzip) | approved (fallback, not adopted) | ADR-0004 |
| **DEP-27** | fflate | ^0.8 | MIT | runtime (not adopted) | Fallback deflate for an own PNG encoder if SP-png-export fails (~8 KB gzip) | approved (fallback, not adopted) | ADR-0007 |

## Platform features used (no dependency)
- Canvas 2D (`HTMLCanvasElement`, `colorSpace: 'srgb'`), `ImageBitmap`, `createImageBitmap` with
  `imageOrientation`/`colorSpaceConversion`/`resize*` — rendering and decoding (ADR-0004, ADR-0005).
- `canvas.toBlob('image/png')` + our own chunk whitelist — export (ADR-0007).
- Async Clipboard API (`navigator.clipboard.write`, `ClipboardItem`) and the `paste` event — copy
  and paste (ADR-0007, F-001.R1).
- Dedicated module `Worker` with transferable `ArrayBuffer`s — the effects worker (ADR-0006).
- `document.fonts` (`load`, `ready`, `check`) — canvas text safety (ADR-0009).
- `Intl.NumberFormat`, `Intl.PluralRules` — language formatting (ADR-0015).
- Cache Storage — offline, in `sw.js` only, the tool's own files only (ADR-0011, NFR-01).

## Notes
- Shipped third-party code is Preact + signals (MIT) only; fonts (OFL text) and icons (ISC) are
  the shipped assets. `/third-party-notices.txt` lists exactly those.
- `pnpm check:licenses` scans the built `dist/` and fails when the shipped set and the notices
  differ, or when anything ships that is not an approved runtime/asset row.
- No CI dependencies: there are no code-host workflows (ADR-0014).
- 2026-11-02 licence audit: DEP-01–18 and DEP-20–27 approved (26/27 as fallbacks only); DEP-19 waits for the real lockfile's transitive licence list; re-run the audit against the lockfile in phase 3.3.
