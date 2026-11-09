---
id: ADR-0025
title: QA hardening — worker through the offline copy on WebKit, tighter image policy, notices offline, earlier seed (amends ADR-0001, ADR-0010, ADR-0024)
status: accepted
date: 2026-11-09
supersedes: []
---

## Context
The QA security audit (phase 5) found:
- On WebKit, the effects worker script, when it is served by the service worker, falls under the
  service worker's own content policy (`default-src 'none'; connect-src 'self'`) and is refused. An
  image opened before the offline copy holds the worker can then never get exact blur or pixelate,
  so every export of it fails (safely, F-012.R7) after the 10 s bound.
- `img-src data:` (ADR-0010) is not used by anything.
- The open-source notices (F-016) are not in the offline copy, so they don't open offline (F-017.R1).
- On a first visit the seed waits for the fonts, so a paste before then fetches the worker on first
  use, against the letter of NFR-01.

## Decision
1. The `/sw.js` response policy adds `worker-src 'self'`. The effects client treats a worker error as
   fatal at any time, not only during a job, so a dead worker is replaced or reported at once.
2. The page policy uses `img-src 'self'` (no `data:`).
3. MOD-Build emits the notices (ADR-0001's `/third-party-notices.txt`) as a hashed file under `/assets/` and lists it in `tk-assets`
   (ADR-0024 decision 1); the privacy details link to that file.
4. The page posts the `tk-assets` list to the service worker as soon as it is ready, and its own
   entries separately once the fonts have settled.

## Alternatives
- Record a first-visit exception in NFR-01: rejected, seeding earlier keeps the requirement as written.
- Serve the notices network-first like the page: they then need a route of their own; a hashed asset
  reuses the existing one.

## Consequences
- Blur and pixelate export on WebKit on a first visit and after a new version.
- The page policy is one source narrower.
- Every link in the tool works offline.
