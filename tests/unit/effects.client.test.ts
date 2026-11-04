// MOD-Effects client scheduling with a fake worker, timers and bitmaps (ADR-0006 "Computation",
// ADR-0017 "Scheduling", ADR-0022 "Fresh effects worker"): approximations while pending or moving, no
// exact job while moving, one after 100 ms still, latest wins with one job in flight, cache keys that
// include the solids an effect reads, and the export's wait for every exact patch.
import { describe, expect, it } from 'vitest';
import { DEFAULT_STYLES, type Annotation, type Box, type Style } from '../../src/core';
import {
  EffectsClient,
  IDLE_MS,
  type ApproxRequest,
  type EffectsDeps,
  type FromWorker,
  type ToWorker,
  type WorkerLike,
} from '../../src/effects';
import { PALETTE_HEX } from '../../src/render';

function harness() {
  const workers: {
    sent: ToWorker[];
    terminated: boolean;
    reply: (m: FromWorker) => void;
    crash: () => void;
  }[] = [];
  const approxRequests: ApproxRequest[] = [];
  let bitmapFails = false;
  let bitmapGate: Promise<void> = Promise.resolve();
  const timers: { fn: () => void; at: number; done: boolean }[] = [];
  let now = 0;
  const deps: EffectsDeps = {
    createWorker() {
      const listeners: Record<string, (e: MessageEvent<FromWorker>) => void> = {};
      const w = {
        sent: [] as ToWorker[],
        terminated: false,
        reply: (m: FromWorker) => listeners.message?.({ data: m } as MessageEvent<FromWorker>),
        crash: () => listeners.error?.({} as MessageEvent<FromWorker>),
      };
      workers.push(w);
      const worker: WorkerLike = {
        postMessage: (m: ToWorker) => void w.sent.push(m),
        addEventListener: (t: string, fn: (e: MessageEvent<FromWorker>) => void) => void (listeners[t] = fn),
        terminate: () => void (w.terminated = true),
      };
      return worker;
    },
    toBitmap: async (_p, width, height) => {
      await bitmapGate;
      if (bitmapFails) throw new Error('decode');
      return { width, height, exact: true } as unknown as CanvasImageSource;
    },
    approximate: (r) => {
      approxRequests.push(r);
      return {
        bitmap: { approx: true } as unknown as CanvasImageSource,
        width: r.output.width / r.factor,
        height: r.output.height / r.factor,
      };
    },
    setTimer(fn, ms) {
      const t = { fn, at: now + ms, done: false };
      timers.push(t);
      return t;
    },
    clearTimer(h) {
      (h as { done: boolean }).done = true;
    },
  };
  const advance = (ms: number) => {
    now += ms;
    for (const t of timers)
      if (!t.done && t.at <= now) {
        t.done = true;
        t.fn();
      }
  };
  const client = new EffectsClient(deps);
  const load = () =>
    client.setImage(new ArrayBuffer(1000 * 800 * 4), 1000, 800, { width: 1000, height: 800 } as never, PALETTE_HEX);
  const jobs = (i = workers.length - 1) =>
    workers[i]!.sent.filter((m) => m.type === 'job') as Extract<ToWorker, { type: 'job' }>[];
  const settle = async () => {
    for (let i = 0; i < 6; i++) await Promise.resolve();
  };
  const answer = async (i = workers.length - 1) => {
    const job = jobs(i).at(-1)!;
    workers[i]!.reply({ v: 1, type: 'patch', id: job.id, box: job.box, pixels: new ArrayBuffer(4) });
    await settle();
  };
  const fail = async (i = workers.length - 1) => {
    workers[i]!.reply({ v: 1, type: 'failed', id: jobs(i).at(-1)!.id });
    await settle();
  };
  const gate = () => {
    let open = () => {};
    bitmapGate = new Promise<void>((r) => (open = r));
    return open;
  };
  const failBitmaps = () => (bitmapFails = true);
  return { client, workers, load, jobs, answer, fail, advance, settle, gate, failBitmaps, approxRequests };
}

const frame: Box = { x: 0, y: 0, width: 1000, height: 800 };
const red = (id: string, box: Box, style: Partial<Style> = {}): Annotation => ({
  id,
  kind: 'redaction',
  style: { ...DEFAULT_STYLES.redact, ...style },
  box,
});
const blurAt = (x: number) => red('b', { x, y: 100, width: 200, height: 40 }, { redactionKind: 'blur' });
const doc = (...annotations: Annotation[]) => ({ annotations, frame });

