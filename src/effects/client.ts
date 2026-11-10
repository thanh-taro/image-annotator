// MOD-Effects — the main-thread client (MOD-Effects "Responsibility", ADR-0006, ADR-0017, ADR-0022):
// sends one job per blur or pixelate redaction to the effects worker (ids, latest wins per redaction,
// one job in flight), caches finished patches as bitmaps keyed on (box, kind, strength in pixels, the
// solids touching the read window, frame), bounds the cache, offers an instant approximation while the
// exact patch is pending or while the redaction (or a solid it depends on) moves, and resolves a
// promise once every exact patch of a document is ready (the export awaits it, ADR-0007), or rejects
// when a job fails (MOD-Effects `exactPatches`, F-012.R7). A failed key is not asked for again until
// the redaction's key changes (a `failed` reply never stalls later jobs). A worker error is fatal at any
// time (ADR-0025.1): every job of that image then fails at once.
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
  isHexColour,
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
  /**
   * Where the `source` part is drawn, in image pixels, clipped to `box` (default: `box`). A pixelate
   * approximation sets it to whole p × p blocks from B's top-left corner (RULE-10), which may reach
   * past O; the clip keeps the drawing inside O.
   */
  readonly at?: Box;
}

/** What `exactPatches` resolves with: the exact patches by redaction id, held until `release()`. */
export interface HeldPatches {
  readonly patches: ReadonlyMap<string, Patch>;
  release(): void;
}

/** The worker as the client uses it (a real `Worker`, or a fake in the tests). */
export interface WorkerLike {
  postMessage(message: ToWorker, transfer?: Transferable[]): void;
  addEventListener(type: 'message', fn: (e: MessageEvent<FromWorker>) => void): void;
  /** An uncaught worker error, or a reply that cannot be read: the worker is dead (ADR-0025.1). */
  addEventListener(type: 'error' | 'messageerror', fn: () => void): void;
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
  /**
   * Pixelate (RULE-10): the blocks the output area falls in, aligned to B's top-left corner: `cols` ×
   * `rows` cells of `factor` pixels from (x, y). Each cell is drawn as one small-canvas pixel.
   */
  readonly grid?: { readonly x: number; readonly y: number; readonly cols: number; readonly rows: number };
}

