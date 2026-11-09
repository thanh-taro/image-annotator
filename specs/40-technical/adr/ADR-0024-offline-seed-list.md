---
id: ADR-0024
title: Offline seed list from the build, network-first page (outcome of building F-017; amends ADR-0011)
status: accepted
date: 2026-11-10
supersedes: []
---

## Context
ADR-0011 seeds the offline cache with every file the tool loads, after the effects worker has
started, and rejected a build-time precache list. Since ADR-0022 a fresh effects worker starts per
image, so at startup it hasn't loaded and "seed after it starts" can't be met. ADR-0011 also says a
new version is adopted only from the next open, while its own network-first page runs the new
version on the first online open (F-017.R3, found in the F-017 build and review).

## Decision
1. MOD-Build lists every hashed file of the build in `<meta name="tk-assets">` on the page. The page
   posts that list, with its own resource entries, to the service worker, which caches them and
   stores the page only once every listed file is cached. Old files are pruned per seed.
2. The page is fetched network-first: an online open uses the newest version from that open on. An
   open tool is never reloaded, and a new service worker waits until every open copy of the old
   version has closed (F-017.R3).
3. WebKit's second download of the files on a first visit or a new version (about 146 KB compressed,
   once per version) is accepted; NFR-01 allows the tool fetching its own files.

## Alternatives
- Seed after the effects worker starts (ADR-0011): no longer possible with a worker per image.
- Cache only what the page has loaded (resource timing): misses the effects worker and the fonts
  not yet used, so the tool wouldn't open fully offline.

## Consequences
- The offline copy is complete before it is used, including the effects worker and every font.
- Updates reach online users one open sooner than ADR-0011 said.
- Real Safari is checked once for the second download (it may be a Playwright disk-cache artefact).