describe('MOD-Effects client', () => {
  it('ADR-0006 F-007.R3 a pending patch shows the approximation; the exact one replaces it when it arrives', async () => {
    const h = harness();
    h.load();
    let repaints = 0;
    h.client.onPatch(() => repaints++);
    const first = h.client.patchesFor(doc(blurAt(100))).get('b');
    expect(first).toMatchObject({ exact: false, smooth: true, box: { x: 100, y: 100, width: 200, height: 40 } });
    // RULE-10 blur M on s = 800 is r = 16 → b = 8: scaled down by 8.
    expect(first?.source).toEqual({ width: 25, height: 5 }); // the fake keeps w / b
    expect(h.jobs()).toHaveLength(1);
    expect(h.jobs()[0]).toMatchObject({ kind: 'blur', size: 16, box: { x: 100, y: 100, width: 200, height: 40 } });
    await h.answer();
    expect(repaints).toBe(1);
    expect(h.client.patchesFor(doc(blurAt(100))).get('b')).toMatchObject({ exact: true });
    expect(h.jobs()).toHaveLength(1); // cached: no second job
  });

  it('ADR-0017 no exact job while the redaction moves; one after 100 ms without movement', () => {
    const h = harness();
    h.load();
    const moving = new Set(['b']);
    for (let x = 100; x < 160; x += 10) {
      h.client.patchesFor(doc(blurAt(x)), moving);
      h.advance(16);
    }
    expect(h.jobs()).toHaveLength(0);
    let repaints = 0;
    h.client.onPatch(() => repaints++);
    h.advance(IDLE_MS);
    expect(repaints).toBe(1); // the timer asks for a repaint; that paint sends the job
    h.client.patchesFor(doc(blurAt(150)), moving);
    expect(h.jobs()).toHaveLength(1);
    expect(h.jobs()[0]?.box.x).toBe(150);
  });

  it('ADR-0017 F-007.R3 on release (moving → still) exactly one job is sent for the final position', () => {
    const h = harness();
    h.load();
    h.client.patchesFor(doc(blurAt(100)), new Set(['b']));
    h.client.patchesFor(doc(blurAt(130)), new Set(['b']));
    h.client.patchesFor(doc(blurAt(130)));
    h.client.patchesFor(doc(blurAt(130)));
    h.advance(IDLE_MS * 3);
    h.client.patchesFor(doc(blurAt(130)));
    expect(h.jobs()).toHaveLength(1);
    expect(h.jobs()[0]?.box.x).toBe(130);
  });

  it('ADR-0017 a draft that is cancelled or committed under a new id leaves no timer or job behind', () => {
    const h = harness();
    h.load();
    const draft = red('draft', { x: 100, y: 100, width: 200, height: 40 }, { redactionKind: 'blur' });
    h.client.patchesFor(doc(draft), new Set(['draft']));
    h.client.patchesFor(doc()); // Esc: the draft is gone
    h.advance(IDLE_MS * 2);
    h.client.patchesFor(doc());
    expect(h.jobs()).toHaveLength(0);
  });

  it('ADR-0017 a solid being drawn or moved holds back the jobs of the effects that read it', () => {
    const h = harness();
    h.load();
    const solid = red('s', { x: 120, y: 110, width: 20, height: 10 });
    h.client.patchesFor(doc(blurAt(100), solid), new Set(['s']));
    expect(h.jobs()).toHaveLength(0);
    h.advance(IDLE_MS);
    h.client.patchesFor(doc(blurAt(100), solid), new Set(['s'])); // the repaint the timer asks for
    expect(h.jobs()).toHaveLength(1);
    // The solid is part of the job (RULE-10: effects read pixels with every solid applied).
    expect(h.jobs()[0]?.solids).toEqual([{ box: { x: 120, y: 110, width: 20, height: 10 }, rgb: [0, 0, 0] }]);
  });

  it('ADR-0017 latest wins: one job in flight, the newest wanted position queued, stale ones skipped', async () => {
    const h = harness();
    h.load();
    h.client.patchesFor(doc(blurAt(100)));
    h.client.patchesFor(doc(blurAt(110)));
    h.client.patchesFor(doc(blurAt(120)));
    expect(h.jobs()).toHaveLength(1);
    await h.answer();
    expect(h.jobs()).toHaveLength(2);
    expect(h.jobs()[1]?.box.x).toBe(120);
  });

  it('INV-02 RULE-10 the cache key includes the solids an effect reads: a new solid nearby means a new job', async () => {
    const h = harness();
    h.load();
    h.client.patchesFor(doc(blurAt(100)));
    await h.answer();
    const solid = red('s', { x: 90, y: 100, width: 5, height: 5 });
    expect(h.client.patchesFor(doc(blurAt(100), solid)).get('b')?.exact).toBe(false);
    expect(h.jobs()).toHaveLength(2);
  });

  it('ADR-0022 NFR-04 a new image terminates the worker and starts a fresh one; old replies are ignored', async () => {
    const h = harness();
    h.load();
    h.client.patchesFor(doc(blurAt(100)));
    h.load();
    expect(h.workers).toHaveLength(2);
    expect(h.workers[0]?.terminated).toBe(true);
    expect(h.workers[0]?.sent.at(-1)).toMatchObject({ type: 'drop' });
    await h.answer(0); // a late reply of the terminated worker
    expect(h.client.version).toBe(0);
    h.client.clearImage();
    expect(h.workers[1]?.terminated).toBe(true);
    // Security m6: the cleared client keeps no size or palette: no patch, no job until the next image.
    expect(h.client.patchesFor(doc(blurAt(100))).size).toBe(0);
  });

  it('MOD-Effects F-012.R7 a failed job makes exactPatches reject, is not asked for again, and later jobs still run', async () => {
    const h = harness();
    h.load();
    const other = red('p', { x: 500, y: 100, width: 64, height: 64 }, { redactionKind: 'pixelate' });
    const result = h.client.exactPatches(doc(blurAt(100), other));
    await h.fail(); // the blur fails in the worker
    await expect(result).rejects.toThrow();
    expect(h.jobs()).toHaveLength(2); // the pixelate job was sent next
    await h.answer();
    h.client.patchesFor(doc(blurAt(100), other));
    h.client.patchesFor(doc(blurAt(100), other));
    expect(h.jobs()).toHaveLength(2); // the failed key is not re-requested
    h.client.patchesFor(doc(blurAt(110))); // a new key is
    expect(h.jobs()).toHaveLength(3);
  });

  it('MOD-Effects a worker error fails the job in flight and does not stall the queue', async () => {
    const h = harness();
    h.load();
    const result = h.client.exactPatches(doc(blurAt(100)));
    h.client.patchesFor(
      doc(blurAt(100), red('c', { x: 600, y: 300, width: 50, height: 50 }, { redactionKind: 'blur' })),
    );
    h.workers[0]!.crash();
    await h.settle();
    await expect(result).rejects.toThrow();
    expect(h.jobs()).toHaveLength(2);
  });

  it('MOD-Effects a patch whose bitmap cannot be made fails its job (exactPatches rejects)', async () => {
    const h = harness();
    h.load();
    h.failBitmaps();
    const result = h.client.exactPatches(doc(blurAt(100)));
    await h.answer();
    await expect(result).rejects.toThrow();
  });

  it('ADR-0017 NFR-04 a paint between a reply and its bitmap sends no duplicate job', async () => {
    const h = harness();
    h.load();
    h.client.patchesFor(doc(blurAt(100)));
    const open = h.gate();
    const job = h.jobs()[0]!;
    h.workers[0]!.reply({ v: 1, type: 'patch', id: job.id, box: job.box, pixels: new ArrayBuffer(4) });
    h.client.patchesFor(doc(blurAt(100))); // a drag frame while the bitmap is being made
    expect(h.jobs()).toHaveLength(1);
    open();
    await h.settle();
    expect(h.client.patchesFor(doc(blurAt(100))).get('b')?.exact).toBe(true);
    expect(h.jobs()).toHaveLength(1);
  });

  it('F-007.AC4 RULE-10 the pixelate approximation uses p × p blocks from the box corner at any box size', () => {
    const h = harness();
    h.load();
    // Pixelate M on 1000 × 800: p = 16. A 150 × 70 box is not a multiple of 16.
    const pix = (box: Box) => red('p', box, { redactionKind: 'pixelate' });
    const patch = h.client.patchesFor(doc(pix({ x: 101, y: 50, width: 150, height: 70 }))).get('p');
    expect(h.approxRequests.at(-1)).toMatchObject({ factor: 16, grid: { x: 101, y: 50, cols: 10, rows: 5 } });
    expect(patch?.box).toEqual({ x: 101, y: 50, width: 150, height: 70 });
    // A box starting left of and above the frame: blocks still count from its corner (-20, -7).
    h.client.patchesFor(doc(pix({ x: -20, y: -7, width: 150, height: 70 })));
    expect(h.approxRequests.at(-1)).toMatchObject({ grid: { x: -4, y: -7, cols: 9, rows: 5 } });
  });

  it('ADR-0006 ADR-0007 the export waits for every exact patch', async () => {
    const h = harness();
    h.load();
    const two = doc(blurAt(100), red('p', { x: 500, y: 100, width: 64, height: 64 }, { redactionKind: 'pixelate' }));
    let done: ReadonlyMap<string, unknown> | null = null;
    void h.client.exactPatches(two).then((m) => (done = m));
    await h.answer();
    expect(done).toBeNull();
    await h.answer();
    await Promise.resolve();
    expect(done).not.toBeNull();
    expect([...done!.keys()].sort()).toEqual(['b', 'p']);
  });

  it('NFR-04 the exact cache keeps at most two image areas of patch pixels, dropping the oldest', async () => {
    const h = harness();
    h.load();
    const big = (x: number) => red('w', { x, y: 0, width: 900, height: 800 }, { redactionKind: 'blur' });
    for (const x of [0, 10, 20]) {
      h.client.patchesFor(doc(big(x)));
      await h.answer();
    }
    // 3 × 0.9 image areas > 2: the first is gone (asked again), the latest two are kept.
    expect(h.client.patchesFor(doc(big(20))).get('w')?.exact).toBe(true);
    expect(h.client.patchesFor(doc(big(10))).get('w')?.exact).toBe(true);
    expect(h.client.patchesFor(doc(big(0))).get('w')?.exact).toBe(false);
  });

  it('RULE-10 a box wholly outside the frame has no patch and sends no job', () => {
    const h = harness();
    h.load();
    expect(
      h.client.patchesFor(doc(red('o', { x: 1100, y: 10, width: 50, height: 50 }, { redactionKind: 'blur' }))).size,
    ).toBe(0);
    expect(h.jobs()).toHaveLength(0);
  });
});
