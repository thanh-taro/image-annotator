// MOD-Core — the declared image size from the file header, before any decode (ADR-0023), so RULE-02's
// scale-down question comes before a huge image is decoded. Pure: it reads only the bytes it is given
// (MOD-IO passes at most HEADER_BYTES) and returns null when the header is missing, truncated or
// malformed; MOD-IO then falls back to decode-then-check (ADR-0023 §4).
// Implements: RULE-02 (limits before decode), RULE-03 (orientations 5–8 swap the declared size).
import { sniffFormat } from './format';

/** How many leading bytes MOD-IO reads for the header (ADR-0023: at most 256 KB). */
export const HEADER_BYTES = 256 * 1024;

export interface HeaderSize {
  readonly width: number;
  readonly height: number;
}

const u16be = (b: Uint8Array, at: number) => ((b[at] ?? 0) << 8) | (b[at + 1] ?? 0);
const u16le = (b: Uint8Array, at: number) => (b[at] ?? 0) | ((b[at + 1] ?? 0) << 8);
const u24le = (b: Uint8Array, at: number) => (b[at] ?? 0) | ((b[at + 1] ?? 0) << 8) | ((b[at + 2] ?? 0) << 16);
const u32be = (b: Uint8Array, at: number) => (((b[at] ?? 0) << 24) | ((b[at + 1] ?? 0) << 16) | u16be(b, at + 2)) >>> 0;
const u32le = (b: Uint8Array, at: number) => (u16le(b, at) | (u16le(b, at + 2) << 16)) >>> 0;
const tag = (b: Uint8Array, at: number) =>
  String.fromCharCode(b[at] ?? 0, b[at + 1] ?? 0, b[at + 2] ?? 0, b[at + 3] ?? 0);

const size = (width: number, height: number, swap = false): HeaderSize | null => {
  if (!(width >= 1 && height >= 1)) return null;
  return swap ? { width: height, height: width } : { width, height };
};

function png(b: Uint8Array): HeaderSize | null {
  if (b.length < 24 || tag(b, 12) !== 'IHDR') return null;
  return size(u32be(b, 16), u32be(b, 20));
}

function gif(b: Uint8Array): HeaderSize | null {
  if (b.length < 10) return null;
  return size(u16le(b, 6), u16le(b, 8));
}

function bmp(b: Uint8Array): HeaderSize | null {
  if (b.length < 26) return null;
  const dib = u32le(b, 14);
  if (dib === 12) return size(u16le(b, 18), u16le(b, 20)); // BITMAPCOREHEADER
  if (dib < 40) return null;
  const height = u32le(b, 22) | 0; // signed: negative means top-down
  return size(u32le(b, 18) | 0, Math.abs(height));
}

function webp(b: Uint8Array): HeaderSize | null {
  if (b.length < 30) return null;
  const chunk = tag(b, 12);
  if (chunk === 'VP8X') return size(u24le(b, 24) + 1, u24le(b, 27) + 1);
  if (chunk === 'VP8L') {
    if (b[20] !== 0x2f) return null;
    const bits = u32le(b, 21);
    return size((bits & 0x3fff) + 1, ((bits >>> 14) & 0x3fff) + 1);
  }
  if (chunk === 'VP8 ') {
    if (b[23] !== 0x9d || b[24] !== 0x01 || b[25] !== 0x2a) return null;
    return size(u16le(b, 26) & 0x3fff, u16le(b, 28) & 0x3fff);
  }
  return null;
}

/** RULE-03: the EXIF orientation (1–8) in an APP1 segment's payload, or 1. */
function exifOrientation(b: Uint8Array, start: number, end: number): number {
  if (tag(b, start) !== 'Exif' || b[start + 4] !== 0 || b[start + 5] !== 0) return 1;
  const tiff = start + 6;
  const le = b[tiff] === 0x49 && b[tiff + 1] === 0x49;
  if (!le && !(b[tiff] === 0x4d && b[tiff + 1] === 0x4d)) return 1;
  const r16 = (at: number) => (le ? u16le(b, at) : u16be(b, at));
  const r32 = (at: number) => (le ? u32le(b, at) : u32be(b, at));
  const ifd = tiff + r32(tiff + 4);
  if (ifd + 2 > end) return 1;
  const count = r16(ifd);
  for (let i = 0; i < count; i++) {
    const entry = ifd + 2 + 12 * i;
    if (entry + 12 > end) break;
    if (r16(entry) === 0x0112) {
      const value = r16(entry + 8);
      return value >= 1 && value <= 8 ? value : 1;
    }
  }
  return 1;
}

const SOF = new Set([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf]);

function jpeg(b: Uint8Array): HeaderSize | null {
  let at = 2;
  let orientation = 1;
  while (at + 4 <= b.length) {
    if (b[at] !== 0xff) return null;
    const marker = b[at + 1] ?? 0;
    if (marker === 0xff) {
      at++; // fill byte
      continue;
    }
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      at += 2; // no length
      continue;
    }
    if (marker === 0xd9 || marker === 0xda) return null; // end of image or scan data before any SOF
    const length = u16be(b, at + 2);
    if (length < 2) return null;
    const end = at + 2 + length;
    if (marker === 0xe1) orientation = Math.max(orientation, exifOrientation(b, at + 4, Math.min(end, b.length)));
    if (SOF.has(marker)) {
      if (at + 9 > b.length) return null;
      return size(u16be(b, at + 7), u16be(b, at + 5), orientation >= 5);
    }
    at = end;
  }
  return null;
}

/**
 * AVIF: the largest `ispe` (the primary image; thumbnails are smaller), swapped by an odd `irot`. The
 * scan stops at the first `mdat` box: compressed pixel data may contain the bytes `ispe`.
 */
function avif(b: Uint8Array): HeaderSize | null {
  let best: HeaderSize | null = null;
  let rotate = false;
  for (let at = 4; at + 16 <= b.length; at++) {
    if (b[at] !== 0x69 && b[at] !== 0x6d) continue; // 'i' or 'm'
    const name = tag(b, at);
    if (name === 'mdat') break;
    if (name === 'ispe' && u32be(b, at - 4) >= 20) {
      const s = size(u32be(b, at + 8), u32be(b, at + 12));
      if (s && (!best || s.width * s.height > best.width * best.height)) best = s;
    } else if (name === 'irot' && u32be(b, at - 4) >= 9) {
      rotate = ((b[at + 4] ?? 0) & 3) % 2 === 1;
    }
  }
  return best && rotate ? { width: best.height, height: best.width } : best;
}

/**
 * The image size its header declares, after orientation (ADR-0023 §1), or null when it can't be read.
 * The size is a claim: MOD-IO re-checks the decoded bitmap (a lying header, ADR-0023 §3).
 */
export function readImageHeader(bytes: Uint8Array): HeaderSize | null {
  switch (sniffFormat(bytes)) {
    case 'png':
      return png(bytes);
    case 'gif':
      return gif(bytes);
    case 'bmp':
      return bmp(bytes);
    case 'webp':
      return webp(bytes);
    case 'jpeg':
      return jpeg(bytes);
    case 'avif':
      return avif(bytes);
    default:
      return null;
  }
}
