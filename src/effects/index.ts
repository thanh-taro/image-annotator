// MOD-Effects — reference blur and pixelate in a worker, patch cache, live approximation
// (specs/40-technical/modules/MOD-Effects.md, ADR-0006, ADR-0017, ADR-0022). Imports MOD-Core only.
// The client and its scheduling are ./client.ts; the worker is ./worker.ts (protocol in ./protocol.ts)
// running ./algorithms.ts; the slow reference for tests is ./reference.ts (never imported by the app).
// This file binds one client for the page to the real worker, bitmaps and approximation canvas.
// Implements: F-007.R3/R5, RULE-10, INV-02, NFR-02, NFR-04.
import type { Colour } from '../core';
import {
  EffectsClient,
  type ApproxRequest,
  type EffectsDoc,
  type Patch,
  type SourceImage,
  type WorkerLike,
} from './client';

export { CACHE_IMAGE_AREAS, CACHE_LIMIT, EffectsClient, hexRgb, IDLE_MS } from './client';
export type { ApproxRequest, EffectsDeps, EffectsDoc, Patch, SourceImage, WorkerLike } from './client';
export type { FromWorker, ToWorker, WireSolid } from './protocol';
export { PROTOCOL_VERSION } from './protocol';

const newCanvas = (w: number, h: number): OffscreenCanvas | HTMLCanvasElement => {
  if (typeof OffscreenCanvas === 'function') return new OffscreenCanvas(w, h);
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
};

/**
 * ADR-0006 instant approximation: the output area drawn scaled down by about b (blur, with smoothing)
 * or by p (pixelate) into a small canvas, with the solids it reads stamped in their colours; MOD-Render
 * scales it back up over the area. Only frame pixels are read (the area lies inside the frame).
 */
export function approximate({ source, output, factor, smooth, solids }: ApproxRequest) {
  // Whole pixels, so the small canvas is fully covered (no translucent last row or column showing the
  // backdrop); the area is stretched by less than one block to fit them.
  const width = Math.max(1, Math.ceil(output.width / factor));
  const height = Math.max(1, Math.ceil(output.height / factor));
  const kx = width / output.width;
  const ky = height / output.height;
  const canvas = newCanvas(width, height);
  // ADR-0005 §4: every canvas the tool creates is sRGB.
  const ctx = canvas.getContext('2d', { colorSpace: 'srgb' }) as
    OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D | null;
  if (!ctx) return null;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = smooth ? 'medium' : 'low';
  ctx.drawImage(source, output.x, output.y, output.width, output.height, 0, 0, width, height);
  for (const s of solids) {
    ctx.fillStyle = `rgb(${s.rgb.join(',')})`;
    ctx.fillRect((s.box.x - output.x) * kx, (s.box.y - output.y) * ky, s.box.width * kx, s.box.height * ky);
  }
  return { bitmap: canvas, width, height };
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

/** MOD-Effects `exactPatches`: resolves once every exact patch of `doc` is ready (export, ADR-0007). */
export function exactPatches(doc: EffectsDoc): Promise<ReadonlyMap<string, Patch>> {
  return effects().exactPatches(doc);
}
