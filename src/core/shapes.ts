// MOD-Core — shape geometry, RULE-05 clicks, RULE-06 constraints, analytic hit-testing, handles, and
// move/resize, for the box kinds (rectangle, ellipse, redaction) and the line kinds (line, arrow).
// Promoted from the SP-engine spike (ADR-0004 §3, ADR-0016) and adapted to the domain types; stroke,
// highlight, text and step geometry join with F-004…F-006. Pure; coordinates are image pixels.
// Implements: F-003.R1/R2/R4/R5, RULE-05 (default size), RULE-06 (constrain), ADR-0004 §3.
// Spec gap (reported with F-003's review): MOD-Core's public surface lists `hitTest(annotation, point,
// tolerance)`, `boundsOf(annotation)`, `constrain(drag, kind)` and `defaultAnnotationAt(point, kind,
// sizes)`. Here stroke widths need the image's shorter side (RULE-04), so they take `shortSide`, and
// `constrain` takes the drag's two points. Hit-testing and handles are used by F-008.
import { DEFAULT_SIZE_FACTOR } from './constants';
import { styleSizes } from './sizes';
import type { Annotation, AnnotationKind, Box, Point, Style } from './types';

export type BoxAnnotation = Extract<Annotation, { readonly box: Box }>;
export type LineAnnotation = Extract<Annotation, { readonly tail: Point }>;

export const isBoxKind = (kind: AnnotationKind): kind is BoxAnnotation['kind'] =>
  kind === 'rectangle' || kind === 'ellipse' || kind === 'redaction';
export const isLineKind = (kind: AnnotationKind): kind is LineAnnotation['kind'] => kind === 'line' || kind === 'arrow';
export const isBoxAnnotation = (a: Annotation): a is BoxAnnotation => isBoxKind(a.kind);
export const isLineAnnotation = (a: Annotation): a is LineAnnotation => isLineKind(a.kind);

/** F-003.R2: an arrowhead is 4 × the stroke size long and 3 × the stroke size wide. */
export const ARROW_HEAD_LENGTH = 4;
export const ARROW_HEAD_WIDTH = 3;

/** CMP-Canvas: clicks hit the visible mark within this many screen pixels (image pixels grow when zoomed out). */
export const HIT_TOLERANCE_PX = 6;

/** RULE-04: the stroke size in pixels of a style on an image whose shorter side is `shortSide`. */
export const strokePixels = (style: Style, shortSide: number): number => styleSizes(shortSide, style.strokeSize).stroke;

/** RULE-05: the default size of a click-placed shape (20 % of the shorter side, rounded). */
export const defaultSize = (shortSide: number): number => Math.round(DEFAULT_SIZE_FACTOR * shortSide);

/** A box with a non-negative width and height. */
export function normalizeBox(b: Box): Box {
  return {
    x: Math.min(b.x, b.x + b.width),
    y: Math.min(b.y, b.y + b.height),
    width: Math.abs(b.width),
    height: Math.abs(b.height),
  };
}

/** The box spanned by two points (F-003.R1). */
export const boxBetween = (a: Point, b: Point): Box =>
  normalizeBox({ x: a.x, y: a.y, width: b.x - a.x, height: b.y - a.y });

const sign = (v: number) => (v < 0 ? -1 : 1);

/** Eight directions at 45° steps from +x, clockwise on screen, as unit vectors (exact on the axes). */
const DIRECTIONS: readonly Point[] = [
  { x: 1, y: 0 },
  { x: Math.SQRT1_2, y: Math.SQRT1_2 },
  { x: 0, y: 1 },
  { x: -Math.SQRT1_2, y: Math.SQRT1_2 },
  { x: -1, y: 0 },
  { x: -Math.SQRT1_2, y: -Math.SQRT1_2 },
  { x: 0, y: -1 },
  { x: Math.SQRT1_2, y: -Math.SQRT1_2 },
];

/**
 * RULE-06 constraint of a drag from `from` to `to` (Shift held): boxes stay square and ellipses circles
 * (side = the longer side of the drag, in the drag's direction); lines and arrows snap to 45° steps
 * (keeping the drag's length); highlights stay horizontal or vertical.
 */
