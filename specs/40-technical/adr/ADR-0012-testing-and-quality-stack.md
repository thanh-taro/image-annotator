---
id: ADR-0012
title: Testing and quality stack
status: accepted
date: 2026-11-02
supersedes: []
---

## Context
Correctness and privacy are the product (PRN-01, PRN-02): redactions that really hide (INV-02),
export fidelity and clean files (NFR-08, INV-03), responsiveness and memory (NFR-02, NFR-03,
NFR-04), accessibility (NFR-06), the host contract and no-network guarantee (NFR-01, NFR-09,
RULE-16), and the startup budget (NFR-05). The suite already standardises its test stack.

## Decision
- **Vitest** (DEP-14) for unit, integration and benchmark tests: MOD-Core geometry, hit-testing,
  limits, frame/padding/canvas maths, file names and the PNG chunk whitelist; MOD-Document
  operations, coalescing and the change epoch; MOD-Keys mapping; MOD-Effects against the reference.
- **fast-check** (DEP-15) for property tests: the optimised blur/pixelate equals the slow reference
  implementation (ADR-0006); undo/redo round trips restore documents and selections; geometry
  invariants (outward-rounded boxes, padding step-down within RULE-02).
- **Pixel and file fixtures**: the NFR-03 reference images, EXIF orientations 1–8, wide-gamut
  sources, each RULE-01 format, damaged and over-limit files; export tests compare the screen path
  at 100 % with the export path and inspect PNG chunks (NFR-08).
- **Playwright** (DEP-16) on Chromium and WebKit (ADR-0014) for e2e: FLOW-01 and FLOW-02, paste/
  drop/open, clipboard copy in and out of a frame, download names, the host contract and origin
  checks with a stub host, offline, the leave-page warning, and a **server-side request log
  asserting that only the tool's own files are fetched** (NFR-01). Performance and memory traces
  for NFR-02/03/04 run in Chromium.
- **@axe-core/playwright** (DEP-18) for the automated accessibility audit, plus a manual
  screen-reader pass (NFR-06).
- **Lighthouse CI** (DEP-19) with matched throttling for NFR-05, and a build **size gate** for the
  budgets in `architecture.md`.
- Spikes (`architecture.md` "Spikes") are prototyped and measured before the pending conditions of
  ADR-0004, ADR-0005, ADR-0006, ADR-0007 and ADR-0009 are recorded as met; reports live under
  `.build-my-app/reports/`. Test names cite spec IDs (`adapters/tests.md`).

## Alternatives considered
- **Jest** — the suite uses Vitest.
- **Cypress** — Playwright already drives both engines, clipboard permissions and request logs.
- **Hand-written fixtures only** — property tests find the rounding and edge cases that matter for
  the reference effects and undo.

## Consequences
- Redaction safety, fidelity, performance, accessibility, privacy and the host contract each have
  an automated gate; NFRs map to concrete suites.
- The gated ADRs carry spike evidence before the build relies on them.

<!-- Accepted ADRs are immutable. Write a new ADR to change a decision. -->
