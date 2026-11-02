---
id: CMP-ShortcutHelp
title: Shortcut help
status: ready
tokens: []
---

## Purpose
List every keyboard shortcut in RULE-19.

## Anatomy
COPY-shortcuts.title; groups COPY-shortcuts.tools, COPY-shortcuts.canvas, COPY-shortcuts.edit,
COPY-shortcuts.history, COPY-shortcuts.view, COPY-shortcuts.pointer, COPY-shortcuts.load,
COPY-shortcuts.export, COPY-shortcuts.help; COPY-shortcuts.scope_note; COPY-action.close. Entries reuse the tool and action names plus COPY-shortcut.place, COPY-shortcut.next, COPY-shortcut.select_all,
COPY-shortcut.cancel, COPY-shortcut.move, COPY-shortcut.resize, COPY-shortcut.pan,
COPY-shortcut.move_while_drawing, COPY-shortcut.paste, COPY-shortcut.edit_text,
COPY-shortcut.zoom_pointer. Crop keys reuse COPY-shortcut.move and COPY-shortcut.resize.

## Variants & states
| Variant / state | Description |
|---|---|
| open | Shown over the work area |

## Behavior
Opened with ? or COPY-action.shortcuts; closed with Esc. Shows Ctrl or ⌘ for the user's OS. Key labels (Ctrl, ⌘, Alt, ⌥, Shift, ⇧, Enter, Esc, Tab, Delete,
Backspace, Space, arrows) are shown as printed on the keyboard and are not translated; aliases
(Backspace for Delete, Ctrl+Y for redo on Windows/Linux) are listed with the main key.

## Accessibility
Modal dialog: focus moves to COPY-action.close, stays inside the dialog and returns to what opened it on close; the rest of the tool is inert and RULE-19 shortcuts are off while it is open, and the canvas live regions announce nothing until it closes. Key names readable by screen readers (spoken names as text, not only symbols).
