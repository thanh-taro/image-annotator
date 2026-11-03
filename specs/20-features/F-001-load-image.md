---
id: F-001
title: Load an image
status: ready
milestone: M-1
priority: P0
personas: [PER-01]
entities: [ENT-Session, ENT-Image]
rules: [RULE-01, RULE-02, RULE-03, RULE-16, RULE-18, RULE-19]
screens: [SCR-Annotator]
components: [CMP-EmptyState, CMP-DropOverlay, CMP-Toolbar, CMP-ConfirmDialog, CMP-Notice]
nfr: [NFR-01, NFR-03, NFR-04]
events: []
depends_on: []
---

## Intent
Getting the screenshot in must take one gesture: paste it, drop it, or pick a file (PRN-03).
Nothing is uploaded; the image is decoded on the device (PRN-01).

## Scope
- In: pasting an image from the clipboard; dropping a file; picking a file; replacing the
  current image; formats, size limits and orientation (RULE-01, RULE-02, RULE-03); getting
  keyboard focus when embedded.
- Out: screen capture, several images per session, HEIC and images beyond the limits without
  scaling down (M-2).

## Requirements
- **R1** Pasting an image (Mod+V, RULE-19) while the tool has focus and no text is being edited loads it.
- **R2** Dropping an image file onto the tool loads it; while a file is dragged over the tool, it shows where to drop.
- **R3** The user can pick an image file from the device and load it.
- **R4** Only supported input loads (RULE-01); refused input leaves the current session unchanged and tells the user why. Links and web images without image data are never fetched.
- **R5** Size limits apply (RULE-02): too-large files are refused; images over the pixel limits offer to open scaled down or cancel.
- **R6** The loaded image appears in its recorded orientation (RULE-03), fitted to the view.
- **R7** Input is checked first (format, size, scale-down choice); only input that would load can replace the current image. Replacing while the session has unexported changes (RULE-18) asks the user to confirm; without them it replaces at once. Replacing starts a new session (ENT-Session).
- **R8** When no image is loaded, the tool explains the three ways to load one.
- **R9** When embedded, the tool gets keyboard focus from the host after it is ready (RULE-16); if it has no focus, the empty state asks the user to click before pasting, and a click anywhere in the tool gives it focus. The tool never takes focus from the host by itself.

## Acceptance criteria
- **AC1** Given the empty state with the tool focused, when the user pastes a PNG screenshot from the clipboard, then the image is shown fitted to the view at its full resolution. (R1, R6)
- **AC2** Given the empty state, when the user drags a JPEG file over the tool, then CMP-DropOverlay shows COPY-load.drop_here; when they drop it, then the image loads. (R2)
- **AC3** Given the empty state, when the user chooses COPY-action.open and picks a WebP file, then the image loads. (R3)
- **AC4** Given an image is loaded, when the user pastes plain text (no image), then nothing changes and COPY-load.no_image_in_clipboard is shown. (R1, R4)
- **AC5** Given an image is loaded, when the user drops a PDF or a HEIC file, then the session is unchanged and COPY-error.unsupported_format is shown. (R4)
- **AC6** Given the empty state, when the user drops a file of 60 MB, then it is refused with COPY-error.file_too_large and the session is unchanged. (R5)
- **AC7** Given the empty state, when the user loads a 6000 × 3400 image (20.4 million pixels), then CMP-ConfirmDialog offers COPY-load.scale_down with the resulting size, and COPY-action.cancel; choosing to scale down loads it at 5441 × 3083 (within RULE-02); cancelling leaves the session unchanged. (R5)
- **AC8** Given a JPEG photo whose metadata says it is rotated 90°, when it loads, then it is shown upright with width and height swapped. (R6)
- **AC9** Given an image with annotations that have not been exported, when the user pastes another image, then CMP-ConfirmDialog shows COPY-confirm.replace; confirming loads the new image with no annotations and an empty history; cancelling keeps everything. (R7)
- **AC10** Given an image was just exported and nothing changed since, when the user pastes another image, then it replaces the current one without asking. (R7)
- **AC11** Given no image is loaded, when the tool opens standalone, then CMP-EmptyState shows COPY-load.empty_title and COPY-load.empty_hint naming paste, drop and open. (R8)
- **AC12** Given the empty state, when the user drops three image files at once, then the first loads and COPY-load.first_only is shown. (R4)
- **AC13** Given a file that claims to be PNG but can't be decoded, when it is dropped, then COPY-error.decode_failed is shown and the session is unchanged. (R4)
- **AC14** Given unexported changes, when the user drops a PDF, then COPY-error.unsupported_format is shown and no replace confirmation appears. (R7)
- **AC15** Given the clipboard holds only a web page fragment referring to a remote image, when the user pastes, then COPY-load.no_image_in_clipboard is shown and the network log shows no request. (R4)
- **AC16** Given the tool is embedded and the host has not moved focus into it, when the empty state shows, then it shows COPY-load.click_to_paste; when the user clicks it and presses Mod+V with an image on the clipboard, then the image loads. (R9)
- **AC17** Given the tool is embedded, when it sends the ready signal and the host moves focus into it, then pressing Mod+V with an image on the clipboard loads it without a click. (R9)

## UX notes
Entry points: CMP-EmptyState (paste hint, drop target, COPY-action.open), CMP-Toolbar
COPY-action.open at any time, keyboard paste, drop anywhere on SCR-Annotator. Messages use
CMP-Notice; decoding longer than 0.5 s shows COPY-load.loading.

## Edge cases
- Clipboard holds both an image and text → the image is used.
- Paste while editing text → pastes the text into the text annotation, never loads an image.
- Animated GIF → first frame only (RULE-01), no message.
- Transparent PNG → transparency kept (shown over a checkerboard on screen, transparent in export).
- A drop that holds no files (only folders) → refused with COPY-error.unsupported_format.
- A drop or paste with several files → the first file that passes RULE-01 loads, with COPY-load.first_only; if none passes, the first file's refusal message shows.
- A paste, drop or open that arrives while an image is loading or a dialog is open → ignored.

## Open questions
