---
id: CMP-TextEditor
title: Text editor
status: ready
tokens: []
---

## Purpose
Edit a text annotation in place at its final size and colour.

## Anatomy
Editable text with caret; COPY-text.placeholder while empty.

## Variants & states
| Variant / state | Description |
|---|---|
| editing | Caret visible, shortcuts off |

## Behavior
Grows with its content; ends on click outside or Esc (F-005).

## Accessibility
A multi-line text field named COPY-tool.text. It takes focus when editing starts and returns focus to the canvas, with the text selected, when editing ends.
