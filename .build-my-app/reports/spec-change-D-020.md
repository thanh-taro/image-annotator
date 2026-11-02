# Spec change D-020 — padding wraps the frame

Found while drawing FLOW-02: under RULE-13/14, padding went around the image, and a cropped frame kept its place on the image, so a cropped image could never be padded. The owner chose "padding wraps the frame".

Changed: RULE-02, RULE-10 (blur and pixelate sample only inside the frame), RULE-11, RULE-12 (view while cropping), RULE-13, RULE-14, RULE-15, RULE-20; ENT-Frame, ENT-Session; glossary Frame, Canvas, Padding; F-007 (edge case, AC13); F-010 (R2, R3, AC2, AC4, AC10, edge cases); F-011 (R1–R4, new R6, AC4, AC7, edge cases); F-012 R3; CMP-Canvas, CMP-StatusBar; COPY-a11y.canvas_summary ("canvas").

Review: spec-reviewer found 1 blocker (blur in the padding would show cropped-out pixels), 5 majors and 8 minors. All are fixed. Lint: 0 errors, 0 warnings.
