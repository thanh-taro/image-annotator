// MOD-App — the undo and redo commands (MOD-App `undo`, `redo`) over MOD-Document's snapshot History
// (ADR-0008): each reverts or re-applies one RULE-11 step and restores the selection that went with it
// (F-009.R3), bumps the change epoch so the session counts as unexported (RULE-18, ADR-0008 §5), and is
// announced politely (COPY-a11y.undone, COPY-a11y.redone; CMP-Canvas "Accessibility", NFR-06). A pointer
// drag in progress is never undone under the user's hand: the command waits for it to end (as the edit
// keys do). A text being edited is ended first, so its whole edit is one step (F-009 edge case); the keys
// never get here while a text is edited (RULE-19, ./keys.ts).
// A zoom or pan is another action between nudges, so it ends a coalescing chain (RULE-11, ADR-0008 §3).
// Implements: F-009.R1/R2/R3/R4 (with MOD-Document), RULE-11, RULE-18, CMP-Canvas "Accessibility".
import { canvasCommands } from '../canvas';
import { t } from '../copy';
import type { View } from '../core';
import { announcePolite, commit, loaded, textEditing, view } from './state';

function step(direction: 'undo' | 'redo'): void {
  const l = loaded.value;
  if (!l || canvasCommands.dragging()) return;
  if (textEditing.value) canvasCommands.endTextEdit();
  if (textEditing.value) return;
  const restore = direction === 'undo' ? l.session.history.undo() : l.session.history.redo();
  if (!restore) return;
  commit(restore);
  announcePolite(t(direction === 'undo' ? 'a11y.undone' : 'a11y.redone'));
}

/** F-009.R1 / RULE-19 Mod+Z, COPY-action.undo: reverts the last change. */
export const undo = (): void => step('undo');

/** F-009.R1 / RULE-19 Mod+Shift+Z (Ctrl+Y off macOS), COPY-action.redo: re-applies the last undone change. */
export const redo = (): void => step('redo');

/**
 * MOD-Canvas reports the view (every zoom and pan, by key, wheel, pinch, drag or the status bar). Not an
 * undo step (RULE-11), but an action in between: repeated nudges or resizes around it are separate steps.
 */
export function viewChanged(next: View | null): void {
  const previous = view.value;
  view.value = next;
  if (previous && next && (previous.zoom !== next.zoom || previous.x !== next.x || previous.y !== next.y))
    loaded.value?.session.history.breakChain();
}
