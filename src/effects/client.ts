// MOD-Effects — the main-thread client (MOD-Effects "Responsibility", ADR-0006, ADR-0017, ADR-0022):
// sends one job per blur or pixelate redaction to the effects worker (ids, latest wins per redaction,
// one job in flight), caches finished patches as bitmaps keyed on (box, kind, strength in pixels, the
// solids touching the read window, frame), bounds the cache, offers an instant approximation while the
// exact patch is pending or while the redaction (or a solid it depends on) moves, and resolves a
// promise once every exact patch of a document is ready (the export awaits it, ADR-0007).
// Scheduling (ADR-0017): no exact job is sent while a redaction, or a solid it depends on, is moving;
// one job is queued after 100 ms without movement (or once it no longer moves); the latest wins.
// Worker lifetime (ADR-0022): the worker is terminated and a fresh one started for every new image.
// The DOM-bound parts (worker, bitmaps, the approximation canvas) are injected, so the scheduling is
// unit-tested in Node (tests/unit/effects.client.test.ts).
// Implements: F-007.R3 (live while drawn, moved or resized), F-007.R5, RULE-10, INV-02, NFR-02, NFR-04,
// ADR-0006 ("Computation"), ADR-0017 ("Scheduling", "Implementation"), ADR-0022 ("Fresh effects worker").
import {
  blurReach,
  effectArea,
  effectSize,
  intersectBoxes,
  isEffectRedaction,
  isSolidRedaction,
  redactionBox,
  solidsTouching,
  type Annotation,
  type Box,
  type Colour,
} from '../core';
import type { FromWorker, ToWorker, WireSolid } from './protocol';
import { PROTOCOL_VERSION } from './protocol';

/** The document parts the client reads (structurally MOD-Document's Doc and MOD-Render's Scene). */
export interface EffectsDoc {
  readonly annotations: readonly Annotation[];
  readonly frame: Box;
}

/**
 * A patch for one redaction: `bitmap` covers the output area `box` (O = B ∩ F, image pixels). An
 * approximation is smaller (`source` is the part of it that covers `box`) and is drawn scaled up, with
 * smoothing for blur and without for pixelate (`smooth`).
 */
export interface Patch {
  readonly box: Box;
  readonly bitmap: CanvasImageSource;
  readonly exact: boolean;
  readonly smooth: boolean;
  readonly source?: { readonly width: number; readonly height: number };
}

/** The worker as the client uses it (a real `Worker`, or a fake in the tests). */
export interface WorkerLike {
  postMessage(message: ToWorker, transfer?: Transferable[]): void;
  addEventListener(type: 'message', fn: (e: MessageEvent<FromWorker>) => void): void;
  terminate(): void;
}

/** The image as the approximation draws it (the loaded ImageBitmap). */
export type SourceImage = CanvasImageSource & { readonly width: number; readonly height: number };

export interface ApproxRequest {
  readonly source: SourceImage;
  readonly output: Box;
  /** Scale-down factor: about b for blur, p for pixelate (ADR-0006 "instant approximation"). */
  readonly factor: number;
  readonly smooth: boolean;
  readonly solids: readonly WireSolid[];
}

export interface EffectsDeps {
  createWorker(): WorkerLike;
  /** RGBA pixels (unpremultiplied, sRGB) → something drawable. */
  toBitmap(pixels: ArrayBuffer, width: number, height: number): Promise<CanvasImageSource>;
  /** ADR-0006 instant approximation, or null where it cannot be drawn. */
  approximate(request: ApproxRequest): { bitmap: CanvasImageSource; width: number; height: number } | null;
  setTimer(fn: () => void, ms: number): unknown;
  clearTimer(handle: unknown): void;
}

/** ADR-0017: an exact job is queued after this long without movement. */
export const IDLE_MS = 100;
/** Exact patches kept (NFR-04): far above the 10 effect redactions of NFR-02's reference scene. */
export const CACHE_LIMIT = 48;
/**
 * NFR-04: the exact patches' pixels together stay within this many times the image's own (a patch of a
 * whole 4096 × 4096 frame is 67 MB); the oldest go first, the newest always stays.
 */
export const CACHE_IMAGE_AREAS = 2;
const APPROX_LIMIT = 16;

interface Spec {
  readonly key: string;
  readonly box: Box;
  readonly kind: 'blur' | 'pixelate';
  readonly size: number;
  readonly frame: Box;
  readonly solids: readonly WireSolid[];
  readonly output: Box;
  /** The frame pixels the effect reads (ADR-0006: O ± 3b for blur, O for pixelate). */
  readonly window: Box;
}

const close = (bitmap: CanvasImageSource) => (bitmap as { close?: () => void }).close?.();

/** `#RRGGBB` → [r, g, b]. */
export function hexRgb(hex: string): [number, number, number] {
  const v = parseInt(hex.replace('#', '').slice(0, 6), 16);
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
}

