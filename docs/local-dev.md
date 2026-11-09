# Local development

Everything runs on this machine (ADR-0010 "Environments", ADR-0014: no code-host workflows). The tool
has no backend, no database, no accounts and no paid services, so there is nothing to seed or fake:
it is a static page served from `localhost`. Nothing is deployed, uploaded or provisioned before
phase 7.

## Requirements
- Node 24 (`.nvmrc`) and pnpm 11 (`packageManager` in `package.json`; `corepack enable` provides it).
- Python 3 for the spec tools (`tools/`).

## Commands
| What | Command |
|---|---|
| **Set up** (install from the lockfile, Playwright's Chromium + WebKit, generate) | `pnpm bootstrap` |
| **Run** (dev server with hot reload, http://localhost:5173) | `pnpm dev` |
| **Reset** (remove build/test output and the Vite cache, regenerate) | `pnpm reset` (`pnpm reset --all` also removes `node_modules`; then `pnpm bootstrap`) |
| **Check** (every local gate, below) | `pnpm check` |
| **Check with e2e** | `pnpm check:full` |

`pnpm setup` is a built-in pnpm command, hence `bootstrap`.

## Environments
| Environment | Command | Serves |
|---|---|---|
| local (dev) | `pnpm dev` | source, hot reload, port 5173 |
| local (release preview) | `pnpm build && pnpm preview` | the exact `dist/`, port 4173; the e2e suite starts its own preview on a per-worktree port (below) |

`vite preview` does not send the generated headers. The host/offline harness
(`pnpm test:e2e:host`) serves two builds **with** `public/_headers` (real CSP, `frame-ancestors`)
and a stub host page on a second local origin (SP-host):

| Origin (`B` = port base) | Role |
|---|---|
| `http://localhost:B` | stub host (the allowed host origin; frame grants of D-006, focus on ready) |
| `http://127.0.0.1:B+1` | the tool, built with `HOST_ORIGINS=http://localhost:B` |
| `http://localhost:B+2` | a host origin **not** allowed (must be refused) |
| `http://127.0.0.1:B+3` | the tool, built with an empty `HOST_ORIGINS` (standalone only) |

**E2E ports** (`tests/e2e/support/ports.ts`) are derived from the checkout's path, so parallel
worktrees never collide or test each other's build: the harness base `B` is 20000–27996 (step 4) and
the preview port of `pnpm test:e2e` is 30000–31999, both above WebKit's blocked-port list.
`E2E_HOST_PORT_BASE` and `E2E_PORT` override them. The preview runs with `--strictPort`, and an
already running server is reused only with `E2E_REUSE=1`.

The stub host page is `/host.html?tool=<tool URL>`; add `grants=0` to drop the frame grants or
`focus=0` to skip focusing the tool after its ready signal (F-015.R7 fallbacks).

## Variables
See `.env.example`. The only one that changes behaviour is `HOST_ORIGINS` (build time, default
`https://tarokit.app`); `pnpm gen` writes `public/_headers` for the default, and the e2e harness
builds its own variants without touching the checked-in file.

## Tests
| Suite | Command | Notes |
|---|---|---|
| Unit + property (Vitest, fast-check) | `pnpm test` (`pnpm test:watch`) | `tests/unit`, `tests/property` |
| E2E, release preview (Playwright, Chromium + WebKit) | `pnpm build && pnpm test:e2e` | `tests/e2e/*.spec.ts`; one engine: `--project=chromium` |
| E2E, host + offline harness | `pnpm test:e2e:host` | `tests/e2e/host/`; builds `dist-e2e/` itself |
| Both e2e suites | `pnpm test:e2e:all` | |
| Lighthouse (NFR-05) | `pnpm build && pnpm lhci` | needs a Chrome; set `CHROME_PATH` to Playwright's Chromium if none is installed |
| Spec coverage | `python3 tools/spec_lint.py --coverage tests` | acceptance criteria without a test |

Test names start with the spec ID they verify (`adapters/tests.md`).

## The check (`pnpm check`)
Runs in order and stops at the first failure: `gen:check` (generated files up to date) →
`typecheck` → `lint` (ESLint incl. the network/storage ban and module boundaries, then Prettier) →
`test` → `python3 tools/spec_lint.py` → `build` → `check:licenses` (ADR-0001 over the whole lockfile,
then the `dist/` scan) → `check:size` (architecture.md budgets, no lazy chunks) → `check:dist`.
`pnpm check:full` adds both e2e suites. `scripts/release-build` runs the same gates on a clean
clone of a git ref (phase 6).

## Generated files
`pnpm gen` (also the first step of `dev` and `build`) regenerates, from the specs:
`src/app/styles/tokens.gen.{css,ts}` and `src/render/palette.gen.ts` (tokens.json),
`src/copy/messages.gen.ts` (copy.md), `src/app/third-party-notices.txt` (dependencies.md) and
`public/_headers` (boot script + `HOST_ORIGINS`). They are checked in; never edit them by hand
(`adapters/codegen.md`).
