// MOD-App load flow (F-001.R4/R5/R7, architecture.md "Load (F-001)"): checks first, then the
// scale-down choice, then — only for input that would load — the replace confirmation when the
// session is unexported (RULE-18). IO and the dialogs are fakes; the real ones run in e2e.
import { describe, expect, it, vi } from 'vitest';
import { loadFile, type LoadPorts } from '../../src/app/load';
import type { Notice } from '../../src/app/notice';
import type { ImageInfo } from '../../src/core';
import { startSession, type Session } from '../../src/document';
import type { DecodedImage, DecodeResult, Oversize } from '../../src/io/decode';
import type { InputFile } from '../../src/io';

const info = (width: number, height: number): ImageInfo => ({ width, height, sourceName: null, sourceType: 'png' });
const image = (width: number, height: number) =>
  ({ info: info(width, height), bitmap: { close: vi.fn() } as unknown as ImageBitmap }) satisfies DecodedImage;

function ports(
  result: DecodeResult | DecodeResult[],
  opts: { unexported?: boolean; exported?: boolean; confirm?: boolean[] } = {},
) {
  const results = Array.isArray(result) ? [...result] : [result];
  const answers = [...(opts.confirm ?? [])];
  const notices: (Notice | null)[] = [];
  const asked: string[] = [];
  let session: Session | null = startSession(info(100, 100));
  if (opts.unexported || opts.exported)
    session.history.apply((d) => ({ ...d, padding: { ...d.padding, size: 'M' } }), []);
  if (opts.exported) session.markExported();
  const p = {
    decode: vi.fn(async (_input: InputFile) => (results.length > 1 ? results.shift() : results[0]) as DecodeResult),
    scaleDown: vi.fn(async (o: Oversize) => image(o.scaleDownOffer.width, o.scaleDownOffer.height)),
    discard: vi.fn(),
    confirm: vi.fn(async (kind: 'replace' | 'scale-down') => {
      asked.push(kind);
      return answers.shift() ?? false;
    }),
    unexported: () => session?.unexported ?? false,
    replace: vi.fn((img: DecodedImage) => {
      session = startSession(img.info);
    }),
    notify: (n: Notice | null) => notices.push(n),
    later: (_fn: () => void, _ms: number) => () => undefined,
  } satisfies LoadPorts;
  return { p, notices, asked, session: () => session };
}

const file: InputFile[] = [{ file: new File(['x'], 'x.png'), sourceName: 'x.png' }];
const files = (n: number): InputFile[] =>
  Array.from({ length: n }, (_, i) => ({ file: new File(['x'], `${i}.png`), sourceName: `${i}.png` }));
const oversize = (): DecodeResult => ({
  ok: true,
  file: new File(['x'], 'big.png'),
  sourceName: 'big.png',
  sourceType: 'png',
  scaleDownOffer: { width: 5441, height: 3083 },
});
const last = (notices: (Notice | null)[]) => notices.filter(Boolean).at(-1)?.id;

