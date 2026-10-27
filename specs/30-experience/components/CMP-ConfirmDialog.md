---
id: CMP-ConfirmDialog
title: Confirm dialog
status: ready
tokens: []
---

## Purpose
Ask before something that can't be undone or that changes the input.

## Anatomy
Title, message, primary action, COPY-action.cancel.

## Variants & states
| Variant / state | Title | Message | Primary action |
|---|---|---|---|
| replace | COPY-confirm.replace_title | COPY-confirm.replace | COPY-action.replace |
| clear | COPY-confirm.clear_title | COPY-confirm.clear | COPY-action.clear |
| scale-down | COPY-load.scale_down_title | COPY-load.scale_down | COPY-load.scale_down_action |

## Behavior
Esc and cancel keep everything as it was. If the language changes while the dialog is open, its
text switches and the pending choice is unchanged.

## Accessibility
Modal dialog; focus moves to the safe choice (cancel) and returns on close.
