---
id: CMP-Notice
title: Notice
status: draft
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
| success | Export results; disappears after 4 s |
| error | Stays until dismissed or the next action |
| progress | While loading (COPY-load.loading) or exporting (COPY-export.preparing) takes longer than 0.5 s |

## Behavior
At most one notice at a time; a new one replaces the old. A language switch re-renders the
visible notice in the new language.

## Accessibility
Announced via a live region (polite for success/progress, assertive for errors).
