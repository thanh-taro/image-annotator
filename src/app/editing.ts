// MOD-App — the edit commands of F-008: delete, duplicate, select all, bring forward / send backward,
// arrow-key nudges and Alt+arrow resizes, the position and size fields (MOD-App `setFields`), and a
// finished drag from MOD-Canvas. Each completed edit is one undo step (RULE-11); repeated nudges, or
// repeated Alt-resizes, of the same selection with nothing else in between coalesce into one
// (ADR-0008 §3). Deleting and duplicating are announced (CMP-Canvas "Accessibility", NFR-06).
// Implements: F-008.R1 (select all), F-008.R2 (arrow keys move the selection, RULE-19), F-008.R3 (Alt+arrows
// resize a single selection), F-008.R5 (delete, duplicate offset 10 px right and down and selected,
// reorder), F-008.R7 (one undo step each), F-008.R8 (position and size fields), F-006.R2/R5 (steps
// renumbered on delete, a duplicated step gets the next number, RULE-07), RULE-11, RULE-19 Edit.
import { t } from '../copy';
import { altResized, moved, withGeometry, type Annotation, type GeometryField } from '../core';
import { duplicate, edit, remove, reorder, type Op, type Selection } from '../document';
import { select } from './drawing';
import { announcePolite, commit, doc, loaded, selection } from './state';

/** The selected annotations, in drawing order. */
function picked(): Annotation[] {
  const ids = new Set(selection.value);
  return (doc.value?.annotations ?? []).filter((a) => ids.has(a.id));
}

/** Applies `op` as one step leaving `after` selected (with a coalescing key for nudges and resizes). */
function apply(op: Op, after: Selection, coalesceKey?: string): void {
  const l = loaded.value;
  if (l) commit(l.session.history.apply(op, after, coalesceKey));
}

/** F-008.R5 / RULE-19 Delete: deletes the selection (one step); steps after it are renumbered (RULE-07). */
export function deleteSelection(): void {
  const gone = picked();
  if (!gone.length) return;
  apply(remove(gone.map((a) => a.id)), []);
  announcePolite(t('a11y.deleted_count', { count: gone.length }));
}

/**
 * F-008.R5 / RULE-19 Mod+D: copies of the selection offset 10 image pixels right and down, on top and
 * selected (one step); a copied step gets the next number (F-006.R5, RULE-07).
 */
export function duplicateSelection(): void {
  const l = loaded.value;
  const ids = picked().map((a) => a.id);
  if (!l || !ids.length) return;
  const copies = ids.map(() => l.session.newId());
  apply(duplicate(ids, copies), copies);
  announcePolite(t('a11y.duplicated_count', { count: copies.length }));
}

/** F-008.R1 / RULE-19 Mod+A: selects every annotation, in drawing order (not an undo step). */
export function selectAll(): void {
  const all = (doc.value?.annotations ?? []).map((a) => a.id);
  if (all.length) select(all);
}

/** F-008.R5 / RULE-19 ] and [: brings the selection forward or sends it backward one place (one step). */
export function reorderSelection(direction: 'forward' | 'backward'): void {
  const ids = picked().map((a) => a.id);
  if (ids.length) apply(reorder(ids, direction), selection.value);
}

const chainKey = (op: string) => `${op}:${selection.value.join(',')}`;

/** F-008.R2 / RULE-19 arrow keys: moves the selection by (dx, dy) image pixels; repeats coalesce (RULE-11). */
export function nudgeSelection(dx: number, dy: number): void {
  const list = picked();
  if (list.length) apply(edit(list.map((a) => moved(a, dx, dy))), selection.value, chainKey('nudge'));
}

/**
 * F-008.R3 / RULE-19 Alt+arrows: a single selected box (or a stroke's or highlight's bounding box) grows by
 * (dx, dy) keeping its top-left corner, never below 1 × 1; a line or arrow moves its head; text, steps
 * and several selected do nothing. Repeats coalesce (RULE-11).
 */
export function altResizeSelection(dx: number, dy: number): void {
  const list = picked();
  const [a] = list;
  if (list.length !== 1 || !a) return;
  const next = altResized(a, dx, dy);
  if (next !== a) apply(edit([next]), selection.value, chainKey('resize'));
}

/**
 * F-008.R8 (MOD-App `setFields`): sets one position or size field of the single selection to `value`
 * whole image pixels, as one step. Values keep the limits of dragging and Alt+arrows (1 × 1 at least).
 */
export function setGeometry(field: GeometryField, value: number): void {
  const list = picked();
  const [a] = list;
  if (list.length !== 1 || !a || !Number.isFinite(value)) return;
  apply(edit([withGeometry(a, field, Math.round(value))]), selection.value);
}

/** F-008.R2/R3/R7: a finished move or resize from MOD-Canvas, one step leaving the dragged ones selected. */
export function commitDrag(changes: readonly Annotation[]): void {
  if (changes.length) apply(edit(changes), selection.value);
}
