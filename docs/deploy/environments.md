# Environment inventory: Image Annotator 1.0.0

A static single-page app, fully client-side (ADR-0010). No backend, database, data migrations, analytics or
third-party runtime services. Names and purposes only: **never values**. Everything marked **USER-OWNED** is done
by the owner; Claude never creates, reads or sets accounts, secrets, domains or uploads.

## Environments
| Environment | Where | Serves | Embedding allowed from (`HOST_ORIGINS`) | Status |
|---|---|---|---|---|
| local (dev) | `pnpm dev`, http://localhost:5173 | source, hot reload | default `https://tarokit.app` | exists |
| local (release preview) | `scripts/release-build`, then `pnpm preview` or the host/offline harness (`pnpm test:e2e:host`) | the exact release `dist/`; the harness serves it with the real `_headers` on localhost origins and a stub host | `https://tarokit.app` for the release build; the harness builds its own variants | exists |
| staging | PROPOSED, USER-OWNED: Cloudflare Worker `image-annotator-staging` on `https://image-annotator-staging.tarokit.app` | a staging-flavoured build (see below) | `https://tarokit.app https://staging.tarokit.app` | **not in ADR-0010** (decision needed) |
| production | Cloudflare static assets, `https://image-annotator.tarokit.app` | `dist/` of the approved release | `https://tarokit.app` | USER-OWNED, not yet deployed |

**Staging needs an owner decision.** ADR-0010 says "No staging in M-1" (the candidate is verified locally against
the exact `dist/` that ships, and rollback takes seconds). The portal, however, has a temporary staging site
(`https://staging.tarokit.app`, portal D-046). If you want a staging step, approve it and Claude writes a new ADR
that supersedes that line of ADR-0010; then add the wrangler environment below. A staging build is a different
build from the production one (a different `HOST_ORIGINS` changes `_headers`, the page and the hashed script), so
staging verifies the process, the headers and the offline copy, not the production bytes. The production bytes are
the ones verified locally and checksummed in `.build-my-app/reports/release-1.0.0.md`. If you decline staging, the
runbook's production steps stand alone and the "STAGING" part is skipped.

Wrangler environment to add for staging (not applied; non-inheritable keys must be repeated per environment):
```jsonc
"env": {
  "staging": {
    "name": "image-annotator-staging",
    "workers_dev": false,
    "preview_urls": false,
    "routes": [{ "pattern": "image-annotator-staging.tarokit.app", "custom_domain": true }]
  }
}
```

## Configuration variables
Every variable the scripts and tests read is listed in `.env.example`. Nothing is read at runtime in the browser
except `HOST_ORIGINS`, which is baked in at build time (`__HOST_ORIGINS__`).

| Name | Read by | When | Secret | Purpose | Local | Staging | Production |
|---|---|---|---|---|---|---|---|
| `HOST_ORIGINS` | `scripts/gen-headers.mjs`, `vite.config.ts` | build | no | Space-separated origins allowed to embed the tool: CSP `frame-ancestors` and the message allow-list (RULE-16, NFR-09). Wildcards are refused; empty means standalone only | default, or the harness's own | `https://tarokit.app https://staging.tarokit.app` | `https://tarokit.app` |
| `RELEASE_OUT` | `scripts/release-build` | release | no | Output directory (outside the repo) | optional | optional | optional |
| `SKIP_E2E` | `scripts/release-build` | release | no | `1` skips the e2e suites | optional | n/a | n/a |
| `CI` | Playwright configs, `scripts/release-build` | test | no | CI mode: retries, no reused servers, no `.only` | optional | n/a | n/a |
| `E2E_PORT` | `tests/e2e/support/ports.ts` | test | no | Port of the preview for `pnpm test:e2e` | optional | n/a | n/a |
| `E2E_HOST_PORT_BASE` | `tests/e2e/support/ports.ts`, QA harness | test | no | First port of the host harness | optional | n/a | n/a |
| `E2E_REUSE` | `playwright.config.ts` | test | no | Reuse a running preview server | optional | n/a | n/a |
| `E2E_QA_HARNESS` | `tests/e2e/qa/*` | test | no | Set by the QA security harness config | set by config | n/a | n/a |
| `SCREENS` | `tests/e2e/host/narrow-states.spec.ts` | test | no | Save narrow-state screenshots | optional | n/a | n/a |
| `CATALOG_SHOTS` | `tests/e2e/host/catalog-screenshots.spec.ts` | test | no | Write the catalog screenshots to `docs/deploy/screenshots/` | optional | n/a | n/a |
| `CHROME_PATH` | Lighthouse (`pnpm lhci`) | test | no | Chrome binary when none is installed | optional | optional | optional |
| `CLOUDFLARE_ACCOUNT_ID` | wrangler | deploy | no (keep out of git) | The Cloudflare account that receives the deploy | n/a | USER-OWNED | USER-OWNED |
| `CLOUDFLARE_API_TOKEN` | wrangler | deploy | **yes** | Scoped API token for wrangler; alternative is interactive `wrangler login` | n/a | USER-OWNED | USER-OWNED |