export function constrain(from: Point, to: Point, kind: AnnotationKind): Point {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  if (isBoxKind(kind)) {
    const side = Math.max(Math.abs(dx), Math.abs(dy));
    return { x: from.x + sign(dx) * side, y: from.y + sign(dy) * side };
  }
  if (isLineKind(kind)) {
    const length = Math.hypot(dx, dy);
    if (length === 0) return to;
    const step = Math.round(Math.atan2(dy, dx) / (Math.PI / 4));
    const d = DIRECTIONS[((step % 8) + 8) % 8] as Point;
    return { x: from.x + d.x * length, y: from.y + d.y * length };
  }
  if (kind === 'highlight') return Math.abs(dx) >= Math.abs(dy) ? { x: to.x, y: from.y } : { x: from.x, y: to.y };
  return to;
}

/** F-003.R1/R2/R4: the shape a drag from `from` to `to` draws; `shift` applies RULE-06. */
export function shapeFromDrag<K extends BoxAnnotation['kind'] | LineAnnotation['kind']>(
  kind: K,
  id: string,
  style: Style,
  from: Point,
  to: Point,
  shift: boolean,
): Annotation {
  const end = shift ? constrain(from, to, kind) : to;
  if (isLineKind(kind)) return { id, kind, style, tail: { ...from }, head: { ...end } };
  return { id, kind: kind as BoxAnnotation['kind'], style, box: boxBetween(from, end) };
}

/**
 * RULE-05: a click with a shape (or redaction) tool places it at 20 % of `s`, centred on the click;
 * lines and arrows point right.
 */
export function defaultAnnotationAt(
  point: Point,
  kind: BoxAnnotation['kind'] | LineAnnotation['kind'],
  shortSide: number,
  id: string,
  style: Style,
): Annotation {
  const size = defaultSize(shortSide);
  const half = size / 2;
  if (isLineKind(kind)) {
    return { id, kind, style, tail: { x: point.x - half, y: point.y }, head: { x: point.x + half, y: point.y } };
  }
  return {
    id,
    kind: kind as BoxAnnotation['kind'],
    style,
    box: { x: point.x - half, y: point.y - half, width: size, height: size },
  };
}

/** F-003.R2: the arrowhead triangle — the tip at the head, then the two base corners. */
export function arrowHead(tail: Point, head: Point, stroke: number): readonly [Point, Point, Point] {
  const length = ARROW_HEAD_LENGTH * stroke;
  const half = (ARROW_HEAD_WIDTH * stroke) / 2;
  const dx = head.x - tail.x;
  const dy = head.y - tail.y;
  const l = Math.hypot(dx, dy) || 1;
  const ux = dx / l;
  const uy = dy / l;
  const bx = head.x - ux * length;
  const by = head.y - uy * length;
  return [
    { x: head.x, y: head.y },
    { x: bx - uy * half, y: by + ux * half },
    { x: bx + uy * half, y: by - ux * half },
  ];
}

/** The geometry box of a shape, without its stroke (handles sit on it). */
export function shapeBox(a: Annotation): Box {
  if (isBoxAnnotation(a)) return normalizeBox(a.box);
  if (isLineAnnotation(a)) return boxBetween(a.tail, a.head);
  throw new Error(`shapeBox: ${a.kind} arrives with its feature`);
}

/** The box covering a shape's visible mark, including its stroke and arrowhead. */
export function boundsOf(a: Annotation, shortSide: number): Box {
  const stroke = strokePixels(a.style, shortSide);
  const hw = stroke / 2;
  if (isBoxAnnotation(a)) {
    const b = normalizeBox(a.box);
    return { x: b.x - hw, y: b.y - hw, width: b.width + stroke, height: b.height + stroke };
  }
  if (isLineAnnotation(a)) {
    const pts = a.kind === 'arrow' ? [a.tail, ...arrowHead(a.tail, a.head, stroke)] : [a.tail, a.head];
    const xs = pts.map((p) => p.x);
    const ys = pts.map((p) => p.y);
    const x = Math.min(...xs) - hw;
    const y = Math.min(...ys) - hw;
    return { x, y, width: Math.max(...xs) + hw - x, height: Math.max(...ys) + hw - y };
  }
  throw new Error(`boundsOf: ${a.kind} arrives with its feature`);
}

// ---------- analytic hit-testing (ADR-0004 §3) ----------

