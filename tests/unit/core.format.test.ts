// MOD-Core magic-byte sniff (RULE-01, ADR-0005 decision 1, ADR-0018). The committed fixtures come
// from tests/fixtures/make-fixtures.sh. Test names follow adapters/tests.md.
import { describe, expect, it } from 'vitest';
import { sniffFormat, SNIFF_BYTES } from '../../src/core';
import { fixtureBytes } from '../support/fixtures';

const fixture = fixtureBytes;
const head = (name: string) => fixture(name).subarray(0, SNIFF_BYTES);
const ascii = (s: string) => Uint8Array.from(s, (c) => c.charCodeAt(0));

/** An ISO-BMFF `ftyp` box with a major brand and compatible brands. */
function ftyp(major: string, ...compatible: string[]): Uint8Array {
  const size = 16 + 4 * compatible.length;
  const out = new Uint8Array(size + 8);
  new DataView(out.buffer).setUint32(0, size);
  out.set(ascii('ftyp'), 4);
  out.set(ascii(major), 8);
  compatible.forEach((b, i) => out.set(ascii(b), 16 + 4 * i));
  return out;
}

describe('MOD-Core sniffFormat', () => {
  it('RULE-01 reads the format from the first 64 bytes only', () => {
    expect(SNIFF_BYTES).toBe(64);
  });

  it('RULE-01 recognises PNG, JPEG, WebP, GIF, BMP and AVIF by their magic bytes', () => {
    expect(sniffFormat(head('fmt.png'))).toBe('png');
    expect(sniffFormat(head('orient-1.jpg'))).toBe('jpeg');
    expect(sniffFormat(head('fmt.webp'))).toBe('webp');
    expect(sniffFormat(head('fmt-anim.gif'))).toBe('gif');
    expect(sniffFormat(ascii('GIF87a\x01\x00'))).toBe('gif');
    expect(sniffFormat(head('fmt.bmp'))).toBe('bmp');
    expect(sniffFormat(head('fmt.avif'))).toBe('avif');
    expect(sniffFormat(ftyp('mif1', 'avis'))).toBe('avif');
  });

  it('RULE-01 refuses HEIC even though some engines decode it (ADR-0018)', () => {
    expect(sniffFormat(head('fmt.heic'))).toBeNull();
    expect(sniffFormat(ftyp('heic', 'mif1', 'heic'))).toBeNull();
    expect(sniffFormat(ftyp('mif1', 'heix'))).toBeNull();
  });

  it('RULE-01 refuses PDF, TIFF, SVG, renamed text and empty input', () => {
    expect(sniffFormat(ascii('%PDF-1.7\n'))).toBeNull();
    expect(sniffFormat(Uint8Array.of(0x49, 0x49, 0x2a, 0x00))).toBeNull();
    expect(sniffFormat(Uint8Array.of(0x4d, 0x4d, 0x00, 0x2a))).toBeNull();
    expect(sniffFormat(ascii('<svg xmlns="http://www.w3.org/2000/svg"/>'))).toBeNull();
    expect(sniffFormat(head('not-image.png'))).toBeNull();
    expect(sniffFormat(new Uint8Array(0))).toBeNull();
    expect(sniffFormat(ascii('RIFF\0\0\0\0WAVE'))).toBeNull();
  });

  it('RULE-01 a file with a PNG signature is sniffed as PNG even if its body is damaged', () => {
    expect(sniffFormat(head('broken.png'))).toBe('png');
  });
});
