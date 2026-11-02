# Design plan — Image Annotator (2026-10-27)

Tool: Claude Design canvas (D-013). Style: Workbench (D-011), top toolbar + right panel (D-012).
Each artboard shows dark and light side by side. Viewports: embedded 1200 × 760, narrow 390 × 760.

## Inventory
- 1 screen (SCR-Annotator) with 10 states; 10 components; 2 flows.

## Phases
| Phase | Artboards | Count |
|---|---|---|
| D1 — Components | CMP-Toolbar, CMP-StylePanel (tool / selection / canvas / crop), CMP-Canvas (drawing / selected / cropping, every annotation kind), CMP-TextEditor, CMP-EmptyState (default / unfocused), CMP-DropOverlay, CMP-StatusBar (default / narrow / no image), CMP-Notice (success / error / progress), CMP-ConfirmDialog (replace / clear / scale-down), CMP-ShortcutHelp | 10 |
| D2 — Primary flow (FLOW-01) | Main (annotated, embedded); FLOW-01 steps 1–5: pasted → arrow + rectangle → text label → solid redaction (count pill) → copied notice | 6 |
| D3 — Screen states, embedded | empty, default, canvas-settings, selecting, editing-text, cropping, dragging-file, loading, exporting, error, + shortcut help open, + confirm replace open | 12 |
| D4 — Narrow + FLOW-02 | narrow: empty, default, selecting (bottom sheet), cropping, vi-VN default; FLOW-02 steps (steps placed → highlight → crop → padding + background) | 9 |

Total ≈ 37 artboards. Each phase runs make → design audit → UI critique (+ a11y) → fix, max 3 rounds.
