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
Grows with its content; ends on click outside or Esc (F-005). From M-1c, for a text with a background, the editing outline surrounds the background box and a press in the box's margin places the caret (F-020.R8).

## Accessibility
A multi-line text field named COPY-tool.text. It takes focus when editing starts and returns focus to the canvas, with the text selected, when editing ends.
