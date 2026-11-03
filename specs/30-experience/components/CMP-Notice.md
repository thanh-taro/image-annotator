---
id: CMP-Notice
title: Notice
status: ready
tokens: []
---

## Purpose
Short, non-blocking messages: results, errors, progress.

## Anatomy
Message text; optional action (e.g. COPY-action.download after COPY-error.clipboard); dismiss
(COPY-action.close).

## Variants & states
| Variant / state | Description |
|---|---|
| success | Export results and COPY-load.first_only; disappears after 4 s |
| error | Stays until dismissed or the next action |
| progress | While loading (COPY-load.loading) or exporting (COPY-export.preparing) takes longer than 0.5 s |

## Behavior
At most one notice at a time; a new one replaces the old. A language switch re-renders the
visible notice in the new language. The success timer pauses while the pointer or focus is on
the notice.

## Accessibility
Announced by writing its text into the canvas's persistent live regions (polite for success/progress, assertive for errors); a progress message is cleared from the polite region when the work ends, before any success or error is written; the notice itself has no live role and never takes focus. Its close button is reachable by keyboard, and Esc closes the notice while focus is on it.
