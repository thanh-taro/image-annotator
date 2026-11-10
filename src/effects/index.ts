// MOD-Effects — reference blur and pixelate in a worker, patch cache, live approximation
// (specs/40-technical/modules/MOD-Effects.md, ADR-0006, ADR-0017, ADR-0022). Imports MOD-Core only.
// The client and its scheduling are ./client.ts; the worker is ./worker.ts (protocol in ./protocol.ts)
// running ./algorithms.ts; the slow reference for tests is ./reference.ts (test-only; lint forbids app imports, ADR-0017).
// This file binds one client for the page to the real worker, bitmaps and approximation canvas.
// Implements: F-007.R3/R5, RULE-10, INV-02, NFR-02, NFR-04.
import type { Colour } from '../core';
import {
  EffectsClient,
  type ApproxRequest,
  type EffectsDoc,
  type HeldPatches,
  type Patch,
  type SourceImage,
  type WorkerLike,
} from './client';

export { CACHE_IMAGE_AREAS, CACHE_LIMIT, EffectsClient, IDLE_MS } from './client';
export type { ApproxRequest, EffectsDeps, EffectsDoc, HeldPatches, Patch, SourceImage, WorkerLike } from './client';
export type { FromWorker, ToWorker, WireSolid } from './protocol';
export { PROTOCOL_VERSION } from './protocol';

const newCanvas = (w: number, h: number): OffscreenCanvas | HTMLCanvasElement => {
  if (typeof OffscreenCanvas === 'function') return new OffscreenCanvas(w, h);
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
};

type Ctx2D = OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D;
const context = (c: OffscreenCanvas | HTMLCanvasElement): Ctx2D | null =>
  // ADR-0005 §4: every canvas the tool creates is sRGB.
  c.getContext('2d', { colorSpace: 'srgb' }) as Ctx2D | null;

/**
 * ADR-0006 instant approximation. RULE-10 holds on screen too: the output area O is first copied at
 * 1:1 (whole pixels, so no filtering reads past O, i.e. outside the frame) with every solid it reads
 * stamped at its whole-pixel box, and only that copy is scaled down, so no pixel under a solid is ever
 * averaged in. Blur: O scaled down by about b (smoothing) into whole pixels, stretched back over O.
 * Pixelate: one small pixel per p × p block of the grid aligned to B's top-left corner, drawn back at
 * p × p (MOD-Render clips it to O); edge blocks average only their part inside O.
 */
export function approximate({ source, output: o, factor, solids, grid }: ApproxRequest) {
  const copy = newCanvas(o.width, o.height);
  const cx = context(copy);
  if (!cx) return null;
  cx.imageSmoothingEnabled = false;
  cx.drawImage(source, o.x, o.y, o.width, o.height, 0, 0, o.width, o.height);
  for (const s of solids) {
    cx.fillStyle = `rgb(${s.rgb.join(',')})`;
    cx.fillRect(s.box.x - o.x, s.box.y - o.y, s.box.width, s.box.height);
  }
  const width = grid ? grid.cols : Math.max(1, Math.ceil(o.width / factor));
  const height = grid ? grid.rows : Math.max(1, Math.ceil(o.height / factor));
  const canvas = newCanvas(width, height);
  const ctx = context(canvas);
  if (!ctx) return null;
  // 'medium' averages the pixels it scales down on Chromium and WebKit alike ('low' samples a point,
  // WebKit's 'high' too), so each small pixel approximates its block's mean (ADR-0006).
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'medium';
  // Underlay: the whole small canvas covered (no translucent edge cell showing the backdrop) …
  ctx.drawImage(copy, 0, 0, width, height);
  // … then, for pixelate, O placed at its true position in the block grid.
  if (grid) ctx.drawImage(copy, (o.x - grid.x) / factor, (o.y - grid.y) / factor, o.width / factor, o.height / factor);
  copy.width = 0; // NFR-04: the 1:1 copy is freed at once
  copy.height = 0;
  const at = grid ? { x: grid.x, y: grid.y, width: grid.cols * factor, height: grid.rows * factor } : undefined;
  return { bitmap: canvas, width, height, ...(at ? { at } : {}) };
}

let client: EffectsClient | null = null;

/** The page's one effects client, created on first use with the real worker. */
export function effects(): EffectsClient {
  client ??= new EffectsClient({
    createWorker: () =>
      new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' }) as unknown as WorkerLike,
    toBitmap: (pixels, width, height) =>
      createImageBitmap(new ImageData(new Uint8ClampedArray(pixels), width, height), {
        premultiplyAlpha: 'none',
        colorSpaceConversion: 'none',
      }),
    approximate,
    setTimer: (fn, ms) => setTimeout(fn, ms),
    clearTimer: (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>),
  });
  return client;
}

/** MOD-Effects `setImage`: a new image's sRGB pixels, its drawable source and the palette (RULE-04). */
export function setImage(
  pixels: ArrayBuffer,
  width: number,
  height: number,
  source: SourceImage,
  palette: Readonly<Record<Colour, string>>,
): void {
  effects().setImage(pixels, width, height, source, palette);
}

/** MOD-Effects `clearImage`: the image is replaced or cleared (fresh worker next time, ADR-0022). */
export function clearImage(): void {
  client?.clearImage();
}

/** MOD-Effects `patchesFor`: exact or approximate patches by redaction id. */
export function patchesFor(doc: EffectsDoc, moving?: ReadonlySet<string>): ReadonlyMap<string, Patch> {
  return effects().patchesFor(doc, moving);
}

/**
 * MOD-Effects `exactPatches`: resolves once every exact patch of `doc` is ready (held until `release()`),
 * rejects if a job failed, the image was replaced or `signal` aborted.
 */
export function exactPatches(doc: EffectsDoc, signal?: AbortSignal): Promise<HeldPatches> {
  return effects().exactPatches(doc, signal);
}
