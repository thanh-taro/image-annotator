---
id: F-018
title: Use the portal's language
status: ready
milestone: M-1
priority: P1
personas: [PER-02, PER-01]
entities: []
rules: [RULE-07, RULE-15, RULE-16, RULE-17, RULE-20]
screens: [SCR-Annotator]
components: [CMP-Toolbar, CMP-StylePanel, CMP-StatusBar, CMP-EmptyState, CMP-Notice, CMP-ConfirmDialog, CMP-DropOverlay, CMP-ShortcutHelp, CMP-TextEditor]
nfr: [NFR-01, NFR-06, NFR-07, NFR-09]
events: []
depends_on: [F-015]
---

## Intent
The portal is used in English and Vietnamese. The tool should speak the portal's language so it
feels native (PRN-05), and pick a sensible one on its own when standalone.

## Scope
- In: every user-facing string (copy.md) in each supported language (RULE-17); the language the
  host passes in the address and later messages (RULE-16); the browser fallback; marking the page
  language; formatting numbers (zoom, sizes, counts).
- Out: the user's own text annotations (content, never translated); the product name; download
  file names (RULE-15); a language control inside the tool; languages other than en-US and vi-VN.

## Requirements
- **R1** The tool shows every user-facing string in the active language (RULE-17) from first display, with nothing shown first in another language, and marks the page with that language.
- **R2** When embedded, the tool follows later language messages from the host without reloading and without losing the image, annotations, selection, active tool, view or history (RULE-16).
- **R3** When the host passes no language, or an unsupported one, the tool picks the language per RULE-17.
- **R4** Language messages are accepted only from allowed host origins; messages from anywhere else, or with an unsupported value, are ignored (RULE-16, NFR-09).
- **R5** Exports, download file names and the user's text annotations are identical in every language (INV-05).
- **R6** Numbers shown to the user (zoom, pixel sizes, counts) are formatted the way the active language writes them; plural forms follow the active language. Step numbers in the image are plain digits (RULE-07, INV-05).
- **R7** Text in every supported language fits the layout down to 320 px wide without a horizontal scrollbar (NFR-07). UI text and the user's text annotations render in the tool's own typeface, including Vietnamese letters, which is part of the initial load (NFR-01).

## Acceptance criteria
- **AC1** Given the host opens the tool with language vi-VN in its address, when it first displays, then every user-facing string is the vi-VN text from copy.md, the page language is vi-VN, and nothing is shown first in English. (R1)
- **AC2** Given the tool is embedded in vi-VN with an annotated image, a selection and the arrow tool active, when the host sends a language message for en-US, then the UI switches to English without reloading, and the image, annotations, selection, tool, zoom and undo history are unchanged. (R2)
- **AC3** Given the tool is opened with no language in its address, when the browser's preferred languages are `[fr-FR, vi]`, then it shows vi-VN; when they are `[fr-FR]`, then it shows en-US. (R3)
- **AC4** Given the tool is embedded in vi-VN, when a language message arrives from an origin not in the allowed list, from anything other than the embedding page, or with an unsupported value, then the language stays vi-VN. (R4)
- **AC5** Given the same image and annotations, when exported in vi-VN and in en-US, then the files are byte-identical and have the same name. (R5)
- **AC6** Given vi-VN and a crop of 1920 × 1080 pixels, when the crop size shows, then numbers are written the Vietnamese way (`1.920 × 1.080`); in en-US `1,920 × 1,080`. (R6)
- **AC7** Given vi-VN at 320 px wide, when every state of SCR-Annotator is shown, then there is no horizontal scrollbar and no control label is clipped. (R7)
- **AC8** Given copy.md, when strings are generated, then every COPY ID has a text for every supported language with the same placeholders. (R1)
- **AC9** Given en-US and one redaction, when the user looks at the toolbar, then it reads `1 redaction`; with 3, `3 redactions`; in vi-VN the text has no plural change. (R6)
- **AC10** Given the tool was first opened online in en-US, when it is reopened offline in vi-VN and the user adds the text "Đường dẫn lỗi" and downloads, then every diacritic renders in the export and the network log shows no font request. (R7)

## UX notes
No language control in the tool; the host owns it (RULE-16). A live switch announces nothing and
does not move focus. Longer Vietnamese labels wrap or use their narrow variants.

## Edge cases
- `vi` or `vi-vn` in the address → vi-VN; `en-GB` → en-US (RULE-17).
- The same language arrives twice → applied with no visible change.
- A text annotation being edited during a switch → editing continues; only the UI changes.
- An open dialog, notice or progress during a switch → re-rendered in the new language; the
  pending choice or operation is unchanged.

## Open questions
