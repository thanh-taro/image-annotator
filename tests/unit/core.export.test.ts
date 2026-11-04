// MOD-Core export helpers: the RULE-15 download name and the ADR-0007 / ADR-0019 chunk whitelist.
// The whitelist cases are promoted from spike SP-png-export (spikes/png-export/test/strip.test.ts).
import { deflateSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import { crc32, downloadName, pngChunkTypes, stripPngChunks } from '../../src/core';

const SIG = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

function chunk(type: string, data: Uint8Array = new Uint8Array(0), badCrc = false): Uint8Array {
  const out = new Uint8Array(12 + data.length);
  const dv = new DataView(out.buffer);
  dv.setUint32(0, data.length);
  for (let i = 0; i < 4; i++) out[4 + i] = type.charCodeAt(i);
  out.set(data, 8);
  dv.setUint32(8 + data.length, (crc32(out, 4, 8 + data.length) ^ (badCrc ? 1 : 0)) >>> 0);
  return out;
}
function ihdr(w: number, h: number, colorType = 6): Uint8Array {
  const d = new Uint8Array(13);
  const dv = new DataView(d.buffer);
  dv.setUint32(0, w);
  dv.setUint32(4, h);
  d[8] = 8;
  d[9] = colorType;
  return chunk('IHDR', d);
}
function idat(w: number, h: number, bpp = 4): Uint8Array {
  const raw = new Uint8Array((w * bpp + 1) * h);
  for (let i = 0; i < raw.length; i++) raw[i] = (i * 7) & 0xff;
  for (let y = 0; y < h; y++) raw[y * (w * bpp + 1)] = 0;
  return chunk('IDAT', new Uint8Array(deflateSync(raw)));
}
const cat = (...parts: Uint8Array[]) => {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return out;
};
const text = (s: string) => new TextEncoder().encode(s);

/** The shape WebKit's encoder emits (ADR-0007 probe): sRGB and a 68-byte eXIf. */
const webkitLike = () =>
  cat(
    SIG,
    ihdr(4, 3),
    chunk('sRGB', Uint8Array.of(0)),
    chunk('eXIf', new Uint8Array(68).fill(1)),
    idat(4, 3),
    chunk('IEND'),
  );

function allCrcsValid(b: Uint8Array): boolean {
  const dv = new DataView(b.buffer, b.byteOffset, b.byteLength);
  let o = 8;
  while (o < b.length) {
    const len = dv.getUint32(o);
    if (crc32(b, o + 4, o + 8 + len) !== dv.getUint32(o + 8 + len)) return false;
    o += 12 + len;
  }
  return true;
}

describe('RULE-15 download name', () => {
  it('F-012.AC2 an image opened from login-bug.jpg downloads as login-bug-annotated.png', () => {
    expect(downloadName('login-bug.jpg', new Date(2026, 9, 27, 14, 5, 9))).toBe('login-bug-annotated.png');
  });

  it('F-012.AC3 a pasted image downloaded at 14:05:09 on 27 Oct 2026 is annotated-20261027-140509.png', () => {
    expect(downloadName(null, new Date(2026, 9, 27, 14, 5, 9))).toBe('annotated-20261027-140509.png');
  });

  it('RULE-15 only the last extension is removed; a name without one is kept whole; local time is zero-padded', () => {
    expect(downloadName('build.log.png', new Date())).toBe('build.log-annotated.png');
    expect(downloadName('screenshot', new Date())).toBe('screenshot-annotated.png');
    expect(downloadName(null, new Date(2026, 0, 2, 3, 4, 5))).toBe('annotated-20260102-030405.png');
  });

  const at = new Date(2026, 9, 27, 14, 5, 9);
  it('RULE-15 control and bidirectional formatting characters are removed from the source name', () => {
    expect(downloadName('in\u0000voice\u0007\u009f.png', at)).toBe('invoice-annotated.png');
    expect(downloadName('x\u202Egnp.exe.png', at)).toBe('xgnp.exe-annotated.png');
    expect(downloadName('a\u200Fb\u2066c\u2069\uFEFF.jpg', at)).toBe('abc-annotated.png');
  });

  it('RULE-15 leading dots are removed, so the file is never hidden', () => {
    expect(downloadName('.env.png', at)).toBe('env-annotated.png');
    expect(downloadName('...secret.jpg', at)).toBe('secret-annotated.png');
    expect(downloadName('\u202E.hidden.png', at)).toBe('hidden-annotated.png');
    expect(downloadName('.png', at)).toBe('png-annotated.png'); // a leading dot is not an extension
  });

  it('RULE-15 the source name is cut to 100 characters (whole characters, not code units)', () => {
    expect(downloadName(`${'a'.repeat(150)}.png`, at)).toBe(`${'a'.repeat(100)}-annotated.png`);
    expect(downloadName(`${'😀'.repeat(120)}.png`, at)).toBe(`${'😀'.repeat(100)}-annotated.png`);
  });

  it('RULE-15 a source name with nothing left uses the pasted-image name', () => {
    for (const name of ['', '....', '\u202E\u0000', '\u0000.'])
      expect(downloadName(name, at)).toBe('annotated-20261027-140509.png');
  });
});

describe('ADR-0007 §3 / ADR-0019 stripPngChunks', () => {
  it('INV-03 drops sRGB and eXIf and keeps IHDR, IDAT, IEND', () => {
    const r = stripPngChunks(webkitLike(), { width: 4, height: 3 });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(pngChunkTypes(r.bytes)).toEqual(['IHDR', 'IDAT', 'IEND']);
  });

  it('INV-03 drops every metadata and ancillary chunk: text, time, colour, animation', () => {
    const anc = [
      'gAMA',
      'cHRM',
      'iCCP',
      'tEXt',
      'zTXt',
      'iTXt',
      'tIME',
      'pHYs',
      'acTL',
      'fcTL',
      'bKGD',
      'sBIT',
      'caNv',
    ];
    const png = cat(
      SIG,
      ihdr(4, 3),
      ...anc.map((t) => chunk(t, text('x'))),
      idat(4, 3),
      chunk('tEXt', text('after')),
      chunk('IEND'),
    );
    const r = stripPngChunks(png);
    expect(r.ok && pngChunkTypes(r.bytes)).toEqual(['IHDR', 'IDAT', 'IEND']);
  });

  it('ADR-0007 keeps PLTE and tRNS for palette images', () => {
    const png = cat(
      SIG,
      ihdr(4, 3, 3),
      chunk('PLTE', new Uint8Array(6)),
      chunk('tRNS', Uint8Array.of(0)),
      chunk('tEXt', text('a')),
      idat(4, 3, 1),
      chunk('IEND'),
    );
    const r = stripPngChunks(png);
    expect(r.ok && pngChunkTypes(r.bytes)).toEqual(['IHDR', 'PLTE', 'tRNS', 'IDAT', 'IEND']);
  });

  it('INV-02 copies kept chunks whole: CRCs valid, IDAT bytes identical, several IDAT kept', () => {
    const d1 = idat(4, 3);
    const d2 = chunk('IDAT', new Uint8Array(0));
    const r = stripPngChunks(cat(SIG, ihdr(4, 3), chunk('eXIf', new Uint8Array(10)), d1, d2, chunk('IEND')));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(allCrcsValid(r.bytes)).toBe(true);
    expect(r.bytes).toEqual(cat(SIG, ihdr(4, 3), d1, d2, chunk('IEND')));
  });

  it('F-018.AC5 an already clean file comes back byte-identical, every time', () => {
    const clean = cat(SIG, ihdr(4, 3), idat(4, 3), chunk('IEND'));
    const a = stripPngChunks(clean);
    const b = stripPngChunks(clean);
    expect(a.ok && a.bytes).toEqual(clean);
    expect(b.ok && b.bytes).toEqual(clean);
  });

  it('ADR-0019 crc32 matches the PNG check values', () => {
    expect(crc32(text('123456789'))).toBe(0xcbf43926);
    expect(crc32(text('IEND'))).toBe(0xae426082);
  });

  describe('F-012.R7 fails closed and never throws', () => {
    const cases: [string, Uint8Array, { width: number; height: number }?][] = [
      ['empty', new Uint8Array(0)],
      ['bad signature', cat(Uint8Array.of(0x89, 0x50, 0x4e, 0x47, 0, 0, 0, 0), ihdr(4, 3), idat(4, 3), chunk('IEND'))],
      ['IHDR not first', cat(SIG, chunk('sRGB', Uint8Array.of(0)), ihdr(4, 3), idat(4, 3), chunk('IEND'))],
      ['no IEND', cat(SIG, ihdr(4, 3), idat(4, 3))],
      ['data after IEND', cat(SIG, ihdr(4, 3), idat(4, 3), chunk('IEND'), chunk('tEXt', text('x')))],
      ['bad CRC in IDAT', cat(SIG, ihdr(4, 3), chunk('IDAT', text('zz'), true), chunk('IEND'))],
      ['bad CRC in a dropped chunk', cat(SIG, ihdr(4, 3), chunk('eXIf', text('zz'), true), idat(4, 3), chunk('IEND'))],
      [
        'length past the end',
        (() => {
          const b = webkitLike();
          new DataView(b.buffer).setUint32(8 + 25, 0x7ffffff0);
          return b;
        })(),
      ],
      ['two IHDR', cat(SIG, ihdr(4, 3), ihdr(4, 3), idat(4, 3), chunk('IEND'))],
      ['no IDAT', cat(SIG, ihdr(4, 3), chunk('IEND'))],
      ['IDAT not consecutive', cat(SIG, ihdr(4, 3), idat(4, 3), chunk('tEXt', text('x')), idat(4, 3), chunk('IEND'))],
      ['unknown critical chunk', cat(SIG, ihdr(4, 3), chunk('ABCD', text('x')), idat(4, 3), chunk('IEND'))],
      ['invalid chunk type bytes', cat(SIG, ihdr(4, 3), chunk('a#cd', text('x')), idat(4, 3), chunk('IEND'))],
      ['width differs from the canvas', webkitLike(), { width: 5, height: 3 }],
      ['height differs from the canvas', webkitLike(), { width: 4, height: 4 }],
    ];
    for (const [name, bytes, expected] of cases) {
      it(`ADR-0019 rejects: ${name}`, () => {
        let r: ReturnType<typeof stripPngChunks> | undefined;
        expect(() => {
          r = stripPngChunks(bytes, expected);
        }).not.toThrow();
        expect(r?.ok).toBe(false);
      });
    }

    it('ADR-0019 every truncation of a valid file is rejected', () => {
      const full = webkitLike();
      for (let n = 0; n < full.length; n++) expect(stripPngChunks(full.subarray(0, n)).ok, `length ${n}`).toBe(false);
    });

    it('ADR-0019 every single-bit flip is rejected (the CRC catches payload flips)', () => {
      const full = webkitLike();
      for (let i = 0; i < full.length; i++)
        for (let bit = 0; bit < 8; bit++) {
          const b = full.slice();
          b[i] = (b[i] ?? 0) ^ (1 << bit);
          expect(stripPngChunks(b).ok, `byte ${i} bit ${bit}`).toBe(false);
        }
    });

    it('ADR-0019 2,000 random inputs never throw', () => {
      let seed = 42;
      const rnd = () => ((seed = (seed * 1103515245 + 12345) >>> 0) >>> 16) & 0xff;
      for (let k = 0; k < 2000; k++) {
        const len = rnd() * 4;
        const b = new Uint8Array(len);
        for (let i = 0; i < len; i++) b[i] = rnd();
        if (k % 2 === 0 && len >= 8) b.set(SIG, 0);
        expect(() => stripPngChunks(b)).not.toThrow();
      }
    });
  });
});
