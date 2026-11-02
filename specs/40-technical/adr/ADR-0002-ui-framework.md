---
id: ADR-0002
title: UI framework — Preact with signals, matching the suite
status: accepted
date: 2026-11-02
supersedes: []
---

## Context
The tool is one screen (SCR-Annotator) of thin chrome — CMP-Toolbar, CMP-StylePanel,
CMP-StatusBar, notices and dialogs — around one heavy, imperative view: the drawing canvas
(CMP-Canvas, ADR-0004). The UI layer must be small (NFR-05 startup budget), update chrome without
touching the canvas paint loop (NFR-02: 60 fps while drawing), and match the sibling tools so the
suite shares conventions, tokens, and review knowledge.

## Decision
Use **Preact 10** for rendering and **@preact/signals** for state, exactly as the sibling tools do.
Session and UI state (document and history, selection, active tool, current styles, view, notices,
unexported flag, redaction count; ADR-0008) live in signals; components subscribe to the slices they
need. The canvas is not a Preact tree: MOD-Canvas owns its element, paints it imperatively on
`requestAnimationFrame` and keeps transient pointer-drag state outside signals, so a pointer move
never re-renders Preact components. JSX uses the Preact runtime (`jsxImportSource: preact`). No
additional UI framework, router, or state library.

## Alternatives considered
- **React** — same model, far larger baseline against NFR-05, and diverges from the suite.
- **Svelte / Solid / Vue** — fine tools, but none is used elsewhere in the suite.
- **No framework (vanilla DOM)** — tempting for thin chrome, but the toolbar, style panel, bottom
  sheet (D-019), dialogs and notices benefit from a component model and the shared styling setup.

## Consequences
- Tiny UI baseline; the startup budget is spent mostly on our own canvas, rendering and effects code.
- Shared components, tokens, lint rules, and build steps with the sibling tools.
- The canvas does its own painting and input handling (ADR-0004) rather than leaning on framework
  diffing, which is the wrong tool for per-frame drawing.

<!-- Accepted ADRs are immutable. Write a new ADR to change a decision. -->
