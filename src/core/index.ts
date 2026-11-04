// MOD-Core — domain types, limits, geometry, frame/padding/canvas maths, pure helpers
// (specs/40-technical/modules/MOD-Core.md). Pure, synchronous, dependency-free: usable on the main
// thread and in the effects worker; no DOM, clock or language. Results carry codes and numbers.
// Types, constants, size tables, the format sniff (F-001), the canvas/fit maths and the view maths
// (F-002), the tools and shape geometry (F-003), step numbering (F-006), text (F-005), redaction geometry (F-007), the export's file name and PNG chunk whitelist (F-012) and the edit geometry (F-008: move, resize, Alt+arrows, marquee, position and size fields) are real; the rest throws until its feature is built.
import type { Frame, ImageInfo, Padding, PaddingSize } from './types';

export * from './types';
export * from './limits';
export * from './sizes';
export * from './constants';
export * from './format';
export * from './canvas';
export * from './header';
export * from './view';
export * from './tools';
export * from './shapes';
export * from './steps';
export * from './text';
export * from './redaction';
export * from './export';

const notImplemented = (name: string): never => {
  throw new Error(`not implemented: MOD-Core ${name}`);
};

/** RULE-14: the padding sizes that keep the canvas within RULE-02. */
export function availablePaddings(_frame: Frame): readonly PaddingSize[] {
  return notImplemented('availablePaddings');
}

/** RULE-13: a frame clamped inside the image, at least 16 px per side (or the image's size). */
export function clampFrame(_frame: Frame, _image: Pick<ImageInfo, 'width' | 'height'>): Frame {
  return notImplemented('clampFrame');
}

/** F-011.R6: the largest padding size that still fits after a frame change. */
export function stepDownPadding(_frame: Frame, _padding: Padding): Padding {
  return notImplemented('stepDownPadding');
}
