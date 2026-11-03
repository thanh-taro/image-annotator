// MOD-Core — the canvas (frame plus padding) and the fit level (D-020).
// Implements: RULE-14 (padding and canvas), RULE-12 (fit: the whole content, never above 100 %).
import { FIT_MAX, PADDING_FACTOR } from './constants';
import type { Box, Frame, PaddingSize } from './types';

/** RULE-14: padding in pixels on each side, from the frame's longer side, rounded (halves up). */
export function paddingPixels(frame: Frame, size: PaddingSize): number {
  return Math.round(PADDING_FACTOR[size] * Math.max(frame.width, frame.height));
}

/** RULE-14: the canvas rectangle (frame plus padding), in image pixels. */
export function canvasRect(frame: Frame, size: PaddingSize): Box {
  const p = paddingPixels(frame, size);
  return { x: frame.x - p, y: frame.y - p, width: frame.width + 2 * p, height: frame.height + 2 * p };
}

/** RULE-12: the zoom (percent) at which the whole content fits the view area, at most 100 %. */
export function fitZoom(content: Box, viewport: { width: number; height: number }): number {
  if (content.width <= 0 || content.height <= 0 || viewport.width <= 0 || viewport.height <= 0) return 0;
  return Math.min(FIT_MAX, (100 * viewport.width) / content.width, (100 * viewport.height) / content.height);
}
