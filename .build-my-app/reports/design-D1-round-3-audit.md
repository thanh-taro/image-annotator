# Design audit — D1 components, round 3

Source: design-auditor agent (saved by the orchestrator). Scope: the 10 CMP-* boards in design/canvas/project/.
Counts: 0 blocker, 0 major, 3 minor new. Round-2: 3/3 majors fixed; 11/14 minors fixed, 1 partly (m11), 2 deferred as triaged.
Script checks: all pass (copy IDs, literal text, token colours both themes, off-token values only in data-sample art, canvas.json no overlaps). Coverage: every Variants & states row present in both themes.

## New findings (minor)
- R3-1 CMP-ShortcutHelp: COPY-shortcuts.scope_note ("Tool and editing keys…") contradicts RULE-19 (Help/View single keys are canvas-only too). Same as a11y NN4. Fix: copy change en-US + vi-VN, update three frames.
- R3-2 CMP-Toolbar: wide tool buttons keep aria-keyshortcuts="V" etc. Same as a11y NN1. Fix: drop on the 11 tool buttons, keep "(V)" hint and Mod-key aria-keyshortcuts.
- R3-3 CMP-StatusBar privacy popover "narrow" frame is the wide 360 px popover with 32 px targets (rest of round-2 m11). Fix: real 390 px frame, popover 358 px, 44 px Close/link.

## Agreement with a11y round 3
NN2 confirmed (hidden span lacks lang="vi"); NN5/m13 confirmed (only 1 fieldset in StylePanel).

Recommendation: D1 can close at round 3 after R3-1..R3-3.