export class EffectsClient {
  private worker: WorkerLike | null = null;
  private source: SourceImage | null = null;
  private palette: Readonly<Record<Colour, readonly [number, number, number]>> | null = null;
  private shortSide = 0;
  private imageArea = 0;
  private readonly exact = new Map<string, Patch>();
  private readonly approx = new Map<string, Patch>();
  /** Latest wanted job per redaction id (latest wins), in request order. */
  private readonly pending = new Map<string, Spec>();
  private inflight: { readonly id: number; readonly key: string } | null = null;
  private nextId = 1;
  /** ADR-0017: per moving redaction, the key it last had and the idle timer for it. */
  private readonly moving = new Map<string, { key: string; timer: unknown; fired: boolean }>();
  private readonly listeners = new Set<() => void>();
  private readonly waiters = new Set<() => void>();
  /** Bumped whenever an exact patch arrives (MOD-Canvas rebuilds cached drag layers that used approximations). */
  version = 0;
  /** Exact jobs sent so far (the ADR-0017 scheduling is checked with it). */
  jobsSent = 0;

  constructor(private readonly deps: EffectsDeps) {}

  /**
   * A new image's pixels (ADR-0005: read once after load and transferred): a fresh worker gets them
   * (ADR-0022), every cached patch is dropped, and pending jobs are sent.
   */
  setImage(
    pixels: ArrayBuffer,
    width: number,
    height: number,
    source: SourceImage,
    palette: Readonly<Record<Colour, string>>,
  ): void {
    this.clearImage();
    this.source = source;
    this.shortSide = Math.min(width, height);
    this.imageArea = width * height;
    this.palette = Object.fromEntries(Object.entries(palette).map(([k, v]) => [k, hexRgb(v)])) as Record<
      Colour,
      [number, number, number]
    >;
    const worker = this.deps.createWorker();
    worker.addEventListener('message', (e) => this.onMessage(worker, e.data));
    worker.postMessage({ v: PROTOCOL_VERSION, type: 'image', pixels, width, height }, [pixels]);
    this.worker = worker;
    for (const w of [...this.waiters]) w();
  }

  /** The image is replaced or cleared: the worker is terminated and its pixels freed (ADR-0022, NFR-04). */
  clearImage(): void {
    if (this.worker) {
      this.worker.postMessage({ v: PROTOCOL_VERSION, type: 'drop' });
      this.worker.terminate();
    }
    this.worker = null;
    this.source = null;
    this.inflight = null;
    this.pending.clear();
    for (const m of this.moving.values()) this.deps.clearTimer(m.timer);
    this.moving.clear();
    for (const p of [...this.exact.values(), ...this.approx.values()]) close(p.bitmap);
    this.exact.clear();
    this.approx.clear();
  }

