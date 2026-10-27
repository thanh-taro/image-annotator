---
id: FLOW-01
title: Bug report with redaction
status: ready
features: [F-001, F-003, F-005, F-007, F-012]
screens: [SCR-Annotator]
---

## Goal
Paste a screenshot, point at the problem, hide customer data, and paste the result into a ticket
in under 20 seconds.

## Diagram
```mermaid
flowchart LR
  A[Paste screenshot] --> B[Arrow + rectangle]
  B --> C[Text label]
  C --> D[Solid redaction]
  D --> E[Copy]
  E --> F[Paste into ticket]
```

## Steps
1. Paste — SCR-Annotator — F-001.R1
2. Arrow (A) and rectangle (R) — F-003.R1, F-003.R2
3. Text label (T) — F-005.R1
4. Redact (X), solid by default — F-007.R1, F-007.R2
5. Copy (Ctrl+C) — F-012.R1, F-012.R4

## Exits & failures
- Clipboard blocked → download instead (F-012.R5).
- Tab closed before copying → leave-page warning (F-014.R1).
