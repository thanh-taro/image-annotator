// MOD-Core — the frame maths (RULE-13) and the padding sizes it allows (RULE-14, D-020). Pure: the crop
// tool (MOD-Canvas), the keyboard and the position and size fields (MOD-App) and MOD-Document's
// `setFrame` all go through these, so every way of changing the frame keeps the same limits.
// Implements: RULE-13 (whole image pixels, at least 16 px per side or the image's size, inside the image),
// RULE-14 (sizes offered only within RULE-02; the step-down a frame change causes, F-011.R6),
// F-010.R1 (edges, corners, move, a new frame), F-010.R6 (1 / 10 px moves and right/bottom resizes, fields).
import { canvasRect } from './canvas';
import { FRAME_MIN } from './constants';
import { checkLimits } from './limits';
import type { Box, Frame, Padding, PaddingSize, Point } from './types';

/** The image's size, as the frame maths reads it. */
export interface ImageSize {
  readonly width: number;
  readonly height: number;
}

/** RULE-14: the padding sizes, smallest first. */
export const PADDING_SIZES: readonly PaddingSize[] = ['none', 'S', 'M', 'L'];

/** RULE-13: the smallest frame side along an image side of `extent` pixels. */
const minSide = (extent: number): number => Math.min(FRAME_MIN, extent);

const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v));

/** The whole image as a frame (RULE-13 default; COPY-action.crop_reset, F-010.R3). */
export const wholeFrame = (image: ImageSize): Frame => ({ x: 0, y: 0, width: image.width, height: image.height });

/** The frame covers the whole image (nothing is cropped). */
export const isWholeFrame = (frame: Frame, image: ImageSize): boolean =>
  frame.x === 0 && frame.y === 0 && frame.width === image.width && frame.height === image.height;

export const sameFrame = (a: Frame, b: Frame): boolean =>
  a.x === b.x && a.y === b.y && a.width === b.width && a.height === b.height;

/**
 * RULE-13: a frame in whole image pixels, at least 16 px per side (or the image's size), inside the image.
 * The size is kept where it fits and the position moves in to keep it inside.
 */
export function clampFrame(frame: Frame, image: ImageSize): Frame {
  const axis = (pos: number, size: number, extent: number) => {
    const s = clamp(Math.round(size), minSide(extent), extent);
    return [clamp(Math.round(pos), 0, extent - s), s] as const;
  };
  const [x, width] = axis(frame.x, frame.width, image.width);
  const [y, height] = axis(frame.y, frame.height, image.height);
  return { x, y, width, height };
}

/** What a crop-tool press grabs (F-010.R1): an edge or corner, the inside (move), or outside (a new frame). */
export type FrameGrip = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w' | 'move' | 'new';

/**
 * F-010.R1: what a press at `p` (image pixels) grabs on `frame`. An edge is grabbed anywhere along it
 * within `half` image pixels (corners first, where two edges meet); inside the frame moves it; outside
 * draws a new one. D-033: while the frame covers the whole `image`, a press inside it draws a new frame
 * too (moving it could do nothing).
 */
export function frameGripAt(frame: Frame, p: Point, half: number, image?: ImageSize): FrameGrip {
  const left = frame.x;
  const right = frame.x + frame.width;
  const top = frame.y;
  const bottom = frame.y + frame.height;
  const withinX = p.x >= left - half && p.x <= right + half;
  const withinY = p.y >= top - half && p.y <= bottom + half;
  // On a small frame the nearer edge wins, so both edges stay reachable.
  const nearX = (p.x - left) ** 2 <= (p.x - right) ** 2;
  const nearY = (p.y - top) ** 2 <= (p.y - bottom) ** 2;
  const onW = withinY && Math.abs(p.x - left) <= half && (nearX || Math.abs(p.x - right) > half);
  const onE = withinY && Math.abs(p.x - right) <= half && !onW;
  const onN = withinX && Math.abs(p.y - top) <= half && (nearY || Math.abs(p.y - bottom) > half);
  const onS = withinX && Math.abs(p.y - bottom) <= half && !onN;
  const v = onN ? 'n' : onS ? 's' : '';
  const h = onW ? 'w' : onE ? 'e' : '';
  if (v || h) return `${v}${h}` as FrameGrip;
  const inside = p.x > left && p.x < right && p.y > top && p.y < bottom;
  return inside && !(image && isWholeFrame(frame, image)) ? 'move' : 'new';
}