  /** Called whenever an exact patch arrives (MOD-Canvas repaints). */
  onPatch(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private spec(a: Annotation, doc: EffectsDoc): Spec | null {
    if (!isEffectRedaction(a) || !this.palette) return null;
    const kind = a.style.redactionKind as 'blur' | 'pixelate';
    const size = effectSize(a.style, this.shortSide);
    const area = effectArea(a.box, kind, size, doc.frame);
    if (!area) return null;
    const palette = this.palette;
    const solids: WireSolid[] = solidsTouching(doc.annotations, area.window).map((s) => ({
      box: redactionBox(s.box),
      rgb: palette[s.style.color],
    }));
    const box = redactionBox(a.box);
    const f = doc.frame;
    const key = [
      kind,
      size,
      box.x,
      box.y,
      box.width,
      box.height,
      f.x,
      f.y,
      f.width,
      f.height,
      ...solids.flatMap((s) => [s.box.x, s.box.y, s.box.width, s.box.height, ...s.rgb]),
    ].join(',');
    return { key, box, kind, size, frame: f, solids, output: area.output, window: area.window };
  }

  /**
   * The patch to draw for every blur and pixelate redaction of `doc` (MOD-Effects `patchesFor`): the
   * exact one when it is ready, else the approximation. `moving` names the annotations being drawn,
   * moved or resized (ADR-0017): no exact job is sent for them, or for effects that read a moving solid,
   * until they have been still for IDLE_MS.
   */
  patchesFor(doc: EffectsDoc, moving: ReadonlySet<string> = new Set()): ReadonlyMap<string, Patch> {
    const out = new Map<string, Patch>();
    const movingSolids = doc.annotations.filter((a) => moving.has(a.id) && isSolidRedaction(a));
    for (const a of doc.annotations) {
      const spec = this.spec(a, doc);
      if (!spec) continue;
      const exact = this.exact.get(spec.key);
      if (exact) {
        // Refresh its place in the bounded cache (least recently used goes first).
        this.exact.delete(spec.key);
        this.exact.set(spec.key, exact);
        out.set(a.id, exact);
      } else {
        const approx = this.approximation(spec);
        if (approx) out.set(a.id, approx);
      }
      const reads = (s: Annotation) => isSolidRedaction(s) && intersectBoxes(redactionBox(s.box), spec.window) !== null;
      if (moving.has(a.id) || movingSolids.some(reads)) this.noteMoving(a.id, spec);
      else {
        this.settle(a.id);
        if (!exact) this.request(a.id, spec);
      }
    }
    return out;
  }

  /** ADR-0017: a moving redaction gets an exact job only after IDLE_MS without its key changing. */
  private noteMoving(id: string, spec: Spec): void {
    const m = this.moving.get(id);
    if (m && m.key === spec.key) {
      if (m.fired && !this.exact.has(spec.key)) this.request(id, spec);
      return;
    }
    if (m) this.deps.clearTimer(m.timer);
    this.pending.delete(id); // a job for an earlier position is no longer wanted
    const entry = { key: spec.key, fired: false, timer: undefined as unknown };
    entry.timer = this.deps.setTimer(() => {
      entry.fired = true;
      this.request(id, spec);
    }, IDLE_MS);
    this.moving.set(id, entry);
  }

  private settle(id: string): void {
    const m = this.moving.get(id);
    if (!m) return;
    this.deps.clearTimer(m.timer);
    this.moving.delete(id);
  }

  private approximation(spec: Spec): Patch | null {
    const cached = this.approx.get(spec.key);
    if (cached) return cached;
    if (!this.source) return null;
    const b = spec.kind === 'blur' ? Math.max(1, blurReach(spec.size)) : spec.size;
    const smooth = spec.kind === 'blur';
    const made = this.deps.approximate({
      source: this.source,
      output: spec.output,
      factor: b,
      smooth,
      solids: spec.solids,
    });
    if (!made) return null;
    const patch: Patch = {
      box: spec.output,
      bitmap: made.bitmap,
      exact: false,
      smooth,
      source: { width: made.width, height: made.height },
    };
    this.approx.set(spec.key, patch);
    while (this.approx.size > APPROX_LIMIT) {
      const [oldest, p] = this.approx.entries().next().value as [string, Patch];
      this.approx.delete(oldest);
      close(p.bitmap);
    }
    return patch;
  }

  private request(id: string, spec: Spec): void {
    if (this.exact.has(spec.key) || this.inflight?.key === spec.key) return;
    if (this.pending.get(id)?.key === spec.key) return;
    this.pending.delete(id);
    this.pending.set(id, spec);
    this.pump();
  }

  /** One job in flight; the next pending one (latest per redaction) is sent when it returns. */
  private pump(): void {
    if (this.inflight || !this.worker) return;
    for (const [id, spec] of this.pending) {
      this.pending.delete(id);
      if (this.exact.has(spec.key)) continue;
      const jobId = this.nextId++;
      this.inflight = { id: jobId, key: spec.key };
      this.jobsSent++;
      this.worker.postMessage({
        v: PROTOCOL_VERSION,
        type: 'job',
        id: jobId,
        box: spec.box,
        kind: spec.kind,
        size: spec.size,
        frame: spec.frame,
        solids: spec.solids,
      });
      return;
    }
  }

  private onMessage(worker: WorkerLike, msg: FromWorker): void {
    if (worker !== this.worker || msg.v !== PROTOCOL_VERSION) return; // a terminated worker's late reply
    const job = this.inflight;
    if (!job || job.id !== msg.id) return;
    this.inflight = null;
    if (msg.type === 'patch') {
      const { box } = msg;
      void this.deps.toBitmap(msg.pixels, box.width, box.height).then((bitmap) => {
        if (worker !== this.worker) return close(bitmap);
        const patch: Patch = { box, bitmap, exact: true, smooth: !job.key.startsWith('pixelate') };
        this.exact.set(job.key, patch);
        const area = () => [...this.exact.values()].reduce((sum, p) => sum + p.box.width * p.box.height, 0);
        while (this.exact.size > 1 && (this.exact.size > CACHE_LIMIT || area() > CACHE_IMAGE_AREAS * this.imageArea)) {
          const [oldest, p] = this.exact.entries().next().value as [string, Patch];
          this.exact.delete(oldest);
          close(p.bitmap);
        }
        const a = this.approx.get(job.key);
        if (a) {
          this.approx.delete(job.key);
          close(a.bitmap);
        }
        this.version++;
        for (const l of this.listeners) l();
        for (const w of [...this.waiters]) w();
      });
    }
    this.pump();
  }

  /**
   * MOD-Effects `exactPatches`: resolves with the exact patch of every blur and pixelate redaction of
   * `doc` once all are ready (the export waits for them, ADR-0006, ADR-0007).
   */
  exactPatches(doc: EffectsDoc): Promise<ReadonlyMap<string, Patch>> {
    return new Promise((resolve) => {
      const check = () => {
        // Until the image's pixels arrive, no effect can be computed: wait for them.
        if (!this.palette && doc.annotations.some(isEffectRedaction)) return false;
        const out = new Map<string, Patch>();
        let missing = false;
        for (const a of doc.annotations) {
          const spec = this.spec(a, doc);
          if (!spec) continue;
          const p = this.exact.get(spec.key);
          if (p) out.set(a.id, p);
          else {
            missing = true;
            this.request(a.id, spec);
          }
        }
        if (missing) return false;
        this.waiters.delete(waiter);
        resolve(out);
        return true;
      };
      const waiter = () => void check();
      this.waiters.add(waiter);
      check();
    });
  }
}
