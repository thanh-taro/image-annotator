// MOD-Effects — the slow, independent reference of ADR-0006, for tests only (never imported by the app;
// ADR-0006 "Testing", ADR-0017). Promoted from spike SP-blur (spikes/blur/src/reference.ts): written from
// the ADR text, deliberately naive — per-channel planes of plain numbers over the WHOLE frame, explicit
// clamping, no windowing, no lookup tables — so it shares no code with ./algorithms.ts.
// Implements: ADR-0006 (definitions), RULE-10, INV-02 (the reference the tests and F-007.AC7 compare with).
import type { Box } from '../core';
import type { EffectPixels, Pixels, Solid } from './algorithms';

type Planes = number[][][]; // [channel][y][x], frame-relative

function sourcePlanes(img: Pixels, F: Box, solids: readonly Solid[]): Planes {
  const P: Planes = [0, 1, 2, 3].map(() => Array.from({ length: F.height }, () => new Array<number>(F.width).fill(0)));
  for (let y = 0; y < F.height; y++)
    for (let x = 0; x < F.width; x++) {
      const ix = F.x + x;
      const iy = F.y + y;
      let rgba = [0, 1, 2, 3].map((c) => img.data[(iy * img.width + ix) * 4 + c] as number);
      for (const s of solids) {
        const sx0 = Math.floor(s.box.x);
        const sy0 = Math.floor(s.box.y);
        const sx1 = Math.ceil(s.box.x + s.box.width);
        const sy1 = Math.ceil(s.box.y + s.box.height);
        if (ix >= sx0 && ix < sx1 && iy >= sy0 && iy < sy1) rgba = [...s.rgb, 255];
      }
      const a = rgba[3] as number;
      for (let c = 0; c < 3; c++) (P[c] as number[][])[y]![x] = Math.floor(((rgba[c] as number) * a + 127) / 255);
      (P[3] as number[][])[y]![x] = a;
    }
  return P;
}

const clamp = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v);

function pass(P: Planes, b: number, horizontal: boolean): Planes {
  const w = 2 * b + 1;
  return P.map((plane) =>
    plane.map((row, y) =>
      row.map((_, x) => {
        let sum = 0;
        for (let k = -b; k <= b; k++)
          sum += horizontal
            ? (plane[y]![clamp(x + k, 0, row.length - 1)] as number)
            : (plane[clamp(y + k, 0, plane.length - 1)]![x] as number);
        return Math.floor((sum + b) / w);
      }),
    ),
  );
}

function unpremultiplyOut(P: Planes, F: Box, O: Box): Uint8ClampedArray {
  const out = new Uint8ClampedArray(O.width * O.height * 4);
  for (let y = 0; y < O.height; y++)
    for (let x = 0; x < O.width; x++) {
      const fy = O.y - F.y + y;
      const fx = O.x - F.x + x;
      const i = (y * O.width + x) * 4;
      const a = P[3]![fy]![fx] as number;
      if (a === 0) continue;
      for (let c = 0; c < 3; c++)
        out[i + c] = Math.min(255, Math.floor(((P[c]![fy]![fx] as number) * 255 + Math.floor(a / 2)) / a));
      out[i + 3] = a;
    }
  return out;
}

function outArea(F: Box, box: Box): Box | null {
  const x0 = Math.max(Math.floor(box.x), F.x);
  const y0 = Math.max(Math.floor(box.y), F.y);
  const x1 = Math.min(Math.ceil(box.x + box.width), F.x + F.width);
  const y1 = Math.min(Math.ceil(box.y + box.height), F.y + F.height);
  return x1 > x0 && y1 > y0 ? { x: x0, y: y0, width: x1 - x0, height: y1 - y0 } : null;
}

/** ADR-0006 reference blur of `box` with radius `r` over frame F. */
export function referenceBlur(img: Pixels, F: Box, box: Box, r: number, solids: readonly Solid[]): EffectPixels | null {
  const O = outArea(F, box);
  if (!O) return null;
  const b = Math.floor((r + 1) / 2);
  let P = sourcePlanes(img, F, solids);
  for (let i = 0; i < 3; i++) {
    P = pass(P, b, true);
    P = pass(P, b, false);
  }
  return { ...O, data: unpremultiplyOut(P, F, O) };
}

/** ADR-0006 reference pixelate of `box` with block `p` over frame F. */
export function referencePixelate(
  img: Pixels,
  F: Box,
  box: Box,
  p: number,
  solids: readonly Solid[],
): EffectPixels | null {
  const O = outArea(F, box);
  if (!O) return null;
  const bx0 = Math.floor(box.x);
  const by0 = Math.floor(box.y);
  const P = sourcePlanes(img, F, solids);
  const R: Planes = P.map((pl) => pl.map((row) => row.slice()));
  const groups = new Map<string, [number, number][]>();
  for (let y = O.y; y < O.y + O.height; y++)
    for (let x = O.x; x < O.x + O.width; x++) {
      const key = `${Math.floor((x - bx0) / p)},${Math.floor((y - by0) / p)}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push([x - F.x, y - F.y]);
    }
  for (const px of groups.values()) {
    const n = px.length;
    for (let c = 0; c < 4; c++) {
      const sum = px.reduce((acc, [x, y]) => acc + (P[c]![y]![x] as number), 0);
      const v = Math.floor((sum + Math.floor(n / 2)) / n);
      for (const [x, y] of px) R[c]![y]![x] = v;
    }
  }
  return { ...O, data: unpremultiplyOut(R, F, O) };
}
