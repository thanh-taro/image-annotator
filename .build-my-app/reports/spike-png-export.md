# Spike SP-png-export — PNG chunk whitelist and export timing (ADR-0007)

**Question:** does `canvas.toBlob('image/png')` followed by a chunk whitelist (keep IHDR, PLTE, tRNS, IDAT, IEND; drop the rest) give a valid, metadata-free PNG fast enough on every engine?
**Hypothesis:** stripping is a cheap byte copy; encoding dominates and fits NFR-03.
**Success measures:**
- the stripped file's chunk list is exactly IHDR/IDAT/IEND (plus PLTE/tRNS if present) on Chromium and WebKit (Playwright); Firefox is noted as a manual check;
- the stripped file decodes to the same pixels as the unstripped one (max difference 0);
- export of 14.7 MP (5120×2880) ≤ 1.5 s and 5.2 MP (2880×1800) ≤ 0.5 s, measured from start of paint to blob ready, on Chromium and WebKit;
- the output is deterministic: two exports of the same canvas are byte-identical (F-018.AC5);
- CRCs are valid, and a corrupt or truncated input is rejected safely (no throw that escapes).
**Manual, for the owner later:** paste into Slack, GitHub and Google Docs (not part of this spike).
**Fail →** a pure-JS encoder (would need a new dependency through the licence policy) via a superseding ADR.
**Time box:** about 1.5 hours of agent work.
**Not built:** UI, clipboard, app structure.

## Outcome (2026-11-02)
**Adapt** (ADR-0019). The platform encoder plus whitelist pass on Chromium and WebKit: 14.7 MP in 324 / 515 ms, 5.2 MP in 118 / 194 ms, byte-identical repeats, pixels unchanged by stripping. The stripper is hardened (critical unknown chunks, split IDAT, CRC, trailing bytes). WebKit's decoder changes semi-transparent pixels on read-back, so pixel tests decode outside the browser. Still open: Firefox (manual), paste into apps (owner, manual), WebKit clipboard (SP-host). Code: branch `worktree-agent-ac0875180f48ad052` (bbb6e01), `spikes/png-export/`.
