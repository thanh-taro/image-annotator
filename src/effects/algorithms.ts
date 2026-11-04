// MOD-Effects — the optimised exact blur and pixelate of ADR-0006, promoted from spike SP-blur
// (spikes/blur/src/effects.ts, commit bc838fc) per ADR-0017: the packed-integer (SWAR) blur for b ≤ 128,
// the plain interleaved integer blur above that, and window buffers reused between jobs. Pure and
// DOM-free: it runs in the effects worker and in the tests, which compare it with ./reference.ts.
// Implements: RULE-10 (radius and block; only frame pixels, every solid applied), INV-02, F-007.R3/R5,
// ADR-0006 (definitions, rounding, window O ± 3b), ADR-0017 (SWAR, buffer reuse).
import { blurReach, effectArea, redactionBox, intersectBoxes, type Box } from '../core';

/** 8-bit RGBA pixels, row-major (the image's sRGB pixels, ADR-0005). */
export interface Pixels {
  readonly data: Uint8ClampedArray | Uint8Array;
  readonly width: number;
  readonly height: number;
}

/** A solid redaction as an effect reads it: its box and colour (stamped at α 255, ADR-0006 source S). */
export interface Solid {
  readonly box: Box;
  readonly rgb: readonly [number, number, number];
}

/** An effect's output pixels over O = B ∩ F (unpremultiplied RGBA). */
export interface EffectPixels {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly data: Uint8ClampedArray;
}

/**
 * Buffers kept between jobs (ADR-0017: the large box otherwise allocates about 25 MB per job). Each
 * grows to the largest window seen; `drop` frees them (a new image).
 */
export class Scratch {
  private words = new Uint32Array(0);
  private temp = new Uint32Array(0);
  private sumsA = new Int32Array(0);
  private sumsB = new Int32Array(0);

  /** The window buffer as 32-bit words and as bytes over the same memory (n pixels). */
  window(n: number): { readonly words: Uint32Array; readonly bytes: Uint8Array } {
    if (this.words.length < n) this.words = new Uint32Array(n);
    const words = this.words.subarray(0, n);
    return { words, bytes: new Uint8Array(words.buffer, 0, n * 4) };
  }
  tempWords(n: number): Uint32Array {
    if (this.temp.length < n) this.temp = new Uint32Array(n);
    return this.temp.subarray(0, n);
  }
  sums(n: number): readonly [Int32Array, Int32Array] {
    if (this.sumsA.length < n) {
      this.sumsA = new Int32Array(n);
      this.sumsB = new Int32Array(n);
    }
    return [this.sumsA.subarray(0, n), this.sumsB.subarray(0, n)];
  }
  drop(): void {
    this.words = new Uint32Array(0);
    this.temp = new Uint32Array(0);
    this.sumsA = new Int32Array(0);
    this.sumsB = new Int32Array(0);
  }
}

const divLuts = new Map<number, Uint8Array>();
/** LUT[sum] = ⌊(sum + b) / w⌋ for sum in [0, 255·w] (ADR-0006 pass rounding). */
function divLut(b: number): Uint8Array {
  let t = divLuts.get(b);
  if (!t) {
    const w = 2 * b + 1;
    t = new Uint8Array(255 * w + 1);
    for (let s = 0; s < t.length; s++) t[s] = Math.floor((s + b) / w);
    divLuts.set(b, t);
  }
  return t;
}

/**
 * ADR-0006 source S over window W: the image's pixels premultiplied (p = ⌊(c·a + 127) / 255⌋), with
 * every solid's covered pixels set to its colour at α 255. Returns whether every pixel is opaque.
 */
