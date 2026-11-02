---
id: ADR-0003
title: Language and build tooling — TypeScript, Vite, pnpm, matching the suite
status: accepted
date: 2026-11-02
supersedes: []
---

## Context
The tool must build a small main bundle and one effects worker (ADR-0006), all loaded at startup
(NFR-01: nothing fetched on first use; NFR-05), run its build on Node >= 24, and share conventions
with the sibling tools. Type safety matters for the domain model, the document operations and the
worker protocol, where a wrong shape is a correctness and a privacy risk (INV-02, INV-04).

## Decision
Use **TypeScript** (strict, with `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`,
`verbatimModuleSyntax`, `isolatedModules`), **Vite** for the dev server and production build, and
**pnpm** as the package manager, pinned to the same major versions the sibling tools use. Vite's
worker support (`worker: { format: 'es' }`) produces the module worker (ADR-0006). **No dynamic
`import()` and no lazy chunks**: the build fails if it emits a chunk that is not loaded at startup.
ESLint + typescript-eslint + eslint-plugin-jsx-a11y + Prettier enforce style, accessibility, and:
- a **ban on network and storage APIs** that keeps INV-04 / NFR-01 true: `fetch`,
  `XMLHttpRequest`, `WebSocket`, `EventSource`, `navigator.sendBeacon`, `new Image()`, `innerHTML`/
  `outerHTML`/`insertAdjacentHTML`, `localStorage`, `sessionStorage`, `indexedDB`, `document.cookie`
  (Cache Storage only in `sw.js`, ADR-0011);
- **module-boundary rules** (`no-restricted-imports` per folder) as listed in `architecture.md`:
  MOD-Core and MOD-Document import no DOM code; the worker imports only MOD-Core; MOD-Render never
  imports language or theme; only MOD-Host posts to the parent or touches the service worker; only
  MOD-IO touches the clipboard, downloads and `beforeunload`.
The build is type-checked (`tsc --noEmit`) before bundling.

## Alternatives considered
- **esbuild/Rollup alone** — Vite already wraps the bundler and gives worker ergonomics and the dev
  server; no reason to hand-roll.
- **npm/yarn** — the suite uses pnpm (strict, content-addressed, license reporting).
- **Plain JavaScript** — the worker protocol, the geometry and the document model are exactly
  where types prevent fidelity and privacy bugs.

## Consequences
- Same build/lint/type conventions as the sibling tools; the network/storage lint ban is a
  first-class defence for NFR-01 alongside the CSP (ADR-0010).
- Module boundaries are checked on every lint run, not left to review.
- Every byte of code counts against the startup budget, because nothing is lazy.

<!-- Accepted ADRs are immutable. Write a new ADR to change a decision. -->
