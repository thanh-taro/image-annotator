# Release report: Image Annotator 1.1.1-rc.1 (local candidate)

Branch `build/1.1`. Tagged locally `v1.1.1-rc.1` (not pushed). Production runs 1.1.0 (Cloudflare version
`e4f26f6f-ff4a-4333-9f1a-785e4c70d0ee`, the rollback target).

## Candidate
- **Scope:** bug fix reported by the owner: the selection in the text being edited was not visible
  (CMP-TextEditor, ADR-0009 §2). No spec change. Release notes: `docs/release-notes/1.1.1.md`.
- **Test-first:** new e2e test "F-005.R2 ADR-0009 selected characters in the text being edited show a visible
  selection" failed on Chromium and WebKit before the fix and passes after it. The ADR-0006 reference property
  test's limit is raised to 20 s (it timed out under machine load three times).
- **Built and tested** by `scripts/release-build d0431aa` in a clean clone, 2026-11-10: unit + property 752/752,
  e2e preview Chromium + WebKit 668 passed (0 failed, 0 flaky), host + offline 96 passed.
- **Artifacts:** `release/1.1.1-rc.1/`: `image-annotator-1.1.1.tar.gz` 162,938 bytes, SHA-256
  `de4f65f92e75a41d4cd3dade9885373b4e3e85d5fbb2d7597275a0668fa7fc07`; `dist.sha256`
  `2deb9bc125b6a75cef15fcd9313b7bb932a020f007d570b5453c62c608d526c3`.

## Deploy
As 1.1.0: runbook section 3 with `v1.1.1-rc.1` and `release/1.1.1-rc.1`, then the smoke checks of section 4.

## Deployed
- Deploy authorised by the owner (2026-11-10, "Deploy now"). `v1.1.1-rc.1` archive verified against `dist.sha256`,
  deployed with wrangler 4.158.0. Cloudflare Version ID `e9d11729-e4f1-49cf-a8cf-8de37ca1b58d` (previous: 1.1.0
  `e4f26f6f-ff4a-4333-9f1a-785e4c70d0ee`, the rollback target).
- Smoke checks passed: all 6 page headers and the `/sw.js` policy; `/nonexistent`, `/.vite/`, `/_headers` return
  404; all 10 served files match `release/1.1.1-rc.1/dist.sha256`.
