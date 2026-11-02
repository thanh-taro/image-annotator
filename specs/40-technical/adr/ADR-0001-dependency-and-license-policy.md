---
id: ADR-0001
title: Dependency and license policy (aligned with the portal and the sibling tools)
status: accepted
date: 2026-11-02
supersedes: []
---

## Context
The tool is a personal, zero-budget project that ships JavaScript to every visitor and is embedded
in the TaroKit portal owned by the same person. The vision rules out anything that would let an
image or its annotations leave the device, so every runtime dependency is also an attack surface for
INV-04 / NFR-01 (a library that phones home, logs, or persists breaks the privacy promise, PRN-01)
and a cost against the startup budget (NFR-05). NFR-01 also requires every code path to load at
startup, so nothing may be fetched on first use of a feature.

The portal and the sibling tools (`json-formatter`, `data-analysts-file-viewer`) already define a
machine-checkable licensing policy with scoped exceptions. Using the same policy keeps one audit
approach across the suite.

## Decision
Adopt the suite's policy unchanged:
1. **Allowed for anything, including shipped code and assets**: MIT, ISC, BSD-2-Clause,
   BSD-3-Clause, 0BSD, Apache-2.0, Unlicense, CC0-1.0, BlueOak-1.0.0, Python-2.0, and OFL-1.1 for
   fonts.
2. **Allowed for build/dev/test tools only, used unmodified and never shipped**: MPL-2.0
   (lightningcss via Vite, axe-core), LGPL prebuilt binaries (Playwright's WebKit; the libvips binaries that wrangler's sharp pulls in for deploy tooling, D-026), CC-BY-4.0 data
   (caniuse-lite, attributed in the notices).
3. **Never allowed**: GPL, AGPL, SSPL, BUSL or other source-available licenses, CC-BY-NC/ND, no
   license, unknown license.
4. **Registry first**: every direct dependency, every transitive *runtime* dependency, and every
   asset pack is a DEP- row in `dependencies.md` (name, version range, license, kind, purpose,
   status) before it enters the lockfile. Status moves `proposed` → `approved` → (`removed`); the
   license audit approves rows.
5. **Runtime dependencies must** run fully offline, make no network request, collect no telemetry,
   work under the CSP of ADR-0010, load at startup (no lazy chunks, ADR-0011), and be justified
   against the bundle budget in `architecture.md`. Prefer the platform, or a small amount of our
   own code, when there is no tricky correctness surface. For this tool that covers rendering
   (ADR-0004), decoding (ADR-0005), the redaction effects (ADR-0006) and PNG chunk handling
   (ADR-0007): M-1 adds **no runtime package** beyond the suite's Preact + signals.
6. **Local enforcement** (no code-host workflows, ADR-0014): `pnpm licenses list --json` checked
   against the allow-lists by the kind recorded in the registry; a scan of `dist/` fails on
   third-party code or fonts not registered as runtime/asset; the build emits
   `/third-party-notices.txt` for shipped code and assets. Both run in `scripts/release-build`.
7. **Supply chain**: the lockfile is committed; pnpm's block on dependency lifecycle scripts stays
   on; `minimumReleaseAge` delays new releases; updates are reviewed, never auto-merged. A
   dependency whose canonical distribution has moved off npm must record its real install source
   in its DEP- row.

## Alternatives considered
- **A stricter MIT/Apache/BSD/ISC-only policy** — impossible with any Vite build (lightningcss is
  MPL-2.0) and excludes the standard accessibility engine; also diverges from the suite.
- **No registry, audit only** — loses the "why is this here" record and the review moment.

## Consequences
- One policy and one audit approach across the portal and its tools.
- Adding any package is a two-step change (registry row, then lockfile).
- Fallback libraries named by the gated ADRs (Konva for ADR-0004, fflate for ADR-0007) are
  recorded as not adopted; adopting one needs its row approved and a superseding ADR.

<!-- Accepted ADRs are immutable. Write a new ADR to change a decision. -->