/** Distance from `p` to the segment a–b. */
export function distanceToSegment(p: Point, a: Point, b: Point): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const l2 = dx * dx + dy * dy;
  let t = l2 ? ((p.x - a.x) * dx + (p.y - a.y) * dy) / l2 : 0;
  t = t < 0 ? 0 : t > 1 ? 1 : t;
  return Math.hypot(p.x - a.x - t * dx, p.y - a.y - t * dy);
}

/** Distance from (px, py) to the outline of an axis-aligned ellipse with radii a, b centred at the origin. */
export function distanceToEllipse(px: number, py: number, a: number, b: number): number {
  const ax = Math.abs(px);
  const ay = Math.abs(py);
  if (a < 1e-9 || b < 1e-9) {
    return a < 1e-9
      ? distanceToSegment({ x: ax, y: ay }, { x: 0, y: -b }, { x: 0, y: b })
      : distanceToSegment({ x: ax, y: ay }, { x: -a, y: 0 }, { x: a, y: 0 });
  }
  // Trig-free iteration towards the nearest point on the outline (SP-engine).
  let tx = Math.SQRT1_2;
  let ty = Math.SQRT1_2;
  for (let i = 0; i < 4; i++) {
    const x = a * tx;
    const y = b * ty;
    const ex = ((a * a - b * b) * tx ** 3) / a;
    const ey = ((b * b - a * a) * ty ** 3) / b;
    const r = Math.hypot(x - ex, y - ey);
    const q = Math.hypot(ax - ex, ay - ey) || 1e-12;
    tx = Math.min(1, Math.max(0, (((ax - ex) * r) / q + ex) / a));
    ty = Math.min(1, Math.max(0, (((ay - ey) * r) / q + ey) / b));
    const l = Math.hypot(tx, ty);
    tx /= l;
    ty /= l;
  }
  return Math.hypot(ax - a * tx, ay - b * ty);
}

function distanceToBoxOutline(p: Point, b: Box): number {
  const x2 = b.x + b.width;
  const y2 = b.y + b.height;
  if (p.x >= b.x && p.x <= x2 && p.y >= b.y && p.y <= y2) return Math.min(p.x - b.x, x2 - p.x, p.y - b.y, y2 - p.y);
  return Math.hypot(Math.max(b.x - p.x, 0, p.x - x2), Math.max(b.y - p.y, 0, p.y - y2));
}

function inTriangle(p: Point, [a, b, c]: readonly [Point, Point, Point]): boolean {
  const s = (u: Point, v: Point) => (v.x - u.x) * (p.y - u.y) - (v.y - u.y) * (p.x - u.x);
  const d1 = s(a, b);
  const d2 = s(b, c);
  const d3 = s(c, a);
  return !((d1 < 0 || d2 < 0 || d3 < 0) && (d1 > 0 || d2 > 0 || d3 > 0));
}

/**
 * True when `p` hits the visible mark of `a`, within `tolerance` image pixels (CMP-Canvas: the caller
 * passes HIT_TOLERANCE_PX / zoom, so it grows when zoomed out). Filled shapes hit inside too.
 */
export function hitTest(a: Annotation, p: Point, tolerance: number, shortSide: number): boolean {
  const bb = boundsOf(a, shortSide);
  if (p.x < bb.x - tolerance || p.y < bb.y - tolerance) return false;
  if (p.x > bb.x + bb.width + tolerance || p.y > bb.y + bb.height + tolerance) return false;
  const stroke = strokePixels(a.style, shortSide);
  const reach = tolerance + stroke / 2;
  if (isBoxAnnotation(a)) {
    const b = normalizeBox(a.box);
    const filled = a.kind === 'redaction' || a.style.fill !== 'none';
    if (a.kind === 'ellipse') {
      const rx = b.width / 2;
      const ry = b.height / 2;
      const cx = p.x - b.x - rx;
      const cy = p.y - b.y - ry;
      if (filled && rx > 0 && ry > 0 && (cx * cx) / (rx * rx) + (cy * cy) / (ry * ry) <= 1) return true;
      return distanceToEllipse(cx, cy, rx, ry) <= reach;
    }
    if (filled && p.x >= b.x && p.x <= b.x + b.width && p.y >= b.y && p.y <= b.y + b.height) return true;
    return distanceToBoxOutline(p, b) <= reach;
  }
  if (isLineAnnotation(a)) {
    if (a.kind === 'arrow') {
      const head = arrowHead(a.tail, a.head, stroke);
      if (inTriangle(p, head)) return true;
      const [t, l, r] = head;
      if (Math.min(distanceToSegment(p, t, l), distanceToSegment(p, l, r), distanceToSegment(p, r, t)) <= tolerance)
        return true;
    }
    return distanceToSegment(p, a.tail, a.head) <= reach;
  }
  return false;
}

