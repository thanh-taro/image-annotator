// MOD-IO checks and decode in F-001.R7's order: size, magic bytes, header size, decode, limits
// (ADR-0005, ADR-0023). The engine decoder is replaced by a fake; the real one runs in tests/e2e/load.spec.ts.
import { describe, expect, it, vi } from 'vitest';
import { decodeInput, scaleDown, type DecodeEnv } from '../../src/io/decode';
import { fixtureBytes } from '../support/fixtures';

const bytes = fixtureBytes;
const file = (name: string, type = '') => new File([bytes(name)], name, { type });

interface FakeBitmap {
  width: number;
  height: number;
  closed: boolean;
  close(): void;
}
const bitmap = (width: number, height: number): FakeBitmap => ({
  width,
  height,
  closed: false,
  close() {
    this.closed = true;
  },
});

function env(result: FakeBitmap | Error, avif = true) {
  const decode = vi.fn(async (_src: unknown, _opts?: ImageBitmapOptions) => {
    if (result instanceof Error) throw result;
    return result as unknown as ImageBitmap;
  });
  return { decode, avif, env: { createImageBitmap: decode, avifSupported: () => avif } as DecodeEnv };
}

describe('MOD-IO decodeInput', () => {
  it('F-001.AC6 a 60 MB file is refused as too large before anything is read or decoded', async () => {
    const big = new File([new Uint8Array(60_000_000)], 'big.png', { type: 'image/png' });
    const e = env(bitmap(10, 10));
    expect(await decodeInput(big, 'big.png', e.env)).toEqual({ ok: false, refused: 'file_too_large' });
    expect(e.decode).not.toHaveBeenCalled();
  });

  it('RULE-02 a file of exactly 50,000,000 bytes is not refused for its size', async () => {
    const at = new File([bytes('fmt.png'), new Uint8Array(50_000_000 - bytes('fmt.png').length)], 'a.png');
    const r = await decodeInput(at, 'a.png', env(bitmap(240, 160)).env);
    expect(r.ok).toBe(true);
  });

  it('F-001.AC5 PDF and HEIC are refused as unsupported without decoding (MIME type ignored)', async () => {
    const e = env(bitmap(240, 160));
    const pdf = new File(['%PDF-1.7\n%âãÏÓ\n'], 'doc.pdf', { type: 'application/pdf' });
    expect(await decodeInput(pdf, 'doc.pdf', e.env)).toEqual({ ok: false, refused: 'unsupported_format' });
    expect(await decodeInput(file('fmt.heic', 'image/png'), 'fmt.heic', e.env)).toEqual({
      ok: false,
      refused: 'unsupported_format',
    });
    expect(e.decode).not.toHaveBeenCalled();
  });

  it('RULE-01 AVIF counts as unsupported when the start-up probe failed', async () => {
    const e = env(bitmap(240, 160), false);
    expect(await decodeInput(file('fmt.avif'), 'fmt.avif', e.env)).toEqual({
      ok: false,
      refused: 'unsupported_format',
    });
  });

  it('F-001.AC13 a file that claims to be PNG but cannot be decoded is refused as decode_failed', async () => {
    const e = env(new DOMException('bad', 'InvalidStateError') as unknown as Error);
    expect(await decodeInput(file('broken.png', 'image/png'), 'broken.png', e.env)).toEqual({
      ok: false,
      refused: 'decode_failed',
    });
  });

  it('RULE-02 a decoded image smaller than 1 × 1 is treated as undecodable and closed', async () => {
    const b = bitmap(0, 0);
    expect(await decodeInput(file('fmt.png'), 'fmt.png', env(b).env)).toEqual({ ok: false, refused: 'decode_failed' });
    expect(b.closed).toBe(true);
  });

  it('RULE-03 decodes with the recorded orientation applied and sRGB conversion (ADR-0005 §2)', async () => {
    const e = env(bitmap(240, 160));
    const r = await decodeInput(file('orient-6.jpg'), 'orient-6.jpg', e.env);
    expect(e.decode).toHaveBeenCalledWith(expect.any(Blob), {
      imageOrientation: 'from-image',
      colorSpaceConversion: 'default',
      premultiplyAlpha: 'default',
    });
    expect(r).toMatchObject({ ok: true, image: { info: { width: 240, height: 160, sourceType: 'jpeg' } } });
  });

  it('RULE-15 records the file name as the source name', async () => {
    const r = await decodeInput(file('fmt.png'), 'fmt.png', env(bitmap(240, 160)).env);
    expect(r).toMatchObject({ ok: true, image: { info: { sourceName: 'fmt.png', sourceType: 'png' } } });
  });

  it('RULE-15 a pasted image has no source name', async () => {
    const r = await decodeInput(file('fmt.png'), null, env(bitmap(240, 160)).env);
    expect(r).toMatchObject({ ok: true, image: { info: { sourceName: null } } });
  });

  it('F-001.AC7 ADR-0023 an image over the pixel limit by its header is offered 5441 × 3083 before any decode', async () => {
    const e = env(bitmap(6000, 3400));
    const r = await decodeInput(file('large-6000x3400.png'), 'large.png', e.env);
    expect(r).toMatchObject({
      ok: true,
      sourceName: 'large.png',
      sourceType: 'png',
      scaleDownOffer: { width: 5441, height: 3083 },
    });
    expect(r.ok && r.image).toBeFalsy();
    expect(e.decode).not.toHaveBeenCalled();
  });

  it('RULE-03 ADR-0023 the offer for a JPEG with orientation 6 uses the upright size', async () => {
    const e = env(bitmap(6000, 3400));
    const r = await decodeInput(file('large-rot6.jpg'), 'r.jpg', e.env);
    expect(r).toMatchObject({ ok: true, scaleDownOffer: { width: 5441, height: 3083 } });
    expect(e.decode).not.toHaveBeenCalled();
  });

  it('ADR-0023 §3 a lying header (small claim, huge bitmap) is caught after decode and the bitmap closed', async () => {
    const big = bitmap(6000, 3400);
    const r = await decodeInput(file('fmt.png'), 'fmt.png', env(big).env);
    expect(r).toMatchObject({ ok: true, scaleDownOffer: { width: 5441, height: 3083 } });
    expect(big.closed).toBe(true);
  });

  it('ADR-0023 §4 a header that cannot be read falls back to decode-then-check', async () => {
    const noIhdr = Uint8Array.from(bytes('fmt.png'));
    noIhdr.set([0x78, 0x78, 0x78, 0x78], 12); // the IHDR tag is unreadable
    const e = env(bitmap(6000, 3400));
    const r = await decodeInput(new File([noIhdr], 'x.png'), 'x.png', e.env);
    expect(e.decode).toHaveBeenCalledOnce();
    expect(r).toMatchObject({ ok: true, scaleDownOffer: { width: 5441, height: 3083 } });
  });

  it('F-001.AC7 ADR-0023 scaling down is one decode of the file at the offered size, oriented', async () => {
    const e = env(bitmap(5441, 3083));
    const r = await decodeInput(file('large-6000x3400.png'), 'large.png', e.env);
    if (!r.ok || r.image) throw new Error('expected an offer');
    const scaled = await scaleDown(r, e.env);
    expect(e.decode).toHaveBeenCalledOnce();
    expect(e.decode).toHaveBeenCalledWith(expect.any(Blob), {
      imageOrientation: 'from-image',
      colorSpaceConversion: 'default',
      premultiplyAlpha: 'default',
      resizeWidth: 5441,
      resizeHeight: 3083,
      resizeQuality: 'high',
    });
    expect(scaled.info).toEqual({ width: 5441, height: 3083, sourceName: 'large.png', sourceType: 'png' });
  });

  it('RULE-02 a scaled bitmap still outside the limits is closed and refused', async () => {
    const wrong = bitmap(6000, 3400);
    const offer = {
      file: file('fmt.png'),
      sourceName: null,
      sourceType: 'png' as const,
      scaleDownOffer: { width: 5441, height: 3083 },
    };
    await expect(scaleDown(offer, env(wrong).env)).rejects.toThrow();
    expect(wrong.closed).toBe(true);
  });
});
