// MOD-App — the signals of SCR-Annotator (ADR-0008 §6): the loaded image and its session, the
// document and a change version (so every edit repaints), the computed `unexported` (RULE-18), the
// notice, the open dialog, the drag state and the two persistent live regions (NFR-06). F-002 adds the
// view; F-003 the tool, the page-lifetime current styles, the selection and the layout width. MOD-Document
// stays free of signals; every change to the session goes through `commit` or `exported` here.
import { computed, signal } from '@preact/signals';
import { startSession, type Doc, type Restore, type Selection, type Session } from '../document';
import { DEFAULT_STYLES, type DrawingTool, type Style, type ToolName, type View } from '../core';
import { feedEffects, type DecodedImage, type Size } from '../io';
import { toolbarCount } from './export';
import type { Notice } from './notice';

export interface Loaded {
  readonly image: DecodedImage;
  readonly session: Session;
}

/** ENT-Session with its ENT-Image, or null in the empty state. */
export const loaded = signal<Loaded | null>(null);

/** The session's current document (ADR-0008 §6); null in the empty state. */
export const doc = signal<Doc | null>(null);

/** Bumped on every do, undo, redo and export, so `unexported` recomputes. */
const version = signal(0);

/** RULE-18: the session has unexported changes (F-001.R7, F-014). */
export const unexported = computed(() => {
  void version.value;
  return loaded.value?.session.unexported ?? false;
});

/** F-009.R1 / CMP-Toolbar: there is a step to undo / to redo (both false with no image, F-009.AC5). */
export const canUndo = computed(() => {
  void version.value;
  return loaded.value?.session.history.canUndo ?? false;
});
export const canRedo = computed(() => {
  void version.value;
  return loaded.value?.session.history.canRedo ?? false;
});

/** Applies a history result (apply, undo or redo) to the signals, with the selection that goes with it. */
export function commit(restore: Restore): void {
  doc.value = restore.doc;
  selection.value = restore.selection;
  version.value++;
}

/** CMP-Toolbar: exactly one tool is active; select when the page opens, kept when a new image loads. */
export const tool = signal<ToolName>('select');

/** RULE-04: each drawing tool's current style, for the page's lifetime (kept across images, ENT-Session). */
export const currentStyles = signal<Readonly<Record<DrawingTool, Style>>>(DEFAULT_STYLES);

/** The selected annotations' ids, in selection order (not an undo step, RULE-11). */
export const selection = signal<Selection>([]);

/**
 * SCR-Annotator "editing-text" (F-005): the text being edited — an existing one by id, or a new one
 * (id null, not in the document until editing ends). MOD-Canvas owns the edit; this mirrors it.
 */
export const textEditing = signal<{ readonly id: string | null } | null>(null);

/** D-014 layout width of the tool itself (wide ≥ 1000 px, compact 800–999 px, narrow below). */
export type Layout = 'wide' | 'compact' | 'narrow';
export const layout = signal<Layout>('wide');

/** D-019: the narrow bottom sheet of CMP-StylePanel is open. */
export const sheetOpen = signal(false);

/**
 * Records a successful export (RULE-18; F-012): `session` exported at change epoch `at` — by default the
 * current session as it is now. An export of a session that was replaced meanwhile records nothing.
 */
export function exported(session: Session | undefined = loaded.value?.session, at = session?.epoch): void {
  if (!session || loaded.value?.session !== session) return;
  session.markExported(at);
  version.value++;
}

/** RULE-20 / F-012.R8: the live redaction count next to the export actions (hidden at 0). */
export const redactions = computed(() => toolbarCount(doc.value));

/**
 * Starts a new session with this image (ENT-Session, F-001.R7): empty history, the whole image as
 * frame, no padding. The previous image's bitmap is closed (NFR-04); the canvas skips a closed bitmap.
 */
export function startNewSession(image: DecodedImage): Session {
  const previous = loaded.value;
  const session = startSession(image.info);
  loaded.value = { image, session };
  doc.value = session.doc;
  selection.value = [];
  version.value++;
  previous?.image.bitmap.close();
  // F-007: the new image's pixels go to a fresh effects worker (ADR-0005 §5, ADR-0022).
  feedEffects(image.bitmap);
  return session;
}

/**
 * The view of the shown canvas (zoom, pan; F-002), reported by MOD-Canvas; null in the empty state.
 * It is never part of the session (INV-05): changing it adds no history step and no unexported change.
 */
export const view = signal<View | null>(null);

/**
 * The zoom level (percent) while an image is shown, else null. CMP-StatusBar reads this, not `view`,
 * so panning (which changes only the position) never re-renders the zoom control (NFR-02).
 */
export const zoomLevel = computed(() => (loaded.value && view.value ? view.value.zoom : null));

/** CMP-Notice: at most one at a time; a new one replaces the old. */
export const notice = signal<Notice | null>(null);

export interface DialogRequest {
  readonly kind: 'replace' | 'scale-down';
  readonly size?: Size;
  answer(ok: boolean): void;
}
/** CMP-ConfirmDialog, while open. */
export const dialog = signal<DialogRequest | null>(null);

/** CMP-ShortcutHelp, while open (F-013.R3): a modal dialog, so the rest of the tool is inert. */
export const shortcutsOpen = signal(false);

/** CMP-DropOverlay: a file is dragged over the tool. */
export const dragging = signal(false);

export interface LiveMessage {
  readonly id: number;
  readonly text: string;
}

/**
 * The polite live region: messages are appended (so one following another is not lost, and a repeated
 * one is announced again) and the region keeps only the latest few; clearing empties it.
 */
export const polite = signal<readonly LiveMessage[]>([]);
/** The assertive live region (errors): one message at a time. */
export const assertive = signal('');

const POLITE_KEEP = 3;
let nextId = 1;

/** Adds a message to the polite region (CMP-Canvas, CMP-Notice "Accessibility"). */
export function announcePolite(text: string): void {
  polite.value = [...polite.value, { id: nextId++, text }].slice(-POLITE_KEEP);
}

/** Clears the polite region (a progress message ends, the drop overlay disappears). */
export function clearPolite(): void {
  polite.value = [];
}

let assertiveTimer: ReturnType<typeof setTimeout> | undefined;

/** Writes an error into the assertive region, clearing it first so a repeated error is announced again. */
export function announceAssertive(text: string): void {
  clearTimeout(assertiveTimer);
  assertive.value = '';
  if (text) assertiveTimer = setTimeout(() => (assertive.value = text), 50);
}

/** Shows (or clears) the notice and announces it: errors assertively, the rest politely (CMP-Notice). */
export function setNotice(next: Notice | null): void {
  const previous = notice.value;
  notice.value = next;
  if (previous?.kind === 'progress') clearPolite(); // progress is cleared before any result
  if (!next) return;
  if (next.kind === 'error') announceAssertive(next.text());
  else announcePolite(next.text());
}