/** The topmost annotation hit at `p` (painter's order reversed), or undefined. */
export function hitTopmost(
  list: readonly Annotation[],
  p: Point,
  tolerance: number,
  shortSide: number,
): Annotation | undefined {
  for (let i = list.length - 1; i >= 0; i--) {
    const a = list[i] as Annotation;
    if (hitTest(a, p, tolerance, shortSide)) return a;
  }
  return undefined;
}

// ---------- handles (F-008.R3; drawn on a single selection, CMP-Canvas "selected") ----------

/** Corner and edge handles of boxes; `tail` and `head` handles of lines and arrows. */
export type Handle = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w' | 'tail' | 'head';

export function handlesOf(a: Annotation): readonly (readonly [Handle, Point])[] {
  if (isLineAnnotation(a))
    return [
      ['tail', a.tail],
      ['head', a.head],
    ];
  const b = shapeBox(a);
  const mx = b.x + b.width / 2;
  const my = b.y + b.height / 2;
  const r = b.x + b.width;
  const d = b.y + b.height;
  return [
    ['nw', { x: b.x, y: b.y }],
    ['n', { x: mx, y: b.y }],
    ['ne', { x: r, y: b.y }],
    ['e', { x: r, y: my }],
    ['se', { x: r, y: d }],
    ['s', { x: mx, y: d }],
    ['sw', { x: b.x, y: d }],
    ['w', { x: b.x, y: my }],
  ];
}

/** The handle within `half` image pixels of `p` (half the handle's hit area divided by the zoom). */
export function hitHandle(a: Annotation, p: Point, half: number): Handle | undefined {
  for (const [h, q] of handlesOf(a)) if (Math.abs(p.x - q.x) <= half && Math.abs(p.y - q.y) <= half) return h;
  return undefined;
}

// ---------- move and resize (pure; F-008 drives them) ----------

export function moved(a: Annotation, dx: number, dy: number): Annotation {
  const at = (p: Point): Point => ({ x: p.x + dx, y: p.y + dy });
  if (isBoxAnnotation(a)) return { ...a, box: { ...a.box, x: a.box.x + dx, y: a.box.y + dy } };
  if (isLineAnnotation(a)) return { ...a, tail: at(a.tail), head: at(a.head) };
  throw new Error(`moved: ${a.kind} arrives with its feature`);
}

/** `a` (as at the start of the drag) with handle `h` dragged by (dx, dy); `keepAspect` is RULE-06 Shift. */
export function resized(a: Annotation, h: Handle, dx: number, dy: number, keepAspect = false): Annotation {
  if (isLineAnnotation(a)) {
    const move = (p: Point): Point => ({ x: p.x + dx, y: p.y + dy });
    return h === 'tail' ? { ...a, tail: move(a.tail) } : { ...a, head: move(a.head) };
  }
  if (!isBoxAnnotation(a)) throw new Error(`resized: ${a.kind} arrives with its feature`);
  const b = normalizeBox(a.box);
  let x1 = b.x;
  let y1 = b.y;
  let x2 = b.x + b.width;
  let y2 = b.y + b.height;
  if (h.includes('w')) x1 += dx;
  if (h.includes('e')) x2 += dx;
  if (h.includes('n')) y1 += dy;
  if (h.includes('s')) y2 += dy;
  if (keepAspect && b.width > 0 && b.height > 0 && h.length === 2) {
    const s = Math.max(Math.abs(x2 - x1) / b.width, Math.abs(y2 - y1) / b.height);
    const w = b.width * s * sign(x2 - x1);
    const ht = b.height * s * sign(y2 - y1);
    if (h.includes('w')) x1 = x2 - w;
    else x2 = x1 + w;
    if (h.includes('n')) y1 = y2 - ht;
    else y2 = y1 + ht;
  }
  return { ...a, box: normalizeBox({ x: x1, y: y1, width: x2 - x1, height: y2 - y1 }) };
}
