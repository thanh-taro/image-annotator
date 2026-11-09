# Release report: Image Annotator 1.0.0-rc.1 (phase 6, local candidate)

Branch `build/m1`. Nothing was uploaded, published, deployed or provisioned; no credentials were touched. Tagged locally `v1.0.0-rc.1` (not pushed).
The owner signs off the manual checks below (D-038), reviews the drafts, then tags and ships (phase 7).

## Candidate
- **Version:** `package.json` 1.0.0; changelog entry "## 1.0.0" in `specs/60-delivery/changelog.md`; spec lint 0 errors.
- **Build commit:** `e46b59e` (version, changelog, release script). The later commits of this candidate change only
  docs, `.env.example`, a test file, the report and `release/`; a build of `8a3dae1` gave the same `dist/`. Tag the
  last commit on `build/m1` (the one holding this report): `git log -1 --format=%H`.
- **Production `HOST_ORIGINS`:** `https://tarokit.app` (the default; supplied through the environment variable read by
  `scripts/gen-headers.mjs`, ADR-0010), so `frame-ancestors https://tarokit.app`.

## Artifacts and checksums
Kept in the repo at `release/1.0.0-rc.1/` (verify with `cd release/1.0.0-rc.1 && shasum -a 256 -c SHA256SUMS`).

| File | Size (bytes) | SHA-256 |
|---|---|---|
| `release/1.0.0-rc.1/image-annotator-1.0.0.tar.gz` (deterministic archive of `dist/`, without `*.map` and `.vite`) | 159,748 | `764ab1f4398823f68b1d10d4bac161747e05a28865b30bcdf90738d811fce2f1` |
| `release/1.0.0-rc.1/dist.sha256` (checksums of every file in `dist/` except `*.map`) | 1,277 | `ea5b6a79ec15d080991ae8172a809614dfc7fadfb8f9a92d3260f6eb53216db6` |

Files in `dist/` (what Cloudflare serves; maps and `.vite/` are not uploaded):

| Path | Bytes | SHA-256 |
|---|---|---|
| `index.html` | 1,938 | `a15eb7f34b68fe7ee5d259995c99fc4928a93e74299412a5f436b8dc896759bc` |
| `sw.js` | 4,206 | `ada4ecd622779773f1755db653ead6d9d61fa89adf6beb410149d329f7d762cc` |
| `_headers` (read by Cloudflare, not served) | 1,456 | `379f12e419af7cb92752f664a5884c2e0f847f3d53000a93db1dee815241ee8e` |
| `assets/index-DKjugBN7.js` | 185,933 | `60be90188b1f1ac098e7f939ca4209cc4ed12a76399771d2e971cd802f43d1f5` |
| `assets/index-CXxB50mC.css` | 38,023 | `1421041fe97e665e98e0e8327a26be772c55808d95be5b2e63d4859656b463ea` |
| `assets/worker-l04FsEQG.js` | 6,392 | `4d36a87d67e9f468a64f5521e0ad7df7234003171615de52ae055cda1c4cbab0` |
| `assets/third-party-notices-DsvlZ65n.txt` | 16,641 | `cb4a1446c21f5ceb8de8fb9592027dc70b174d63441e851508ea43a1989e43f3` |
| `assets/manrope-latin-wght-normal-DHIcAJRg.woff2` | 24,836 | `a30ddcd349703aff7464c34bef3fffdff405ee50c113440d7c8693c02d210972` |
| `assets/manrope-vietnamese-wght-normal-usUDDRr7.woff2` | 8,520 | `6bbb044ab420e07edb0a3042d2eb314b85e83a0182e945a15ab3b9092668dfd5` |
| `assets/jetbrains-mono-latin-wght-normal-B9CIFXIH.woff2` | 40,404 | `18be452724bfdc236c074ca94a249a7f41a86752c7d04ab258ce9ed5651f6a7e` |
| `assets/jetbrains-mono-vietnamese-wght-normal-Bt-aOZkq.woff2` | 7,504 | `2288795da89dd97e648954b96e22b4501bd85dfc453264460b252f888b582ca2` |
| `.assetsignore` (deploy config) | 102 | `563c07c40a46fa52f81cb9664d8455653d5293d384b8109a9e82e0b9b8b01b0d` |
| `.vite/manifest.json` (not uploaded) | 2,354 | `e5c8864591d6517f1a7a04ba7cb4e2c0b717aa51dff84a16554872b9ad50a99e` |

Source maps (not deployed): `index-DKjugBN7.js.map` 860,094; `worker-l04FsEQG.js.map` 43,879; `sw.js.map` 25,404.
`dist.sha256` also lists `.assetsignore` and `.vite/manifest.json`, which the archive leaves out.

Catalog screenshots, from UI tests (`tests/e2e/host/catalog-screenshots.spec.ts`, `CATALOG_SHOTS=1`), in
`docs/deploy/screenshots/`: `embedded-1200x760-light.png`, `embedded-1200x760-dark.png` (1200 x 760),
`narrow-390-light.png`, `narrow-390-dark.png` (390 x 760).

## Build commands
```sh
# Release build from a clean clone of the committed tree (frozen lockfile, production HOST_ORIGINS, every gate,
# deterministic archive + checksums; then the e2e suites unless SKIP_E2E=1):
RELEASE_OUT=/path/outside/the/repo scripts/release-build <ref>

# What it runs in the clone: pnpm install --frozen-lockfile; pnpm gen:check; pnpm typecheck; pnpm lint; pnpm test;
# python3 tools/spec_lint.py; pnpm build; pnpm check:licenses; pnpm check:size; pnpm check:dist; archive and
# checksums; pnpm test:e2e:all (CI=1) and a check that dist/ is unchanged.
# Verification used here:   pnpm check:full   inside the clone
```
`scripts/release-build` was fixed for this candidate: it refuses an output directory inside the repo, builds only the
committed tree, writes a deterministic tar.gz (sorted, mtime 0, owner 0, no gzip timestamp) plus `dist.sha256` and
`SHA256SUMS`, takes the checksums before the e2e step and compares them afterwards.

