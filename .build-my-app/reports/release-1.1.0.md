# Release report: Image Annotator 1.1.0-rc.1 (local candidate)

Branch `build/1.1`. Nothing was uploaded or deployed. Tagged locally `v1.1.0-rc.1` (not pushed).
Production runs 1.0.0 (Cloudflare version `517ae3cf-f6e5-45b9-a99a-6deda8f9f469`, see `release-1.0.0.md`).

## Candidate
- **Scope:** M-1b, F-019 custom colour and size (D-048, D-049, D-050), plus two fixes: clicking the active tool
  clears the selection on wide layouts (CMP-Toolbar, D-043), and Esc in an unchanged panel field follows RULE-19
  with focus moving to the canvas region (CMP-StylePanel). Release notes: `docs/release-notes/1.1.0.md`.
- **Version:** `package.json` 1.1.0; changelog "## 1.1.0"; spec lint 0 errors; AC coverage 0 uncovered.
- **Built and tested** by `scripts/release-build 5e2d851` in a clean clone (frozen lockfile,
  `HOST_ORIGINS=https://tarokit.app`), 2026-11-10.
- **Artifacts:** `release/1.1.0-rc.1/`: archive `image-annotator-1.1.0.tar.gz` 162,738 bytes,
  SHA-256 `16f9c9bc0564dde289cddf909d6eae95b84ddcea1e700be2bb67c68d9659daaa`; `dist.sha256`
  `873db0336f9a1d94a225b89b0ec0c5a1e5e81a08fee6e6d774e9ad81dfa0749f`.

## Verification
| Run | Result |
|---|---|
| All gates (codegen, types, lint, unit, spec lint, build, licences, dist, size) | pass |
| Unit + property | 752/752 (76 files) |
| E2E preview, Chromium + WebKit (includes FLOW-01, FLOW-02, smoke, the a11y matrix, 26 F-019 tests) | 666 passed, 0 failed, 0 flaky |
| E2E host + offline harness | 96 passed |
| QA security harness | 16/16 (on the merged branch) |
| Reviews | spec review 3 rounds; code review and accessibility audit, 2 fix rounds (`review-F-019-*.md`, `a11y-F-019.md`) |

## Manual sign-off (owner)
Owner sign-off 2026-11-10: "it's good" (hand test of 1.1.0-rc.1).
- [ ] Custom swatch in Chrome and Safari: opens the real picker by click and by Enter/Space; live preview; the
      swatch remembers the colour; cancel (Esc in the picker) where the browser supports it
- [ ] Custom size: type a size, drag the slider, pick S/M/L again; text, step, pen, highlighter, shapes
- [ ] Narrow (phone width): 2 rows of 5 swatches, the size field, summary bar "· 7 px"
- [ ] Undo after a picker session and after a slider drag: one step each
- [ ] Embedded in the portal: the picker opens inside the frame
- [ ] Optional: a screen reader on the colour group and slider; Windows high contrast

## Deploy
Same steps as `docs/deploy/runbook.md` section 3 with `v1.1.0-rc.1` and `release/1.1.0-rc.1`, then the smoke checks
of section 4 against `release/1.1.0-rc.1/dist.sha256`. Rollback: `wrangler rollback 517ae3cf-f6e5-45b9-a99a-6deda8f9f469`.
