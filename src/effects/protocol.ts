// MOD-Effects — the typed, versioned worker protocol (MOD-Effects public surface, ADR-0006, ADR-0017).
import type { Box, Frame, RedactionKind } from '../core';

export const PROTOCOL_VERSION = 1;

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
      readonly kind: Exclude<RedactionKind, 'solid'>;
      readonly size: number;
      readonly frame: Frame;
      readonly solids: readonly { readonly box: Box; readonly rgba: number }[];
    }
  | { readonly v: typeof PROTOCOL_VERSION; readonly type: 'drop' };

/** Worker → main thread. */
export type FromWorker =
  | { readonly v: typeof PROTOCOL_VERSION; readonly type: 'patch'; readonly id: number; readonly pixels: ArrayBuffer }
  | { readonly v: typeof PROTOCOL_VERSION; readonly type: 'failed'; readonly id: number };
