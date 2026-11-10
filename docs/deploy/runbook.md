# Deployment runbook — Image Annotator 1.0.0

Phase 7 only. Nothing here has been run. Every step marked **USER-OWNED** is done by the owner by
hand (ADR-0014); Claude prepares and checks, but never logs in, holds a token, uploads or deploys.

- **Target:** Cloudflare static assets via wrangler, assets only, on `https://image-annotator.tarokit.app`
  (ADR-0010). No staging (ADR-0010, D-040).
- **What ships:** the exact archive verified in phase 6:
  `image-annotator-1.0.0.tar.gz`, SHA-256 in `.build-my-app/reports/release-1.0.0.md`. Never deploy
  a fresh build that has not been verified.
- **No backend, database or migrations.** Configuration is baked in at build time (`HOST_ORIGINS`).
- **Environments and variables:** see `environments.md`.

## 0. Before you start (go / no-go)
1. **USER-OWNED:** every box in "Manual sign-off" in `.build-my-app/reports/release-1.0.0.md` is ticked
   on this candidate (D-038). Any failure means a fix and a new candidate (`rc.N+1`), re-verified.
2. **USER-OWNED:** the privacy policy and terms drafts (`privacy-policy.md`, `terms.md`) have had the
   legal review they are marked for, or you have decided the portal's own pages cover the tool.
3. The release gate (G6) is approved, and the candidate is tagged `v1.0.0-rc.4` locally.
4. **USER-OWNED:** the GitHub repository the tool links to (F-016.R3) is public, or will be at launch.

## 1. Portal first (release order)
The portal's frame grants must be live **before or together with** the tool. Until they are, the
spec fallbacks apply (F-015.R7): no downloads, no leave-page warning, no focus on ready.

1. **USER-OWNED:** in `taro-kit`, confirm that commit `4c4ae94` or later (its D-070 and D-071: the
   `dialogs` permission, focus into the frame on the first `taro:ready`, and the sandbox and `allow`
   attributes) is deployed to `https://tarokit.app`.
2. **USER-OWNED:** add the catalog entry `content/tools/image-annotator.yaml` from
   `docs/deploy/catalog-entry.yaml`. Choose its category, then add the screenshots from
   `docs/deploy/screenshots/`. Keep `openMode: embedded` and
   `permissions: [downloads, clipboard-write, popups, dialogs, file-pick]`. You may merge it now and
   publish it after step 3, or publish both together. The entry must not go live before the tool
   answers at its address.

## 2. One-time setup (USER-OWNED, first deploy only)
1. A Cloudflare account that holds the `tarokit.app` zone (free tier is enough).
2. Credentials for wrangler, on your machine only, never committed:
   - either run `pnpm exec wrangler login` (interactive),
   - or create an API token with **Account → Workers Scripts: Edit** and **Zone → Workers Routes: Edit**
     for `tarokit.app` only. Export it as `CLOUDFLARE_API_TOKEN` and the account ID as
     `CLOUDFLARE_ACCOUNT_ID` in your shell (not in `.env` in the repo).
3. The custom domain `image-annotator.tarokit.app` is attached by the first deploy (from `routes` in
   `wrangler.jsonc`, `custom_domain: true`). Cloudflare creates the DNS record and certificate; there
   must be no existing DNS record with that name.

## 3. Deploy production (USER-OWNED)
From a clean checkout of the tag, deploying the verified archive rather than a rebuild:

```sh
git switch --detach v1.0.0-rc.4           # the approved candidate
git status --short                        # must print nothing
pnpm install --frozen-lockfile            # wrangler is a dev dependency (DEP-24)
R=release/1.0.0-rc.4
(cd $R && shasum -a 256 -c SHA256SUMS)    # archive and checksum list: both OK
rm -rf dist && mkdir dist
tar -xzf $R/image-annotator-1.0.0.tar.gz -C dist
# every shipped file must say OK (.vite/ is in the list but is never shipped)
(cd dist && grep -v '/\.vite/' ../$R/dist.sha256 | shasum -a 256 -c -)
pnpm exec wrangler deploy --dry-run       # check: assets only, route image-annotator.tarokit.app
pnpm exec wrangler deploy                 # the upload
pnpm exec wrangler deployments list       # note the new version ID in the release report
```

Record the deployed version ID and time in `.build-my-app/reports/release-1.0.0.md`.

## 4. Verify production (smoke checks)
Claude can run 4.1 and 4.2 from the terminal once you say the deploy is done. Read-only requests;
nothing is changed.

