// MOD-App load flow (F-001.R4/R5/R7, architecture.md "Load (F-001)"): checks first, then the
// scale-down choice, then — only for input that would load — the replace confirmation when the
// session is unexported (RULE-18). IO and the dialogs are fakes; the real ones run in e2e.
import { describe, expect, it, vi } from 'vitest';
import { loadFile, type LoadPorts } from '../../src/app/load';
import type { Notice } from '../../src/app/notice';
import type { ImageInfo } from '../../src/core';
import { startSession, type Session } from '../../src/document';
import type { DecodedImage, DecodeResult } from '../../src/io/decode';

const info = (width: number, height: number): ImageInfo => ({ width, height, sourceName: null, sourceType: 'png' });
const image = (width: number, height: number) =>
  ({ info: info(width, height), bitmap: { close: vi.fn() } as unknown as ImageBitmap }) satisfies DecodedImage;

function ports(result: DecodeResult, opts: { unexported?: boolean; confirm?: boolean[] } = {}) {
  const answers = [...(opts.confirm ?? [])];
  const notices: (Notice | null)[] = [];
  const asked: string[] = [];
  let session: Session | null = startSession(info(100, 100));
  if (opts.unexported) session.history.apply((d) => ({ ...d }), []);
  const p = {
    decode: vi.fn(async () => result),
    scaleDown: vi.fn(async (_img: DecodedImage, size: { width: number; height: number }) =>
      image(size.width, size.height),
    ),
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

const file = new File(['x'], 'x.png');
const last = (notices: (Notice | null)[]) => notices.filter(Boolean).at(-1)?.id;

describe('MOD-App loadFile', () => {
  it('F-001.AC10 with no unexported changes a new image replaces the current one without asking', async () => {
    const t = ports({ ok: true, image: image(300, 200) });
    expect(await loadFile(file, { extraFiles: false }, t.p)).toBe('loaded');
    expect(t.asked).toEqual([]);
    expect(t.p.replace).toHaveBeenCalledOnce();
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
    const big = image(6000, 3400);
    const t = ports(
      { ok: false, refused: 'too_large', scaleDownOffer: { width: 5441, height: 3083 }, image: big },
      { confirm: [true] },
    );
    expect(await loadFile(file, { extraFiles: false }, t.p)).toBe('loaded');
    expect(t.asked).toEqual(['scale-down']);
    expect(t.p.confirm).toHaveBeenCalledWith('scale-down', { width: 5441, height: 3083 });
    expect(t.p.replace.mock.calls[0]?.[0].info).toMatchObject({ width: 5441, height: 3083 });
  });

  it('F-001.AC7 cancelling the scale-down leaves the session unchanged and frees the decoded image', async () => {
    const big = image(6000, 3400);
    const t = ports({ ok: false, refused: 'too_large', scaleDownOffer: { width: 5441, height: 3083 }, image: big });
    const before = t.session();
    expect(await loadFile(file, { extraFiles: false }, t.p)).toBe('cancelled');
    expect(t.session()).toBe(before);
    expect(t.p.discard).toHaveBeenCalledWith(big);
  });

  it('F-001.R7 the scale-down choice comes before the replace confirmation', async () => {
    const big = image(6000, 3400);
    const t = ports(
      { ok: false, refused: 'too_large', scaleDownOffer: { width: 5441, height: 3083 }, image: big },
      { unexported: true, confirm: [true, true] },
    );
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
    expect(await loadFile(file, { extraFiles: true }, t.p)).toBe('loaded');
    expect(last(t.notices)).toBe('load.first_only');
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
