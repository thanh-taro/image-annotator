# Review F-016 (Show the privacy guarantee): round 1

Branch `worktree-agent-a827ac8c129d0efa2` @ 730d6cc vs `build/m1`.
Verdict: **approve with changes**. No blockers, 1 major, 5 minors.

## Major

### M1. AC4 does not test the image now that F-001 is merged (`tests/e2e/privacy.spec.ts:5-6, 160-187`)
The header says that "image unchanged" needs F-001, but F-001 is merged into `build/m1`, so this branch can load an image (see the `tests/e2e/load.spec.ts` fixtures). The AC4 test only checks a window marker and the URL. That would still pass if a click on the link cleared the document.
**Fix:** load `wide-2000x1000.png` first, as load.spec.ts does. After the click, assert that the canvas is still shown and the state is still `default`, and check the image size or `data-state`. Keep only "annotations and history" deferred to F-003/F-009, and say so in the comment.

## Minor

### m1. Esc is caught even while the popover is closed (`src/app/PrivacyStatus.tsx:51-57`)
`onKeyDown` sits on the root, which also wraps the badge and the source link. It runs whether or not the popover is open.
**Scenario:** focus the source link with the popover closed and press Esc. Focus jumps to the badge, and the event is stopped and its default prevented for nothing.
**Fix:** `if (e.key !== 'Escape' || !open) return;`

### m2. Focus moving to the source link does not dismiss the popover (`PrivacyStatus.tsx:59-62`)
`onFocusOut` tests `rootRef.contains(next)`. The source link is inside the root and comes right after the popover in DOM order.
**Scenario:** Tab from Close to the source link. Focus has left the popover but it stays open. That breaks CMP-StatusBar Accessibility: "focus leaving it … dismisses it".
**Fix:** close unless `next` is inside `detailsRef` or is the badge. Also add a test: Tab past Close dismisses the popover, and Shift+Tab out of the badge dismisses it. No focus-out dismissal is tested at the moment.

### m3. The narrow popover offset is measured once (`PrivacyStatus.tsx:31-39`, `privacy.css:136-139`)
`--tk-privacy-offset` is set only when the popover opens. If the device rotates or the frame resizes while it is open, the popover sits at the wrong place and can overflow.
**Simpler fix:** delete the measuring effect. Anchor the popover to the status bar instead: `.tk-status-bar { position: relative }`, and in the narrow container `.tk-privacy { position: static }` with `.tk-privacy__details { inset-inline: var(--tk-space-4) }`. The `useLayoutEffect` is then needed only for the focus move.

### m4. No test that the narrow source link shows only an icon (`tests/e2e/privacy.spec.ts:139-158`)
The CMP-StatusBar "narrow" variant and the F-016 edge case say the source link becomes an icon. The badge has an icon-only check at 390 px (`:61-68`), but the link only has its accessible name checked.
**Fix:** at 320 and 390 px, assert that `.tk-privacy__label` has a bounding width of 1 px or less, or is visually hidden, while the name is still COPY-privacy.source_label plus COPY-a11y.new_tab.

### m5. The notices link is checked only by its attributes (`tests/e2e/privacy.spec.ts:84-87`)
Nothing checks that `/third-party-notices.txt` is actually served by `pnpm preview`. A broken path would pass.
**Fix:** `expect((await page.request.get('/third-party-notices.txt')).ok()).toBe(true)`. Or click the link and wait for the new page, as the AC4 test does.

## Checked, no issue
- Security: both links use `target=_blank rel="noopener noreferrer"`, and the page sends `Referrer-Policy: no-referrer`. AC4 asserts there is no Referer header, `document.referrer === ''` and `opener === null`. GitHub is stubbed in both tests. The notices link is same-origin with a root-relative path (Vite `base` is `/`), so the CSP is unaffected because navigations are not `connect-src`.
- Embedded, the sandbox blocks the link and no tab, request or navigation happens (`privacy-embedded.spec.ts`).
- Names: the badge's name is swapped by CSS (`display:none` on one span), and both widths are tested. The dialog is named COPY-privacy.title, which exists (copy.md:182). Icons are `aria-hidden`. The popover is non-modal, focus moves into it, and Esc or Close returns focus to the badge. axe runs at wide (closed and open) and at 320 px (open), in both themes.
- R1, AC1, AC2 (open, Close, Esc, toggle, outside press, vi-VN) and AC3 (320, 390, 900 and 1200 px, same row, no scroll) are implemented and tested.