There are no other secrets, no runtime secrets, no database and no migrations. `.env`, `.env.*` are git-ignored
(only `.env.example` is committed).

## Hosting and domains (ADR-0010)
- **Hosting:** Cloudflare static assets via wrangler, assets only, no Worker script (`wrangler.jsonc`:
  `assets.directory ./dist`, `not_found_handling none`, `workers_dev false`, `preview_urls false`). Headers come
  from the generated `dist/_headers` (CSP with `connect-src 'none'` and `frame-ancestors`, Permissions-Policy,
  Referrer-Policy, COOP, HSTS, cache rules, and the `/sw.js` exception). `dist/.assetsignore` keeps `*.map` and
  `.vite` off the host.
- **`image-annotator.tarokit.app`:** production, a custom domain on the Worker `image-annotator`. DNS record and
  certificate are created by Cloudflare when the custom domain is attached (needs the `tarokit.app` zone in the same
  Cloudflare account). USER-OWNED.
- **`tarokit.app`:** the portal that embeds the tool, and the only allowed frame ancestor in production.
- **`staging.tarokit.app`:** the portal's temporary staging site (portal D-046), allowed to embed the staging tool only.

## External accounts and services (all USER-OWNED)
| Service | Purpose | Needed for | Cost |
|---|---|---|---|
| Cloudflare account with the `tarokit.app` zone | Hosting, custom domain, TLS | deploy | Free tier covers static assets |
| GitHub (`thanh-taro/image-annotator`) | Source link in the tool (F-016.R3); the repository should be public by launch | launch | none |
| Portal repo access (`taro-kit`) | The catalog entry and the frame grants | portal change | none |

No analytics, error-reporting, email, payment or storage service exists, by design (NFR-01).

## Portal repo dependency
- **Repo:** `taro-kit` (the portal), checked out next to the tools at `~/Documents/personals/taro-kit`.
- **Frame grants (already built):** the portal applied the change request in commit `4c4ae94` (its D-070 and D-071):
  `dialogs` permission, focus into the frame on the first ready signal, and the sandbox and `allow` attributes this
  tool needs. They must be **live before or together with the tool** (build plan, deploy notes); until then the spec
  fallbacks apply (F-015.R7) and downloads, the leave-page warning and focus-on-ready are missing.
- **Catalog entry (to do):** `content/tools/image-annotator.yaml`, drafted in `docs/deploy/catalog-entry.yaml`, with
  `openMode: embedded` and `permissions: [downloads, clipboard-write, popups, dialogs, file-pick]`.
- **Privacy and terms:** the portal serves its own `/privacy/` and `/terms/` (`content/privacy.yaml`,
  `content/terms.yaml`). The tool's drafts (`privacy-policy.md`, `terms.md`) are inputs for those pages or links
  from them after legal review.
- **Design tokens:** DEP-07, a copy of the portal's `tokens.json` pinned to portal commit `27ea733`; nothing to do
  at deploy time.
