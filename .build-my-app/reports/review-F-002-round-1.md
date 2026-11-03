# Review — F-002 Zoom and pan the view — round 1

Branch `worktree-agent-a5e944aee8738974f`, diff `build/m1..HEAD` (181773c, fc516ee).
Checks run: `vitest` 144/144 pass, `tsc` clean, `eslint` clean, full Playwright suite 120/120 (Chromium + WebKit).
A throwaway probe spec (since deleted) also checked the canvas focus ring and a very small area.

**Verdict: changes requested (1 major, 7 minor). No blockers.** The zoom maths, pan limits, layer cache, key scope and ConfirmDialog change are sound.

## Major

### M1 — The canvas focus ring is invisible (NFR-06, WCAG 2.4.7, CMP-Canvas "Accessibility")
- **Where:** `src/app/Shell.tsx:45`, which adds `tabIndex` to `.tk-work-area`, and `src/app/styles/components.css:109-119`.
- **Scenario:** the user Tabs to the canvas, or focuses it and presses a key, so `:focus-visible` matches. The ring is inset by `outline-offset: -2px`, but the absolutely positioned `canvas.tk-canvas` (`inset: 0`) paints over it. Before this change, a probe sampled the work-area corner. It then focused the work area by keyboard, with `:focus-visible` true. The pixels were identical afterwards, and screenshots show no ring. F-002 is the first feature to make this region focusable, and every RULE-19 canvas key depends on the user being able to see that focus.
- **Fix:** draw the ring above the canvas. Either use `.tk-work-area:focus-visible::after { content:''; position:absolute; inset:0; outline/box-shadow inset; pointer-events:none; z-index:1 }`, or put the outline on the canvas when the region has `:focus-visible` (`.tk-work-area:focus-visible > .tk-canvas { outline… ; outline-offset:-2px }`). Add an e2e test that samples the ring pixel after a keyboard focus.

## Minor

### m1 — Alt+Arrow on the canvas is not kept from the browser
- **Where:** `src/keys/index.ts:1340-1354`.
- **Scenario:** canvas focus, nothing selected, Alt+Left on Windows or Linux. `resolveKey` returns NONE, so the browser goes Back and leaves the tool, or with the iframe takes the joint history back. RULE-19 lists Alt+arrows among the canvas keys and keeps every such key from the browser. This is F-013's map, but the arrow-key branch belongs to F-002 and the fix costs one line.
- **Fix:** in canvas scope, return `{ preventDefault: true }` for Alt+Arrow, with no action. Add a unit test.

### m2 — `viewCommands` lacks "zoom at a point" (MOD-Canvas "F-002 outcome")
- **Where:** `src/canvas/index.ts:857-870`.
- **Problem:** MOD-Canvas lists zoom at a point among the commands. Only `ViewController.zoomIn(at)` and `zoomOut(at)` exist, reached through the private `activeCanvas()`.
- **Fix:** add `zoomAt(zoom, point)`, or make the `at?` arguments part of `viewCommands`. Otherwise amend MOD-Canvas.

### m3 — The pan limit differs from the wording of R4
- **Where:** `src/core/view.ts:1270-1282`.
- **Scenario:** a 1180 px canvas in a 1200 px area with a 24 px margin. R4 says "smaller than the visible area is centred", but the code allows 28 px of pan, because it centres only content of at most `area − 2·margin`. The code's version is continuous with the margin rule, which is arguably better.
- **Fix:** change the spec to "smaller than the area inside the Fit margin is centred" (preferred), or change the code to match the spec.

### m4 — Space+drag state is a closure local, so drawing tools cannot reach it
- **Where:** `src/canvas/Canvas.tsx:722-785`.
- **Problem:** `space`, `drag` and `touches` live inside the mount effect. F-003…F-008 will add their pointer handlers to the same closure, so the effect will grow into one large handler. There is no seam where "Space held → pan, otherwise tool" can be decided and tested.
- **Fix:** before F-003, move the pointer routing into a DOM-light `PointerRouter` or `InputController` class, next to `ViewController`, that owns `space`, `drag` and the touch pairs and can be unit-tested. Leave `Canvas.tsx` with only the listener wiring.

