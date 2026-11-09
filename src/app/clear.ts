// MOD-App — the `clear` command (MOD-App public surface): COPY-action.clear, "Start over", in CMP-Toolbar's
// COPY-action.more menu. A text being edited is ended first, so its edit counts (RULE-11); then, only while
// the session has unexported changes (RULE-18), CMP-ConfirmDialog "clear" asks; confirming (or no
// changes) returns to the empty state, which can't be undone (RULE-11). Nothing happens with no image,
// while a load is running or while a dialog is open (as for the load input, F-001 edge case).
// Implements: F-014.R3, CMP-ConfirmDialog variant "clear".
import { canvasCommands } from '../canvas';
import { isBusy } from './loader';
import { askConfirm, endSession, loaded, modalOpen, textEditing, unexported } from './state';

/** COPY-action.clear: starts over, asking first when there are unexported changes (F-014.R3). */
export async function clearImage(): Promise<void> {
  const current = loaded.value;
  if (!current || isBusy() || modalOpen() || canvasCommands.dragging()) return;
  if (textEditing.value) canvasCommands.endTextEdit();
  if (textEditing.value) return;
  if (unexported.value && !(await askConfirm('clear'))) return;
  // The dialog is modal, but a load that was already decoding may have replaced the session meanwhile.
  if (loaded.value === current) endSession();
}
