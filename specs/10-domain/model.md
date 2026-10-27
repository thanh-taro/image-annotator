# Domain model

M-1 stores nothing between sessions (PRN-01); every entity lives only in memory.
Coordinates and sizes are in **image pixels** (1 unit = 1 pixel of the image at full
resolution), with the origin at the image's top-left corner. Coordinates inside the padding
are negative or beyond the image's size; they are never clamped to the image. The view
(INV-05) never changes them.

### ENT-Session — Session
Everything the user works on, from loading an image until it is replaced, cleared, or the page
closes.
- `image` — the ENT-Image, or none (empty state).
- `annotations` — ordered list of ENT-Annotation; later items are drawn on top (except as
  RULE-10 says for redactions).
- `frame` — the ENT-Frame (what is exported).
- `padding` — the ENT-Padding around the image.
- `history` — undoable changes (RULE-11).
- `unexported` — see RULE-18.

The **current style** (one ENT-Style per tool, RULE-04) belongs to the open page, not to the
session: it starts at the defaults when the page opens and is kept when a new image is loaded.

### ENT-Image — Image
- `width`, `height` — in pixels, after orientation is applied (RULE-03) and after any scale-down
  the user accepted (RULE-02).
- `pixels` — the decoded picture in sRGB (INV-03); never modified (INV-01).
- `sourceName` — file name if opened from a file, otherwise none.
- `sourceType` — one of the formats in RULE-01.

### ENT-Annotation — Annotation
- `id` — unique within the session.
- `kind` — `rectangle`, `ellipse`, `line`, `arrow`, `stroke`, `highlight`, `text`, `step`,
  `redaction`.
- `geometry` — by kind: a box (`x`, `y`, `width`, `height`) for rectangle, ellipse and
  redaction; two end points (`tail`, `head`) for line and arrow; a list of points for stroke and
  highlight; a top-left anchor for text, whose box is derived from its content (RULE-08); a
  centre point for step.
- `style` — ENT-Style.
- `text` — for `text` only (RULE-08).
- `number` — for `step` only (RULE-07).

### ENT-Style — Style
- `color` — one of the palette colours (RULE-04).
- `strokeSize` — `S`, `M` or `L` (RULE-04); for text and steps it sets the text size.
- `fill` — `none`, `solid` or `translucent` (rectangle and ellipse only, RULE-04).
- `redactionKind` — `solid`, `blur` or `pixelate` (redaction only, RULE-10).
- `strength` — `S`, `M` or `L` (blur and pixelate redactions only, RULE-10).

### ENT-Frame — Frame
The part of the canvas that is exported.
- `x`, `y`, `width`, `height` — whole image pixels, within the canvas (RULE-13); `x`, `y` are
  negative when the frame starts in the padding. Default: the whole canvas.

### ENT-Padding — Padding
- `size` — `none`, `S`, `M` or `L` (RULE-14).
- `background` — `transparent` or a palette colour, for the whole canvas (RULE-14).

## Invariants

- **INV-01** — The image's pixels are never changed. Annotations, crop and padding are kept
  separately and only combined at export (PRN-04).
- **INV-02** — A redaction covers every image pixel its box touches (its box is extended
  outward to whole pixels). In an export, no covered pixel of a solid redaction carries any
  value derived from the original image: it has the redaction's colour, fully opaque, except
  where a shape, stroke, highlight, text or step later in drawing order is drawn over it, and
  that is drawn over the redaction colour. Blur and pixelate never show or sample pixels under
  a solid redaction (RULE-10). The exported file holds exactly one flattened picture: no extra
  frames, layers, thumbnails, or data blocks (PRN-02).
- **INV-03** — An exported image contains no metadata from the source file (location, camera,
  dates, comments, colour profiles or thumbnails). Pixels are converted to sRGB when the image
  is loaded, so dropping the colour profile does not change how colours look.
- **INV-04** — Images and annotations never leave the device and are never written to storage
  that outlives the page, except the file or clipboard copy the user explicitly exports. The
  browser's own temporary paging of in-memory data, discarded when the page closes, does not
  count (PRN-01, NFR-01).
- **INV-05** — The view (zoom, pan), the theme and the language never change the exported image.
