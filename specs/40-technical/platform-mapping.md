# Platform mapping

How the neutral wording of the specs maps to concrete browser platform features. Targets: the latest
two versions of the Chromium-, Gecko- and WebKit-based desktop browsers, plus single-finger drawing
on the latest WebKit- and Chromium-based tablet browsers (NFR-07), embedded in the portal's frame and
standalone. Items marked (spike) are confirmed by the spikes in `architecture.md`.

## Getting images in
| Spec wording | Platform mapping | Notes / fallback |
|---|---|---|
| Paste an image (F-001.R1) | `paste` listener on the document; only `clipboardData.files` / items of kind `file` with an `image/*` type; keydown Mod+V is not prevented | HTML/URI items never parsed or fetched (F-001.AC15); no `clipboard-read` permission. No focus in a frame → COPY-load.click_to_paste (F-001.R9) |
| Drop a file (F-001.R2) | `dragenter`/`dragover`/`drop`; CMP-DropOverlay only when `dataTransfer.types` contains `Files`; `webkitGetAsEntry()` to skip folders; first image only (COPY-load.first_only) | Non-file drags ignored |
| Pick a file (F-001.R3) | Hidden `<input type="file">` opened by the open action or Mod+O (keydown is a user activation) | `accept` is a hint only; magic bytes decide (spike SP-host checks tablet pickers that convert formats) |
| File too large (RULE-02) | `File.size` > 50,000,000 before any read | COPY-error.file_too_large |
| Supported formats (RULE-01) | Magic bytes of `file.slice(0, 64)`; AVIF only if the start-up capability probe decoded | COPY-error.unsupported_format; MIME type and extension ignored |
| Decode, orientation applied (RULE-03) | `createImageBitmap(file, { imageOrientation: 'from-image', colorSpaceConversion: 'default' })` | Rejection → COPY-error.decode_failed (D-024); fallback `<img>` + `decode()` + `img-src blob:` (spike SP-decode) |
| Converted to sRGB (INV-03) | Every canvas `colorSpace: 'srgb'`; `getImageData(..., { colorSpace: 'srgb' })` | Verified with a P3 fixture (spike SP-decode) |
| Image / canvas ≤ 16,777,216 px, ≤ 16,384 per side (RULE-02) | Checked on the bitmap's size; matches WebKit's 16.7 MP canvas area cap; display canvas is viewport-sized, export canvas ≤ the canvas | Spike SP-large-image on iPad |
| Open scaled down (RULE-02) | `createImageBitmap(bitmap, { resizeWidth, resizeHeight, resizeQuality: 'high' })`, then `bitmap.close()` | Sides rounded down |
| Memory released on replace (NFR-04) | `ImageBitmap.close()`; worker drops its buffer; patch cache cleared | |

