---
id: MOD-Host
title: Host — theme, language, origin-checked messaging, ready signal, offline service worker
status: draft
depends_on: [MOD-Copy]
---

## Responsibility
Everything about living inside the TaroKit portal and about offline (PRN-05, F-015, F-017). An
inline, CSP-hashed boot script reads the initial theme and language (RULE-17) from the tool's
address and sets them (theme attribute, page language) before first paint. A message listener
accepts only messages whose origin is in the fixed allow-list and whose source is the parent,
applies later theme and language changes (forwarding the language to MOD-Copy), and ignores
everything else (RULE-16, NFR-09). The tool posts exactly one ready signal to the host after first
render and never sends anything else; it never takes focus from the host (F-001.R9). The
allow-list, delivered as the `frame-ancestors` directive, governs both who may embed the tool and
whose messages are accepted; an empty list means standalone only. It reports `embedded` /
`standalone` and whether the tool has focus (for the click-to-paste hint). It registers the
offline service worker after first render and seeds it, once fonts and the effects worker have
loaded, with every same-origin file the page used, so every feature works with no network and
nothing is fetched on first use (ADR-0011).

## Not responsible for
- App state, rendering, or images (MOD-App and the canvas modules).
- Any outbound request other than the single ready signal and the browser's own service-worker
  install/update fetches of the tool's own files.

## Public surface
- Language resolution (RULE-17) as pure functions, shared by the app and mirrored in the boot
  script.
- The boot script, the origin-checked `message` handler, the one-time ready post, and the
  `embedded`, `hasFocus` and current-theme signals.
- The service worker (`sw.js`): install/activate, cache the seeded URLs, serve the page
  network-first and hashed assets cache-first, prune old assets, update only on open.

## Implements
F-015.R1/R2/R3/R4/R5/R6/R7, F-017.R1/R2/R3, F-018.R1/R2/R3/R4; INV-04; RULE-16, RULE-17; NFR-01,
NFR-05, NFR-09. Decided by ADR-0010, ADR-0011, ADR-0015.
