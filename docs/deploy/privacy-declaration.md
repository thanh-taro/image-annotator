# Image Annotator: privacy declaration (release 1.0.0)

Source: the QA security audit (phase 5, `.build-my-app/reports/qa-security.md`; NFR-01, INV-03, INV-04, F-016,
F-017, RULE-16), updated for the 1.0.0 release candidate (ADR-0025 hardening). Use it for the portal catalog and the
release notes. The owner reviews it before it is published. Not legal advice; the policy drafts next to this file
are marked "DRAFT — needs legal review".

## Catalog entry (short)
**Privacy: no data collected.** Images open, are edited and are exported only in your browser. Nothing is
uploaded, stored, logged or tracked: no account, no cookies, no analytics, no third-party code. To work
offline, the tool keeps a copy of its own program files in your browser, never your images. Exported PNGs
contain no metadata from the original (no location, camera, date or colour profile). Blur and pixelate can
sometimes be reversed, so use solid redaction for secrets.

## Store-style data declaration
| Question | Answer |
|---|---|
| Data collected or transmitted (any category: contact, identifiers, location, usage, diagnostics, user content, …) | **None** |
| Data shared with third parties | None |
| Data used for tracking or advertising | No |
| Account or sign-in | None |
| Analytics, crash reporting, third-party SDKs at runtime | None. Runtime code is the tool's own plus Preact, @preact/signals, inlined Lucide icons and self-hosted Manrope / JetBrains Mono fonts, all served from the tool's origin |
| Cookies, localStorage, sessionStorage, IndexedDB | None |
| On-device storage | A service-worker registration and one Cache Storage entry (`image-annotator-v1`) holding only the tool's page and its hashed JS, CSS, font and worker files (about 0.3 MB). No image, annotation, file name, address query or identifier. Embedded in the portal it is a separate, partitioned copy. Removed with the site's data in browser settings |
| User content (images, annotations, text) | Kept only in the page's memory and its worker while the tab is open. Freed when replaced, on "Start over", and when the tab closes |
| Network | After the page opens, the page itself makes no requests: its content policy refuses every connection. The only requests are the browser fetching the tool's own files from its own origin to save the offline copy and, on each online open, checking for a new version. None carries user content (verified with full-session network logs, Chromium and WebKit) |
| Exports | Only when you ask: a PNG to the system clipboard (Copy) or to your downloads (Download). The PNG holds one flattened image and nothing else (IHDR/IDAT/IEND). A download's file name is the opened file's name plus `-annotated` (pasted images get a timestamp name) |
| Permissions used | Clipboard **write** only, on Copy (never reads the clipboard; pastes arrive as the browser's paste event). File picker and drag-and-drop on your action. Downloads. Every other powerful feature (camera, microphone, location, …) is denied by the tool's own Permissions-Policy |
| Embedding | Only the configured portal origin (`https://tarokit.app`) may embed the tool. It accepts only theme and language settings from that page, and sends it one "ready" signal with no content |
| Links that leave the tool | "Source code on GitHub" opens github.com in a new tab, only when clicked, with no referrer. "Open-source notices" opens a text file from the tool's own origin |

## Release notes paragraph
> **Privacy.** The Image Annotator runs entirely in your browser. Your images and annotations are never
> uploaded, stored or tracked. There are no accounts, cookies, analytics or third-party scripts, and the page
> blocks all network connections after it loads. For offline use, it keeps a copy of its own program files
> (not your images) in your browser. Exported PNGs carry no metadata from the original: no GPS location,
> camera details, dates, XMP or colour profiles. Solid redaction replaces the pixels completely. Blur and
> pixelate are marked "Not secure" because blurred text can sometimes be recovered.

## Caveats the owner should know before publishing
- **Safari, first visit, blur or pixelate (QA M1).** Found in QA: copy or download could fail if you used blur or
  pixelate right after the first visit. It failed safe (nothing unredacted was exported). ADR-0025 fixed it (the
  worker now loads through the offline copy, which is seeded earlier); it passes in Playwright WebKit. Real Safari
  is still on the owner's sign-off list (D-038), so keep the release-notes line until it is ticked.
- WebKit re-encodes clipboard images and adds its own colour-space and size tags. They hold nothing from the
  original. Downloads are byte-clean.
- The source file name appears in the downloaded file's name by design (RULE-15, with unsafe characters replaced).
  Mention this if the catalog promises "no metadata".
- Hosting: the tool's files are served by Cloudflare (static assets). Cloudflare, as the host, can see ordinary
  web-server request data (such as IP address and the files asked for) like any website; the tool itself sends no
  image data and has no analytics. The policy drafts say so; the owner confirms the wording with the host's terms.
