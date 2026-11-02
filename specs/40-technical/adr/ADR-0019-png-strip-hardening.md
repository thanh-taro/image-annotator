---
id: ADR-0019
title: PNG chunk whitelist hardening — outcome of spike SP-png-export (amends ADR-0007)
status: accepted
date: 2026-11-02
supersedes: []
---

## Context
ADR-0007 chose the platform PNG encoder plus a chunk whitelist, pending spikes SP-png-export and
SP-host. SP-png-export (branch `worktree-agent-ac0875180f48ad052`, commit bbb6e01, report
`.build-my-app/reports/spike-png-export.md`) confirmed the encoder and the whitelist. Its clipboard
and paste conditions stay with SP-host and the owner's manual paste check.

## Decision
- The platform encoder stays; no own encoder or fflate (DEP-27).
- `stripPngChunks` (MOD-Core) also fails closed on an unknown critical chunk (type starting with an
  uppercase letter), IDAT chunks that are not consecutive, a CRC mismatch, and any bytes after
  `IEND`. All of these lead to COPY-error.export_failed (F-012.R7).
- CRCs are checked. It costs about 35 ms at 14.7 MP, which fits NFR-03, and keeps the function
  fail-closed.
- **Test strategy (NFR-08):** WebKit's own PNG decoder changes semi-transparent pixels when a file is
  read back, by up to 232 per channel, while the encoded bytes are correct. Export pixel tests
  therefore decode the PNG outside the browser. Decoding in WebKit is allowed only for assertions
  about opaque pixels.

## Evidence (SP-png-export; Apple M3, headless Chromium 156 and WebKit 27.2, median of 7)
| Measure | Target | Chromium | WebKit |
|---|---|---|---|
| Chunks after stripping | IHDR, IDAT, IEND | met (input already clean) | met (removes `sRGB` and `eXIf`, 93 bytes) |
| Stripped vs unstripped pixels | equal | max difference 0 | max difference 0 |
| 14.7 MP, start of paint to stripped bytes | ≤ 1.5 s | 324 ms | 515 ms (`toBlob` 390 ms) |
| 5.2 MP | ≤ 0.5 s | 118 ms | 194 ms |
| Two exports byte-identical (F-018.AC5) | equal | met | met |
| Corrupt input | rejected, never throws | 24/24 unit tests: every truncation, every single-bit flip and 2,000 random inputs | |

## Still open
- Firefox chunk list: manual check per release candidate (ADR-0014).
- Pasting into chat, code-hosting and document apps: a manual check by the owner.
- The `ClipboardItem` promise in a WebKit frame: SP-host.

## Consequences
- The test setup needs a way to decode PNGs outside the browser. This may mean a dev-only PNG
  decoder, which must be registered in dependencies.md before use.