## Drawing and the view
| Spec wording | Platform mapping | Notes |
|---|---|---|
| Show image, padding, annotations (CMP-Canvas) | One `<canvas>` sized to its box × `devicePixelRatio` (cap 2), repainted on `requestAnimationFrame` by MOD-Render | `ResizeObserver` for the box |
| One finger draws, two pan/zoom (CMP-Canvas, F-002.R3/R4) | Pointer Events, `touch-action: none`, `setPointerCapture`; two active touch pointers → pan/zoom; `wheel` with `ctrlKey` for trackpad pinch and Mod+wheel | Pinch polish is M-2 (NFR-07) |
| Pan by scrolling / Space+drag (F-002.R4) | `wheel` without modifiers pans; Space held on keydown switches the pointer machine to pan | |
| Crisp pixels when zoomed (A5) | `imageSmoothingEnabled = false` at zoom ≥ 200 % on screen only | Export unaffected (INV-05) |
| Custom colour (F-019.R1/R8, RULE-21) | The colour group is an ARIA radio group with a roving tabindex (the custom swatch is its ninth `role="radio"`), so an option is checked only when a colour is applied; clicking the custom swatch, or Enter/Space on it, opens a visually hidden `<input type="color">` with `showPicker()` (fallback `click()`); arrow keys never open it. `input` events preview and chain into one undo step; `change` or focus leaving ends the chain; a `cancel` event, where the browser fires one, restores the colour from before the swatch was chosen, otherwise closing counts as closing without a choice | The input reports lowercase `#rrggbb` sRGB; compared with the palette's `annotation.color.*` token values ignoring case; shown uppercase in the accessible name |
| Size field and slider (F-019.R3/R5) | `<input type="number" inputmode="numeric">` applied on Enter/blur; `<input type="range">` (wide layout) applied on `input`, chained into one undo step until `change` | `aria-valuetext` uses COPY-style.size_value |
| Highlight without self-darkening (RULE-09) | One path stroked once with `globalAlpha = 0.4` | |
| Solid redaction hard edges (INV-02) | `fillRect` on the outward-rounded integer box, no antialiasing at 1:1 | |
| Blur / pixelate (RULE-10) | Own integer algorithm in a module `Worker`, transferable buffers, `ImageBitmap` patches; GPU approximation while dragging via scaled `drawImage` | WebGL if too slow (spike SP-blur) |
| Text in the tool's face (RULE-08) | `@font-face` + `document.fonts.load` before drawing is enabled; `fillText`/`strokeText` with `600 <size>px Manrope` | Spike SP-text |
| Text editing (CMP-TextEditor, F-005.R2) | `<textarea>` overlay with transparent text, positioned via CSSOM; `beforeinput` for the 2,000-code-point limit; `compositionend` for input methods | Native undo inside the field (RULE-19) |
| Letter keys by layout (RULE-19) | `event.key` if a Latin letter, else `event.code`; Shift+1/0 by `code`; `?`, `[`, `]`, `=`, `-` by `key` | Mod = Meta on macOS, else Ctrl |
| Narrow layout, bottom sheet (D-014, D-019) | CSS container queries on the tool root (≥ 1000 / 800–999 / < 800 px); the summary bar is a `<button aria-expanded>`; MOD-Canvas gets the sheet height as a bottom inset | Down to 320 px (NFR-07) |

