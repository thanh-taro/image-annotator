# Release report: Image Annotator 1.2.0-rc.1 (local candidate)

Branch `build/1.2`. Tagged locally `v1.2.0-rc.1` (not pushed). Production runs 1.1.1 (Cloudflare version
`e9d11729-e4f1-49cf-a8cf-8de37ca1b58d`, the rollback target).

## Candidate
- **Scope:** milestone M-1c, F-020 fill colour and text background (D-051, D-052, D-053). Release notes:
  `docs/release-notes/1.2.0.md`.
- **Reviews:** spec review 2 rounds (`review-F-020-spec-round-1.md`, `-round-2.md`); code review 2 rounds
  (`review-F-020-round-1.md`, `-round-2.md`, round 2 clean); accessibility audit (`a11y-F-020.md`, 0 blockers,
  0 major; copy "Text background" adopted).
- **Built and tested** by `scripts/release-build 98dbc24` in a clean clone, 2026-11-10: unit + property 791/791;
  e2e preview Chromium + WebKit 712 passed and 4 flaky (the first four crop tests on Chromium timed out at
  ~45 s at suite start and passed on retry; `crop.spec.ts` re-run with retries off: 32/32 passed); host +
  offline 96 passed.
- **Reproducible:** a second build of 98dbc24 (`SKIP_E2E=1`) gave an identical `SHA256SUMS`.
- **Artifacts:** `release/1.2.0-rc.1/`: `image-annotator-1.2.0.tar.gz` 163,446 bytes, SHA-256
  `5756a6ce6837d42e4a17fced5ab7ed31fe941668a36e69a4bd11cb9cd41c7cc1`; `dist.sha256`
  `0987a9980948322c4770021fc5835b048ed7649ac6fabd4ffcda1e292c3c844c`.

## Manual checks for the owner
- Hand test: fill colour on rectangles and ellipses; text background (empty, typing, clicking in the margin,
  selecting, export).
- As for 1.1: the real colour picker (Safari cancel and focus), a screen reader on the new colour groups,
  forced colours, a touch device.

## Deploy
As 1.1.1: runbook section 3 with `v1.2.0-rc.1` and `release/1.2.0-rc.1`, then the smoke checks of section 4.
