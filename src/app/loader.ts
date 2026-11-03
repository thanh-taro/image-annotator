// MOD-App — wires MOD-IO input (paste, drop, pick, Mod+O) to the load flow (./load.ts) and the
// SCR-Annotator signals (./state.ts).
// Implements: F-001.R1/R2/R3 (entry points), F-001.R7 (new session), F-001 edge cases (input during a
// load or a dialog is ignored; a folder-only drop is refused), RULE-19 (Load keys: Mod+O, kept from
// the browser; only Esc acts while a dialog is open; no key acts while text is edited).
import { t } from '../copy';
import { decodeInput, discard, isEditing, onImageInput, openPicker, probeAvif, scaleDown } from '../io';
import type { ImageInput } from '../io';
import { loadFile, noImageNotice, refusalNotice, type LoadPorts } from './load';
import { isMod } from './platform';
import { announcePolite, clearPolite, dialog, dragging, setNotice, startNewSession, unexported } from './state';

let busy = false;

/** A load is running (F-001 edge case: further input is ignored). */
export const isBusy = () => busy;

const ports: LoadPorts = {
  decode: ({ file, sourceName }) => decodeInput(file, sourceName),
  scaleDown: (image) => scaleDown(image),
  discard,
  confirm: (kind, size) =>
    new Promise((resolve) => {
      dialog.value = {
        kind,
        ...(size ? { size } : {}),
        answer(ok) {
          dialog.value = null;
          resolve(ok);
        },
      };
    }),
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

/** RULE-19 "Load": Mod+O opens a file. Letters follow the typed character, or the US key position. */
function onKeyDown(e: KeyboardEvent): void {
  if (!isMod(e) || e.shiftKey) return;
  const key = e.key.toLowerCase();
  if (key !== 'o' && !(!/^[a-z]$/.test(key) && e.code === 'KeyO')) return;
  if (isEditing(e.target)) return;
  e.preventDefault(); // kept from the browser even when it does nothing (RULE-19)
  if (dialog.value || busy) return;
  openPicker();
}

/** The open action (CMP-Toolbar, CMP-EmptyState); does nothing while a load or a dialog is in progress. */
export function openImage(): void {
  if (!dialog.value && !busy) openPicker();
}

/** Starts listening for images; called once after the shell has mounted. Returns a stop function. */
export function startLoader(): () => void {
  void probeAvif();
  const stop = onImageInput({
    file(input) {
      // F-001 edge case: input that arrives while an image is loading or a dialog is open is ignored.
      if (busy || dialog.value) return;
      void run(input);
    },
    noImage(via) {
      if (busy || dialog.value) return;
      // F-001 edge case: a drop that holds no files (only folders) is refused as unsupported.
      setNotice(via === 'paste' ? noImageNotice : refusalNotice('unsupported_format'));
    },
    dragging(active) {
      const show = active && !dialog.value;
      if (dragging.value === show) return;
      dragging.value = show;
      // CMP-DropOverlay: announced politely each time it appears; cleared when it disappears.
      if (show) announcePolite(t('load.drop_here'));
      else clearPolite();
    },
  });
  document.addEventListener('keydown', onKeyDown);
  return () => {
    stop();
    document.removeEventListener('keydown', onKeyDown);
  };
}
