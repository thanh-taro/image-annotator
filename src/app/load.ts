// MOD-App — the load flow (architecture.md "Load (F-001)"): checks → scale-down choice → only then,
// if the session is unexported, the replace confirmation → new session. Any refusal or cancel leaves
// the current session unchanged. The ports are MOD-IO, the dialogs and the session store (./state.ts);
// unit tests replace them.
// Implements: F-001.R4, F-001.R5, F-001.R7; RULE-01, RULE-02, RULE-18; CMP-Notice progress after 0.5 s.
import { formatNumber, language, t } from '../copy';
import { MAX_FILE_BYTES } from '../core';
import {
  supportedFormatNames,
  type DecodedImage,
  type DecodeResult,
  type InputFile,
  type Oversize,
  type Refusal,
  type Size,
} from '../io';
import type { Notice } from './notice';

/** CMP-Notice progress: shown only when the work takes longer than this (UX notes, SCR-Annotator "loading"). */
export const PROGRESS_DELAY_MS = 500;

export interface LoadPorts {
  decode(input: InputFile): Promise<DecodeResult>;
  /** One decode at the offered size (ADR-0023). */
  scaleDown(image: Oversize): Promise<DecodedImage>;
  /** Frees a decoded image that will not be loaded (NFR-04). */
  discard(image: DecodedImage): void;
  /** CMP-ConfirmDialog; resolves true for the primary action, false for cancel or Esc. */
  confirm(kind: 'replace' | 'scale-down', size?: Size): Promise<boolean>;
  /** RULE-18 for the current session (false when no image is loaded). */
  unexported(): boolean;
  /** Starts a new session with this image (ENT-Session), freeing the previous one. */
  replace(image: DecodedImage): void;
  notify(notice: Notice | null): void;
  /** Runs `fn` after `ms` unless the returned function is called first. */
  later(fn: () => void, ms: number): () => void;
}

export type LoadOutcome = 'loaded' | 'refused' | 'cancelled';

const error = (id: Notice['id'], text: () => string): Notice => ({ kind: 'error', id, text });

/** The CMP-Notice for a refusal code (COPY-error.*). */
export function refusalNotice(code: Refusal): Notice {
  switch (code) {
    case 'file_too_large':
      return error('error.file_too_large', () =>
        t('error.file_too_large', { limit: `${formatNumber(MAX_FILE_BYTES / 1_000_000)} MB` }),
      );
    case 'unsupported_format':
      return error('error.unsupported_format', () =>
        t('error.unsupported_format', {
          formats: new Intl.ListFormat(language.value, { type: 'disjunction' }).format(supportedFormatNames()),
        }),
      );
    case 'decode_failed':
      return error('error.decode_failed', () => t('error.decode_failed'));
  }
}

export const noImageNotice: Notice = error('load.no_image_in_clipboard', () => t('load.no_image_in_clipboard'));

const loadingNotice: Notice = { kind: 'progress', id: 'load.loading', text: () => t('load.loading') };
/** CMP-Notice: COPY-load.first_only is a success notice. */
const firstOnlyNotice: Notice = { kind: 'success', id: 'load.first_only', text: () => t('load.first_only') };

/** Runs `work`, showing COPY-load.loading if it takes longer than 0.5 s and clearing it after. */
async function withProgress<T>(ports: LoadPorts, work: () => Promise<T>): Promise<T> {
  let shown = false;
  const cancel = ports.later(() => {
    shown = true;
    ports.notify(loadingNotice);
  }, PROGRESS_DELAY_MS);
  try {
    return await work();
  } finally {
    cancel();
    if (shown) ports.notify(null);
  }
}

/**
 * Checks, decodes and (after the user's choices) loads one of the files (F-001.R7). With several
 * files, the first that passes the checks loads, with COPY-load.first_only; if none passes, the first
 * file's refusal shows (F-001 edge cases, RULE-01).
 */
export async function loadFile(
  files: readonly InputFile[],
  opts: { extraFiles: boolean },
  ports: LoadPorts,
): Promise<LoadOutcome> {
  ports.notify(null); // a new action replaces an error notice (CMP-Notice)
  let result: Extract<DecodeResult, { ok: true }> | undefined;
  let firstRefusal: Refusal | undefined;
  for (const input of files) {
    let r: DecodeResult;
    try {
      r = await withProgress(ports, () => ports.decode(input));
    } catch {
      r = { ok: false, refused: 'decode_failed' };
    }
    if (r.ok) {
      result = r;
      break;
    }
    firstRefusal ??= r.refused;
  }
  if (!result) {
    ports.notify(refusalNotice(firstRefusal ?? 'unsupported_format'));
    return 'refused';
  }

  let image: DecodedImage;
  if (result.image) image = result.image;
  else {
    // ADR-0023 §2: the scale-down question comes before any decode; cancelling decodes nothing.
    const oversize = result;
    if (!(await ports.confirm('scale-down', oversize.scaleDownOffer))) return 'cancelled';
    try {
      image = await withProgress(ports, () => ports.scaleDown(oversize));
    } catch {
      ports.notify(refusalNotice('decode_failed'));
      return 'refused';
    }
  }

  if (ports.unexported() && !(await ports.confirm('replace'))) {
    ports.discard(image);
    return 'cancelled';
  }
  ports.replace(image);
  if (opts.extraFiles) ports.notify(firstOnlyNotice);
  return 'loaded';
}
