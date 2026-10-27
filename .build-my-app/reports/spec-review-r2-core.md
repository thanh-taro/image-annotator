# Spec review round 2 — domain + F-001..F-012
All round-1 blockers verified fixed; numbers verified.
N1 MAJOR RULE-19 scope: canvas/edit/tool keys only when canvas (or crop frame) focused; controls keep standard keys; global: Mod+Z/Shift+Z, Mod+S, Mod+O, Mod+V, ? except in text fields.
N2 MAJOR F-008 R8 fields for text/step (X,Y only), stroke/highlight (bbox scale from top-left); Alt+arrows scale stroke/highlight; AC step shows X/Y only.
N3 MAJOR Shift+1/Shift+0/? matched by US key position.
N4 MAJOR F-007 AC9 untestable → blur later hides arrow inside box; sending blur back draws arrow over.
N5 MINOR reference blur definition → architecture (Gaussian σ = r/2, clamped edges).
N6 MINOR crop: arrow keys always act on frame; "canvas focus" in F-010 AC7.
Verdicts: F-008 not ready; rules/F-007/F-010 minor; rest ready.
