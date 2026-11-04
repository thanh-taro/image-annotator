---
id: F-007
title: Redact part of the image
status: ready
milestone: M-1
priority: P0
personas: [PER-01]
entities: [ENT-Annotation, ENT-Style]
rules: [RULE-04, RULE-05, RULE-06, RULE-10, RULE-19, RULE-20]
screens: [SCR-Annotator]
components: [CMP-Toolbar, CMP-Canvas, CMP-StylePanel, CMP-Notice]
nfr: [NFR-02, NFR-08]
events: []
depends_on: [F-001]
---

## Intent
Users must hide emails, tokens and customer data before sharing, and trust that it is really
gone (PRN-02). Blur and pixelate look softer but can be reversed, so the tool says so.

## Scope
- In: rectangular redactions of three kinds, solid, blur and pixelate (RULE-10); honest labelling;
  the redaction count (RULE-20, shown by F-012).
- Out: free-form redaction shapes, finding sensitive text automatically.

## Requirements
- **R1** With the redaction tool, dragging (or clicking, RULE-05) creates a rectangular redaction of the current kind; Shift keeps it square (RULE-06); Enter places one at the centre of the view (RULE-19).
- **R2** A solid redaction is always fully opaque with hard edges, in a palette colour (default black); no path lowers its opacity, and it covers every pixel its box touches (INV-02).
- **R3** A blur or pixelate redaction obscures the image under it at the chosen strength (RULE-10), updating live while it is drawn, moved or resized.
- **R4** Choosing blur or pixelate always shows that it is not secure, and offers solid; solid is the kind when the tool is first used after the page opens.
- **R5** In the export, no covered pixel of a solid redaction carries original image values, and blur and pixelate never reveal what a solid redaction hides, whatever the drawing order (INV-02, RULE-10).
- **R6** A redaction can be changed between kinds and strengths after it is placed (F-008).

## Acceptance criteria
- **AC1** Given the redaction tool with kind solid, when the user drags over an email address, then a black opaque box covers it. (R1, R2)
- **AC2** Given a solid redaction and a rectangle selected, when the user looks at CMP-StylePanel, then there is no opacity or fill choice. (R2)
- **AC3** Given an image with text and a solid redaction over it with no annotation above it, when the result is exported, then every exported pixel inside the redaction box has exactly the redaction colour with full opacity. (R2, R5)
- **AC4** Given the redaction kind pixelate, strength M, on a 1000 × 800 image, when the user drags, then the area shows blocks of 16 × 16 image pixels, updating while dragging. (R3)
- **AC5** Given the redaction tool, when the user chooses blur or pixelate, then COPY-redact.not_secure is visible next to the choice and COPY-redact.use_solid is offered. (R4)
- **AC6** Given the tool was just opened, when the user picks the redaction tool, then its kind is solid. (R4)
- **AC7** Given a blur redaction over text, when the result is downloaded, then each pixel in the box equals the reference blur of the image there (defined in the architecture) within ±1 per channel, and the file holds one image and no extra data blocks (INV-02). (R3, R5)
- **AC8** Given a selected pixelate redaction, when the user switches its kind to solid, then it becomes an opaque box in the redact tool's current solid colour. (R6)
- **AC9** Given an arrow and a later blur redaction over part of it, when exported, then inside the blur box the pixels equal the reference blur of the image alone (the arrow does not appear in or tint the blur) and the arrow outside the box is unchanged; after the blur is sent behind the arrow, the arrow is drawn over the blur. (R3)
- **AC10** Given a solid redaction over an email and a blur redaction placed later over half of it and brought to the front, when exported, then every pixel inside the solid box is the solid colour. (R5)
- **AC11** Given a solid redaction whose left edge was drawn at x = 10.4 at 33 % zoom, when exported, then pixel column 10 inside its box is entirely the redaction colour. (R2)
- **AC12** Given the redaction tool and canvas focus, when the user presses Enter, then a default-size redaction of the current kind appears at the centre of the view and is selected. (R1)
- **AC13** Given a 1000 × 500 image cropped to 400 × 200 with padding M on white and a blur redaction spanning the frame's left edge, when exported, then the part of the box in the padding is white and no exported pixel depends on image pixels outside the frame. (R3)

## UX notes
COPY-tool.redact in CMP-Toolbar. Kind choice in CMP-StylePanel: COPY-redact.solid,
COPY-redact.blur, COPY-redact.pixelate, with strengths COPY-style.strength. The not-secure
warning (COPY-redact.not_secure) appears inline in CMP-StylePanel, not as a dialog.

## Edge cases
- A redaction partly outside the frame (e.g. over the padding) → only the part inside the frame
  is blurred or pixelated, sampling only pixels inside the frame; the solid kind covers its whole box.
- Very small blur boxes (under 4 image pixels) → still blurred using the surrounding pixels
  (with solid redactions already applied).

## Open questions
