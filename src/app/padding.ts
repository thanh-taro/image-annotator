// MOD-App — the canvas settings of F-011: MOD-App `setPadding` and `setBackground`, each one undo step
// (RULE-11) through MOD-Document; the frame is never touched (RULE-13). Sizes whose canvas would exceed
// RULE-02's limits are unavailable (MOD-Core `availablePaddings`), so choosing one changes nothing.
// Implements: F-011.R1/R2/R4/R5, RULE-11, RULE-14, CMP-StylePanel "canvas" and "Behavior".
import type { Colour, PaddingSize } from '../core';
import { setBackground as backgroundOp, setPadding as paddingOp, type Op } from '../document';
import { commit, loaded, selection } from './state';

function apply(op: Op): void {
  const l = loaded.value;
  if (l) commit(l.session.history.apply(op, selection.value));
}

/** F-011.R1 / RULE-14: none, S, M or L around the frame (one step; an unavailable size is ignored). */
export function setPadding(size: PaddingSize): void {
  apply(paddingOp(size));
}

/** F-011.R2 / RULE-14: transparent or a palette colour for the whole canvas (one step). */
export function setBackground(background: 'transparent' | Colour): void {
  apply(backgroundOp(background));
}
