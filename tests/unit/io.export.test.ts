// MOD-IO export pipeline (ADR-0007, ADR-0022, F-012.R7) with a fake canvas, anchor, effects and timers:
// the bounded wait for effects and fonts, the held patches released after painting, the export canvas
// freed on every path, the image painted without smoothing, and the download URL revoked 2 s later (at
// once when the click throws). The real pipeline runs in tests/e2e/export.spec.ts.
import { deflateSync } from 'node:zlib';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { crc32, type Annotation, type ImageInfo } from '../../src/core';
import type { HeldPatches } from '../../src/effects';

const effects = vi.hoisted(() => ({
  exactPatches: vi.fn<(doc: unknown, signal?: AbortSignal) => Promise<HeldPatches>>(),
}));
const render = vi.hoisted(() => ({ paint: vi.fn() }));
vi.mock('../../src/effects', () => effects);
vi.mock('../../src/render', () => render);

const { downloadResult, EXPORT_WAIT_MS, renderPng, REVOKE_DELAY_MS } = await import('../../src/io');

function chunk(type: string, data: Uint8Array = new Uint8Array(0)): Uint8Array {
  const out = new Uint8Array(12 + data.length);
  const dv = new DataView(out.buffer);
  dv.setUint32(0, data.length);
  for (let i = 0; i < 4; i++) out[4 + i] = type.charCodeAt(i);
  out.set(data, 8);
  dv.setUint32(8 + data.length, crc32(out, 4, 8 + data.length));
  return out;
}
/** A valid 8-bit RGBA PNG of w × h (what an encoder hands back). */
function png(w: number, h: number): Uint8Array {
  const d = new Uint8Array(13);
  new DataView(d.buffer).setUint32(0, w);
  new DataView(d.buffer).setUint32(4, h);
  d[8] = 8;
  d[9] = 6;
  const parts = [
    Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', d),
    chunk('IDAT', new Uint8Array(deflateSync(new Uint8Array((w * 4 + 1) * h)))),
    chunk('IEND'),
  ];
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return out;
}

const info: ImageInfo = { width: 40, height: 30, sourceName: 'login-bug.jpg', sourceType: 'jpeg' };
const image = () => ({ info, bitmap: { width: 40, height: 30 } as ImageBitmap });
const scene = (annotations: Annotation[] = []) => ({
  annotations,
  frame: { x: 0, y: 0, width: 40, height: 30 },
  padding: { size: 'none' as const, background: 'transparent' as const },
});

type Encoder = 'png' | 'null' | 'bad';
function fakeDom(encoder: Encoder = 'png') {
  const canvases: { width: number; height: number }[] = [];
  const anchors: { click: () => void; download: string; href: string }[] = [];
  let clickThrows = false;
  vi.stubGlobal('document', {
    createElement(tag: string) {
      if (tag === 'canvas') {
        const c = {
          width: 0,
          height: 0,
          getContext: () => ({}),
          toBlob(cb: (b: Blob | null) => void) {
            if (encoder === 'null') return cb(null);
            const bytes = encoder === 'bad' ? new Uint8Array(20) : png(c.width, c.height);
            cb(new Blob([bytes as Uint8Array<ArrayBuffer>], { type: 'image/png' }));
          },
        };
        canvases.push(c);
        return c;
      }
      const a = {
        href: '',
        download: '',
        hidden: false,
        click: () => {
          if (clickThrows) throw new Error('blocked');
        },
        remove: () => {},
      };
      anchors.push(a);
      return a;
    },
    body: { append: () => {} },
  });
  const revoke = vi.fn();
  vi.stubGlobal('URL', { createObjectURL: () => 'blob:tool/1', revokeObjectURL: revoke });
  return { canvases, anchors, revoke, throwOnClick: () => (clickThrows = true) };
}

const held = () => {
  const release = vi.fn();
  return { value: { patches: new Map(), release } satisfies HeldPatches, release };
};

