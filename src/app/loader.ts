// MOD-App — wires MOD-IO input (paste, drop, pick, Mod+O) to the load flow (./load.ts) and the
// SCR-Annotator signals (./state.ts).
// Implements: F-001.R1/R2/R3 (entry points), F-001.R7 (new session), RULE-19 (Load keys: Mod+O; no key
// acts while text is edited or a dialog is open); NFR-04 (the replaced image is closed).
import { t } from '../copy';
import { startSession } from '../document';
import {
  decodeInput,
  discard,
  onImageInput,
  openPicker,
  probeAvif,
  scaleDown,
  withoutSourceName,
  type DecodeResult,
  type ImageInput,
} from '../io';
import { loadFile, noImageNotice, refusalNotice, type LoadPorts } from './load';
import { isMod } from './platform';
import { announce, dialog, dragging, loaded, polite, setNotice } from './state';

let busy = false;

/** RULE-15: a pasted image has no source name. */
function forPaste(result: DecodeResult): DecodeResult {
  if (result.ok) return { ok: true, image: withoutSourceName(result.image) };
  if (result.refused === 'too_large') return { ...result, image: withoutSourceName(result.image) };
  return result;
}

function ports(via: ImageInput['via']): LoadPorts {
  return {
    decode: async (file) => {
      const result = await decodeInput(file);
      return via === 'paste' ? forPaste(result) : result;
    },
    scaleDown: (image, size) => scaleDown(image, size),
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
    unexported: () => loaded.value?.session.unexported ?? false,
    replace(image) {
      const previous = loaded.value;
      loaded.value = { image, session: startSession(image.info) };
      previous?.image.bitmap.close();
      // CMP-Canvas: image loads are announced with COPY-a11y.loaded.
      announce(polite, t('a11y.loaded', { width: image.info.width, height: image.info.height }));
    },
    notify: setNotice,
    later(fn, ms) {
      const id = setTimeout(fn, ms);
      return () => clearTimeout(id);
    },
  };
}

async function run({ file, via, extraFiles }: ImageInput): Promise<void> {
  busy = true;
  try {
    await loadFile(file, { extraFiles }, ports(via));
  } finally {
    busy = false;
  }
}

function isEditingText(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLTextAreaElement ||
    (target instanceof HTMLInputElement && !['button', 'checkbox', 'radio'].includes(target.type)) ||
    (target instanceof HTMLElement && target.isContentEditable)
  );
}

/** RULE-19 "Load": Mod+O opens a file. Letters follow the typed character, or the US key position. */
function onKeyDown(e: KeyboardEvent): void {
  if (!isMod(e) || e.shiftKey) return;
  const key = e.key.toLowerCase();
  if (key !== 'o' && !(!/^[a-z]$/.test(key) && e.code === 'KeyO')) return;
  if (dialog.value || isEditingText(e.target)) return;
  e.preventDefault();
  openPicker();
}

/** The open action (CMP-Toolbar, CMP-EmptyState). */
export function openImage(): void {
  if (!dialog.value) openPicker();
}

/** Starts listening for images; called once after the shell has mounted. Returns a stop function. */
export function startLoader(): () => void {
  void probeAvif();
  const stop = onImageInput({
    file(input) {
      // Input that arrives while a dialog is open or a load is running is ignored (RULE-19: a dialog
      // makes the rest of the tool inert).
      if (busy || dialog.value) return;
      void run(input);
    },
    noImage(via) {
      if (busy || dialog.value) return;
      setNotice(via === 'paste' ? noImageNotice : refusalNotice('unsupported_format'));
    },
    dragging(active) {
      const show = active && !dialog.value;
      if (dragging.value === show) return;
      dragging.value = show;
      // CMP-DropOverlay: announced politely each time it appears; cleared when it disappears.
      announce(polite, show ? t('load.drop_here') : '');
    },
  });
  document.addEventListener('keydown', onKeyDown);
  return () => {
    stop();
    document.removeEventListener('keydown', onKeyDown);
  };
}