function loadPremultiplied(img: Pixels, W: Box, solids: readonly Solid[], buf: Uint8Array): boolean {
  const src = img.data;
  let opaque = true;
  for (let y = 0; y < W.height; y++) {
    let si = ((W.y + y) * img.width + W.x) * 4;
    let di = y * W.width * 4;
    const end = di + W.width * 4;
    for (; di < end; di += 4, si += 4) {
      const a = src[si + 3] as number;
      if (a === 255) {
        buf[di] = src[si] as number;
        buf[di + 1] = src[si + 1] as number;
        buf[di + 2] = src[si + 2] as number;
        buf[di + 3] = 255;
      } else {
        opaque = false;
        buf[di] = (((src[si] as number) * a + 127) / 255) | 0;
        buf[di + 1] = (((src[si + 1] as number) * a + 127) / 255) | 0;
        buf[di + 2] = (((src[si + 2] as number) * a + 127) / 255) | 0;
        buf[di + 3] = a;
      }
    }
  }
  for (const s of solids) {
    const r = intersectBoxes(redactionBox(s.box), W);
    if (!r) continue;
    const [cr, cg, cb] = s.rgb;
    for (let y = r.y; y < r.y + r.height; y++) {
      let di = ((y - W.y) * W.width + (r.x - W.x)) * 4;
      for (let x = 0; x < r.width; x++, di += 4) {
        buf[di] = cr;
        buf[di + 1] = cg;
        buf[di + 2] = cb;
        buf[di + 3] = 255;
      }
    }
  }
  return opaque;
}

/** ADR-0006 unpremultiply of O out of the window buffer: c = min(255, ⌊(p·255 + ⌊a/2⌋) / a⌋); a = 0 → 0. */
function unpremultiply(buf: Uint8Array, W: Box, O: Box, opaque: boolean): Uint8ClampedArray {
  const out = new Uint8ClampedArray(O.width * O.height * 4);
  for (let y = 0; y < O.height; y++) {
    const si0 = ((O.y - W.y + y) * W.width + (O.x - W.x)) * 4;
    const di0 = y * O.width * 4;
    if (opaque) {
      out.set(buf.subarray(si0, si0 + O.width * 4), di0);
      continue;
    }
    for (let x = 0; x < O.width * 4; x += 4) {
      const si = si0 + x;
      const di = di0 + x;
      const a = buf[si + 3] as number;
      if (a === 255) {
        out[di] = buf[si] as number;
        out[di + 1] = buf[si + 1] as number;
        out[di + 2] = buf[si + 2] as number;
        out[di + 3] = 255;
      } else if (a !== 0) {
        const h = a >> 1;
        out[di] = Math.min(255, (((buf[si] as number) * 255 + h) / a) | 0);
        out[di + 1] = Math.min(255, (((buf[si + 1] as number) * 255 + h) / a) | 0);
        out[di + 2] = Math.min(255, (((buf[si + 2] as number) * 255 + h) / a) | 0);
        out[di + 3] = a;
      }
    }
  }
  return out;
}

// ---------- plain interleaved passes (fallback for b > 128, where packed sums would overflow) ----------

function hPass(src: Uint8Array, dst: Uint8Array, w: number, h: number, b: number, lut: Uint8Array): void {
  const last = w - 1;
  for (let y = 0; y < h; y++) {
    const row = y * w * 4;
    let s0 = 0;
    let s1 = 0;
    let s2 = 0;
    let s3 = 0;
    for (let k = -b; k <= b; k++) {
      const i = row + (k < 0 ? 0 : k > last ? last : k) * 4;
      s0 += src[i] as number;
      s1 += src[i + 1] as number;
      s2 += src[i + 2] as number;
      s3 += src[i + 3] as number;
    }
    for (let x = 0; x < w; x++) {
      const o = row + x * 4;
      dst[o] = lut[s0] as number;
      dst[o + 1] = lut[s1] as number;
      dst[o + 2] = lut[s2] as number;
      dst[o + 3] = lut[s3] as number;
      const add = row + (x + b + 1 > last ? last : x + b + 1) * 4;
      const sub = row + (x - b < 0 ? 0 : x - b) * 4;
      s0 += (src[add] as number) - (src[sub] as number);
      s1 += (src[add + 1] as number) - (src[sub + 1] as number);
      s2 += (src[add + 2] as number) - (src[sub + 2] as number);
      s3 += (src[add + 3] as number) - (src[sub + 3] as number);
    }
  }
}

