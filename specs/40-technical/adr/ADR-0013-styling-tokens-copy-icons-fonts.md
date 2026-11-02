---
id: ADR-0013
title: Styling with portal design tokens, generated copy, inlined icons and self-hosted fonts
status: accepted
date: 2026-11-02
supersedes: []
---

## Context
The tool must look native inside the portal and consistent standalone (PRN-05, F-015, D-011),
switch theme from the host without a flash (RULE-16), adapt at its own width thresholds (D-014:
wide ≥ 1000 px, compact 800–999 px, narrow < 800 px with the summary bar and bottom sheet, D-019),
stay usable down to 320 px (NFR-07), meet WCAG 2.2 AA contrast and forced-colors needs (NFR-06),
and keep all user-facing text in the specs (copy.md). The sibling tools already do this with design
tokens and generated copy.

## Decision
Use **plain CSS with the portal's design tokens**, compiled from the DTCG `tokens.json` (including
the image-editor roles added in design, D-011) to CSS custom properties by **style-dictionary**
(DEP-13) at build time (MOD-Build). Light/dark themes are token sets selected by a `data-theme`
attribute set by the boot script before first paint and updated on host theme messages;
`prefers-color-scheme` drives the standalone default (F-015.R2). Layout widths use CSS container
queries on the tool's root, so they follow the tool's own width, not the window. Icons are inlined
SVGs from **lucide-static** (DEP-06). Faces are self-hosted variable WOFF2 subsets — **Manrope**
(DEP-04) for UI and canvas text (ADR-0009) and **JetBrains Mono** (DEP-05) for numbers per
style.md — each with Latin and Vietnamese subsets (ADR-0015). Under the strict CSP (ADR-0010) there
are no inline `<style>` blocks or `style=""` attributes; dynamic positions (text field overlay,
handles) are set through CSSOM. Palette colour values used on the canvas come from the tokens but
are compiled into MOD-Render constants, so the export never depends on the theme (INV-05). All
strings come from a typed lookup generated from `copy.md` (MOD-Copy).

## Alternatives considered
- **A CSS framework / CSS-in-JS** — extra bundle against NFR-05, and CSS-in-JS conflicts with the
  strict CSP.
- **Icon font** — heavier and worse for accessibility than inlined SVGs.
- **Hard-coded strings** — breaks "one fact, one place".

## Consequences
- The tool shares the portal's look and theme switching; token changes propagate from one source.
- Copy stays in the specs and is type-checked at the call site.
- No styling or font path needs a network request after startup or violates the CSP (NFR-01).

<!-- Accepted ADRs are immutable. Write a new ADR to change a decision. -->
