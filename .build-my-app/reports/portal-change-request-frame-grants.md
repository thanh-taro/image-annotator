# Change request for the taro-kit portal — frame grants for the Image Annotator

Requested by: Image Annotator (image-annotator.tarokit.app), decision D-006 (2026-10-27).
Not sent anywhere. Apply it in the taro-kit project with `/build-my-app:change`, which puts it
through the portal's own spec process first.

## Why
The Image Annotator is embedded like the other taro-kit tools and uses the same settings
contract: theme and language arrive in the address and in settings messages, and the tool sends
only `taro:ready`. It also depends on four things the portal's frame decides, and without them
three of its core features fail with no visible sign:
- **Downloads:** the browser blocks the file silently, and the tool can't detect it.
- **Leave-page warning:** browsers suppress the "Leave site?" prompt in sandboxed frames, so
  unexported annotations are lost with no warning.
- **Paste (the main way to load a screenshot):** Ctrl/⌘+V only reaches a frame that has keyboard
  focus, and a cross-origin frame can't take focus by itself.

## Proposed spec change (taro-kit)
For the embedded tool frame (where the portal currently grants `clipboard-write` to the
siblings):
- New requirement: *For the Image Annotator, the portal's frame allows downloads, clipboard
  writing and leave-page dialogs.*
- New requirement: *After an embedded tool sends its ready signal, the portal moves keyboard
  focus into the tool's frame.* Recommended for every tool.
- Optional: *The frame allows opening new tabs*, for the source-code and licence links.
- New ACs:
  - *Given the Image Annotator is embedded, when the user downloads an annotated image, then
    the file is saved.*
  - *Given unexported changes in the embedded Image Annotator, when the user closes the tab,
    then the browser asks whether to leave.*
  - *Given the Image Annotator has just opened in the portal, when the user presses Ctrl/⌘+V
    with a screenshot on the clipboard, then the screenshot loads without a click first.*

## Technical hints (portal's 40-technical)
| Need | Frame setting |
|---|---|
| Downloads | `sandbox` includes `allow-downloads` |
| Clipboard writing | `allow="clipboard-write"` (already granted to siblings) |
| Leave-page dialog | `sandbox` includes `allow-modals` |
| Focus after ready | on `taro:ready` from the tool's origin, call `iframe.focus()` |
| New tabs (optional) | `sandbox` includes `allow-popups allow-popups-to-escape-sandbox` |

Not needed: `clipboard-read` (paste uses the paste event), camera, microphone, geolocation.

## Until it lands (tool-side fallbacks)
- No focus → the empty state says "Click here, then press Ctrl+V to paste" (F-001.R9).
- No clipboard grant → copy offers download instead (F-012.R5).
- No downloads or leave-page grant → these only work when the tool is opened standalone.

## Findings from spike SP-host (2026-11-02)
- Without focus after ready, Ctrl/⌘+V goes to the **portal page**: the portal receives the user's pasted screenshot instead of the tool. This is one more reason to move focus into the frame after `taro:ready`.
- WebKit (Safari) never shows the leave-page warning from a cross-origin frame, even with `allow-modals`. `allow-modals` still matters for Chromium and Firefox. The tool accepts this gap for now (D-028), so no portal-side warning is requested.
- WebKit allows clipboard writing in the frame without `clipboard-write`. Keep the grant for Chromium.