export interface EffectsDeps {
  createWorker(): WorkerLike;
  /** RGBA pixels (unpremultiplied, sRGB) → something drawable. */
  toBitmap(pixels: ArrayBuffer, width: number, height: number): Promise<CanvasImageSource>;
  /** ADR-0006 instant approximation, or null where it cannot be drawn. */
  approximate(request: ApproxRequest): { bitmap: CanvasImageSource; width: number; height: number; at?: Box } | null;
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
  /** The current worker raised an error (ADR-0025.1): no job is sent to it again. */
  private dead = false;
  private source: SourceImage | null = null;
  private palette: Readonly<Record<Colour, readonly [number, number, number]>> | null = null;
  private shortSide = 0;
  private imageArea = 0;
  private readonly exact = new Map<string, Patch>();
  private readonly approx = new Map<string, Patch>();
  /** Latest wanted job per redaction id (latest wins), in request order. */
  private readonly pending = new Map<string, Spec>();
  private inflight: { readonly id: number; readonly key: string } | null = null;
  /** Keys whose reply arrived and is being made a bitmap (treated as in flight: no duplicate job). */
  private readonly converting = new Set<string>();
  /** Keys whose job failed: not asked for again (until the key changes); `exactPatches` rejects. */
  private readonly failed = new Set<string>();
  private nextId = 1;
  /** ADR-0017: per moving redaction, the key it last had and the idle timer for it. */
  private readonly moving = new Map<string, { key: string; timer: unknown; fired: boolean }>();
  private readonly listeners = new Set<() => void>();
  private readonly waiters = new Set<() => void>();
  /**
   * F-012 review M1: patches an export holds (collected by a pending `exactPatches`, or resolved and not
   * yet painted), with a count per export. The bounded cache never evicts them, and a held patch that is
   * replaced or cleared is closed only when its last holder releases it.
   */
  private readonly held = new Map<Patch, number>();
  private readonly doomed = new Set<Patch>();
  /** Bumped when an image is cleared: an `exactPatches` of the old image rejects (F-012 security m2). */
  private generation = 0;
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
    // ADR-0025.1: a worker error is fatal at any time, not only during a job (WebKit refused the
    // script before its first job, security M1). The job in flight and every queued one fail at once,
    // and later requests fail without being sent, so an export is told at once (F-012.R7) instead of
    // waiting out its bound; the next image gets a fresh worker (ADR-0022).
    const lost = () => {
      if (worker !== this.worker || this.dead) return;
      this.dead = true;
      if (this.inflight) this.failed.add(this.inflight.key);
      this.inflight = null;
      for (const spec of this.pending.values()) this.failed.add(spec.key);
      this.pending.clear();
      for (const w of [...this.waiters]) w();
    };
    worker.addEventListener('error', lost);
    worker.addEventListener('messageerror', lost);
    worker.postMessage({ v: PROTOCOL_VERSION, type: 'image', pixels, width, height }, [pixels]);
    this.worker = worker;
    for (const w of [...this.waiters]) w();
  }

  /** The image is replaced or cleared: the worker is terminated and its pixels freed (ADR-0022, NFR-04). */
  clearImage(): void {
    if (this.worker || this.source) this.generation++;
    if (this.worker) {
      this.worker.postMessage({ v: PROTOCOL_VERSION, type: 'drop' });
      this.worker.terminate();
    }
    this.worker = null;
    this.dead = false;
    this.source = null;
    this.palette = null;
    this.shortSide = 0;
    this.imageArea = 0;
    this.inflight = null;
    this.converting.clear();
    this.failed.clear();
    this.pending.clear();
    for (const m of this.moving.values()) this.deps.clearTimer(m.timer);
    this.moving.clear();
    for (const p of this.exact.values()) this.drop(p);
    for (const p of this.approx.values()) close(p.bitmap);
    this.exact.clear();
    this.approx.clear();
    for (const w of [...this.waiters]) w(); // an export of the cleared image rejects
  }

  /** Closes a patch no longer cached, unless an export holds it (then on its last release). */
  private drop(p: Patch): void {
    if (this.held.has(p)) this.doomed.add(p);
    else close(p.bitmap);
  }

  private hold(p: Patch): void {
    this.held.set(p, (this.held.get(p) ?? 0) + 1);
  }

  private release(p: Patch): void {
    const n = (this.held.get(p) ?? 1) - 1;
    if (n > 0) return void this.held.set(p, n);
    this.held.delete(p);
    if (this.doomed.delete(p)) close(p.bitmap);
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
      // RULE-10 / RULE-21: a solid redaction in a palette colour, or a custom colour (F-019).
      rgb: isHexColour(s.style.color) ? hexRgb(s.style.color) : palette[s.style.color],
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
    // Ids no longer in the document (a cancelled or committed draft): their timers and jobs go.
    const present = new Set(doc.annotations.map((a) => a.id));
    for (const id of [...this.moving.keys()]) if (!present.has(id)) this.settle(id);
    for (const id of [...this.pending.keys()]) if (!present.has(id)) this.pending.delete(id);
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
    // The timer only marks the entry still and asks for a repaint; that paint's `patchesFor` sends the
    // job if the redaction still exists with this key.
    entry.timer = this.deps.setTimer(() => {
      entry.fired = true;
      for (const l of this.listeners) l();
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
    const o = spec.output;
    // RULE-10: pixelate blocks are p × p from B's top-left corner, whatever the box size.
    const grid =
      spec.kind === 'pixelate'
        ? (() => {
            const c0 = Math.floor((o.x - spec.box.x) / b);
            const r0 = Math.floor((o.y - spec.box.y) / b);
            const cols = Math.ceil((o.x + o.width - spec.box.x) / b) - c0;
            const rows = Math.ceil((o.y + o.height - spec.box.y) / b) - r0;
            return { x: spec.box.x + c0 * b, y: spec.box.y + r0 * b, cols, rows };
          })()
        : undefined;
    const made = this.deps.approximate({
      source: this.source,
      output: o,
      factor: b,
      smooth,
      solids: spec.solids,
      ...(grid ? { grid } : {}),
    });
    if (!made) return null;
    const patch: Patch = {
      box: o,
      bitmap: made.bitmap,
      exact: false,
      smooth,
      source: { width: made.width, height: made.height },
      ...(made.at ? { at: made.at } : {}),
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
    if (this.converting.has(spec.key) || this.failed.has(spec.key)) return;
    if (this.pending.get(id)?.key === spec.key) return;
    if (this.dead) return void this.failed.add(spec.key); // ADR-0025.1: never sent to a dead worker
    this.pending.delete(id);
    this.pending.set(id, spec);
    this.pump();
  }

  /** One job in flight; the next pending one (latest per redaction) is sent when it returns. */
  private pump(): void {
    if (this.inflight || !this.worker || this.dead) return;
    for (const [id, spec] of this.pending) {
      this.pending.delete(id);
      if (this.exact.has(spec.key) || this.converting.has(spec.key) || this.failed.has(spec.key)) continue;
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
    if (msg.type === 'failed') this.fail(job.key);
    else {
      const { box } = msg;
      this.converting.add(job.key);
      const converted = (bitmap: CanvasImageSource) => {
        if (worker !== this.worker) return close(bitmap);
        this.converting.delete(job.key);
        const patch: Patch = { box, bitmap, exact: true, smooth: !job.key.startsWith('pixelate') };
        const old = this.exact.get(job.key);
        if (old) this.drop(old);
        this.exact.delete(job.key);
        this.exact.set(job.key, patch);
        const area = () => [...this.exact.values()].reduce((sum, p) => sum + p.box.width * p.box.height, 0);
        // The least recently used patch goes first; patches an export holds are skipped (F-012 review
        // M1: evicting them made the export ask again forever), so the budget may be exceeded during an
        // export (NFR-04 allows the export's memory).
        while (this.exact.size > 1 && (this.exact.size > CACHE_LIMIT || area() > CACHE_IMAGE_AREAS * this.imageArea)) {
          const victim = [...this.exact.entries()].find(([key, p]) => key !== job.key && !this.held.has(p));
          if (!victim) break;
          this.exact.delete(victim[0]);
          close(victim[1].bitmap);
        }
        const a = this.approx.get(job.key);
        if (a) {
          this.approx.delete(job.key);
          close(a.bitmap);
        }
        this.version++;
        for (const l of this.listeners) l();
        for (const w of [...this.waiters]) w();
      };
      this.deps.toBitmap(msg.pixels, box.width, box.height).then(converted, () => {
        if (worker !== this.worker) return;
        this.converting.delete(job.key);
        this.fail(job.key);
      });
    }
    this.pump();
  }

  /** A job failed: its key is not asked for again, waiters on it reject, the next job is sent. */
  private fail(key: string): void {
    this.failed.add(key);
    for (const w of [...this.waiters]) w();
    this.pump();
  }

  /**
   * MOD-Effects `exactPatches`: resolves with the exact patch of every blur and pixelate redaction of
   * `doc` once all are ready (the export waits for them, ADR-0006, ADR-0007); rejects when one of
   * their jobs failed, when the image is cleared or replaced, or when `signal` aborts (F-012.R7 reports
   * it; the export never falls back to approximations). The patches are held from the moment each is
   * collected until `release()` (on rejection, at once), so the bounded cache cannot evict or close what
   * the export waits for or paints (F-012 review M1, security m1). Call `release()` after painting.
   */
  exactPatches(doc: EffectsDoc, signal?: AbortSignal): Promise<HeldPatches> {
    const generation = this.generation;
    const mine = new Set<Patch>();
    let released = false;
    const release = () => {
      if (released) return;
      released = true;
      for (const p of mine) this.release(p);
      mine.clear();
    };
    return new Promise((resolve, reject) => {
      const stop = (why: string) => {
        this.waiters.delete(waiter);
        signal?.removeEventListener('abort', aborted);
        release();
        reject(new Error(why));
        return true;
      };
      const aborted = () => void stop('effects: the export stopped waiting');
      const check = () => {
        if (generation !== this.generation) return stop('effects: the image was replaced');
        // Until the image's pixels arrive, no effect can be computed: wait for them.
        if (!this.palette && doc.annotations.some(isEffectRedaction)) return false;
        const out = new Map<string, Patch>();
        let missing = false;
        for (const a of doc.annotations) {
          const spec = this.spec(a, doc);
          if (!spec) continue;
          const p = this.exact.get(spec.key);
          if (p) {
            out.set(a.id, p);
            if (!mine.has(p)) {
              mine.add(p);
              this.hold(p);
            }
          } else if (this.failed.has(spec.key)) return stop('effects: a blur or pixelate job failed');
          else {
            missing = true;
            this.request(a.id, spec);
            if (this.failed.has(spec.key)) return stop('effects: the effects worker failed'); // ADR-0025.1
          }
        }
        if (missing) return false;
        this.waiters.delete(waiter);
        signal?.removeEventListener('abort', aborted);
        // Only the patches painted stay held (a key's older patch, replaced meanwhile, is let go).
        for (const p of [...mine])
          if (![...out.values()].includes(p)) {
            mine.delete(p);
            this.release(p);
          }
        resolve({ patches: out, release });
        return true;
      };
      const waiter = () => void check();
      if (signal?.aborted) return void stop('effects: the export stopped waiting');
      signal?.addEventListener('abort', aborted);
      this.waiters.add(waiter);
      check();
    });
  }
}
