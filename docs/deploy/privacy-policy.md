# Image Annotator: privacy policy

> **DRAFT — needs legal review.** Written from the QA security audit and the privacy declaration
> (`docs/deploy/privacy-declaration.md`). It is not legal advice and is not published. The owner, with a
> lawyer if the tool is offered beyond a personal project, reviews it before it is linked from the portal.
> Placeholders in [square brackets] need the owner's input.

Last updated: [date of publication]

## The short version
The Image Annotator does not collect your data. Your images and annotations stay in your browser. There are no
accounts, no cookies, no analytics, no advertising and no third-party code.

## What the tool does with your images
- You open an image by pasting, dropping or choosing a file. It is read and edited only in your browser's
  memory, and in a background worker of the same page. It is never uploaded.
- Nothing you add (annotations, text, redactions) is saved. When you close the tab, replace the image or choose
  "Start over", it is gone.
- When you choose Copy or Download, the finished picture goes only to your clipboard or your downloads folder. The
  PNG holds one flat image and no metadata from the original, such as location, camera, date or colour profile.
  The downloaded file's name is your file's name with "-annotated" added.
- Blur and pixelate can sometimes be reversed. Use solid redaction for secrets.

## What the tool keeps in your browser
To work offline, the tool keeps a copy of its own program files (its page, scripts, styles, fonts and notices; about
0.3 MB) in your browser's cache storage, with a small background worker that serves them. It never stores your images,
annotations, file names or any identifier. When the tool is embedded in TaroKit, this copy is separate from the one
used when you open the tool on its own. Clear the site's data in your browser settings to remove it.

The tool uses no cookies, local storage, session storage or IndexedDB.

## Network
After the page opens, it makes no requests of its own: the page's content security policy refuses every connection.
The only requests are your browser fetching the tool's own files from its own address, to keep the offline copy and
to check for a new version when you open the tool online. They carry no image data.

## Who can see what
- **The host (hosting provider).** The tool's files are served by [Cloudflare, static assets]. Like any website, the
  host and its network may log ordinary request data, such as your IP address, the time, the browser type and the
  address of the file requested. This is outside the tool's code, and the tool does not read or use it. See the
  provider's own privacy notice: [link to be confirmed].
- **The TaroKit portal.** When the tool is embedded, the portal tells it your theme and language, and the tool tells
  the portal only that it is ready. No image or annotation reaches the portal. The portal's own privacy policy
  applies to the portal page.
- **GitHub.** The "Source code on GitHub" link opens github.com in a new tab only when you click it, without sending
  a referrer. GitHub's privacy policy applies from there.
- **No one else.** No analytics, advertising, tracking, crash-reporting or other third-party service receives data.

## Permissions
The tool writes to the clipboard only when you choose Copy, and never reads it (a paste reaches the tool as your
browser's paste action). It uses the file picker and drag-and-drop on your action, and downloads when you choose
Download. Camera, microphone, location and similar features are blocked by the tool's own policy.

## Children
[Owner to confirm the age statement for the suite, in line with the portal's policy.]

## Changes
If this policy changes, the new text and date will be published at [policy address]. [Owner to decide how changes
are announced.]

## Contact
[Support or contact address, to be set by the owner.]
