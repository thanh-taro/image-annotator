---
id: F-016
title: Show the privacy guarantee
status: ready
milestone: M-1
priority: P1
personas: [PER-01]
entities: []
rules: []
screens: [SCR-Annotator]
components: [CMP-StatusBar]
nfr: [NFR-01, NFR-07]
events: []
depends_on: []
---

## Intent
Users only paste screenshots full of customer data into a tool they trust. Tell them plainly,
and make the claim true by construction (PRN-01, D-003).

## Scope
- In: a visible statement that images stay on the device, a short explanation (including that
  exports are stripped of metadata and that blur/pixelate are not secure), and a link to the
  source repository.
- Out: proving it in the UI (the guarantee itself is NFR-01).

## Requirements
- **R1** A short privacy statement is always visible.
- **R2** The user can open a brief explanation of what the tool does and does not do with their images.
- **R3** A link to the source repository (`https://github.com/thanh-taro/image-annotator`, D-009) is always visible next to the statement. It opens the repository in a new tab without sending a referrer and without changing the session.

## Acceptance criteria
- **AC1** Given the tool is open, when the user looks at the status area, then COPY-privacy.badge is visible. (R1)
- **AC2** Given the privacy statement, when the user activates it, then COPY-privacy.details is shown and can be dismissed. (R2)
- **AC3** Given the tool is open at 320 px and at desktop width (NFR-07), when the user looks at the status area, then a link named COPY-privacy.source_label is visible next to the privacy statement and points to `https://github.com/thanh-taro/image-annotator`, without horizontal scrolling. (R3)
- **AC4** Given the tool is open standalone with an annotated image, when the user activates the source link, then the repository opens in a new tab with no referrer, and the image, annotations and history are unchanged. (R3)

## UX notes
CMP-StatusBar holds COPY-privacy.badge; details open as a small popover ending with a
COPY-privacy.notices link to the open-source licence notices shipped with the tool.

## Edge cases
- Narrow widths → the statement shortens to an icon named COPY-privacy.badge_label and the
  source link to an icon named COPY-privacy.source_label.
- Embedded in a host frame that doesn't allow new tabs → the browser blocks the source and notices
  links; the tool does nothing else.

## Open questions
