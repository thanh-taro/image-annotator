# Tests adapter

How tests consume the specs (ADR-0012, ADR-0014). Copied from the sibling
data-analysts-file-viewer and adapted. Every acceptance criterion needs a test whose **title starts
with its ID**; `python3 tools/spec_lint.py --coverage tests` lists criteria without one.

## Naming convention
- Title = `<spec ID> <behaviour in plain words>`, with the dotted form exactly as in the spec:
  `F-012.AC3 exports one pixel per image pixel over the canvas`.
- Rules, invariants, NFRs and ADRs use their IDs the same way: `RULE-02 scale-down keeps the aspect
  ratio`, `INV-02 solid redaction covers every touched pixel`, `NFR-01 no requests after load`.
- One criterion per test where practical; a test covering several lists each ID.
- Parametrised variants append the parameter in parentheses: `… (light)`; Playwright adds the
  engine (`[chromium]`, `[webkit]`) itself.
- Harness checks that verify no spec item start with `smoke:`. A test only cites an acceptance
  criterion once the behaviour it checks is built.
- In code under test, cite what it implements: `// Implements: F-005.R2`.

## Layout
| Folder | Runner | What |
|---|---|---|
| `tests/unit/` | Vitest (Node) | MOD-Core (limits, sizes, geometry, hit-testing, frame/padding maths, file names, chunk whitelist), MOD-Document (operations, coalescing, change epoch), MOD-Keys, MOD-Copy, MOD-Host pure functions and the boot script, the generators |
| `tests/property/` | Vitest + fast-check | geometry invariants, undo/redo round trips, effects equal the slow reference (ADR-0006) |
| `tests/e2e/*.spec.ts` | Playwright on `pnpm preview` | FLOW-01/02, paste/drop/open, drawing, export, axe audits; Chromium + WebKit |
| `tests/e2e/host/` | Playwright, host/offline harness | host contract, origin checks, frame grants, offline, request log (F-015, F-017, F-018, NFR-01, NFR-09) |
| `tests/fixtures/` | — | pixel and file fixtures (NFR-03 reference images, EXIF 1–8, wide gamut, each RULE-01 format, damaged and over-limit files), committed when small and deterministic |

## End-to-end setup
- `pnpm build`, then `pnpm test:e2e` (`--project=chromium|webkit`). `playwright.config.ts` serves
  `dist/` with `pnpm preview --strictPort` on a per-worktree port (30000–31999, from
  `tests/e2e/support/ports.ts`; `E2E_PORT` overrides; a running server is reused only with `E2E_REUSE=1`). `vite preview` sends no CSP, so
  header-dependent behaviour is tested in the harness below.
- `pnpm test:e2e:host` (`playwright.host-offline.config.ts`): global setup builds two variants into
  `dist-e2e/` (`HOST_ORIGINS` = the stub host origin, and empty) with their real `_headers`, and
  starts four local servers on a per-worktree port base (20000–27996; `E2E_HOST_PORT_BASE` overrides;
  `tests/e2e/support/urls.ts`): the stub host page `/host.html?tool=…` on
  a second origin (the D-006 frame grants and focus-on-ready; `grants=0`, `focus=0` for the fallback
  cases), a disallowed host origin, and the two tool builds. The tool servers keep a server-side
  request log (`/__log/dump`, `/__log/reset`, reachable only from the test runner, since the page has
  `connect-src 'none'`) for NFR-01. For offline (F-017, ADR-0021) the allowed tool server can be taken
  down (`/__ctl/down?on=1|0`: every other request has its connection dropped, as if stopped; Playwright's
  `setOffline` breaks service workers on WebKit) and switched to a newly published build
  (`/__ctl/version?v=2|1`, `dist-e2e/allowed-v2`: a renamed stylesheet and a version marker). The stub host records every message the tool posts and offers
  `__sendTheme`, `__sendLanguage`, `__fromSibling(data)` and `__resizeTool`.
- Accessibility: `@axe-core/playwright` with tags `wcag2a, wcag2aa, wcag21a, wcag21aa, wcag22aa` on
  every screen state in both themes; zero violations expected (NFR-06).
- No CI (ADR-0014): every suite runs locally (`pnpm check:full`, `scripts/release-build`). Firefox and
  the tablet touch pass are manual release checks.

## Performance
- `pnpm check:size` — compressed budgets on every build (NFR-05, architecture.md).
- `pnpm lhci` — Lighthouse CI on `dist/` with NFR-05 throttling (40 ms RTT, 10 Mbit/s): transfer
  budgets, interactive ≤ 1.5 s, accessibility score 1.
- NFR-02/03/04 traces (Chromium) and the spike-derived perf suites run before release, not per change.