function vPass(src: Uint8Array, dst: Uint8Array, w: number, h: number, b: number, lut: Uint8Array): void {
  const stride = w * 4;
  const last = h - 1;
  const sums = new Int32Array(stride);
  for (let k = -b; k <= b; k++) {
    const r = (k < 0 ? 0 : k > last ? last : k) * stride;
    for (let c = 0; c < stride; c++) sums[c] = (sums[c] as number) + (src[r + c] as number);
  }
  for (let y = 0; y < h; y++) {
    const o = y * stride;
    for (let c = 0; c < stride; c++) dst[o + c] = lut[sums[c] as number] as number;
    const ar = (y + b + 1 > last ? last : y + b + 1) * stride;
    const sr = (y - b < 0 ? 0 : y - b) * stride;
    for (let c = 0; c < stride; c++) sums[c] = (sums[c] as number) + (src[ar + c] as number) - (src[sr + c] as number);
  }
}

// ---------- SWAR passes: one 32-bit load per pixel, two channels per sum (R|B<<16, G|A<<16) ----------
// Each lane's sum is ≤ 255·(2b + 1) < 65536 for b ≤ 128, so lanes never carry into each other.
const LO = 0x00ff00ff;
export const SWAR_MAX_REACH = 128;

function pack(lut: Uint8Array, rb: number, ga: number): number {
  return (
    ((lut[rb & 0xffff] as number) |
      ((lut[ga & 0xffff] as number) << 8) |
      ((lut[rb >>> 16] as number) << 16) |
      ((lut[ga >>> 16] as number) << 24)) >>>
    0
  );
}

function hSwar(src: Uint32Array, dst: Uint32Array, w: number, h: number, b: number, lut: Uint8Array): void {
  const last = w - 1;
  for (let y = 0, row = 0; y < h; y++, row += w) {
    let rb = 0;
    let ga = 0;
    for (let k = -b; k <= b; k++) {
      const p = src[row + (k < 0 ? 0 : k > last ? last : k)] as number;
      rb += p & LO;
      ga += (p >>> 8) & LO;
    }
    for (let x = 0; x < w; x++) {
      dst[row + x] = pack(lut, rb, ga);
      const ai = x + b + 1;
      const si = x - b;
      const pa = src[row + (ai > last ? last : ai)] as number;
      const ps = src[row + (si < 0 ? 0 : si)] as number;
      rb = rb + (pa & LO) - (ps & LO);
      ga = ga + ((pa >>> 8) & LO) - ((ps >>> 8) & LO);
    }
  }
}

function vSwar(
  src: Uint32Array,
  dst: Uint32Array,
  w: number,
  h: number,
  b: number,
  lut: Uint8Array,
  rbs: Int32Array,
  gas: Int32Array,
): void {
  const last = h - 1;
  rbs.fill(0);
  gas.fill(0);
  for (let k = -b; k <= b; k++) {
    const r = (k < 0 ? 0 : k > last ? last : k) * w;
    for (let c = 0; c < w; c++) {
      const p = src[r + c] as number;
      rbs[c] = (rbs[c] as number) + (p & LO);
      gas[c] = (gas[c] as number) + ((p >>> 8) & LO);
    }
  }
  for (let y = 0; y < h; y++) {
    const o = y * w;
    const ar = (y + b + 1 > last ? last : y + b + 1) * w;
    const sr = (y - b < 0 ? 0 : y - b) * w;
    for (let c = 0; c < w; c++) {
      const rb = rbs[c] as number;
      const ga = gas[c] as number;
      dst[o + c] = pack(lut, rb, ga);
      const pa = src[ar + c] as number;
      const ps = src[sr + c] as number;
      rbs[c] = rb + (pa & LO) - (ps & LO);
      gas[c] = ga + ((pa >>> 8) & LO) - ((ps >>> 8) & LO);
    }
  }
}

const shared = new Scratch();