1. **Headers:** `curl -sI https://image-annotator.tarokit.app/` shows:
   - a Content-Security-Policy with `connect-src 'none'`, `img-src 'self'` and
     `frame-ancestors https://tarokit.app`;
   - Permissions-Policy, `Referrer-Policy: no-referrer`, `X-Content-Type-Options: nosniff`, COOP,
     HSTS and `Cache-Control: no-cache`.

   Check these too:
   - `curl -sI .../sw.js` has its own policy (`default-src 'none'; connect-src 'self'; worker-src 'self'`)
     and `no-cache`;
   - one `/assets/*` file has `immutable`;
   - `curl -sI .../nonexistent` returns 404;
   - no `*.map` file is served.
2. **Bytes:** fetch each shipped path in `release/1.0.0-rc.4/dist.sha256` (all but `.vite/`) from production and compare the SHA-256 (a script can
   loop over the file). The page and every asset must match.
3. **USER-OWNED, in a browser, standalone:**
   - open `https://image-annotator.tarokit.app/`;
   - paste a screenshot, add a rectangle, a solid redaction and a blur;
   - copy, then download;
   - open the privacy details and the open-source notices;
   - DevTools → Network shows no request other than the tool's own files.
4. **USER-OWNED, embedded:**
   - open the tool from the portal at `https://tarokit.app`;
   - focus lands in the tool (a paste works at once);
   - download works;
   - closing the tab with unexported work warns (Chromium-based browsers; the WebKit gap is D-028);
   - the theme and language follow the portal.
5. **Offline:** after one full online open, turn the network off (DevTools → Offline, or airplane
   mode) and reopen the tool. It opens, blurs and downloads. Do this standalone and embedded.
6. **Framing refused elsewhere:** a page on any other origin that frames the tool shows the
   browser's refusal (frame-ancestors).

## 5. Monitoring
There is no analytics or error reporting, by design (NFR-01). Watch:
- **Cloudflare dashboard → Workers & Pages → image-annotator → Metrics:**
  - requests and 4xx/5xx for the first hours;
  - a spike of 404s on `/assets/*` means a cached page refers to files that were not deployed.
- **The portal's own feedback channel** and the GitHub repository's issues.
- **After each later release:** an open of the old version still works offline until all its copies
  close (F-017.R3).

## 6. Rollback
**A. Bad deploy, offline copy healthy** (layout bug, broken feature). This takes seconds.

1. **USER-OWNED:** run `pnpm exec wrangler deployments list` and find the previous good version ID.
2. **USER-OWNED:** run `pnpm exec wrangler rollback <version-id> --message "rollback 1.0.0"`.
3. Rerun the smoke checks in section 4.

Devices that opened the bad version keep its offline copy until their next online open. The page
is network-first, so that open runs the rolled-back version.

**First release, nothing to roll back to.** Remove the catalog entry (portal) so nobody is sent to
the tool. Then either fix forward with `rc.N+1`, or detach the custom domain in the Cloudflare
dashboard (Workers & Pages → image-annotator → Settings → Domains & Routes). Both are USER-OWNED.

**B. Bad service worker** (the tool won't update, or serves broken files offline). Choose one:

- **Fast, no build:** add a temporary rule for `/` with `Clear-Site-Data: "cache", "storage"` to
  `public/_headers`. Then build a new candidate, verify it and deploy it. Each device drops its copy
  and the worker registration on its next online open. Remove the header in the following release.
- **Kill-switch worker:** build a candidate whose `src/host/sw.ts` is the kill switch in
  `docs/offline.md`, then verify and deploy it. Restore the normal worker in a later release.

Both are new candidates: `rc.N+1` goes through phase 6 verification before deploy.

**C. Embedding broken** (the portal can't frame the tool). Check `frame-ancestors` in the headers and
the portal's frame attributes (section 1). The usual fixes are a candidate with corrected
`HOST_ORIGINS`, or a portal fix. Meanwhile the tool still works standalone.

## 7. After the deploy
- Record the version ID, time and smoke-check results in the release report.
- **USER-OWNED:** if you want the tag on the remote, push it: `git push origin v1.0.0-rc.4`. Optionally
  tag the same commit `v1.0.0`.
- Before the next release:
  - bump the dev tools with open advisories (release report, open notes);
  - consider the portal's `share` permission (D-072) for iPad "Save to Photos".
