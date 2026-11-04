---
id: F-012
title: Copy and download the result
status: shipped
milestone: M-1
priority: P0
personas: [PER-01]
entities: [ENT-Session, ENT-Frame]
rules: [RULE-15, RULE-16, RULE-18, RULE-19, RULE-20]
screens: [SCR-Annotator]
components: [CMP-Toolbar, CMP-Notice]
nfr: [NFR-01, NFR-03, NFR-08]
events: []
depends_on: [F-001]
---

## Intent
The point of annotating is sharing: one action puts a clean, flattened image on the clipboard or
in a file, ready to paste into a ticket or chat (PRN-03), with nothing hidden left in it
(PRN-02).

## Scope
- In: copy to clipboard and download as PNG (RULE-15); flattening; stripping metadata (INV-03);
  the redaction count before and after export (RULE-20); fallbacks when the clipboard or export
  fails.
- Out: other formats (M-2), choosing a scale, sharing links (never, PRN-01).

## Requirements
- **R1** The user can copy the result to the clipboard as a PNG image, pasteable into other apps.
- **R2** The user can download the result as a PNG file named per RULE-15.
- **R3** The exported image is flattened: image, padding, annotations and effects in one picture, exactly the canvas (the frame plus its padding, RULE-15), at full resolution (RULE-15), with no metadata (INV-03) and nothing a redaction hides (INV-02).
- **R4** After a successful copy or download (RULE-15), the user is told it worked and, when there are any, how many redactions it contains (RULE-20); the session no longer counts as having unexported changes (RULE-18).
- **R5** If the clipboard refuses the image, the user is told and offered the download instead.
- **R6** Export never sends anything over the network (NFR-01) and leaves the session editable.
- **R7** If the export can't be produced, the user is told; the session is unchanged and still counts as unexported. An export whose redaction effects and fonts are not ready within 10 s counts as not produced.
- **R8** Before export, the current redaction count (RULE-20) is visible next to the export actions whenever it is at least 1.

## Acceptance criteria
- **AC1** Given an annotated image, when the user presses Mod+C (nothing being edited), then the clipboard holds a PNG that pastes into a chat app with every annotation visible. (R1)
- **AC2** Given an image opened from `login-bug.jpg`, when the user chooses COPY-action.download, then a file `login-bug-annotated.png` is saved. (R2)
- **AC3** Given a pasted image, when the user downloads at 14:05:09 on 27 Oct 2026, then the file is `annotated-20261027-140509.png`. (R2)
- **AC4** Given a JPEG with GPS location metadata, when it is annotated and exported, then the exported file contains no location, camera or date metadata. (R3)
- **AC5** Given a 2880 × 1800 image with no crop or padding, when exported, then the PNG is 2880 × 1800. (R3)
- **AC6** Given two solid and one blur redaction inside the frame, when the user copies, then COPY-export.copied_redactions with the count 3 is shown. (R4)
- **AC7** Given the clipboard refuses the write, when the user copies, then COPY-error.clipboard is shown with COPY-action.download. (R5)
- **AC8** Given the user copied, when they move an annotation and copy again, then the new copy reflects the move. (R6)
- **AC9** Given a full session, when exporting, then the network log shows no request. (R6)
- **AC10** Given one solid redaction, when the user downloads, then COPY-export.downloaded_redactions with count 1 is shown; with no redactions, COPY-export.downloaded is shown. (R4)
- **AC11** Given one redaction inside the frame and one entirely outside it, when the user looks at the toolbar, then COPY-export.redaction_count shows 1; after copying, the message says 1. (R4, R8)
- **AC12** Given no redactions, when the user looks at the toolbar, then no redaction count is shown. (R8)
- **AC13** Given the export fails to be produced, when the user downloads, then COPY-error.export_failed is shown, nothing is saved, and closing the tab still warns (F-014). (R7)

## UX notes
COPY-action.copy and COPY-action.download in CMP-Toolbar, with COPY-export.redaction_count next
to them; results in CMP-Notice: COPY-export.copied, COPY-export.copied_redactions,
COPY-export.downloaded, COPY-export.downloaded_redactions. While an export takes longer than
0.5 s, COPY-export.preparing shows.

## Edge cases
- Effects or fonts never become ready (a stuck worker) → after 10 s COPY-error.export_failed is shown and Copy and Download work again (R7).
- Embedded and the host hasn't granted clipboard writing (RULE-16), in browsers that enforce the grant (ADR-0021) → R5 applies.
- Some browsers re-encode a clipboard copy and add colour-space or size tags; these carry nothing from the source (INV-02, INV-03, ADR-0021). The downloaded file is exactly what the tool produced.
- Embedded and the host hasn't allowed downloads (RULE-16) → the browser blocks the file
  silently and the tool can't tell; this is why the host contract requires the grant.
- Export while a text is being edited → editing ends first and the text is included.

## Open questions
