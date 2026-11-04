// MOD-Effects — the typed, versioned worker protocol (MOD-Effects public surface, ADR-0006, ADR-0017).
import type { Box, Frame } from '../core';

export const PROTOCOL_VERSION = 1;

/** A solid redaction as the worker reads it: its box and sRGB colour (ADR-0006 source S). */
export interface WireSolid {
  readonly box: Box;
  readonly rgb: readonly [number, number, number];
}

/** Main thread → worker. */
export type ToWorker =
  | {
      readonly v: typeof PROTOCOL_VERSION;
      readonly type: 'image';
      readonly pixels: ArrayBuffer;
      readonly width: number;
      readonly height: number;
    }
  | {
      readonly v: typeof PROTOCOL_VERSION;
      readonly type: 'job';
      readonly id: number;
      readonly box: Box;
      readonly kind: 'blur' | 'pixelate';
      /** RULE-10 radius or block, in pixels. */
      readonly size: number;
      readonly frame: Frame;
      readonly solids: readonly WireSolid[];
    }
  | { readonly v: typeof PROTOCOL_VERSION; readonly type: 'drop' };

/** Worker → main thread. `box` is the output area O = B ∩ F the pixels cover (ADR-0006). */
export type FromWorker =
  | {
      readonly v: typeof PROTOCOL_VERSION;
      readonly type: 'patch';
      readonly id: number;
      readonly box: Box;
      readonly pixels: ArrayBuffer;
    }
  | { readonly v: typeof PROTOCOL_VERSION; readonly type: 'failed'; readonly id: number };
