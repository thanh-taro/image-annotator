# Release report: Image Annotator 1.2.1-rc.1 (local candidate)

Branch `build/1.2`. Tagged locally `v1.2.1-rc.1` (not pushed). Production runs 1.2.0 (Cloudflare version
`e5e1b75d-8682-47b6-a7a4-6c11a848cac2`, the rollback target).

## Candidate
- **Scope:** owner's change after 1.2.0 (D-054): a rectangle's or ellipse's fill colour is separate from its
  colour (F-020.R2, R6, RULE-22). Release notes: `docs/release-notes/1.2.1.md`.
- **Reviews:** spec review (`review-F-020-D-054-spec.md`, fixes applied); code review
  (`review-F-020-D-054-code.md`, 0 blockers, 0 major; 2 minor test fixes applied).
- **Built and tested** by `scripts/release-build fa589bb` in a clean clone, 2026-11-10: unit + property 801/801;
  e2e preview Chromium + WebKit 724 passed (0 failed, 0 flaky); host + offline 96 passed.
- **Reproducible:** a second build of fa589bb (`SKIP_E2E=1`) gave an identical `SHA256SUMS`.
- **Artifacts:** `release/1.2.1-rc.1/`: `image-annotator-1.2.1.tar.gz` 163,778 bytes, SHA-256
  `b23ceaaebc4295eb23bfe5757b2efea962cbf9ca5dc68c5314fc65ea37c08533`; `dist.sha256`
  `969868e04d57d14a3d0d245ccbb64c2d88dcb4d6039ce843acf4b8ae17ec4b90`.

## Deploy
As 1.2.0: runbook section 3 with `v1.2.1-rc.1` and `release/1.2.1-rc.1`, then the smoke checks of section 4.

## Deployed
- Deploy authorised by the owner (2026-11-10, "deploy"). `v1.2.1-rc.1` archive verified against `SHA256SUMS` and
  `dist.sha256`, deployed with wrangler 4.158.0. Cloudflare Version ID `59a264d9-45eb-460e-bf38-a492edbcf45e`
  (previous: 1.2.0 `e5e1b75d-8682-47b6-a7a4-6c11a848cac2`, the rollback target).
- Smoke checks passed: all page headers; `/sw.js` policy; assets immutable; `/nonexistent`,
  `/.vite/manifest.json`, `/_headers` and `*.map` return 404; all 10 served files match
  `release/1.2.1-rc.1/dist.sha256`.
