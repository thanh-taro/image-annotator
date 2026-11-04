// MOD-Effects — the effects module worker (ADR-0006, ADR-0017): holds the image's sRGB RGBA pixels
// (transferred once after load, ADR-0005) and computes one exact patch per job with ./algorithms.ts.
// Imports MOD-Core only (through ./algorithms); no DOM. Window buffers are reused between jobs (ADR-0017)
// and freed on `drop`; the client terminates the worker when the image is replaced (ADR-0022).
// Implements: F-007.R3/R5, RULE-10, INV-02, ADR-0006, ADR-0017.
import { blur, pixelate, Scratch, type Pixels } from './algorithms';
import type { FromWorker, ToWorker } from './protocol';
import { PROTOCOL_VERSION } from './protocol';

interface WorkerScope {
  addEventListener(type: 'message', fn: (e: MessageEvent<ToWorker>) => void): void;
  postMessage(message: FromWorker, transfer?: Transferable[]): void;
}
const scope = self as unknown as WorkerScope;

let image: Pixels | null = null;
const scratch = new Scratch();

scope.addEventListener('message', (e) => {
  const msg = e.data;
  if (msg.v !== PROTOCOL_VERSION) return;
  if (msg.type === 'image') {
    image = { data: new Uint8ClampedArray(msg.pixels), width: msg.width, height: msg.height };
    return;
  }
  if (msg.type === 'drop') {
    image = null;
    scratch.drop();
    return;
  }
  // MOD-Effects `exactPatches` rejects on failure: any error (e.g. a window too large to allocate under
  // memory pressure) is answered `failed`, so the client never waits on a job that will not come back.
  try {
    const effect = msg.kind === 'blur' ? blur : pixelate;
    const out = image ? effect(image, msg.frame, msg.box, msg.size, msg.solids, scratch) : null;
    if (!out) {
      scope.postMessage({ v: PROTOCOL_VERSION, type: 'failed', id: msg.id });
      return;
    }
    const { x, y, width, height } = out;
    const pixels = out.data.buffer as ArrayBuffer;
    scope.postMessage({ v: PROTOCOL_VERSION, type: 'patch', id: msg.id, box: { x, y, width, height }, pixels }, [
      pixels,
    ]);
  } catch {
    scratch.drop();
    scope.postMessage({ v: PROTOCOL_VERSION, type: 'failed', id: msg.id });
  }
});
