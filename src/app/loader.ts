// MOD-App — wires MOD-IO input (paste, drop, pick, Mod+O) to the load flow (./load.ts) and the
// SCR-Annotator signals (./state.ts).
// Implements: F-001.R1/R2/R3 (entry points), F-001.R7 (new session), F-001 edge cases (input during a
// load or a dialog is ignored; a folder-only drop is refused), RULE-19 (Load keys: Mod+O, kept from
// the browser; only Esc acts while a dialog is open; no key acts while text is edited).
import { t } from '../copy';
import { decodeInput, discard, onImageInput, openPicker, probeAvif, scaleDown } from '../io';
import type { ImageInput } from '../io';
import { loadFile, noImageNotice, refusalNotice, type LoadPorts } from './load';
import {
  announcePolite,
  askConfirm,
  clearPolite,
  dragging,
  modalOpen,
  moreOpen,
  setNotice,
  startNewSession,
  unexported,
} from './state';

/**
 * Input arrives while a dialog or menu is open: it is ignored (F-001 edge case; RULE-19 "while a dialog or
 * menu is open, only Esc acts"). An open COPY-action.more menu closes, so the next paste or drop works.
 */
function blocked(): boolean {
  if (busy || modalOpen()) return true;
  if (!moreOpen.value) return false;
  moreOpen.value = false;
  return true;
}

let busy = false;

/** A load is running (F-001 edge case: further input is ignored). */
export const isBusy = () => busy;

const ports: LoadPorts = {
  decode: ({ file, sourceName }) => decodeInput(file, sourceName),
  scaleDown: (image) => scaleDown(image),
  discard,
  confirm: askConfirm,
  unexported: () => unexported.value,
  replace(image) {
    startNewSession(image);
    // CMP-Canvas: image loads are announced with COPY-a11y.loaded.
    announcePolite(t('a11y.loaded', { width: image.info.width, height: image.info.height }));
  },
  notify: setNotice,
  later(fn, ms) {
    const id = setTimeout(fn, ms);
    return () => clearTimeout(id);
  },
};

async function run({ files, extraFiles }: ImageInput): Promise<void> {
  busy = true;
  try {
    await loadFile(files, { extraFiles }, ports);
  } finally {
    busy = false;
  }
}

/**
 * The open action (CMP-Toolbar, CMP-EmptyState, and RULE-19 Mod+O through MOD-Keys since F-013); does
 * nothing while a load or a dialog is in progress.
 */
export function openImage(): void {
  if (!modalOpen() && !busy) openPicker();
}

/** Starts listening for images; called once after the shell has mounted. Returns a stop function. */
export function startLoader(): () => void {
  void probeAvif();
  const stop = onImageInput({
    file(input) {
      // F-001 edge case: input that arrives while an image is loading or a dialog is open is ignored.
      if (blocked()) return;
      void run(input);
    },
    noImage(via) {
      if (blocked()) return;
      // F-001 edge case: a drop that holds no files (only folders) is refused as unsupported.
      setNotice(via === 'paste' ? noImageNotice : refusalNotice('unsupported_format'));
    },
    dragging(active) {
      const show = active && !modalOpen();
      if (dragging.value === show) return;
      dragging.value = show;
      // CMP-DropOverlay: announced politely each time it appears; cleared when it disappears.
      if (show) announcePolite(t('load.drop_here'));
      else clearPolite();
    },
  });
  return stop;
}
