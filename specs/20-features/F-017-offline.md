---
id: F-017
title: Work offline
status: draft
milestone: M-1
priority: P2
personas: [PER-01, PER-02]
entities: []
rules: []
screens: [SCR-Annotator]
components: []
nfr: [NFR-01]
events: []
depends_on: [F-015]
---

## Intent
The tool needs nothing from a server once loaded, so it should open and work without a
connection, like the portal promises for offline-capable tools (PRN-05).

## Scope
- In: opening and using every M-1 feature without a connection after one successful visit;
  picking up a new version on a later visit.
- Out: background updates or any request the user did not cause by opening the page (NFR-01).

## Requirements
- **R1** After the tool has stayed open with a connection until all its files are cached, the tool opens and every M-1 feature works with no connection, embedded or standalone.
- **R2** The tool makes no network requests of its own; it only checks for a new version when the page itself is being opened with a connection.
- **R3** A new version found while the tool is opening is used from the following open; an open session is never reloaded under the user.

## Acceptance criteria
- **AC1** Given the tool was opened once online, when it is opened with no connection, then it loads and the user can paste an image, draw an arrow, add a solid redaction and download the result. (R1)
- **AC2** Given the tool is open, when the user works for a whole session, then the network log shows only the tool's own files being cached, and using text, blur, pixelate and export for the first time causes no request. (R2)
- **AC3** Given a new version was published, when the user has the tool open, then nothing reloads; when the user opens it online once and then opens it again, then the new version is used. (R3)

## UX notes
No visible UI.

## Edge cases
- First visit offline → the browser's own offline page; nothing the tool can do.

## Open questions
