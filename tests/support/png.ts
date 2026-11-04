// A PNG decoder for tests, run in Node (ADR-0019 test strategy: WebKit's own decoder changes
// semi-transparent pixels on read-back, so export pixel tests decode the file outside the browser).
// Reads 8-bit RGBA (colour type 6) and RGB (colour type 2), non-interlaced — what Chromium's and
// WebKit's encoders write for a canvas. Uses only node:zlib (no dependency). Adapted from the spike
// SP-png-export probe (spikes/png-export/bench/probe-alpha.mjs).
import { inflateSync } from 'node:zlib';

export interface DecodedPng {
  readonly width: number;
  readonly height: number;
  /** RGBA, row-major, straight (not premultiplied) alpha as stored in the file. */
  readonly data: Uint8Array;
}

const u32 = (b: Uint8Array, o: number) =>
  (((b[o] ?? 0) << 24) | ((b[o + 1] ?? 0) << 16) | ((b[o + 2] ?? 0) << 8) | (b[o + 3] ?? 0)) >>> 0;

/** The chunk types of a PNG file, in order. */
export function chunkTypes(b: Uint8Array): string[] {
  const out: string[] = [];
  for (let o = 8; o + 8 <= b.length; o += 12 + u32(b, o))
    out.push(String.fromCharCode(b[o + 4] ?? 0, b[o + 5] ?? 0, b[o + 6] ?? 0, b[o + 7] ?? 0));
  return out;
}

/** Decodes a PNG to RGBA. Throws on anything but 8-bit RGB/RGBA, non-interlaced. */
export function decodePng(b: Uint8Array): DecodedPng {
  let width = 0;
  let height = 0;
  let channels = 0;
  const idat: Uint8Array[] = [];
  for (let o = 8; o + 8 <= b.length; o += 12 + u32(b, o)) {
    const len = u32(b, o);
    const type = String.fromCharCode(b[o + 4] ?? 0, b[o + 5] ?? 0, b[o + 6] ?? 0, b[o + 7] ?? 0);
    if (type === 'IHDR') {
      width = u32(b, o + 8);
      height = u32(b, o + 12);
      const depth = b[o + 16];
      const colour = b[o + 17];
      if (depth !== 8 || (colour !== 6 && colour !== 2) || b[o + 20] !== 0)
        throw new Error(`unsupported PNG: depth ${depth}, colour type ${colour}`);
      channels = colour === 6 ? 4 : 3;
    } else if (type === 'IDAT') idat.push(b.subarray(o + 8, o + 8 + len));
  }
  const all = new Uint8Array(idat.reduce((n, p) => n + p.length, 0));
  let p = 0;
  for (const part of idat) {
    all.set(part, p);
    p += part.length;
  }
  const raw = inflateSync(all);
  const stride = width * channels;
  const rows = new Uint8Array(stride * height);
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)];
    for (let x = 0; x < stride; x++) {
      const a = x >= channels ? (rows[y * stride + x - channels] ?? 0) : 0;
      const up = y ? (rows[(y - 1) * stride + x] ?? 0) : 0;
      const c = x >= channels && y ? (rows[(y - 1) * stride + x - channels] ?? 0) : 0;
      let v = raw[y * (stride + 1) + 1 + x] ?? 0;
      if (filter === 1) v += a;
      else if (filter === 2) v += up;
      else if (filter === 3) v += (a + up) >> 1;
      else if (filter === 4) {
        const pp = a + up - c;
        const pa = Math.abs(pp - a);
        const pb = Math.abs(pp - up);
        const pc = Math.abs(pp - c);
        v += pa <= pb && pa <= pc ? a : pb <= pc ? up : c;
      }
      rows[y * stride + x] = v & 255;
    }
  }
  if (channels === 4) return { width, height, data: rows };
  const data = new Uint8Array(width * height * 4);
  for (let i = 0, j = 0; i < rows.length; i += 3, j += 4) {
    data[j] = rows[i] ?? 0;
    data[j + 1] = rows[i + 1] ?? 0;
    data[j + 2] = rows[i + 2] ?? 0;
    data[j + 3] = 255;
  }
  return { width, height, data };
}

/** RGBA of a box of a decoded PNG, row-major. */
export function pngRegion(png: DecodedPng, x: number, y: number, w: number, h: number): number[] {
  const out: number[] = [];
  for (let yy = y; yy < y + h; yy++)
    for (let xx = x; xx < x + w; xx++) {
      const i = (yy * png.width + xx) * 4;
      out.push(png.data[i] ?? 0, png.data[i + 1] ?? 0, png.data[i + 2] ?? 0, png.data[i + 3] ?? 0);
    }
  return out;
}
