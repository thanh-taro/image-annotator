// MOD-App — wires the RULE-18 state to MOD-IO's leave-page warning: on exactly while the session has
// unexported changes (every do, undo and redo since the image was loaded or last exported), off in the
// empty state and right after a successful export.
// Implements: F-014.R1, F-014.R2 (with MOD-IO ../io/leave.ts).
import { effect } from '@preact/signals';
import { setLeaveWarning } from '../io';
import { unexported } from './state';

/** Keeps the leave-page warning in step with `unexported`; returns a stop function. */
export function startLeaveWarning(set: (enabled: boolean) => void = setLeaveWarning): () => void {
  return effect(() => set(unexported.value));
}
