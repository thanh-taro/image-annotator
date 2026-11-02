---
id: MOD-Keys
title: Keys — the RULE-19 keyboard map as a pure function of event and focus scope
status: draft
depends_on: []
---

## Responsibility
Turns a keyboard event plus the current focus scope into an action, and decides whether the key is
kept from the browser (RULE-19). Scope inputs: where focus is (canvas, another control, a text
annotation or field being edited, an open dialog or menu), the active tool and the selection
shape. Letters follow the typed character on Latin layouts (`event.key` is a Latin letter) and the
US key position otherwise (`event.code`); Shift+1 and Shift+0 follow `event.code` (`Digit1`,
`Digit0`); `?`, `[`, `]`, `=` and `-` follow `event.key`. Mod is Meta on macOS and Ctrl elsewhere;
Ctrl+Y is redo off macOS. While text is edited only Esc and Mod+S act; in a dialog only Esc. Mod+V
is never prevented, so the `paste` event still fires (MOD-IO); Mod+C maps to copy only when no
text is selected on the page. The pure core has no DOM import; a thin adapter reads the event,
focus and platform.

## Not responsible for
- Executing actions (MOD-Canvas, MOD-App, MOD-IO).
- Text editing keys inside fields, which stay native.

## Public surface
- `resolveKey(keyInfo, scope) → { action?, preventDefault }` with `action` from a closed union
  (tool choices, canvas, edit, history, view, load, export, help).
- `shortcutList()` for CMP-ShortcutHelp, as data (key labels plus COPY IDs).

## Implements
F-013.R1/R2/R3/R4/R5; RULE-19; NFR-06.
