// MOD-Core readImageHeader (ADR-0023): declared sizes per format, orientation, truncated and lying
// headers. Fixtures from tests/fixtures/make-fixtures.sh.
import { describe, expect, it } from 'vitest';
import { HEADER_BYTES, readImageHeader } from '../../src/core';
import { fixtureBytes } from '../support/fixtures';

const ascii = (s: string) => Uint8Array.from(s, (c) => c.charCodeAt(0));
const cat = (...parts: Uint8Array[]) => {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let at = 0;
  for (const p of parts) {
    out.set(p, at);
    at += p.length;
  }
  return out;
};
const be32 = (n: number) => Uint8Array.of(n >>> 24, (n >>> 16) & 255, (n >>> 8) & 255, n & 255);
const be16 = (n: number) => Uint8Array.of(n >>> 8, n & 255);

/** A PNG signature and IHDR declaring `w × h` (no image data). */
const pngHeader = (w: number, h: number) =>
  cat(ascii('\x89PNG\r\n\x1a\n'), be32(13), ascii('IHDR'), be32(w), be32(h), Uint8Array.of(8, 6, 0, 0, 0));

/** A JPEG with an optional EXIF orientation and a SOF0 declaring `w × h`. */
function jpegHeader(w: number, h: number, orientation?: number) {
  const parts = [Uint8Array.of(0xff, 0xd8)];
  if (orientation) {
    const tiff = cat(
      ascii('MM'),
      be16(42),
      be32(8),
      be16(1),
      be16(0x0112),
      be16(3),
      be32(1),
      be16(orientation),
      be16(0),
      be32(0),
    );
    const payload = cat(ascii('Exif\0\0'), tiff);
    parts.push(Uint8Array.of(0xff, 0xe1), be16(payload.length + 2), payload);
  }
  parts.push(Uint8Array.of(0xff, 0xdb), be16(4), Uint8Array.of(0, 0)); // a DQT-like segment to skip
  parts.push(Uint8Array.of(0xff, 0xc0), be16(17), Uint8Array.of(8), be16(h), be16(w), new Uint8Array(12));
  return cat(...parts);
}

describe('MOD-Core readImageHeader', () => {
  it('ADR-0023 reads at most 256 KB', () => {
    expect(HEADER_BYTES).toBe(262_144);
  });

  it('ADR-0023 reads the declared size of every RULE-01 format', () => {
    for (const name of [
      'fmt.png',
      'fmt.webp',
      'fmt-lossy.webp',
      'fmt-alpha.webp',
      'fmt-anim.gif',
      'orient-1.jpg',
      'fmt.avif',
    ]) {
      expect(readImageHeader(fixtureBytes(name)), name).toEqual({ width: 240, height: 160 });
    }
    expect(readImageHeader(fixtureBytes('fmt.bmp'))).toEqual({ width: 8, height: 8 });
    expect(readImageHeader(fixtureBytes('large-6000x3400.png'))).toEqual({ width: 6000, height: 3400 });
    expect(readImageHeader(pngHeader(40_000, 40_000))).toEqual({ width: 40_000, height: 40_000 });
  });

  it('RULE-03 EXIF orientations 5–8 swap the declared JPEG size', () => {
    expect(readImageHeader(fixtureBytes('orient-6.jpg'))).toEqual({ width: 240, height: 160 });
    expect(readImageHeader(fixtureBytes('large-rot6.jpg'))).toEqual({ width: 6000, height: 3400 });
    expect(readImageHeader(jpegHeader(300, 200, 3))).toEqual({ width: 300, height: 200 });
    for (const o of [5, 6, 7, 8]) expect(readImageHeader(jpegHeader(300, 200, o))).toEqual({ width: 200, height: 300 });
    expect(readImageHeader(jpegHeader(30_000, 20_000))).toEqual({ width: 30_000, height: 20_000 });
  });

  it('ADR-0023 §4 a truncated header gives null (decode-then-check fallback)', () => {
    expect(readImageHeader(pngHeader(100, 100).subarray(0, 20))).toBeNull();
    expect(readImageHeader(fixtureBytes('fmt-anim.gif').subarray(0, 8))).toBeNull();
    expect(readImageHeader(fixtureBytes('fmt.bmp').subarray(0, 20))).toBeNull();
    expect(readImageHeader(fixtureBytes('fmt-lossy.webp').subarray(0, 24))).toBeNull();
    const jpeg = jpegHeader(300, 200, 6);
    expect(readImageHeader(jpeg.subarray(0, jpeg.length - 20))).toBeNull();
  });

  it('ADR-0023 malformed or zero sizes give null; non-images give null', () => {
    expect(readImageHeader(pngHeader(0, 100))).toBeNull();
    expect(readImageHeader(fixtureBytes('broken.png'))).toBeNull();
    expect(readImageHeader(fixtureBytes('fmt.heic'))).toBeNull();
    expect(readImageHeader(fixtureBytes('not-image.png'))).toBeNull();
    expect(readImageHeader(Uint8Array.of(0xff, 0xd8, 0xff, 0xda, 0, 4, 0, 0))).toBeNull(); // scan before SOF
  });

  it('ADR-0023 the AVIF scan stops at mdat (pixel data may contain the bytes ispe)', () => {
    const avif = fixtureBytes('fmt.avif');
    const fake = cat(be32(20), ascii('ispe'), be32(0), be32(40_000), be32(40_000));
    const inPixels = cat(avif, fake); // fmt.avif ends with its mdat payload
    expect(readImageHeader(inPixels)).toEqual({ width: 240, height: 160 });
  });

  it('ADR-0023 §3 a lying header is reported as declared; the decoded size is checked separately', () => {
    // A 240 × 160 PNG whose IHDR was rewritten to claim 1 × 1: the header says 1 × 1.
    const lying = Uint8Array.from(fixtureBytes('fmt.png'));
    lying.set(be32(1), 16);
    lying.set(be32(1), 20);
    expect(readImageHeader(lying)).toEqual({ width: 1, height: 1 });
  });
});
