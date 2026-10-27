# Portal change request — Image Annotator frame (D-006)

Status: draft for the portal owner. Nothing has been sent; the owner files it.

The Image Annotator is embedded like the other taro-kit tools (same settings contract: theme and
language in the address and in settings messages; the tool sends only `taro:ready`). It needs
these frame settings on its iframe:

| Need | Frame setting | Why | Fallback until granted |
|---|---|---|---|
| Downloads | `sandbox` includes `allow-downloads` | Download (F-012.R2). Without it the browser blocks the file silently, and the tool can't detect it. | Copy to clipboard; open the tool standalone |
| Clipboard writing | `allow="clipboard-write"` | Copy PNG (F-012.R1). Already granted to the siblings. | Download |
| Leave-page dialog | `sandbox` includes `allow-modals` | Warning before losing unexported work (F-014.R1); browsers suppress it in sandboxed frames otherwise. | Warning works standalone only |
| Focus after ready | After receiving `taro:ready`, the portal calls `iframe.focus()` (or `contentWindow.focus()`) | Paste is the main input (F-001.R1, R9); the paste key only reaches a focused frame. | Empty state shows "Click here, then press Ctrl+V to paste" |
| New tabs (optional) | `sandbox` includes `allow-popups` (+ `allow-popups-to-escape-sandbox`) | Source code and licence notice links (F-016.R3). | Links work standalone only |

Not needed: `clipboard-read` (paste uses the paste event), camera, microphone, geolocation.
Allowed host origins for the tool's `frame-ancestors` and message checks: same as the siblings.
