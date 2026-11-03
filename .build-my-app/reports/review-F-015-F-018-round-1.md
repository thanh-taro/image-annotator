# Review — F-015 + F-018, round 1

Branch `build/f015-f018` vs `build/m1`. Specs: F-015, F-018, RULE-16, RULE-17, ADR-0010, ADR-0015, ADR-0021.

**Verdict: approve after the major fix.** There are no blockers. The origin and `event.source` checks, value parsing, the ready target (never `'*'`), the boot script and the CSP are all sound.

## Major

### M1 — If `ancestorOrigins` is present but masked, the ready signal is never sent
`src/host/messages.ts:224-230` (`readyTargets`).
- **Scenario:** the portal adds `referrerpolicy="no-referrer"` to its iframe, which is likely for a privacy-minded host. Chromium then masks `location.ancestorOrigins[0]` as `"null"`. That value isn't in the allow-list, so `readyTargets` returns `[]` and no `taro:ready` is posted. The host never answers with theme or language and never moves focus into the tool, so paste breaks (F-001.R9, RULE-16, D-006). No test covers this.
- **Why the branch isn't needed:** `frame-ancestors` already guarantees that every ancestor, including the parent, is allow-listed. The browser silently drops a `postMessage` whose target origin doesn't match. The message carries no content (F-015.R5).
- **Fix:** delete the `ancestorOrigins` branch and always post to each allowed origin. That is the current Gecko path. Remove `ancestorOrigins()` from `index.ts`. Change the unit test to `readyTargets(allow) === [...allow]`, and keep the e2e check that exactly one message arrives (F-015.R5). This is both simpler and more robust.

## Minor

### m1 — The app never sets the page language itself
`src/app/main.tsx:21`. Only the boot script sets `<html lang>`. If the boot script doesn't run (hash drift after an edit, or a CSP mismatch in some environment), the UI shows vi-VN while the page says en-US, which breaks F-018.R1 "marks the page with that language".
- **Fix:** after resolving the language, add `document.documentElement.lang = language.value;`. The cost is one line.

### m2 — Decision on the builder's proposal to remove `lang="en-US"` from index.html: **reject; keep it**
- The inline boot script is the first script in `<head>`. It overwrites the attribute before `<body>` exists, so no user or assistive technology ever sees the static value. F-018.AC1 is still met, and the test's "record only once there is a body" guard is legitimate.
- The static value is RULE-17's default. Removing it would leave a document with no language (WCAG 3.1.1, axe `html-has-lang`) in exactly the failure case where the boot script didn't run.
- With m1 in place the app also corrects the value. Keep the attribute, and keep the test guard with its comment.

### m3 — Negative message tests rely on a 300 ms sleep and partly duplicate each other
- `tests/e2e/host/support.ts:639` (`settle`).
- `host-integration.spec.ts:375-382`: the inline sibling-frame poster duplicates the stub host's `__fromSibling`, which is hard-coded to `taro:language`.
- `server.mjs:102`: `__postRaw` is never used.
- **Fix:**
  - Make `__fromSibling(data)` take the whole message and use it in both suites. Remove `__postRaw`, or use it for the shape cases.
  - In F-018.AC4, end the parent-sent unsupported values with a valid control from the same parent window. Messages from one source arrive in order, so the control proves the earlier ones were processed. Do the same in F-015.R1 (`'blue'` followed by a valid value). Keep `settle` only for the cross-window cases.

### m4 — Duplicate unit assertions
`tests/unit/copy.catalog.test.ts:664-669`: the new F-018.AC9 test repeats the vi-VN assertions of the existing plural test at lines 655-656.
- **Fix:** rename the existing test to `F-018.AC9 …` and add the en-US lines to it instead of adding a second test.

### m5 — F-018.AC6 is covered at catalog level only
`copy.catalog.test.ts:659`. This is acceptable now, because the crop UI doesn't exist yet. When F-009 (crop) is built, it must add an e2e check that the shown `COPY-crop.size` follows the active language and a live switch.

## Deferred ACs — legitimate
Each deferred AC needs features that aren't built yet:

| AC | Needs |
|---|---|
| F-015.AC2 | an annotated image and history |
| F-015.AC6, F-015.AC7 | every M-1 feature |
| F-015.AC9, F-015.AC10 | copy and download (F-012) |
| F-018.AC2 | selection, tool, zoom and history |
| F-018.AC5 | export |
| F-018.AC7 | every SCR-Annotator state |
| F-018.AC10 | text, download and offline (F-005, F-012, F-017) |

`spec_lint --coverage` still lists all nine as uncovered, which is the safety net. The live-switch half of F-015.AC2 and F-018.AC2 is already covered by the F-015.R1 and F-018.R2 tests, which check that the page doesn't reload.

**Fix:** record the nine IDs as obligations in `.build-my-app/state.json` or the build plan, against F-012, F-009, F-017 and the M-1 end-to-end pass. Today they appear only in test-file comments.

## Checked and found sound (no action)
- **Settings messages:**
  - `acceptSettings` requires an allow-listed `event.origin` and `event.source === window.parent` (non-null).
  - It accepts only the `taro:theme` values `light` and `dark`. `taro:language` goes through RULE-17 `matchLanguage`. Everything else returns `null`.
  - Structured-clone data has no inherited properties a sender could plant, so prototype pollution isn't a concern. Arrays and primitives are rejected.
  - `HOST_ORIGINS` is normalised and refuses wildcards (`gen-headers.mjs`).
- **Outbound messages:** the only message is a frozen `{type:'taro:ready'}`, posted once (`started` guard), never to `'*'`. It is posted after the listener is installed, so the host's reply can't be missed.
- **Boot script:** the URL values only select between fixed literals (`light`/`dark`, the supported languages). Nothing from the address reaches the DOM as text. The script is unchanged, so its CSP hash is unchanged.
- **Theme:**
  - Standalone, or embedded with no host theme, the tool follows the device preference live.
  - After an address theme or a theme message, the host owns the theme.
  - An unknown theme value keeps the current theme.
  - The theme never touches the export (INV-05).
- **Language switch:** the switch updates the signal, `<html lang>` and the title (ADR-0015 §7). Sending the same value twice is a no-op.
- **Fonts:** both faces are variable, so one `document.fonts.load` per family with `A` + `Đ` fetches all four subset files (F-018.R7).
