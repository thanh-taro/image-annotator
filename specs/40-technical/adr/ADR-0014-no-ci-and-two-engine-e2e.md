---
id: ADR-0014
title: No code-host workflows; automated e2e on Chromium and WebKit only
status: accepted
date: 2026-11-02
supersedes: []
---

## Context
The owner decided (2026-10-26) for all taro-kit tools: no code-host workflow files, deploys only by
hand, and Firefox removed from the automated suites, because Playwright's Firefox does not launch
on the owner's machine. NFR-07 still includes Gecko-based browsers and touch on WebKit- and
Chromium-based tablets.

## Decision
1. The repository has no code-host workflows. Every check runs locally (`scripts/release-build`:
   lint, types, unit, e2e, axe, Lighthouse, size, license and dist gates) and releases follow the
   deploy runbook by hand (ADR-0010).
2. Playwright projects: `chromium` and `webkit` only (ADR-0012).
3. Each release candidate gets a manual check in Firefox (runbook smoke steps, including the PNG
   chunk list, ADR-0007) and a manual touch pass on one WebKit-based and one Chromium-based tablet
   (NFR-07).

## Alternatives considered
- **A test-only workflow on the code host** — the owner does not want code-host workflows.
- **Drop Gecko from NFR-07** — not requested; Firefox users stay supported.

## Consequences
- Gecko and tablet regressions are caught only by the manual release checks.
- DEP-17 does not include Playwright's Firefox (MPL-2.0).

<!-- Accepted ADRs are immutable. Write a new ADR to change a decision. -->
