// MOD-Core — the export's pure parts: the RULE-15 download name and the PNG chunk whitelist of
// ADR-0007 §3, hardened per ADR-0019. Promoted from spike SP-png-export (spikes/png-export/src/strip.ts,
// commit bbb6e01): the whitelist keeps IHDR, PLTE, tRNS, IDAT and IEND, copying each kept chunk whole
// (length, type, data and CRC unchanged), drops every other chunk, and fails closed — never throws — on
// anything it cannot vouch for. MOD-Core never reads the clock: the caller passes the local time.
// Implements: RULE-15 (file name), INV-02 (one flattened picture, no extra data blocks), INV-03 (no
// metadata), ADR-0007 §3, ADR-0019, F-012.R2/R3/R7.

/** ADR-0007 §3: the only chunks an exported PNG keeps. */
export const PNG_KEPT_CHUNKS: ReadonlySet<string> = new Set(['IHDR', 'PLTE', 'tRNS', 'IDAT', 'IEND']);

const SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] as const;

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

/** CRC-32 (the PNG chunk checksum) over bytes[start, end). */
export function crc32(bytes: Uint8Array, start = 0, end = bytes.length): number {
  let c = 0xffffffff;
  for (let i = start; i < end; i++) c = (CRC_TABLE[(c ^ (bytes[i] ?? 0)) & 0xff] ?? 0) ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

export type StripResult =
  | { readonly ok: true; readonly bytes: Uint8Array<ArrayBuffer>; readonly kept: readonly string[] }
  | { readonly ok: false; readonly error: string };

/** The size the IHDR must declare (ADR-0007 §3: dimensions that differ from the canvas fail). */
export interface ExpectedSize {
  readonly width: number;
  readonly height: number;
}

interface Chunk {
  readonly type: string;
  readonly length: number;
  readonly offset: number;
}

const u32 = (b: Uint8Array, o: number) =>
  (((b[o] ?? 0) << 24) | ((b[o + 1] ?? 0) << 16) | ((b[o + 2] ?? 0) << 8) | (b[o + 3] ?? 0)) >>> 0;
const isLetter = (c: number) => (c >= 65 && c <= 90) || (c >= 97 && c <= 122);

class Malformed extends Error {}

/** Walks the chunks, checking structure and every CRC; throws Malformed on any problem. */
function walk(b: Uint8Array): Chunk[] {
  if (b.length < 8 || SIGNATURE.some((v, i) => b[i] !== v)) throw new Malformed('bad signature');
  const chunks: Chunk[] = [];
  let o = 8;
  while (o < b.length) {
    if (o + 12 > b.length) throw new Malformed('truncated chunk header');
    const length = u32(b, o);
    if (length > 0x7fffffff) throw new Malformed('chunk length too large');
    for (let i = 4; i < 8; i++) if (!isLetter(b[o + i] ?? 0)) throw new Malformed('invalid chunk type');
    const end = o + 12 + length;
    if (end > b.length) throw new Malformed('chunk runs past the end');
    const type = String.fromCharCode(b[o + 4] ?? 0, b[o + 5] ?? 0, b[o + 6] ?? 0, b[o + 7] ?? 0);
    if (crc32(b, o + 4, o + 8 + length) !== u32(b, o + 8 + length)) throw new Malformed(`bad CRC in ${type}`);
    chunks.push({ type, length, offset: o });
    o = end;
    if (type === 'IEND') break;
  }
  // ADR-0019: any byte after IEND fails.
  if (o !== b.length) throw new Malformed('data after IEND');
  return chunks;
}

/**
 * ADR-0007 §3 / ADR-0019: a copy of `input` holding only IHDR, PLTE, tRNS, IDAT and IEND, each copied
 * whole. Fails (never throws) on a bad signature, IHDR not first or not exactly one, IEND not last, a
 * length past the end, a CRC mismatch, bytes after IEND, IDAT chunks that are not consecutive, an unknown
 * critical chunk (its type starts with an uppercase letter), or IHDR dimensions other than `expected`.
 */
export function stripPngChunks(input: Uint8Array, expected?: ExpectedSize): StripResult {
  let chunks: Chunk[];
  try {
    chunks = walk(input);
  } catch (e) {
    return { ok: false, error: e instanceof Malformed ? e.message : 'unreadable' };
  }
  const first = chunks[0];
  const last = chunks[chunks.length - 1];
  if (!first || first.type !== 'IHDR' || first.length !== 13) return { ok: false, error: 'IHDR not first' };
  if (!last || last.type !== 'IEND') return { ok: false, error: 'IEND not last' };
  if (
    expected &&
    (u32(input, first.offset + 8) !== expected.width || u32(input, first.offset + 12) !== expected.height)
  )
    return { ok: false, error: 'size mismatch' };
  let ihdr = 0;
  let iend = 0;
  let idat = 0;
  let idatEnded = false;
  const kept: Chunk[] = [];
  for (const c of chunks) {
    if (c.type === 'IHDR') ihdr++;
    if (c.type === 'IEND') iend++;
    if (c.type === 'IDAT') {
      if (idatEnded) return { ok: false, error: 'IDAT not consecutive' };
      idat++;
    } else if (idat > 0) idatEnded = true;
    if (PNG_KEPT_CHUNKS.has(c.type)) kept.push(c);
    // An unknown critical chunk: the image may not survive without it, so fail rather than drop it.
    else if (c.type.charCodeAt(0) < 97) return { ok: false, error: `unknown critical chunk ${c.type}` };
  }
  if (ihdr !== 1 || iend !== 1 || idat === 0) return { ok: false, error: 'bad chunk counts' };
  let size = SIGNATURE.length;
  for (const c of kept) size += 12 + c.length;
  const out = new Uint8Array(size);
  out.set(SIGNATURE, 0);
  let p = SIGNATURE.length;
  for (const c of kept) {
    out.set(input.subarray(c.offset, c.offset + 12 + c.length), p);
    p += 12 + c.length;
  }
  return { ok: true, bytes: out, kept: kept.map((c) => c.type) };
}

/** The chunk types of a PNG in order, or null when it is malformed (tests and evidence). */
export function pngChunkTypes(bytes: Uint8Array): string[] | null {
  try {
    return walk(bytes).map((c) => c.type);
  } catch {
    return null;
  }
}

const two = (n: number) => String(n).padStart(2, '0');

/**
 * RULE-15 download name: `<source name without extension>-annotated.png` when the image was opened from
 * a file, else `annotated-<YYYYMMDD-HHMMSS>.png` in the local time the caller passes. The extension is
 * the part after the last dot (a leading dot alone is not one).
 */
export function downloadName(sourceName: string | null, localTime: Date): string {
  if (sourceName) {
    const dot = sourceName.lastIndexOf('.');
    const base = dot > 0 ? sourceName.slice(0, dot) : sourceName;
    if (base) return `${base}-annotated.png`;
  }
  const d = localTime;
  const date = `${d.getFullYear()}${two(d.getMonth() + 1)}${two(d.getDate())}`;
  const time = `${two(d.getHours())}${two(d.getMinutes())}${two(d.getSeconds())}`;
  return `annotated-${date}-${time}.png`;
}
