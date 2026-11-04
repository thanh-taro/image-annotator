// MOD-App export flow (F-012.R4/R5/R7, architecture.md "Export (F-012, ADR-0007)"): the copy is started
// in the same task as the gesture, editing ends first, the result notice carries the redaction count of
// what was exported (RULE-20), success records the export (RULE-18), and any failure leaves the session
// unchanged and unexported. MOD-IO is a fake here; the real pipeline runs in tests/e2e/export.spec.ts.
import { describe, expect, it, vi } from 'vitest';
import { exportResult, PROGRESS_DELAY_MS, toolbarCount, type ExportPorts } from '../../src/app/export';
import type { Notice } from '../../src/app/notice';
import { translate } from '../../src/copy';
import { DEFAULT_STYLES, type Annotation, type ImageInfo } from '../../src/core';
import { add, startSession, type Doc, type Session } from '../../src/document';
import type { DecodedImage, ExportResult } from '../../src/io';

const info: ImageInfo = { width: 400, height: 300, sourceName: 'login-bug.jpg', sourceType: 'jpeg' };
const image = { info, bitmap: {} as ImageBitmap } satisfies DecodedImage;

const redaction = (id: string, x: number, kind: 'solid' | 'blur' = 'solid'): Annotation =>
  ({
    id,
    kind: 'redaction',
    box: { x, y: 20, width: 40, height: 20 },
    style: { ...DEFAULT_STYLES.redact, redactionKind: kind },
  }) as Annotation;
const rect = (id: string): Annotation =>
  ({
    id,
    kind: 'rectangle',
    box: { x: 10, y: 10, width: 50, height: 40 },
    style: DEFAULT_STYLES.rectangle,
  }) as Annotation;

function setup(annotations: Annotation[], results: { copy?: ExportResult; download?: ExportResult } = {}) {
  const session: Session = startSession(info);
  for (const a of annotations) session.history.apply(add(a), []);
  const notices: (Notice | null)[] = [];
  const timers: (() => void)[] = [];
  const order: string[] = [];
  let resolveCopy: (r: ExportResult) => void = () => undefined;
  const p = {
    current: () => ({ image, session, doc: session.doc }),
    endTextEdit: vi.fn(() => order.push('endTextEdit')),
    copy: vi.fn((_doc: Doc, _img: DecodedImage) => {
      order.push('copy');
      return results.copy
        ? Promise.resolve(results.copy)
        : new Promise<ExportResult>((r) => {
            resolveCopy = r;
          });
    }),
    download: vi.fn(async (_doc: Doc, _img: DecodedImage, _t: Date) => {
      order.push('download');
      return results.download ?? { ok: true as const, fileName: 'login-bug-annotated.png' };
    }),
    now: () => new Date(2026, 9, 27, 14, 5, 9),
    notify: (n: Notice | null) => notices.push(n),
    later: (fn: () => void, _ms: number) => {
      timers.push(fn);
      return () => {
        const i = timers.indexOf(fn);
        if (i >= 0) timers.splice(i, 1);
      };
    },
    exported: vi.fn((s: Session, at: number) => s.markExported(at)),
  } satisfies ExportPorts;
  return { p, session, notices, timers, order, resolve: (r: ExportResult) => resolveCopy(r) };
}

const lastNotice = (notices: (Notice | null)[]) => notices.filter(Boolean).at(-1);
const en = (n: Notice | null | undefined) => n?.text();

