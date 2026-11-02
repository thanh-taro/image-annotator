---
id: ADR-0011
title: Offline via a hand-written service worker seeded with every file the tool loads
status: accepted
date: 2026-11-02
supersedes: []
---

## Context
The tool never needs the network for its work (PRN-01), so it should open and work with every M-1
feature offline after one visit, embedded or standalone (F-017.R1). It must make no requests of its
own and only check for a new version while the page opens (F-017.R2), apply updates only on a later
open (F-017.R3), and never store images or annotations (INV-04, NFR-01). Unlike the sibling file
viewer, this tool has **no lazy chunks**: NFR-01 forbids fetching anything on first use of a
feature, so the effects worker, both font subsets and all code load at startup. The sibling tools
use the same service-worker approach.

## Decision
After first render, MOD-Host registers a hand-written service worker (`sw.js`, `updateViaCache:
'all'`), creates nothing else lazily, and — once `document.fonts.ready` has settled and the effects
worker has started — posts it the list of loaded same-origin URLs (`performance` resource entries
plus the page), which the worker stores in Cache Storage, seeded from the HTTP cache. Serving: the
page is network-first with an offline fallback, matched ignoring the query; hashed assets are
cache-first; old assets are pruned per navigation; a new version is adopted only from the next open
(no `skipWaiting`, no `clients.claim` mid-session, no reload). The seed keeps the page address as
loaded when its query holds only `theme` and/or `lang` with supported values (RULE-16, RULE-17), so
the first embedded visit makes no extra page request. Cache Storage is the single storage
exception allowed by the CSP/lint policy and holds only the tool's own files.

## Alternatives considered
- **A service-worker framework (e.g. Workbox)** — more than a fixed same-origin asset list needs.
- **HTTP cache only** — no reliable offline start.
- **A build-time precache manifest** — equivalent here; seeding from what loaded matches the
  siblings and cannot miss a file the page actually used.

## Consequences
- Repeat visits start without the network (NFR-05), and every feature works offline (F-017.AC1).
- Using blur, pixelate, text or export for the first time causes no request (F-017.AC2).
- Updates are predictable: applied on the next online open, never mid-session (F-017.AC3).

<!-- Accepted ADRs are immutable. Write a new ADR to change a decision. -->
