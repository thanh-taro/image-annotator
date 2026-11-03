---
id: F-015
title: Fit into the host portal
status: building
milestone: M-1
priority: P0
personas: [PER-02, PER-01]
entities: []
rules: [RULE-16]
screens: [SCR-Annotator]
components: []
nfr: [NFR-01, NFR-05, NFR-07, NFR-09]
events: []
depends_on: []
---

## Intent
Feel like a native part of the portal when embedded, and work fully on its own (PRN-05).

## Scope
- In: theme (light/dark) following the host or the system; filling the space the host gives;
  running standalone; accepting messages only from the trusted host.
- Out: sharing images or annotations with the host (PRN-01); the host's own navigation; the
  language the host passes (F-018).

## Requirements
- **R1** When embedded, the tool uses the initial theme the host passes in its address from first display (no flash of the wrong theme), and follows later theme messages (RULE-16).
- **R2** When standalone, the tool follows the device's light/dark preference.
- **R3** The tool fills the area the host gives it and adapts when that area changes size.
- **R4** Only allowed host origins (RULE-16) can embed the tool; settings messages from any other origin are ignored.
- **R5** The only message the tool sends to the host is the ready signal; it never contains image or annotation content (INV-04, RULE-16).
- **R6** The tool works completely when opened standalone.
- **R7** When embedded, the tool relies on the host frame's grants (RULE-16): downloads, clipboard writing and leave-page dialogs, and the host moving focus into the tool after the ready signal; opening new tabs is optional. Without the clipboard grant F-012.R5 applies; without focus F-001.R9 applies; without the download or leave-page grants the browser blocks them silently and the tool can't detect it, which is why the host contract requires them. Some browsers never show the leave-page warning from an embedded tool (F-014 edge case, D-028), and some allow clipboard writing without the grant (AC10); ADR-0021 lists which.

## Acceptance criteria
- **AC1** Given the host opens the tool with theme dark in its address, when the tool first displays, then it shows the dark theme with nothing shown first in the light theme. (R1)
- **AC2** Given the tool is embedded in light theme with an annotated image, when the host switches to dark, then the tool switches to dark without reloading or losing the image, annotations or history. (R1)
- **AC3** Given the tool is opened standalone on a device set to dark, when it loads, then it shows the dark theme. (R2)
- **AC4** Given the tool is embedded, when the host area is resized, then the tool fills the new area without a page scrollbar of its own. (R3)
- **AC5** Given a settings message from an origin not in the allowed list, or from anything other than the embedding page, when it arrives, then it is ignored. (R4)
- **AC6** Given the tool is embedded and the user uses every M-1 feature, when messages to the host are observed, then the only one is the ready signal, with no content. (R5)
- **AC7** Given the tool is opened standalone, when the user uses every M-1 feature, then each works as specified. (R6)
- **AC8** Given a page whose origin is not in the allowed list, when it tries to embed the tool, then the browser refuses to display the tool inside it. (R4)
- **AC9** Given the tool embedded in a host frame with all grants, when the user downloads and copies, then the file is saved and the clipboard holds the image. (R7)
- **AC10** Given the tool embedded in a host frame without the clipboard grant, in a browser that enforces that grant (ADR-0021), when the user copies, then COPY-error.clipboard is shown with COPY-action.download. (R7)

## UX notes
No theme control when embedded; the host owns it. SCR-Annotator shows no title of its own when
embedded (the host shows it).

## Edge cases
- Host sends an unknown theme value → keep the current theme.
- Host never sends a theme → follow the device preference.
- The theme never changes annotation colours or the export (INV-05).
- The host hasn't moved focus into the tool → a paste goes to the host page, not the tool, until focus moves into the tool (a click, or Tab from the host; F-001.R9).

## Open questions
