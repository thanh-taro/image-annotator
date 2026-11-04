// MOD-App — the export flow (architecture.md "Export (F-012, ADR-0007)"): editing ends first (F-012 edge
// case), then — in the same task as the click or key press, so the clipboard item is created inside the
// gesture (ADR-0007 §4, ADR-0021) — MOD-IO is asked to copy or download the document as it is now. While it
// takes longer than 0.5 s COPY-export.preparing shows. Success records the export at the change epoch the
// exported document had (RULE-18) and tells the user, with the redaction count of what was exported
// (RULE-20); a refused clipboard offers the download (F-012.R5); any other failure shows
// COPY-error.export_failed and leaves the session unchanged and unexported (F-012.R7).
// The ports are MOD-IO, the canvas and the session store (./state.ts); unit tests replace them.
// Implements: F-012.R1/R2/R4/R5/R6/R7/R8, RULE-18, RULE-20, CMP-Notice progress after 0.5 s.
import { t } from '../copy';
import { canvasRect, redactionCount } from '../core';
import type { Doc, Session } from '../document';
import type { DecodedImage, ExportResult } from '../io';
import type { Notice } from './notice';

/** SCR-Annotator "exporting": COPY-export.preparing shows only when the export takes longer than this. */
export const PROGRESS_DELAY_MS = 500;

export type ExportKind = 'copy' | 'download';

export interface ExportPorts {
  /** The loaded image, its session and the current document, or null in the empty state. */
  current(): { readonly image: DecodedImage; readonly session: Session; readonly doc: Doc } | null;
  /** Ends a text edit, keeping the text (F-012 edge case: the text is included). */
  endTextEdit(): void;
  /** MOD-IO `copyResult`: must start synchronously (the clipboard item is created in the gesture). */
  copy(doc: Doc, image: DecodedImage): Promise<ExportResult>;
  /** MOD-IO `downloadResult`. */
  download(doc: Doc, image: DecodedImage, localTime: Date): Promise<ExportResult>;
  /** The local time (RULE-15 file name of a pasted image). */
  now(): Date;
  notify(notice: Notice | null): void;
  /** Runs `fn` after `ms` unless the returned function is called first. */
  later(fn: () => void, ms: number): () => void;
  /** RULE-18: records the export of `session` at change epoch `at` (if it is still the current session). */
  exported(session: Session, at: number): void;
}

/** RULE-20: the redactions overlapping the canvas (what is exported) — the toolbar count (F-012.R8). */
export function toolbarCount(doc: Doc | null): number {
  return doc ? redactionCount(doc.annotations, canvasRect(doc.frame, doc.padding.size)) : 0;
}

const preparing: Notice = { kind: 'progress', id: 'export.preparing', text: () => t('export.preparing') };
const failed: Notice = { kind: 'error', id: 'error.export_failed', text: () => t('error.export_failed') };

function successNotice(kind: ExportKind, count: number, fileName: string): Notice {
  if (kind === 'copy')
    return count > 0
      ? { kind: 'success', id: 'export.copied_redactions', text: () => t('export.copied_redactions', { count }) }
      : { kind: 'success', id: 'export.copied', text: () => t('export.copied') };
  return count > 0
    ? {
        kind: 'success',
        id: 'export.downloaded_redactions',
        text: () => t('export.downloaded_redactions', { count, file_name: fileName }),
      }
    : { kind: 'success', id: 'export.downloaded', text: () => t('export.downloaded', { file_name: fileName }) };
}

let busy = false;

/**
 * Copies or downloads the result (F-012.R1/R2). An export asked for while one runs, or with no image,
 * does nothing. Resolves when the result has been shown.
 */
export async function exportResult(kind: ExportKind, ports: ExportPorts): Promise<void> {
  if (busy || !ports.current()) return;
  ports.endTextEdit(); // the edited text is committed first and included
  const current = ports.current();
  if (!current) return;
  const { image, session, doc } = current;
  const epoch = session.epoch;
  const count = toolbarCount(doc);
  busy = true;
  ports.notify(null); // a new action replaces an error notice (CMP-Notice)
  let shown = false;
  let cancel = () => {};
  let result: ExportResult;
  try {
    // Started before any await: the copy's clipboard item is created in the gesture's task.
    const work = kind === 'copy' ? ports.copy(doc, image) : ports.download(doc, image, ports.now());
    cancel = ports.later(() => {
      shown = true;
      ports.notify(preparing);
    }, PROGRESS_DELAY_MS);
    result = await work;
  } catch {
    result = { ok: false, code: 'export_failed' };
  } finally {
    cancel();
    busy = false;
  }
  if (shown) ports.notify(null); // the progress message ends before any result (CMP-Notice)
  if (result.ok) {
    ports.exported(session, epoch);
    ports.notify(successNotice(kind, count, result.fileName ?? ''));
  } else if (result.code === 'clipboard') {
    ports.notify({
      kind: 'error',
      id: 'error.clipboard',
      text: () => t('error.clipboard'),
      action: { label: 'action.download', run: () => void exportResult('download', ports) },
    });
  } else ports.notify(failed);
}
