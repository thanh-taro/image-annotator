// MOD-Effects — the effects module worker (ADR-0006, ADR-0017): reference blur and pixelate over the
// image's sRGB pixels. Imports MOD-Core only; no DOM. Phase 3.3 scaffold: every job fails until F-007.
import type { FromWorker, ToWorker } from './protocol';
import { PROTOCOL_VERSION } from './protocol';

interface WorkerScope {
  addEventListener(type: 'message', fn: (e: MessageEvent<ToWorker>) => void): void;
  postMessage(message: FromWorker): void;
}
const scope = self as unknown as WorkerScope;

scope.addEventListener('message', (e) => {
  const msg = e.data;
  if (msg.v !== PROTOCOL_VERSION) return;
  if (msg.type === 'job') scope.postMessage({ v: PROTOCOL_VERSION, type: 'failed', id: msg.id });
});
