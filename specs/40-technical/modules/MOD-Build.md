---
id: MOD-Build
title: Build — codegen, headers, size/license/dist gates, release build, deploy
status: draft
depends_on: []
---

## Responsibility
The build, generation, and local-check machinery (ADR-0003, ADR-0010; no code-host workflows,
ADR-0014). Scripts copied from the sibling and adapted: `gen-all`, `gen-copy` (catalog from
copy.md, failing on a missing language, mismatched placeholders or plural forms, F-018.AC8),
`gen-tokens` (CSS variables and the canvas palette constants from the DTCG tokens), `gen-headers`
(`_headers` with the CSP and boot-script hash from `HOST_ORIGINS`), `gen-notices`,
`check-licenses` (ADR-0001), `check-size` (the budgets in `architecture.md`, and no chunk that is
not loaded at startup), `check-dist` (nothing but the tool's own files and registered assets),
and `release-build` (all gates, then `dist/`). It bundles the app and the effects worker, builds
`sw.js`, and holds the wrangler configuration for the manual production deploy in phase 7.

## Not responsible for
- Any runtime behaviour shipped to the browser (all other modules).
- Choosing dependencies (the registry and its ADRs).

## Public surface
- The generators, the Vite config, the gates, the release build and the deploy configuration;
  `HOST_ORIGINS` as the only build setting that changes behaviour.

## Implements
NFR-01, NFR-05, NFR-09; F-017.R1, F-018.R1. Decided by ADR-0001, ADR-0003, ADR-0010, ADR-0011,
ADR-0013, ADR-0014, ADR-0021.