describe('MOD-App exportResult', () => {
  it('F-012.AC6 two solid and one blur redaction: the copy notice says 3 redactions applied', async () => {
    const s = setup([redaction('a', 10), redaction('b', 100), redaction('c', 200, 'blur')], {
      copy: { ok: true },
    });
    await exportResult('copy', s.p);
    const n = lastNotice(s.notices);
    expect(n?.kind).toBe('success');
    expect(n?.id).toBe('export.copied_redactions');
    expect(en(n)).toBe(translate('en-US', 'export.copied_redactions', { count: 3 }));
  });

  it('F-012.AC1 F-012.R1 the copy is started in the same task as the gesture, after editing ends', async () => {
    const s = setup([rect('r')]);
    const done = exportResult('copy', s.p);
    // No await yet: ClipboardItem must be created synchronously in the gesture (ADR-0007 §4, ADR-0021).
    expect(s.order).toEqual(['endTextEdit', 'copy']);
    s.resolve({ ok: true });
    await done;
  });

  it('F-012.AC7 F-012.R5 a refused clipboard shows COPY-error.clipboard with the download action', async () => {
    const s = setup([rect('r')], { copy: { ok: false, code: 'clipboard' } });
    await exportResult('copy', s.p);
    const n = lastNotice(s.notices);
    expect(n?.kind).toBe('error');
    expect(n?.id).toBe('error.clipboard');
    expect(n?.action?.label).toBe('action.download');
    expect(s.session.unexported).toBe(true);
    n?.action?.run();
    await vi.waitFor(() => expect(s.p.download).toHaveBeenCalledTimes(1));
    await vi.waitFor(() => expect(lastNotice(s.notices)?.id).toBe('export.downloaded'));
  });

  it('F-012.AC10 one solid redaction: COPY-export.downloaded_redactions with count 1 and the file name', async () => {
    const s = setup([redaction('a', 10)]);
    await exportResult('download', s.p);
    const n = lastNotice(s.notices);
    expect(n?.id).toBe('export.downloaded_redactions');
    expect(en(n)).toBe(
      translate('en-US', 'export.downloaded_redactions', { count: 1, file_name: 'login-bug-annotated.png' }),
    );
    expect(s.p.download.mock.calls[0]?.[2]).toEqual(new Date(2026, 9, 27, 14, 5, 9));
  });

  it('F-012.AC10 no redactions: COPY-export.downloaded', async () => {
    const s = setup([rect('r')]);
    await exportResult('download', s.p);
    expect(lastNotice(s.notices)?.id).toBe('export.downloaded');
    expect(en(lastNotice(s.notices))).toBe('Downloaded login-bug-annotated.png.');
  });

  it('F-012.AC11 RULE-20 a redaction entirely outside the canvas is not counted, in the toolbar or the message', async () => {
    const s = setup([redaction('in', 10), redaction('out', 500)], { copy: { ok: true } });
    expect(toolbarCount(s.session.doc)).toBe(1);
    await exportResult('copy', s.p);
    expect(en(lastNotice(s.notices))).toBe(translate('en-US', 'export.copied_redactions', { count: 1 }));
  });

  it('F-012.AC12 F-012.R8 with no redactions the toolbar count is 0 (hidden) and the copy says COPY-export.copied', async () => {
    const s = setup([rect('r')], { copy: { ok: true } });
    expect(toolbarCount(s.session.doc)).toBe(0);
    expect(toolbarCount(null)).toBe(0);
    await exportResult('copy', s.p);
    expect(lastNotice(s.notices)?.id).toBe('export.copied');
  });

  it('F-012.R4 RULE-18 a successful export marks the session exported', async () => {
    const s = setup([rect('r')], { copy: { ok: true } });
    expect(s.session.unexported).toBe(true);
    await exportResult('copy', s.p);
    expect(s.p.exported).toHaveBeenCalledWith(s.session, s.session.epoch);
    expect(s.session.unexported).toBe(false);
  });

  it('F-012.AC13 F-012.R7 a failed export shows COPY-error.export_failed and the session stays unexported', async () => {
    const s = setup([rect('r')], { download: { ok: false, code: 'export_failed' } });
    const before = s.session.doc;
    await exportResult('download', s.p);
    const n = lastNotice(s.notices);
    expect(n?.kind).toBe('error');
    expect(n?.id).toBe('error.export_failed');
    expect(n?.action).toBeUndefined();
    expect(s.p.exported).not.toHaveBeenCalled();
    expect(s.session.unexported).toBe(true);
    expect(s.session.doc).toBe(before);
  });

  it('F-012.R7 a copy whose image could not be produced is export_failed, not a clipboard refusal', async () => {
    const s = setup([rect('r')], { copy: { ok: false, code: 'export_failed' } });
    await exportResult('copy', s.p);
    expect(lastNotice(s.notices)?.id).toBe('error.export_failed');
  });

  it('RULE-18 a change made while the export runs keeps the session unexported', async () => {
    const s = setup([rect('r')]);
    const done = exportResult('copy', s.p);
    s.session.history.apply(add(rect('r2')), []);
    s.resolve({ ok: true });
    await done;
    expect(s.session.unexported).toBe(true);
  });

  it('F-012 UX notes COPY-export.preparing shows only after 0.5 s and is cleared before the result', async () => {
    const s = setup([rect('r')]);
    expect(PROGRESS_DELAY_MS).toBe(500);
    const done = exportResult('copy', s.p);
    expect(s.notices.filter(Boolean)).toEqual([]);
    s.timers.shift()?.();
    expect(lastNotice(s.notices)?.id).toBe('export.preparing');
    expect(lastNotice(s.notices)?.kind).toBe('progress');
    s.resolve({ ok: true });
    await done;
    expect(s.notices.at(-2)).toBeNull();
    expect(lastNotice(s.notices)?.id).toBe('export.copied');
  });

  it('F-012 a second export while one runs is ignored; with no image nothing happens', async () => {
    const s = setup([rect('r')]);
    const first = exportResult('copy', s.p);
    await exportResult('download', s.p);
    expect(s.p.download).not.toHaveBeenCalled();
    s.resolve({ ok: true });
    await first;
    const none = { ...s.p, current: () => null };
    await exportResult('download', none);
    expect(s.p.download).not.toHaveBeenCalled();
  });
});