/**
 * F-010.R1 / RULE-13: the frame after dragging `grip` by (dx, dy) image pixels from `start`. An edge or
 * corner moves within the image and stops 16 px (or the image's size) from the opposite edge, which stays
 * put; a move keeps the size and stays inside the image; `new` is the box from `from` to `from + (dx, dy)`,
 * clamped into the image and grown to the minimum in the direction dragged. Whole image pixels.
 */
export function dragFrame(
  start: Frame,
  grip: FrameGrip,
  dx: number,
  dy: number,
  image: ImageSize,
  from: Point = { x: start.x, y: start.y },
): Frame {
  const ddx = Math.round(dx);
  const ddy = Math.round(dy);
  if (grip === 'move') {
    return {
      x: clamp(start.x + ddx, 0, image.width - start.width),
      y: clamp(start.y + ddy, 0, image.height - start.height),
      width: start.width,
      height: start.height,
    };
  }
  if (grip === 'new') {
    const axis = (a: number, d: number, extent: number) => {
      const p0 = clamp(Math.round(a), 0, extent);
      const p1 = clamp(Math.round(a + d), 0, extent);
      const lo = Math.min(p0, p1);
      const size = Math.abs(p1 - p0);
      const min = minSide(extent);
      if (size >= min) return [lo, size] as const;
      // Grown to the minimum in the direction dragged, inside the image.
      const at = p1 >= p0 ? Math.min(p0, extent - min) : Math.max(0, p0 - min);
      return [at, min] as const;
    };
    const [x, width] = axis(from.x, dx, image.width);
    const [y, height] = axis(from.y, dy, image.height);
    return { x, y, width, height };
  }
  let left = start.x;
  let right = start.x + start.width;
  let top = start.y;
  let bottom = start.y + start.height;
  const minW = minSide(image.width);
  const minH = minSide(image.height);
  if (grip.includes('w')) left = clamp(left + ddx, 0, right - minW);
  if (grip.includes('e')) right = clamp(right + ddx, left + minW, image.width);
  if (grip.includes('n')) top = clamp(top + ddy, 0, bottom - minH);
  if (grip.includes('s')) bottom = clamp(bottom + ddy, top + minH, image.height);
  return { x: left, y: top, width: right - left, height: bottom - top };
}

/** RULE-19 with the crop tool: arrows move the frame by (dx, dy) image pixels, kept inside the image. */
export function movedFrame(frame: Frame, dx: number, dy: number, image: ImageSize): Frame {
  return dragFrame(frame, 'move', dx, dy, image);
}

/**
 * RULE-19 with the crop tool: Alt+arrows resize the frame by its right or bottom edge (dx wider, dy
 * taller; negative narrower or shorter), within the image and never below the RULE-13 minimum.
 */
export function resizedFrame(frame: Frame, dx: number, dy: number, image: ImageSize): Frame {
  return dragFrame(frame, 'se', dx, dy, image);
}

/** The frame's position and size fields (CMP-StylePanel "crop", COPY-geometry.x/y/width/height). */
export type FrameField = 'x' | 'y' | 'width' | 'height';

/**
 * F-010.R6 / D-008: the frame with one field set to `value` whole image pixels, within the same limits as
 * dragging (RULE-13): X and Y move it and keep its size; width and height resize it from its left or top
 * edge, which stays put.
 */
export function withFrameField(frame: Frame, field: FrameField, value: number, image: ImageSize): Frame {
  const v = Math.round(value);
  if (field === 'x') return movedFrame(frame, v - frame.x, 0, image);
  if (field === 'y') return movedFrame(frame, 0, v - frame.y, image);
  if (field === 'width') return resizedFrame(frame, v - frame.width, 0, image);
  return resizedFrame(frame, 0, v - frame.height, image);
}

/** RULE-14: the padding sizes whose canvas (the frame plus that padding) stays within RULE-02's limits. */
export function availablePaddings(frame: Frame): readonly PaddingSize[] {
  return PADDING_SIZES.filter((size) => {
    const c: Box = canvasRect(frame, size);
    return checkLimits(c.width, c.height).ok;
  });
}

/**
 * F-011.R6 / RULE-14: after a frame change, the padding keeps its size if the canvas still fits; else it
 * becomes the largest size that fits (none always fits: the frame is inside the image, itself within the
 * limits). The background is kept. Returns `padding` itself when nothing changes.
 */
export function stepDownPadding(frame: Frame, padding: Padding): Padding {
  const fits = availablePaddings(frame);
  if (fits.includes(padding.size)) return padding;
  const below = PADDING_SIZES.slice(0, PADDING_SIZES.indexOf(padding.size)).filter((s) => fits.includes(s));
  return { ...padding, size: below[below.length - 1] ?? 'none' };
}
