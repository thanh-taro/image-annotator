// MOD-IO checks and decode in F-001.R7's order: size, magic bytes, decode, limits (ADR-0005). The
// engine decoder is replaced by a fake; the real one runs in tests/e2e/load.spec.ts.
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
    expect(await decodeInput(big, e.env)).toEqual({ ok: false, refused: 'file_too_large' });
    expect(e.decode).not.toHaveBeenCalled();
  });

  it('RULE-02 a file of exactly 50,000,000 bytes is not refused for its size', async () => {
    const at = new File([bytes('fmt.png'), new Uint8Array(50_000_000 - bytes('fmt.png').length)], 'a.png');
    const r = await decodeInput(at, env(bitmap(240, 160)).env);
    expect(r.ok).toBe(true);
  });

  it('F-001.AC5 PDF and HEIC are refused as unsupported without decoding (MIME type ignored)', async () => {
    const e = env(bitmap(240, 160));
    const pdf = new File(['%PDF-1.7\n%âãÏÓ\n'], 'doc.pdf', { type: 'application/pdf' });
    expect(await decodeInput(pdf, e.env)).toEqual({ ok: false, refused: 'unsupported_format' });
    expect(await decodeInput(file('fmt.heic', 'image/png'), e.env)).toEqual({
      ok: false,
      refused: 'unsupported_format',
    });
    expect(e.decode).not.toHaveBeenCalled();
  });

  it('RULE-01 AVIF counts as unsupported when the start-up probe failed', async () => {
    const e = env(bitmap(240, 160), false);
    expect(await decodeInput(file('fmt.avif'), e.env)).toEqual({ ok: false, refused: 'unsupported_format' });
  });

  it('F-001.AC13 a file that claims to be PNG but cannot be decoded is refused as decode_failed', async () => {
    const e = env(new DOMException('bad', 'InvalidStateError') as unknown as Error);
    expect(await decodeInput(file('broken.png', 'image/png'), e.env)).toEqual({
      ok: false,
      refused: 'decode_failed',
    });
  });

  it('RULE-02 a decoded image smaller than 1 × 1 is treated as undecodable and closed', async () => {
    const b = bitmap(0, 0);
    expect(await decodeInput(file('fmt.png'), env(b).env)).toEqual({ ok: false, refused: 'decode_failed' });
    expect(b.closed).toBe(true);
  });

  it('RULE-03 decodes with the recorded orientation applied and sRGB conversion (ADR-0005 §2)', async () => {
    const e = env(bitmap(240, 160));
    const r = await decodeInput(file('orient-6.jpg'), e.env);
    expect(e.decode).toHaveBeenCalledWith(expect.any(Blob), {
      imageOrientation: 'from-image',
      colorSpaceConversion: 'default',
      premultiplyAlpha: 'default',
    });
    expect(r).toMatchObject({ ok: true, image: { info: { width: 240, height: 160, sourceType: 'jpeg' } } });
  });

  it('RULE-15 records the file name as the source name', async () => {
    const r = await decodeInput(file('fmt.png'), env(bitmap(240, 160)).env);
    expect(r).toMatchObject({ ok: true, image: { info: { sourceName: 'fmt.png', sourceType: 'png' } } });
  });

  it('F-001.AC7 an image over the pixel limit is offered scaled down to 5441 × 3083', async () => {
    const big = bitmap(6000, 3400);
    const r = await decodeInput(file('large-6000x3400.png'), env(big).env);
    expect(r).toMatchObject({ ok: false, refused: 'too_large', scaleDownOffer: { width: 5441, height: 3083 } });
    expect(big.closed).toBe(false);
  });

  it('F-001.AC7 scaling down resizes with high quality and closes the original bitmap (NFR-04)', async () => {
    const big = bitmap(6000, 3400);
    const e = env(big);
    const r = await decodeInput(file('large-6000x3400.png'), e.env);
    if (r.ok || r.refused !== 'too_large') throw new Error('expected an offer');
    const small = bitmap(5441, 3083);
    e.decode.mockResolvedValueOnce(small as unknown as ImageBitmap);
    const scaled = await scaleDown(r.image, r.scaleDownOffer, e.env);
    expect(e.decode).toHaveBeenLastCalledWith(big, { resizeWidth: 5441, resizeHeight: 3083, resizeQuality: 'high' });
    expect(scaled.info).toMatchObject({ width: 5441, height: 3083, sourceName: 'large-6000x3400.png' });
    expect(big.closed).toBe(true);
  });
});