/**
 * ADR-0006 blur with radius `r`: three rounds of a horizontal then a vertical box pass of width 2b + 1
 * over premultiplied S, edges clamped to the frame, computed on the window O ± 3b ∩ F (exact, since
 * each axis reads at most 3b away). Null when the box lies outside the frame.
 */
export function blur(
  img: Pixels,
  frame: Box,
  box: Box,
  r: number,
  solids: readonly Solid[],
  scratch: Scratch = shared,
): EffectPixels | null {
  const area = effectArea(box, 'blur', r, frame);
  if (!area) return null;
  const { output: O, window: W } = area;
  const b = blurReach(r);
  const n = W.width * W.height;
  const { words, bytes } = scratch.window(n);
  const opaque = loadPremultiplied(img, W, solids, bytes);
  const lut = divLut(b);
  if (b > SWAR_MAX_REACH) {
    const tmp = new Uint8Array(n * 4);
    for (let round = 0; round < 3; round++) {
      hPass(bytes, tmp, W.width, W.height, b, lut);
      vPass(tmp, bytes, W.width, W.height, b, lut);
    }
  } else {
    const tmp = scratch.tempWords(n);
    const [rbs, gas] = scratch.sums(W.width);
    for (let round = 0; round < 3; round++) {
      hSwar(words, tmp, W.width, W.height, b, lut);
      vSwar(tmp, words, W.width, W.height, b, lut, rbs, gas);
    }
  }
  return { ...O, data: unpremultiply(bytes, W, O, opaque) };
}

/**
 * ADR-0006 pixelate with block `p`: blocks aligned to the box's rounded top-left corner; each block ∩ O
 * gets the mean of its own premultiplied pixels, ⌊(Σ + ⌊n/2⌋) / n⌋ per channel, then unpremultiplied.
 */
export function pixelate(
  img: Pixels,
  frame: Box,
  box: Box,
  p: number,
  solids: readonly Solid[],
  scratch: Scratch = shared,
): EffectPixels | null {
  const area = effectArea(box, 'pixelate', p, frame);
  if (!area) return null;
  const O = area.output;
  const B = redactionBox(box);
  const { bytes: buf } = scratch.window(O.width * O.height);
  const opaque = loadPremultiplied(img, O, solids, buf);
  const ow = O.width;
  const x1 = O.x + O.width;
  const y1 = O.y + O.height;
  const firstBx = O.x - ((((O.x - B.x) % p) + p) % p);
  const firstBy = O.y - ((((O.y - B.y) % p) + p) % p);
  for (let by = firstBy; by < y1; by += p) {
    const ya = Math.max(by, O.y) - O.y;
    const yb = Math.min(by + p, y1) - O.y;
    for (let bx = firstBx; bx < x1; bx += p) {
      const xa = Math.max(bx, O.x) - O.x;
      const xb = Math.min(bx + p, x1) - O.x;
      let s0 = 0;
      let s1 = 0;
      let s2 = 0;
      let s3 = 0;
      for (let y = ya; y < yb; y++)
        for (let i = (y * ow + xa) * 4, e = (y * ow + xb) * 4; i < e; i += 4) {
          s0 += buf[i] as number;
          s1 += buf[i + 1] as number;
          s2 += buf[i + 2] as number;
          s3 += buf[i + 3] as number;
        }
      const n = (yb - ya) * (xb - xa);
      const h = n >> 1;
      const v0 = Math.floor((s0 + h) / n);
      const v1 = Math.floor((s1 + h) / n);
      const v2 = Math.floor((s2 + h) / n);
      const v3 = Math.floor((s3 + h) / n);
      for (let y = ya; y < yb; y++)
        for (let i = (y * ow + xa) * 4, e = (y * ow + xb) * 4; i < e; i += 4) {
          buf[i] = v0;
          buf[i + 1] = v1;
          buf[i + 2] = v2;
          buf[i + 3] = v3;
        }
    }
  }
  return { ...O, data: unpremultiply(buf, O, O, opaque) };
}
