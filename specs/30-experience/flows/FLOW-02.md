---
id: FLOW-02
title: How-to steps for docs
status: ready
features: [F-001, F-006, F-004, F-010, F-011, F-012]
screens: [SCR-Annotator]
---

## Goal
Turn a screenshot into a documentation image with numbered steps, trimmed and padded.

## Diagram
```mermaid
flowchart LR
  A[Open file] --> B[Steps 1..n]
  B --> C[Highlight text]
  C --> D[Crop]
  D --> E[Padding + background]
  E --> F[Download]
```

## Steps
1. Open file — F-001.R3
2. Place steps — F-006.R1
3. Highlight a line of text — F-004.R2, F-004.R3
4. Crop to the relevant area — F-010.R1
5. Add padding with a white background — F-011.R1, F-011.R2
6. Download — F-012.R2

## Exits & failures
- Wrong step order → delete and re-add; numbers stay consecutive (F-006.R2).