## Verification (details in `traceability.md`, "Last results")
- **Reproducible:** two clean builds of `e46b59e` (and a third of `8a3dae1`) gave a byte-identical archive,
  `dist.sha256` and `dist/` tree (maps included).
- **`pnpm check:full` in the clean clone: exit 0, all 11 steps.** Unit and property 687/687; e2e on the release
  `dist/` (Chromium + WebKit) 582 passed, 22 skipped, 0 failed; host and offline harness with the real `_headers`
  96 passed, 10 skipped, 0 failed. Licences and dist scan, size budgets and dist contents pass. No flakes this run.
- **FLOW-01 and FLOW-02 and the smoke specs**, both engines, repeated x3: 24/24.
- `dist/` was byte-identical after the e2e runs.
- Not run in the candidate (not part of check:full): the QA security harness (`tests/e2e/qa/security-network`, passed
  in phase 5) and Lighthouse.

## Sign-off: the 12 manual checks (D-038)
Tick each on this candidate before anything ships. Screen-reader steps are in `qa-a11y.md` ("Manual checklist").

Browsers and input
- [ ] 1. Safari: trackpad pinch zoom (F-002.R3)
- [ ] 2. Safari: real Cmd+V paste (F-001)
- [ ] 3. Safari: Vietnamese Telex typing and a real text drop into the editor (F-005)
- [ ] 4. Safari: on a first visit, add a blur, then copy and download (security M1, ADR-0025; not reproducible in Playwright)
- [ ] 5. Safari: the offline files download a second time on a first visit, once only (ADR-0024)
- [ ] 6. Firefox (latest two): a quick pass of FLOW-01 and FLOW-02, embedded and standalone; offline copies kept apart (NFR-07, F-017)
- [ ] 7. Chrome (real, headed): offline copies kept apart embedded vs standalone (F-017); drag smoothness at 60 fps on the 14.7 MP image (NFR-02, ADR-0022)
- [ ] 8. Tablets: single-finger drawing on one iPad (Safari) and one Android tablet (Chrome) (NFR-07)

Accessibility
- [ ] 9. VoiceOver (Safari) and NVDA (Firefox or Chrome): load, draw, select, edit, redact, export, with announcements as CMP-Canvas lists
- [ ] 10. Windows high contrast (forced colours), 400 % zoom, text spacing

Performance on real hardware
- [ ] 11. NFR-04 memory with blur/pixelate at the RULE-02 limit, Safari included
- [ ] 12. 5.2 MP export within 0.5 s on the reference laptop; startup on the real production host (phase 7)

Done by automation, not on the list: security review F-017 m3 (paste before the offline copy is saved).

## Open notes
- **Dev-only audit advisories (5), none in `dist/` (`pnpm audit --prod`: none):** `extract-zip` <= 2.0.1 (high, two
  paths, no fix) , `basic-ftp` <= 6.2.0 (high, fix 6.2.1) and `zod` < 4.6.6 (high, fix 4.6.6), all under
  `@lhci/cli` > lighthouse > puppeteer-core; `deepmerge` 4.2.0 to 4.3.1 (low, no fix) under `style-dictionary`.
  The phase 5 advisories for `vite`, `vitest` and `wrangler` (undici) no longer appear, so the deploy tool has no known
  advisory. Revisit after an `@lhci/cli` or `style-dictionary` update; adding `pnpm.overrides` is optional.
- **Accessibility minors left (qa-a11y.md, 0 blockers, 0 majors):** m1 level-1 heading (fixed by D-036, kept in the
  list for the audit trail), m2 tab order puts the style panel before the canvas, m3 the unfocused empty-state hint
  wording ("Click here, then press Ctrl+V"), m4 little room at 400 % zoom with the narrow sheet open, m5 an
  out-of-range position or size value is corrected silently (no `aria-invalid`).
- **Visual minors left (qa-flows-visual.md, 7, all minor):** Lucide glyphs vs the artboard's sketch icons; the status
  bar hides the canvas size until a crop or padding exists (spec wins); the multi-selection heading difference
  (since fixed by D-035); the redaction count pill has no icon (accepted); the crop size chip's border and font; the
  narrow empty-state hint depends on focus; the image sits 1 to 2 px lower than the artboard.
- **Known gaps carried into the release notes:** WebKit embedded leave-page warning (D-028); Safari first-visit blur
  (fixed by ADR-0025, awaiting check 4); Safari clipboard colour-space tags; separate embedded and standalone offline
  copies; the source file name in the download name.
- **Decided:** no staging (D-040, ADR-0010 kept); the runbook written as a file in phase 6 (D-039), nothing run.
- **Decisions still with the owner:** (1) catalog category `developer` or `media`; (2) the source licence for the terms
  (`package.json` says UNLICENSED, while the tool links to its source); (3) legal review of the privacy policy, the
  terms and the privacy declaration; (4) the GitHub repository is public by launch.
- **Deployment runbook:** `docs/deploy/runbook.md`: go/no-go, portal first, one-time setup, deploy of the verified
  archive (checksum steps dry-run locally: 12/12 files OK), smoke checks, monitoring and rollback (wrangler rollback,
  `Clear-Site-Data` or the kill-switch worker). Every account, token, domain, portal and upload step is USER-OWNED.

## Deployed
Not deployed. (After phase 7, note here the production Cloudflare Version ID and the date.)
