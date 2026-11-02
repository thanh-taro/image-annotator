# Design audit — D1 components, round 2

Source: design-auditor agent (saved by the orchestrator). Scope: the 10 CMP-* boards. Main.dc.html is excluded (it is redone in D3).
Counts: 0 blocker, 3 major, 14 minor.

**Script checks passed:**
- every data-copy ID exists in copy.md;
- literal texts match en-US;
- all token roles match tokens.json in both themes;
- canvas.json has no overlaps.

## Round-1 verification
All round-1 blockers and majors are fixed, with no regressions.

Minor items still open:
- **Size copy reuse:** Strength and Padding reuse COPY-style.size_s/m/l, which isn't stated in the CMP-StylePanel spec.
- **Off-scale values:**
  - EmptyState `kbd`: radius 5 and padding 2/4.
  - Canvas handles: radius 2.
  - StylePanel `.kind button.on`: padding 7; warn icon `margin-top: 1px`.

## Major
- **M1 Toolbar, narrow:** only 8 of the 11 tools are drawn, so Step, Redact and Crop are unreachable. Fix: show all 11 at 44 px, either wrapping or with a visible scroll cue.
- **M2 ShortcutHelp:** the OS key sets are tied to the themes (Windows = dark, macOS = light). Fix: show both key sets in both themes, and keep the theme alone in the label's last slot.
- **M3 Toolbar, narrow:** the spec doesn't describe the narrow layout (Download in the overflow menu, count pill beside Copy). Fix: propose a spec change, or revert.

## Minor
1. **StylePanel tool variants:** missing a no-fill tool variant (arrow) and the solid redaction selection. Also say which kinds hide Fill.
2. **StylePanel inputs:** they are 13 px; `font.size.input` is 16 px (this stops mobile browsers zooming on focus).
3. **StylePanel, narrow:** no narrow / 44 px variant. Fix: add one, or say where the panel goes on phones (D3).
4. **StylePanel size line:** the `COPY-status.image_size` line isn't in the StylePanel anatomy.
5. **Aria-only names without data-copy:**
   - panel names: Style, Canvas, Crop;
   - Privacy and Toolbar;
   - the radiogroup labels.
   Fix: use `aria-labelledby` pointing at the visible headings, or add copy keys.
6. **TextEditor placeholder:** the colour #6B7280 is raw and not marked as sample.
7. **Canvas raw values:** "Remove?" needs `data-sample`; the translucent fill uses a raw rgba.
8. **Canvas hit area and cursors:** the 24 px hit area isn't drawn, and the cursor-per-tool variant is missing.
9. **Toolbar, no image:** there's no narrow no-image frame, and the narrow row overflows at 320 px.
10. **StatusBar, narrow:** targets are 24 px, while the narrow toolbar uses 44 px.
11. **StatusBar privacy popover:** fixed at 360 px, with no narrow frame.
12. **ShortcutHelp headings:** the uppercase transform changes the visible copy, and it's wrong for vi-VN.
13. **Missing narrow frames and variants:**
    - no narrow frame for EmptyState, DropOverlay, ConfirmDialog or TextEditor;
    - no ⌘V EmptyState variant;
    - Notice doesn't show the singular count form.
14. **data-copy on aria-label containers:** document this convention in adapters/design.md.
