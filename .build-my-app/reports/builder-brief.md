# Feature builder brief (shared by every phase-4 feature)

Project: Image Annotator. Follow the project's CLAUDE.md, `adapters/tests.md`, `adapters/codegen.md`, `adapters/design.md` and `docs/local-dev.md`.

1. **Context:** `python3 tools/spec_query.py context <F-ID> --full`; also read the ADRs and module specs it touches (specs/40-technical/). The designs are the artboards in `design/canvas/project/*.dc.html`, named per adapters/design.md. Open them in a headless browser to compare.
2. **Tests first:** at least one test per AC, titled with its ID (`F-001.AC3 …`); unit tests for each RULE/INV touched. Run them and confirm they fail for the right reason before implementing.
3. **Implement** within the module boundaries (eslint enforces them) and the ADRs. Cite IDs (`// Implements: F-001.R2`). Strings only through MOD-Copy `t()` with COPY IDs, values only through tokens. No new dependency unless it is `approved` in specs/40-technical/dependencies.md; if one is needed, stop and report.
4. **Spike code:** promote it deliberately where the brief says. Copy the files and adapt them to the module structure and lint rules; never merge the spike branches.
5. **Spec drift:** if the specs are missing, contradictory or ambiguous for something you must build, do not invent behaviour. Build what is clear, then list the gap in your report with a proposed wording.
6. **Verify locally:**
   - `pnpm check:full` must be green.
   - `python3 tools/spec_lint.py --coverage tests` must list none of your feature's ACs, unless an AC is genuinely manual; name those.
   - Run the app (`pnpm build && pnpm preview`, or `pnpm dev`) and capture screenshots of the feature's states, in both themes where the design has them. Save them in `.build-my-app/reports/screens/<F-ID>/` and compare them with the artboards; note the differences.
7. **Commit** on your branch: one commit, message `<F-ID>: <title>` with a body listing the R/AC covered and any ADRs whose spike code was promoted, ending with the line `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Don't push. Don't change the feature's spec status; the orchestrator does that.
8. **Stay local:** no deploys, uploads or logins. Localhost only.

**Report back (under 350 words):** the branch and commit; the R/AC coverage (each AC with its test file); check results; screenshot paths and design differences; spec gaps with proposed wording; risks or TODOs; and the files touched outside your feature's modules, since they cause merge conflicts.