describe('MOD-App loadFile', () => {
  it('F-001.AC10 with no unexported changes a new image replaces the current one without asking', async () => {
    const t = ports({ ok: true, image: image(300, 200) });
    expect(await loadFile(file, { extraFiles: false }, t.p)).toBe('loaded');
    expect(t.asked).toEqual([]);
    expect(t.p.replace).toHaveBeenCalledOnce();
  });

  it('F-001.AC10 right after an export (edits made, then exported) a new image loads without asking', async () => {
    const t = ports({ ok: true, image: image(300, 200) }, { exported: true });
    expect(t.session()?.history.canUndo).toBe(true);
    expect(await loadFile(file, { extraFiles: false }, t.p)).toBe('loaded');
    expect(t.asked).toEqual([]);
  });

  it('F-001.AC9 with unexported changes, confirming replaces with a new session (no annotations, empty history)', async () => {
    const t = ports({ ok: true, image: image(300, 200) }, { unexported: true, confirm: [true] });
    expect(await loadFile(file, { extraFiles: false }, t.p)).toBe('loaded');
    expect(t.asked).toEqual(['replace']);
    const s = t.session();
    expect(s?.doc.annotations).toEqual([]);
    expect(s?.history.canUndo).toBe(false);
    expect(s?.unexported).toBe(false);
  });

  it('F-001.AC9 with unexported changes, cancelling keeps everything and frees the new image', async () => {
    const t = ports({ ok: true, image: image(300, 200) }, { unexported: true, confirm: [false] });
    const before = t.session();
    expect(await loadFile(file, { extraFiles: false }, t.p)).toBe('cancelled');
    expect(t.p.replace).not.toHaveBeenCalled();
    expect(t.session()).toBe(before);
    expect(t.session()?.history.canUndo).toBe(true);
    expect(t.p.discard).toHaveBeenCalledOnce();
  });

  it('F-001.AC14 with unexported changes, a refused file shows its error and never asks to replace', async () => {
    const t = ports({ ok: false, refused: 'unsupported_format' }, { unexported: true });
    expect(await loadFile(file, { extraFiles: false }, t.p)).toBe('refused');
    expect(t.asked).toEqual([]);
    expect(t.p.replace).not.toHaveBeenCalled();
    expect(last(t.notices)).toBe('error.unsupported_format');
  });

  it('F-001.AC7 an oversize image asks to scale down first; accepting loads it at the offered size', async () => {
    const t = ports(oversize(), { confirm: [true] });
    expect(await loadFile(file, { extraFiles: false }, t.p)).toBe('loaded');
    expect(t.asked).toEqual(['scale-down']);
    expect(t.p.confirm).toHaveBeenCalledWith('scale-down', { width: 5441, height: 3083 });
    expect(t.p.replace.mock.calls[0]?.[0].info).toMatchObject({ width: 5441, height: 3083 });
  });

  it('F-001.AC7 ADR-0023 cancelling the scale-down leaves the session unchanged and decodes nothing', async () => {
    const t = ports(oversize());
    const before = t.session();
    expect(await loadFile(file, { extraFiles: false }, t.p)).toBe('cancelled');
    expect(t.session()).toBe(before);
    expect(t.p.scaleDown).not.toHaveBeenCalled();
    expect(t.p.discard).not.toHaveBeenCalled();
  });

  it('F-001.AC7 a scaled decode that fails shows COPY-error.decode_failed', async () => {
    const t = ports(oversize(), { confirm: [true] });
    t.p.scaleDown.mockRejectedValueOnce(new Error('x'));
    expect(await loadFile(file, { extraFiles: false }, t.p)).toBe('refused');
    expect(last(t.notices)).toBe('error.decode_failed');
  });

  it('F-001.R7 the scale-down choice comes before the replace confirmation', async () => {
    const t = ports(oversize(), { unexported: true, confirm: [true, true] });
    expect(await loadFile(file, { extraFiles: false }, t.p)).toBe('loaded');
    expect(t.asked).toEqual(['scale-down', 'replace']);
  });

  it('F-001.AC6 a too-large file shows COPY-error.file_too_large with 50 MB', async () => {
    const t = ports({ ok: false, refused: 'file_too_large' });
    expect(await loadFile(file, { extraFiles: false }, t.p)).toBe('refused');
    const n = t.notices.filter(Boolean).at(-1);
    expect(n).toMatchObject({ kind: 'error', id: 'error.file_too_large' });
    expect(n?.text()).toBe('This file is larger than 50 MB.');
  });

  it('F-001.AC13 an undecodable file shows COPY-error.decode_failed and changes nothing', async () => {
    const t = ports({ ok: false, refused: 'decode_failed' });
    const before = t.session();
    expect(await loadFile(file, { extraFiles: false }, t.p)).toBe('refused');
    expect(last(t.notices)).toBe('error.decode_failed');
    expect(t.session()).toBe(before);
  });

  it('F-001.AC12 when several files arrive, the first loads and COPY-load.first_only is shown', async () => {
    const t = ports({ ok: true, image: image(300, 200) });
    expect(await loadFile(files(2), { extraFiles: true }, t.p)).toBe('loaded');
    expect(t.p.decode).toHaveBeenCalledOnce();
    expect(t.p.decode.mock.calls[0]?.[0].sourceName).toBe('0.png');
    expect(last(t.notices)).toBe('load.first_only');
  });

  it('F-001 edge case: in a multi-file drop the first file that passes RULE-01 loads, with first_only', async () => {
    const t = ports([
      { ok: false, refused: 'unsupported_format' },
      { ok: true, image: image(300, 200) },
    ]);
    expect(await loadFile(files(2), { extraFiles: true }, t.p)).toBe('loaded');
    expect(t.p.decode).toHaveBeenCalledTimes(2);
    expect(t.notices.filter(Boolean).map((n) => n?.id)).toEqual(['load.first_only']);
  });

  it("F-001 edge case: in a multi-file drop where none passes, the first file's refusal shows", async () => {
    const t = ports([
      { ok: false, refused: 'file_too_large' },
      { ok: false, refused: 'unsupported_format' },
    ]);
    expect(await loadFile(files(2), { extraFiles: true }, t.p)).toBe('refused');
    expect(last(t.notices)).toBe('error.file_too_large');
    expect(t.p.replace).not.toHaveBeenCalled();
  });

  it('F-001.AC5 the unsupported-format message names the formats this browser decodes', async () => {
    const t = ports({ ok: false, refused: 'unsupported_format' });
    await loadFile(file, { extraFiles: false }, t.p);
    expect(t.notices.filter(Boolean).at(-1)?.text()).toBe(
      "This file type isn't supported. Use PNG, JPEG, WebP, GIF, or BMP.",
    );
  });

  it('F-001 UX notes: decoding longer than 0.5 s shows COPY-load.loading, cleared when done', async () => {
    const t = ports({ ok: true, image: image(300, 200) });
    let fire: (() => void) | undefined;
    t.p.later = (fn, ms) => {
      expect(ms).toBe(500);
      fire = fn;
      return () => undefined;
    };
    t.p.decode.mockImplementationOnce(async () => {
      fire?.();
      return { ok: true, image: image(300, 200) };
    });
    await loadFile(file, { extraFiles: false }, t.p);
    const ids = t.notices.map((n) => n?.id ?? null);
    expect(ids).toContain('load.loading');
    expect(ids.indexOf(null, ids.indexOf('load.loading'))).toBeGreaterThan(ids.indexOf('load.loading'));
  });
});
