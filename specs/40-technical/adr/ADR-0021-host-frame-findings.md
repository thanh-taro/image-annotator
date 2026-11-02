---
id: ADR-0021
title: Frame behaviour — outcome of spike SP-host (amends ADR-0007, ADR-0010, ADR-0011)
status: accepted
date: 2026-11-02
supersedes: []
---

## Context
ADR-0007, ADR-0010 and ADR-0011 were pending spike SP-host. The spike (branch
`worktree-agent-a3f08cb2210265e0a`, commit 54e3b76, report `.build-my-app/reports/spike-host.md`)
ran 58 Playwright cases. It served the ADR-0010 headers locally, with a stub host and a disallowed
embedder, each on its own localhost origin.

## Decision
- **Headers, CSP, message checks and focus:** confirmed as written. `frame-ancestors` refuses a
  third origin, including when it is nested between the host and the tool. `connect-src 'none'`
  refuses `fetch` with no request sent. Messages from another origin, or from a window that isn't
  the parent, are ignored. Paste works once the host focuses the frame after `taro:ready`.
- **Clipboard (ADR-0007, ADR-0019):** the chunk whitelist controls the bytes we create, so the
  download is always IHDR/IDAT/IEND. On the clipboard, the browser re-encodes the image: WebKit
  adds `sRGB` and `eXIf`, holding only the export's colour space and pixel size. INV-03 still holds
  for copies, because nothing comes from the source file. Tests assert the chunk list on downloads,
  and on copies only that no chunk carries source data.
- **Clipboard grant:** Chromium rejects a copy without `clipboard-write`
  (`NotAllowedError` → F-012.R5). WebKit copies without it, so F-015.AC10 is tested on Chromium only.
- **Leave-page warning:** WebKit never shows it from a cross-origin frame, whatever the sandbox.
  This is accepted for M-1 (D-028, F-014 edge case). AC7 is tested on Chromium.
- **Offline (ADR-0011):** the hand-written service worker boots the tool standalone and embedded,
  and keeps its CSP. Embedded storage is partitioned, so the frame keeps its own cache: a standalone visit doesn't make the embedded tool work offline, or the reverse (F-017.R1 says "in the same way"). The seed
  list filters out `/sw.js`, which WebKit reports among loaded resources. Offline e2e stops the
  local server rather than using Playwright's `setOffline`, which breaks service workers on WebKit.

## Evidence (Playwright 1.63; Chromium and WebKit)
| Case | Chromium | WebKit |
|---|---|---|
| Paste after host focus / without focus | loads / goes to the host page | same |
| Copy with grant / without | copies / `NotAllowedError` | copies / copies |
| Download with `allow-downloads` / without | saved / blocked silently | saved / blocked, console only |
| Leave-page with `allow-modals` / without | shown / suppressed | never shown |
| `frame-ancestors` third origin | refused | refused |
| CSP `fetch` | refused, 0 requests | refused, 0 requests |
| Foreign `postMessage` | ignored | ignored |
| Offline after one visit | boots | boots |

The Chromium copy passed with Playwright's `clipboard-write` permission. Without it, the state was
`prompt`. Real Chrome normally grants clipboard writing in a user gesture without asking; QA checks
this headed.

## Consequences
- The portal change request lists these findings. Without focus, the portal page receives the
  user's paste.
- Firefox behaviour is a manual check per release candidate (ADR-0014).
