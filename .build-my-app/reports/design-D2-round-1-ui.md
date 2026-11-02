# Design D2 (FLOW-01): UI critique, round 1

Source: ui-critic agent (saved by the orchestrator). The six boards were rendered in headless Chrome (screenshots in the session scratchpad at r/*.png) and measured with getBoundingClientRect.
Verdict: the composition is sound. The image is centred at the fit size, the notice placement is correct, and the count pill sits next to Copy. Counts: 0 blocker, 2 major, 4 minor.

## Major
1. **Step 3 editor frame.** The text measures 322 inner units, but the frame was drawn at 330, so its padding is lopsided and the caret floats about 11 px past the last letter. Fix: draw the frame as an inline-block that hugs the text, with 4 px padding and a trailing caret.
2. **Focus ring.** Steps 1–5 draw a permanent 2 px accent ring around the work area. It competes with the image, is wrong for a pointer flow, and is wrong in step 3, where focus is in the editor. Fix: set `focus=False` on the flow boards.

## Minor
3. **Light-theme canvas edge.** The image against the work area is about 1.1:1, so the edge almost disappears. Fix: add a 1 px lineStrong outline on `.img`.
4. **Step 2 label.** The label says "rectangle, then arrow", but the rectangle step isn't shown. Fix: split the step into 2a (rectangle selected) and 2b, or relabel it.
5. **Field pairs.** Each label is spread away from its own input, so "Y" reads as the label for 1219. Fix: set `.fl` to flex-start with a 4 px gap, and use a wider column gap.
6. **Step 4/5 handles.** The selection handles touch the "API key for invoices" label. Fix: select the email redaction instead, or move the token field lower.
