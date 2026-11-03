// MOD-Canvas — the font gate of ADR-0009 §4: the canvas accepts drawing only after the tool's face is
// ready, so step numbers (F-006) and text (F-005) are never drawn in a fallback face, on screen or in
// the export (NFR-08). The faces are requested at startup by MOD-Host (loadFonts, F-018.R7); this only
// waits for them, so no font request follows startup (NFR-01).
// Implements: ADR-0009 §4, F-006.R3 (the number drawn in the tool's face), NFR-08.
import { TEXT_WEIGHT } from '../core';

/** The canvas face (ADR-0009) and the characters steps draw. */
const FACE = `${TEXT_WEIGHT} 16px Manrope`;
const DIGITS = '0123456789';

/**
 * Opens once `pending` settles. A failed load opens it too (as `document.fonts.ready` does): the canvas
 * then draws in the fallback face rather than never accepting input.
 */
export class FontGate {
  ready = false;
  readonly settled: Promise<void>;
  private readonly listeners = new Set<() => void>();

  constructor(pending: Promise<unknown>) {
    this.settled = pending.then(
      () => this.open(),
      () => this.open(),
    );
  }

  private open(): void {
    this.ready = true;
    for (const fn of this.listeners) fn();
    this.listeners.clear();
  }

  /** Calls `fn` once when the gate opens (at once if it already has). Returns an unsubscribe function. */
  onReady(fn: () => void): () => void {
    if (this.ready) {
      fn();
      return () => {};
    }
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }
}

let shared: FontGate | null = null;

/** The page's gate: `document.fonts.ready`, then the canvas face with its digits (already loaded at startup). */
export function fontGate(): FontGate {
  if (!shared) {
    const fonts = typeof document !== 'undefined' && 'fonts' in document ? document.fonts : null;
    shared = new FontGate(fonts ? fonts.ready.then(() => fonts.load(FACE, DIGITS)) : Promise.resolve());
  }
  return shared;
}
