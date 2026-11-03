// MOD-App — the signals of SCR-Annotator that F-001 needs (ADR-0008 §6): the loaded image and its
// session, the notice, the open dialog, the drag state and the two persistent live regions (NFR-06).
// Later features add the selection, tool, current styles and view.
import { signal } from '@preact/signals';
import type { Session } from '../document';
import type { DecodedImage, Size } from '../io';
import type { Notice } from './notice';

export interface Loaded {
  readonly image: DecodedImage;
  readonly session: Session;
}

/** ENT-Session with its ENT-Image, or null in the empty state. */
export const loaded = signal<Loaded | null>(null);

/** CMP-Notice: at most one at a time; a new one replaces the old. */
export const notice = signal<Notice | null>(null);

export interface DialogRequest {
  readonly kind: 'replace' | 'scale-down';
  readonly size?: Size;
  answer(ok: boolean): void;
}
/** CMP-ConfirmDialog, while open. */
export const dialog = signal<DialogRequest | null>(null);

/** CMP-DropOverlay: a file is dragged over the tool. */
export const dragging = signal(false);

/** The canvas's persistent live regions (CMP-Canvas, CMP-Notice "Accessibility"). */
export const polite = signal('');
export const assertive = signal('');

/** Writes a message into a live region, clearing it first so a repeated message is announced again. */
export function announce(region: typeof polite, text: string): void {
  clearTimeout(pending.get(region));
  region.value = '';
  if (text)
    pending.set(
      region,
      setTimeout(() => (region.value = text), 50),
    );
}
const pending = new Map<typeof polite, ReturnType<typeof setTimeout>>();

/** Shows (or clears) the notice and announces it: errors assertively, the rest politely (CMP-Notice). */
export function setNotice(next: Notice | null): void {
  const previous = notice.value;
  notice.value = next;
  if (previous?.kind === 'progress') announce(polite, ''); // progress is cleared before any result
  if (next) announce(next.kind === 'error' ? assertive : polite, next.text());
}