### m5 — Stringly-typed pan actions
- **Where:** `src/app/keys.ts:278-303` and `src/keys/index.ts:1324-1353`.
- **Problem:** MOD-Keys builds names such as `panRightFar`, and MOD-App strips `Far` and maps the name back to a direction.
- **Fix:** give `Action` an optional payload, for example `{ group:'view', name:'pan', direction:'right', far:true }`, or emit `pan`/`panFar` with a direction field. Then dispatch directly.

### m6 — Every pan frame re-renders the zoom control, and every layer rebuild re-reads computed style
- **Where:** `src/app/ZoomControl.tsx:134` reads `view.value`, which changes x and y on every pan or scroll event. `src/canvas/Canvas.tsx:597-612` (`baseView`) calls `getComputedStyle` three times for each rebuild.
- **Impact:** both are cheap today and stay within NFR-02's 100 ms. They add avoidable main-thread work on the frames that NFR-02 says matter most once drawing lands.
- **Fix:** expose `zoomLevel = computed(() => view.value?.zoom)`, or report the zoom separately, and have ZoomControl read that. Cache `BaseView` by `(theme, dpr)`.

### m7 — Tests missing for the WebKit high-zoom fix and touch pinch, and the wheel blocks host scroll
- **Coverage:** e2e AC3 only checks the level text at 800 %. No test confirms that the image is actually drawn at 800 % on WebKit, which was the reason for `visibleSource`. Add a pixel probe at 800 % in `zoom-pan.spec.ts`; it runs on both projects. Touch pinch and Space-release-during-drag have unit tests only, which is acceptable for now.
- **Host scroll:** `onWheel` (`Canvas.tsx:715-719`) always calls `preventDefault`, even when the canvas fits and cannot pan. When embedded, the portal page cannot be scrolled while the pointer is over the tool. Call `preventDefault` only for Mod or pinch, or when the content overflows on the scrolled axis.
- **Safari pinch:** Safari sends trackpad pinch as `gesturestart`/`gesturechange`, not as Ctrl+wheel. On Safari, R3's trackpad pinch therefore falls back to the browser. platform-mapping chose Ctrl+wheel and defers pinch polish to M-2, so log this as a known gap or a ticket for M-2.

## Checked and OK
- **RULE-12 steps:** steps are taken from between levels (EPS). The floor is min(10 %, fit). AC8: out does nothing, in goes to 10 %. AC9: 31 % → 50 % / 25 %. 800 % is a no-op.
- **Zoom at the pointer** (`zoomAt`) and **Fit** for long images.
- **Resize:** keeps the zoom and the centre point, and refits a fitted view. Over a 100 px-tall area and back, the view stayed finite; no NaN.
- **Image layer:** dpr changes go through `matchMedia`. Layer rebuild keys cover zoom, pan (rounded device dx/dy), size, dpr (through scale and size), theme, image, frame and padding (which includes the background). Crop view is correctly deferred to F-010.
- **Clean-up:** listeners, the ResizeObserver, rAF and the layer are released on unmount. `active` is cleared.
- **Key scope:**
  - Mod+= / Mod+- work anywhere in the tool.
  - Shift+1, Shift+0, Space and the arrow keys act on the canvas only.
  - Nothing acts in text, dialogs or menus.
  - Existing Esc and Tab traps (capture plus stopPropagation or preventDefault) and Mod+O / Mod+V are unaffected.
  - No browser key is prevented outside the scope.
- **ConfirmDialog `useLayoutEffect`:** correct. Focus and the trap are installed in the commit, before the browser's inert focus fix-up, so `returnTo` is captured reliably. Cleanup order is unchanged, and the F-001 e2e tests pass.
- **AC7:** the controller never sees the document, and the unit test shows that the history and `unexported` are unchanged. The export-equality part is deferred to F-003 / F-012 as agreed.
