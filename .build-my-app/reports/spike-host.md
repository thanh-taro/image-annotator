# Spike SP-host — frame behaviour with a stub host (ADR-0007, ADR-0010, ADR-0011, F-015)

**Question:** with production-like headers served locally and a stub host page on a different local origin, do paste, copy, download, the leave-page dialog, CSP and offline behave as F-015 and the ADRs say?
**Hypothesis:** yes with the grants (`allow="clipboard-write"`, `sandbox` incl. `allow-downloads allow-modals`); without them the spec's fallbacks apply.
**Success measures (Chromium and WebKit via Playwright, two localhost origins/ports):**
- paste reaches the tool when the host moves focus into the frame after `taro:ready`, and does not without that focus (document what happens);
- Mod+C on `keydown` with a promised `ClipboardItem` puts a PNG on the clipboard in a WebKit frame with `clipboard-write`; without the grant it rejects, so the COPY-error.clipboard path can run (F-015.AC9/AC10);
- `<a download>` saves inside a frame with `allow-downloads`, and is blocked silently without it (record what the page can detect);
- `beforeunload` shows the dialog with `allow-modals`, and is suppressed without it;
- `frame-ancestors` from the generated headers refuses a third origin (F-015.AC8);
- `connect-src 'none'`: page `fetch` is refused (NFR-01);
- `postMessage` origin and `event.source === parent` checks: a message from another origin or window is ignored (F-015.AC5);
- a hand-written `sw.js` serves the app offline after one visit (ADR-0011);
- Firefox: note as manual.
**Not in scope:** real Cloudflare (local headers only; nothing is deployed), the real portal.
**Fail →** spec change to the F-015 fallbacks or the portal change request, or a superseding ADR.
**Time box:** about 2 hours of agent work.

## Outcome (2026-11-02)
**Adapt** (ADR-0021). Headers, CSP, `frame-ancestors`, message checks, focus-then-paste, downloads and offline all behave as specified on both engines. WebKit never shows the leave-page warning from the frame: accepted as a known gap (D-028, F-014 edge case). WebKit allows clipboard writing without the grant (F-015.AC10 scoped), and re-encodes copies with `sRGB`/`eXIf` that hold no source data (INV-03 holds). Code: branch `worktree-agent-a3f08cb2210265e0a` (54e3b76), `spikes/host/`.