beforeEach(() => {
  vi.useFakeTimers();
  effects.exactPatches.mockReset();
  render.paint.mockReset();
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('MOD-IO renderPng', () => {
  it('ADR-0022 F-012.R1 the export canvas is freed after a successful encode; the patches are released after painting', async () => {
    const dom = fakeDom();
    const h = held();
    effects.exactPatches.mockResolvedValue(h.value);
    render.paint.mockImplementation(() => expect(h.release).not.toHaveBeenCalled());
    const bytes = await renderPng(scene(), image());
    expect(bytes.length).toBeGreaterThan(0);
    expect(dom.canvases).toEqual([expect.objectContaining({ width: 0, height: 0 })]);
    expect(h.release).toHaveBeenCalledTimes(1);
  });

  it('F-012 security m4 the export paints at scale 1 from the canvas corner with the image unsmoothed', async () => {
    fakeDom();
    effects.exactPatches.mockResolvedValue(held().value);
    await renderPng(scene(), image());
    const args = render.paint.mock.calls[0]!;
    expect(args[3]).toEqual({ scale: 1, dx: -0, dy: -0 });
    expect(args[5]).toBeUndefined(); // no overlays
    expect(args[6]).toBeUndefined(); // no layer
    expect(args[7]).toBe(true); // crisp
  });

  for (const encoder of ['null', 'bad'] as const)
    it(`ADR-0022 F-012.R7 an encoder that returns ${encoder === 'null' ? 'nothing' : 'a damaged file'} fails, and the canvas is still freed`, async () => {
      const dom = fakeDom(encoder);
      const h = held();
      effects.exactPatches.mockResolvedValue(h.value);
      await expect(renderPng(scene(), image())).rejects.toThrow();
      expect(dom.canvases).toEqual([expect.objectContaining({ width: 0, height: 0 })]);
      expect(h.release).toHaveBeenCalled();
    });

  it('F-012.R7 effects not ready within EXPORT_WAIT_MS: the export fails and the wait is aborted', async () => {
    fakeDom();
    let signal: AbortSignal | undefined;
    effects.exactPatches.mockImplementation(
      (_doc, s) =>
        new Promise((_, reject) => {
          signal = s;
          s?.addEventListener('abort', () => reject(new Error('aborted')));
        }),
    );
    const result = renderPng(scene(), image());
    const settled = vi.fn();
    void result.then(settled, settled);
    await vi.advanceTimersByTimeAsync(EXPORT_WAIT_MS - 1);
    expect(settled).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    await expect(result).rejects.toThrow(/not ready in time/);
    expect(signal?.aborted).toBe(true);
    expect(render.paint).not.toHaveBeenCalled();
    expect(EXPORT_WAIT_MS).toBe(10_000);
  });

  it('F-012 security m2 an image closed while waiting is not painted', async () => {
    const dom = fakeDom();
    const img = image();
    const h = held();
    effects.exactPatches.mockImplementation(async () => {
      (img.bitmap as { width: number }).width = 0; // replaced meanwhile: the old bitmap was closed
      return h.value;
    });
    await expect(renderPng(scene(), img)).rejects.toThrow(/closed/);
    expect(render.paint).not.toHaveBeenCalled();
    expect(h.release).toHaveBeenCalled();
    expect(dom.canvases.every((c) => c.width === 0)).toBe(true);
  });
});

describe('MOD-IO downloadResult', () => {
  it('F-012.R2 ADR-0007 §5 the object URL is revoked once, REVOKE_DELAY_MS after the click', async () => {
    const dom = fakeDom();
    effects.exactPatches.mockResolvedValue(held().value);
    const result = await downloadResult(scene(), image(), new Date());
    expect(result).toEqual({ ok: true, fileName: 'login-bug-annotated.png' });
    expect(dom.anchors[0]?.download).toBe('login-bug-annotated.png');
    await vi.advanceTimersByTimeAsync(REVOKE_DELAY_MS - 1);
    expect(dom.revoke).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(dom.revoke).toHaveBeenCalledTimes(1);
    expect(dom.revoke).toHaveBeenCalledWith('blob:tool/1');
  });

  it('F-012.R7 a click that throws revokes the URL at once and reports export_failed', async () => {
    const dom = fakeDom();
    dom.throwOnClick();
    effects.exactPatches.mockResolvedValue(held().value);
    const result = await downloadResult(scene(), image(), new Date());
    expect(result).toEqual({ ok: false, code: 'export_failed' });
    expect(dom.revoke).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(REVOKE_DELAY_MS);
    expect(dom.revoke).toHaveBeenCalledTimes(1);
  });
});
