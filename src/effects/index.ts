// MOD-Effects — the main-thread client: reference blur and pixelate in a worker, patch cache, live
// approximation (specs/40-technical/modules/MOD-Effects.md, ADR-0006, ADR-0017, ADR-0022).
// Imports MOD-Core only. Phase 3.3 scaffold: the surface is typed; it throws until F-007 is built.
// The worker itself is ./worker.ts (protocol in ./protocol.ts); the slow reference implementation
// for tests lands in ./reference.ts with F-007.
import type { Annotation, Box } from '../core';

export type { FromWorker, ToWorker } from './protocol';
export { PROTOCOL_VERSION } from './protocol';

/** The document parts the client reads (structurally MOD-Document's Doc). */
export interface EffectsDoc {
  readonly annotations: readonly Annotation[];
  readonly frame: Box;
}

export interface Patch {
  readonly box: Box;
  readonly bitmap: ImageBitmap;
  readonly exact: boolean;
}

const notImplemented = (name: string): never => {
  throw new Error(`not implemented: MOD-Effects ${name}`);
};

export function setImage(_pixels: ArrayBuffer, _width: number, _height: number): void {
  notImplemented('setImage');
}
export function clearImage(): void {
  notImplemented('clearImage');
}
export function patchesFor(_doc: EffectsDoc): ReadonlyMap<string, Patch> {
  return notImplemented('patchesFor');
}
export function exactPatches(_doc: EffectsDoc): Promise<ReadonlyMap<string, Patch>> {
  return notImplemented('exactPatches');
}