## Getting results out
| Spec wording | Platform mapping | Notes / fallback |
|---|---|---|
| Flattened, one pixel per image pixel (RULE-15, F-012.R3) | Unattached `<canvas>` of the canvas size, `colorSpace: 'srgb'`, same `paint()` at 1:1 | Waits for exact patches and fonts |
| No metadata, one image (INV-02, INV-03) | `canvas.toBlob(cb, 'image/png')` + chunk whitelist IHDR/PLTE/tRNS/IDAT/IEND | Own encoder via `CompressionStream('deflate')` or fflate (spike SP-png-export) |
| Copy as PNG (F-012.R1) | `navigator.clipboard.write([new ClipboardItem({ 'image/png': promise })])` created synchronously in the click/keydown | Needs a secure context and `clipboard-write` in the frame in browsers that enforce the grant (ADR-0021: WebKit doesn't); refusal (`NotAllowedError`, no `ClipboardItem`) → COPY-error.clipboard + download (F-012.R5) |
| Mod+C copies (RULE-19) | Handled on `keydown` when `getSelection()` is collapsed and focus is not in a field | Not on the `copy` event |
| Download with a file name (F-012.R2, RULE-15) | `<a download="name">` + `URL.createObjectURL(blob)`, revoked after the click; name from local time for pasted images | Needs `allow-downloads` in the frame (RULE-16) |
| Leave-page warning (F-014.R1) | `beforeunload` with `preventDefault()` only while unexported | Needs `allow-modals` in the frame |
| Confirmation dialogs (CMP-ConfirmDialog, CMP-ShortcutHelp) | Native `<dialog>` with `showModal()` (inert background, focus return) | |

## Host integration
| Spec wording | Platform mapping | Notes |
|---|---|---|
| Initial theme and language in the address (RULE-16, RULE-17) | `URLSearchParams(location.search)` read by an inline, CSP-hashed script in `<head>`; sets `<html data-theme>` and `<html lang>` before first paint; language falls back to `navigator.languages` | F-015.R1, F-018.R1 |
| Later settings messages (RULE-16) | `window.addEventListener('message')`; accept only `event.origin` in the allow-list **and** `event.source === window.parent`; `{ type: 'taro:theme' \| 'taro:language', value }`; unknown values ignored | F-015.R4, F-018.R4 |
| Ready signal (RULE-16) | `window.parent.postMessage({ type: 'taro:ready' }, allowListedOrigin)`, never `'*'`, never content; the only message out | F-015.R5 |
| Focus from the host (F-001.R9) | The tool never calls `focus()` to take focus from the host; `document.hasFocus()` + `focus`/`blur` events drive the click-to-paste hint | |
| Who may embed (NFR-09) | Response header `Content-Security-Policy: frame-ancestors <allow-list>` (empty → `'none'`) | Header only |
| Embedded vs standalone | `window.top !== window.self` in try/catch | PRN-05 |
| Fill the host area (F-015.R3) | `html, body, #app { height: 100% }`, internal layout; `ResizeObserver` for the canvas | No sizing messages |
| Numbers and plurals in the active language (F-018.R6) | `Intl.NumberFormat(activeLanguage)`, `Intl.PluralRules(activeLanguage)` | vi-VN `1.920 × 1.080` |

## Privacy and policy
| Spec wording | Platform mapping |
|---|---|
| No outgoing connections after load (NFR-01) | CSP `connect-src 'none'`; lint ban on `fetch`/`XMLHttpRequest`/`WebSocket`/`EventSource`/`sendBeacon`/`new Image()`/`innerHTML`; e2e server-side request log; a test `fetch` to another origin is refused |
| Nothing persisted (INV-04) | No `localStorage`/`sessionStorage`/`indexedDB`/cookies (lint-banned); Cache Storage only in `sw.js` with the tool's own files (ADR-0011) |
| Links and web images never fetched (RULE-01) | Paste and drop read only `File` objects; no `<img>` from pasted HTML |
| No WebAssembly (ADR-0010) | CSP omits `'wasm-unsafe-eval'` |
| Source link (F-016.R3) | `<a target="_blank" rel="noopener noreferrer">`; opening a tab is optional in the frame (RULE-16) |

## Offline (F-017)
| Spec wording | Platform mapping | Notes |
|---|---|---|
| Works offline after one visit (F-017.R1) | `navigator.serviceWorker.register('/sw.js', { updateViaCache: 'all' })` after first render; the page posts every loaded same-origin URL once fonts and the worker have loaded | Registration permitted in the frame (`allow-same-origin`); failure → online-only |
| Nothing fetched on first use (NFR-01) | No dynamic `import()`; the effects worker starts right after first render; both font subsets load at startup | Build gate fails on a lazy chunk |
| Update only on open (F-017.R3) | Page network-first, hashed assets cache-first, prune per navigation, no `skipWaiting` | |

## Responsiveness and accessibility
| Spec wording | Platform mapping |
|---|---|
| 60 fps while dragging (NFR-02) | rAF-driven repaint from a mutable drag controller; no Preact render per pointer move; effects in the worker with the GPU approximation |
| Status announced (NFR-06) | Persistent `role="status"` (polite) and `role="alert"` (assertive) live regions owned by MOD-App |
| Annotations reachable by keyboard (CMP-Canvas) | Focusable canvas region containing a `listbox` with `aria-multiselectable` and roving `aria-activedescendant`/tabindex options in drawing order |
| Reduced motion / forced colors | `prefers-reduced-motion`, forced-colors styles (suite style) |
