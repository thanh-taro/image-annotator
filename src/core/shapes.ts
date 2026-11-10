// MOD-Core — shape geometry, RULE-05 clicks, RULE-06 constraints, analytic hit-testing, handles, and
// move/resize, for the box kinds (rectangle, ellipse, redaction) and the line kinds (line, arrow).
// Promoted from the SP-engine spike (ADR-0004 §3, ADR-0016) and adapted to the domain types; step
// badges (F-006) come from ./steps and text boxes (F-005) from ./text. Pen strokes and highlights (F-004) are lists of
// points drawn as midpoint quadratics (ADR-0004 §4), stored as the pointer sampled them (no smoothing
// or simplification: the specs ask for neither). Pure; coordinates are image pixels.
// Implements: F-003.R1/R2/R4/R5, F-004.R1/R3/R4, RULE-04 (highlight width), RULE-05 (default size, dots),
// RULE-06 (constrain), ADR-0004 §3, F-006.R1 (step badges hit as filled), F-008.R3 (steps and text have
// no handles), RULE-08 (a text's box fits its content). MOD-Core: `hitTest`, `hitTopmost` and `boundsOf`
// take a required TextMeasure (text widths are measured by the caller in the tool's face, ADR-0020).
// Spec gap (reported with F-003's review): MOD-Core's public surface lists `hitTest(annotation, point,
// tolerance)`, `boundsOf(annotation)`, `constrain(drag, kind)` and `defaultAnnotationAt(point, kind,
// sizes)`. Here stroke widths need the image's shorter side (RULE-04), so they take `shortSide`, and
// `constrain` takes the drag's two points. Hit-testing and handles are used by F-008.
import { DEFAULT_SIZE_FACTOR } from './constants';
import { styleSizes } from './sizes';
import { distanceToStep, isStepAnnotation, stepBox } from './steps';
import { hitsText, isTextAnnotation, textLayout, type TextMeasure } from './text';
import type { Annotation, AnnotationKind, Box, Point, Style } from './types';

export type BoxAnnotation = Extract<Annotation, { readonly box: Box }>;
export type LineAnnotation = Extract<Annotation, { readonly tail: Point }>;

export const isBoxKind = (kind: AnnotationKind): kind is BoxAnnotation['kind'] =>
  kind === 'rectangle' || kind === 'ellipse' || kind === 'redaction';
export const isLineKind = (kind: AnnotationKind): kind is LineAnnotation['kind'] => kind === 'line' || kind === 'arrow';
export type PathAnnotation = Extract<Annotation, { readonly points: readonly Point[] }>;
export const isPathKind = (kind: AnnotationKind): kind is PathAnnotation['kind'] =>
  kind === 'stroke' || kind === 'highlight';
export const isBoxAnnotation = (a: Annotation): a is BoxAnnotation => isBoxKind(a.kind);
export const isLineAnnotation = (a: Annotation): a is LineAnnotation => isLineKind(a.kind);
export const isPathAnnotation = (a: Annotation): a is PathAnnotation => isPathKind(a.kind);

/** F-003.R2: an arrowhead is 4 × the stroke size long and 3 × the stroke size wide. */
export const ARROW_HEAD_LENGTH = 4;
export const ARROW_HEAD_WIDTH = 3;

/** CMP-Canvas: clicks hit the visible mark within this many screen pixels (image pixels grow when zoomed out). */
export const HIT_TOLERANCE_PX = 6;

/** RULE-04: the stroke size in pixels of a style on an image whose shorter side is `shortSide`. */
export const strokePixels = (style: Style, shortSide: number): number => styleSizes(shortSide, style.strokeSize).stroke;

/**
 * RULE-04: the width of an annotation's mark in pixels — the stroke size, or for a highlight 3 × the
 * stroke size of its size.
 */
export function markWidth(a: Annotation, shortSide: number): number {
  const sizes = styleSizes(shortSide, a.style.strokeSize);
  return a.kind === 'highlight' ? sizes.highlight : sizes.stroke;
}

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
 * F-004.R1/R2/R4: the path a pen or highlight drag draws through the sampled `points` (image pixels, in
 * order, the press point first). `shift` applies RULE-06 to highlights only: a straight horizontal or
 * vertical run from the press point to the pointer (whichever the drag is closer to).
 */
export function pathFromDrag(
  kind: PathAnnotation['kind'],
  id: string,
  style: Style,
  points: readonly Point[],
  shift: boolean,
): Annotation {
  const first = points[0];
  const last = points[points.length - 1];
  if (shift && kind === 'highlight' && first && last) {
    const end = constrain(first, last, kind);
    // RULE-09: a run that ends back at its press point is a highlight dot, never an empty run.
    const run = end.x === first.x && end.y === first.y ? [{ ...first }] : [{ ...first }, end];
    return { id, kind, style, points: run };
  }
  return { id, kind, style, points: points.map((p) => ({ ...p })) };
}

/**
 * RULE-05: a click with a shape (or redaction) tool places it at 20 % of `s`, centred on the click;
 * lines and arrows point right; a click with the pen or highlight tool places a dot (one point).
 */
export function defaultAnnotationAt(
  point: Point,
  kind: BoxAnnotation['kind'] | LineAnnotation['kind'] | PathAnnotation['kind'],
  shortSide: number,
  id: string,
  style: Style,
): Annotation {
  if (isPathKind(kind)) return { id, kind, style, points: [{ ...point }] };
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

/**
 * ADR-0004 §4 midpoint quadratics: each inner sample is a control point and the curve passes through
 * the midpoints between samples, from the first point to the last. Consecutive pieces share their end
 * and its tangent (the control points and the midpoint between them are collinear), so the curve has
 * no angle at any sample (F-004.AC1). Two points make one straight piece; one point a zero-length dot.
 */
export interface QuadPiece {
  readonly from: Point;
  readonly control: Point;
  readonly to: Point;
}

export function strokePieces(points: readonly Point[]): readonly QuadPiece[] {
  const n = points.length;
  const p = (i: number) => points[i] as Point;
  const mid = (a: Point, b: Point): Point => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
  if (n === 0) return [];
  if (n === 1) return [{ from: p(0), control: p(0), to: p(0) }];
  if (n === 2) return [{ from: p(0), control: mid(p(0), p(1)), to: p(1) }];
  const out: QuadPiece[] = [];
  let from = p(0);
  for (let i = 1; i < n - 1; i++) {
    const to = i === n - 2 ? p(n - 1) : mid(p(i), p(i + 1));
    out.push({ from, control: p(i), to });
    from = to;
  }
  return out;
}

/** The box of a list of points (one pass, so long strokes cost no spread of their points). */
function pointsBox(points: readonly Point[]): Box {
  let x1 = Infinity;
  let y1 = Infinity;
  let x2 = -Infinity;
  let y2 = -Infinity;
  for (const p of points) {
    if (p.x < x1) x1 = p.x;
    if (p.x > x2) x2 = p.x;
    if (p.y < y1) y1 = p.y;
    if (p.y > y2) y2 = p.y;
  }
  return points.length ? { x: x1, y: y1, width: x2 - x1, height: y2 - y1 } : { x: 0, y: 0, width: 0, height: 0 };
}

/**
 * The geometry box of a shape, without its stroke (handles sit on it; for paths, the points' box). A
 * step's box is its badge, whose size needs the image's shorter side: use `boundsOf` (RULE-04).
 */
export function shapeBox(a: Annotation): Box {
  if (isBoxAnnotation(a)) return normalizeBox(a.box);
  if (isLineAnnotation(a)) return boxBetween(a.tail, a.head);
  if (isPathAnnotation(a)) return pointsBox(a.points);
  throw new Error(`shapeBox: ${a.kind} arrives with its feature`);
}

/**
 * The box covering a shape's visible mark, including its stroke and arrowhead. A text's is its box
 * (RULE-08, ADR-0020), measured with `measure`.
 */
export function boundsOf(a: Annotation, shortSide: number, measure: TextMeasure): Box {
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
  if (isPathAnnotation(a)) {
    // The curve stays inside its points' hull. Pens have round ends (half the width around the path);
    // a highlight's square ends reach half the width × √2 at their corners.
    const reach = a.kind === 'highlight' ? (markWidth(a, shortSide) / 2) * Math.SQRT2 : hw;
    const b = pointsBox(a.points);
    return { x: b.x - reach, y: b.y - reach, width: b.width + 2 * reach, height: b.height + 2 * reach };
  }
  if (isStepAnnotation(a)) return stepBox(a, shortSide);
  if (isTextAnnotation(a)) return textLayout(a, shortSide, measure).box;
  throw new Error(`boundsOf: ${(a as Annotation).kind} arrives with its feature`);
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

/** The chord error allowed when a quadratic piece is flattened for hit-testing (image pixels). */
const FLATTEN_ERROR = 0.01;

/** Distance from `p` to a quadratic piece, flattened so the chords stay within FLATTEN_ERROR of it. */
export function distanceToQuad(p: Point, { from: a, control: c, to: b }: QuadPiece): number {
  // A quadratic split into n chords deviates from them by at most |a − 2c + b| / (4 n²).
  const bend = Math.hypot(a.x - 2 * c.x + b.x, a.y - 2 * c.y + b.y);
  const n = Math.max(1, Math.ceil(Math.sqrt(bend / (4 * FLATTEN_ERROR))));
  let best = Infinity;
  let last = a;
  for (let i = 1; i <= n; i++) {
    const t = i / n;
    const u = 1 - t;
    const q = { x: u * u * a.x + 2 * u * t * c.x + t * t * b.x, y: u * u * a.y + 2 * u * t * c.y + t * t * b.y };
    const d = distanceToSegment(p, last, q);
    if (d < best) best = d;
    last = q;
  }
  return best;
}

/**
 * RULE-09: whether `p` is within the square end of a highlight at either end point — a square of side
 * 2 × `half` centred on the end and turned with the path's tangent there (axis-aligned for a dot).
 */
function hitsSquareEnds(p: Point, points: readonly Point[], pieces: readonly QuadPiece[], half: number): boolean {
  const inSquare = (c: Point, dir: Point) => {
    const l = Math.hypot(dir.x, dir.y);
    const ux = l ? dir.x / l : 1;
    const uy = l ? dir.y / l : 0;
    const dx = p.x - c.x;
    const dy = p.y - c.y;
    return Math.abs(dx * ux + dy * uy) <= half && Math.abs(-dx * uy + dy * ux) <= half;
  };
  const first = pieces[0];
  const last = pieces[pieces.length - 1];
  if (!first || !last) return false;
  if (points.length === 1) return inSquare(first.from, { x: 1, y: 0 });
  // The tangent at each end: towards the control point, or along the piece when they coincide.
  const away = (a: Point, b: Point, c: Point) => (a.x !== b.x || a.y !== b.y ? b : c);
  const start = away(first.from, first.control, first.to);
  const end = away(last.to, last.control, last.from);
  return (
    inSquare(first.from, { x: start.x - first.from.x, y: start.y - first.from.y }) ||
    inSquare(last.to, { x: last.to.x - end.x, y: last.to.y - end.y })
  );
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
export function hitTest(a: Annotation, p: Point, tolerance: number, shortSide: number, measure: TextMeasure): boolean {
  // F-005: a text is hit anywhere on its box.
  if (isTextAnnotation(a)) return hitsText(a, p, tolerance, shortSide, measure);
  const bb = boundsOf(a, shortSide, measure);
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
  if (isPathAnnotation(a)) {
    // F-004: the visible mark is the curve widened by half the mark's width (a highlight is 3 × wider).
    const half = tolerance + markWidth(a, shortSide) / 2;
    const pieces = strokePieces(a.points);
    for (const piece of pieces) if (distanceToQuad(p, piece) <= half) return true;
    // RULE-09: a highlight's ends and dot are square, so their corners count too.
    if (a.kind === 'highlight') return hitsSquareEnds(p, a.points, pieces, half);
    return false;
  }
  // F-006: a step's badge is filled, so a click anywhere on it hits.
  if (isStepAnnotation(a)) return distanceToStep(a, p, shortSide) <= tolerance;
  return false;
}

/** The topmost annotation hit at `p` (painter's order reversed), or undefined. */
export function hitTopmost(
  list: readonly Annotation[],
  p: Point,
  tolerance: number,
  shortSide: number,
  measure: TextMeasure,
): Annotation | undefined {
  for (let i = list.length - 1; i >= 0; i--) {
    const a = list[i] as Annotation;
    if (hitTest(a, p, tolerance, shortSide, measure)) return a;
  }
  return undefined;
}

// ---------- handles (F-008.R3; drawn on a single selection, CMP-Canvas "selected") ----------

/** Corner and edge handles of boxes; `tail` and `head` handles of lines and arrows. */
export type Handle = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w' | 'tail' | 'head';

/**
 * F-008.R3 (D-044): half the width of a stroke's or highlight's drawn mark, by which its handle box
 * grows past its points' box on each side; 0 for every other kind (their handles sit on their geometry).
 */
const markHalf = (a: Annotation, shortSide: number): number => (isPathAnnotation(a) ? markWidth(a, shortSide) / 2 : 0);

/**
 * F-008.R3 (D-044): the box a single selection's handles sit on. A box annotation's box; a stroke's or
 * highlight's drawn mark, its points' box grown by half its line width on each side, so the handles
 * stay at the mark's edge and not inside its body. (Lines and arrows use their end points.)
 */
export function handleBox(a: Annotation, shortSide: number): Box {
  const b = shapeBox(a);
  const hw = markHalf(a, shortSide);
  return hw ? { x: b.x - hw, y: b.y - hw, width: b.width + 2 * hw, height: b.height + 2 * hw } : b;
}

/**
 * F-008.R3: a box's eight handles on its box; a line's two end points; a stroke's or highlight's eight
 * on the box of its drawn mark (`handleBox`, D-044). Text and steps have none (their size is S/M/L).
 * F-008 edge case: a stroke or highlight with no height (or width), such as a Shift highlight, cannot be
 * scaled across it; it shows only the handles along its length (`e`, `w`, or `n`, `s`), at the ends of
 * the drawn mark, so no two handles stack, and a dot shows none.
 */
// Implements: F-008.R3 (D-044), F-008.AC18, F-008 edge case (zero extent)
export function handlesOf(a: Annotation, shortSide: number): readonly (readonly [Handle, Point])[] {
  if (isStepAnnotation(a) || isTextAnnotation(a)) return [];
  if (isLineAnnotation(a))
    return [
      ['tail', a.tail],
      ['head', a.head],
    ];
  // Which handles show follows the points' box (the axes the path has); where they sit, the drawn mark's.
  const points = shapeBox(a);
  const b = handleBox(a, shortSide);
  const mx = b.x + b.width / 2;
  const my = b.y + b.height / 2;
  const r = b.x + b.width;
  const d = b.y + b.height;
  const all: readonly (readonly [Handle, Point])[] = [
    ['nw', { x: b.x, y: b.y }],
    ['n', { x: mx, y: b.y }],
    ['ne', { x: r, y: b.y }],
    ['e', { x: r, y: my }],
    ['se', { x: r, y: d }],
    ['s', { x: mx, y: d }],
    ['sw', { x: b.x, y: d }],
    ['w', { x: b.x, y: my }],
  ];
  if (!isPathAnnotation(a) || (points.width > 0 && points.height > 0)) return all;
  if (points.width > 0) return all.filter(([h]) => h === 'e' || h === 'w');
  if (points.height > 0) return all.filter(([h]) => h === 'n' || h === 's');
  return [];
}

/** The handle within `half` image pixels of `p` (half the handle's hit area divided by the zoom). */
export function hitHandle(a: Annotation, p: Point, half: number, shortSide: number): Handle | undefined {
  for (const [h, q] of handlesOf(a, shortSide))
    if (Math.abs(p.x - q.x) <= half && Math.abs(p.y - q.y) <= half) return h;
  return undefined;
}

// ---------- move and resize (pure; F-008 drives them) ----------

/** F-008.R2: `a` moved by (dx, dy) image pixels (a stroke or highlight: every point). */
export function moved(a: Annotation, dx: number, dy: number): Annotation {
  const at = (p: Point): Point => ({ x: p.x + dx, y: p.y + dy });
  if (isBoxAnnotation(a)) return { ...a, box: { ...a.box, x: a.box.x + dx, y: a.box.y + dy } };
  if (isLineAnnotation(a)) return { ...a, tail: at(a.tail), head: at(a.head) };
  if (isPathAnnotation(a)) return { ...a, points: a.points.map(at) };
  if (isStepAnnotation(a)) return { ...a, centre: at(a.centre) };
  return { ...a, anchor: at(a.anchor) };
}

/**
 * A path's points mapped from their box `b` onto the box from (x1, y1) to (x2, y2) (F-008.R3 scale). An
 * axis on which `b` has no extent is kept as it is (a straight highlight cannot gain a height).
 */
function scalePoints(a: PathAnnotation, b: Box, x1: number, y1: number, x2: number, y2: number): PathAnnotation {
  const sx = b.width > 0 ? (x2 - x1) / b.width : 1;
  const sy = b.height > 0 ? (y2 - y1) / b.height : 1;
  const ox = b.width > 0 ? x1 : b.x;
  const oy = b.height > 0 ? y1 : b.y;
  return { ...a, points: a.points.map((p) => ({ x: ox + (p.x - b.x) * sx, y: oy + (p.y - b.y) * sy })) };
}

/**
 * F-008.R3: `a` (as at the start of the drag) with handle `h` dragged by (dx, dy): a box is resized, a
 * line's end point moves, a stroke or highlight is scaled with its box. Text and steps have no handles
 * and are returned as is. A stroke's or highlight's handles sit on its drawn mark's box (D-044); the
 * dragged mark box is mapped back onto its points' box (shrunk by half the line width on each side), so
 * the line width stays and the scale applies to the points: while it does not flip, its points' edge
 * moves by the drag, and once the dragged mark edge passes the opposite one, the points flip with it. The box never gets smaller than MIN_EDIT_SIZE on an axis it has (the same
 * limit as the fields and Alt+arrows, CMP-StylePanel; F-008 review m1); dragging a handle past the
 * opposite edge flips it.
 * `keepAspect` is RULE-06 Shift: a corner handle keeps the box's aspect ratio; an edge handle scales the
 * other axis by the same factor about its centre; a line's moved end snaps to 45° steps about the other
 * end (F-008 review m2).
 */
export function resized(
  a: Annotation,
  h: Handle,
  dx: number,
  dy: number,
  shortSide: number,
  keepAspect = false,
): Annotation {
  if (isLineAnnotation(a)) {
    const end = h === 'tail' ? a.tail : h === 'head' ? a.head : null;
    if (!end) return a;
    const fixed = h === 'tail' ? a.head : a.tail;
    const free = { x: end.x + dx, y: end.y + dy };
    const to = keepAspect ? constrain(fixed, free, a.kind) : free;
    return h === 'tail' ? { ...a, tail: to } : { ...a, head: to };
  }
  if (!isBoxAnnotation(a) && !isPathAnnotation(a)) return a;
  const b = shapeBox(a);
  let x1 = b.x;
  let y1 = b.y;
  let x2 = b.x + b.width;
  let y2 = b.y + b.height;
  if (h.includes('w')) x1 += dx;
  if (h.includes('e')) x2 += dx;
  if (h.includes('n')) y1 += dy;
  if (h.includes('s')) y2 += dy;
  // D-044: a stroke's or highlight's mark box is 2 × half its width wider than its points' box.
  const gap = 2 * markHalf(a, shortSide);
  [x1, x2] = flipPast(b.x, b.x + b.width, x1, x2, h.includes('w'), gap);
  [y1, y2] = flipPast(b.y, b.y + b.height, y1, y2, h.includes('n'), gap);
  if (keepAspect && b.width > 0 && b.height > 0) {
    if (h.length === 2) {
      const k = Math.max(Math.abs(x2 - x1) / b.width, Math.abs(y2 - y1) / b.height);
      const w = b.width * k * sign(x2 - x1);
      const ht = b.height * k * sign(y2 - y1);
      if (h.includes('w')) x1 = x2 - w;
      else x2 = x1 + w;
      if (h.includes('n')) y1 = y2 - ht;
      else y2 = y1 + ht;
    } else if (h === 'e' || h === 'w') {
      const half = (b.height * Math.abs(x2 - x1)) / b.width / 2;
      const my = b.y + b.height / 2;
      y1 = my - half;
      y2 = my + half;
    } else {
      const half = (b.width * Math.abs(y2 - y1)) / b.height / 2;
      const mx = b.x + b.width / 2;
      x1 = mx - half;
      x2 = mx + half;
    }
  }
  // m1: never below MIN_EDIT_SIZE on an axis the box has; the dragged edge stops short of the fixed one.
  const isPath = isPathAnnotation(a);
  [x1, x2] = atLeast(x1, x2, h.includes('w'), !isPath || b.width > 0);
  [y1, y2] = atLeast(y1, y2, h.includes('n'), !isPath || b.height > 0);
  if (isPathAnnotation(a)) return scalePoints(a, b, x1, y1, x2, y2);
  return { ...a, box: normalizeBox({ x: x1, y: y1, width: x2 - x1, height: y2 - y1 }) };
}

/**
 * D-044: the dragged points' edge, from the drag of the mark box `gap` wider (lo0–hi0 the points' span at
 * the start, lo–hi after moving one edge by the drag). Before the dragged mark edge passes the fixed mark
 * edge the points' edge stops at the fixed one (MIN_EDIT_SIZE applies after); past it, the points flip.
 */
function flipPast(lo0: number, hi0: number, lo: number, hi: number, moveLo: boolean, gap: number): [number, number] {
  if (!gap) return [lo, hi];
  if (moveLo && lo > hi0) return [lo - gap > hi0 ? lo - gap : hi0, hi];
  if (!moveLo && hi < lo0) return [lo, hi + gap < lo0 ? hi + gap : lo0];
  return [lo, hi];
}

/** The span lo–hi widened to MIN_EDIT_SIZE (keeping its direction) by moving lo or hi, if the axis exists. */
function atLeast(lo: number, hi: number, moveLo: boolean, has: boolean): [number, number] {
  if (!has || Math.abs(hi - lo) >= MIN_EDIT_SIZE) return [lo, hi];
  const dir = hi - lo < 0 ? -1 : 1;
  return moveLo ? [hi - dir * MIN_EDIT_SIZE, hi] : [lo, lo + dir * MIN_EDIT_SIZE];
}

/** RULE-19: Alt+arrow resizes never make a box smaller than 1 × 1; the size fields keep the same limit. */
export const MIN_EDIT_SIZE = 1;

/**
 * `a` with its box (a stroke's or highlight's points box) set to `width` × `height`, keeping its top-left
 * corner, never below MIN_EDIT_SIZE (RULE-19, F-008.R8). Other kinds are returned as is.
 */
function sizedTo(a: Annotation, width: number, height: number): Annotation {
  const b = shapeBox(a);
  if (isPathAnnotation(a)) {
    const w = b.width > 0 ? Math.max(MIN_EDIT_SIZE, width) : 0;
    const h = b.height > 0 ? Math.max(MIN_EDIT_SIZE, height) : 0;
    return scalePoints(a, b, b.x, b.y, b.x + w, b.y + h);
  }
  if (!isBoxAnnotation(a)) return a;
  const box = { x: b.x, y: b.y, width: Math.max(MIN_EDIT_SIZE, width), height: Math.max(MIN_EDIT_SIZE, height) };
  return { ...a, box };
}

/**
 * RULE-19 Alt+arrows on a single selection: a box annotation (and a stroke's or highlight's bounding box)
 * gets (dx, dy) wider and taller, keeping its top-left corner, never below 1 × 1; a line or arrow moves
 * its head; text and steps do nothing (the same object is returned). Implements: F-008.R3, F-008.AC10.
 */
export function altResized(a: Annotation, dx: number, dy: number): Annotation {
  if (isLineAnnotation(a)) return { ...a, head: { x: a.head.x + dx, y: a.head.y + dy } };
  if (!isBoxAnnotation(a) && !isPathAnnotation(a)) return a;
  const b = shapeBox(a);
  return sizedTo(a, b.width + dx, b.height + dy);
}

/** True when the segment p–q meets the box `m` (Liang–Barsky clipping). */
function segmentMeetsBox(p: Point, q: Point, m: Box): boolean {
  let t0 = 0;
  let t1 = 1;
  const dx = q.x - p.x;
  const dy = q.y - p.y;
  const sides: readonly (readonly [number, number])[] = [
    [-dx, p.x - m.x],
    [dx, m.x + m.width - p.x],
    [-dy, p.y - m.y],
    [dy, m.y + m.height - p.y],
  ];
  for (const [d, r] of sides) {
    if (d === 0) {
      if (r < 0) return false;
    } else {
      const t = r / d;
      if (d < 0) t0 = Math.max(t0, t);
      else t1 = Math.min(t1, t);
      if (t0 > t1) return false;
    }
  }
  return true;
}

const grow = (m: Box, by: number): Box => ({
  x: m.x - by,
  y: m.y - by,
  width: m.width + 2 * by,
  height: m.height + 2 * by,
});
const boxesMeet = (b: Box, m: Box) =>
  b.x <= m.x + m.width && b.x + b.width >= m.x && b.y <= m.y + m.height && b.y + b.height >= m.y;
const boxWithin = (m: Box, b: Box) =>
  m.x > b.x && m.y > b.y && m.x + m.width < b.x + b.width && m.y + m.height < b.y + b.height;
const cornersOf = (m: Box): readonly Point[] => [
  { x: m.x, y: m.y },
  { x: m.x + m.width, y: m.y },
  { x: m.x + m.width, y: m.y + m.height },
  { x: m.x, y: m.y + m.height },
];

/** Segments along a stroke's or highlight's curve (each quadratic piece in a few straight steps). */
function curveSegments(points: readonly Point[]): readonly (readonly [Point, Point])[] {
  const pieces = strokePieces(points);
  if (!pieces.length) return points[0] ? [[points[0], points[0]]] : [];
  const out: [Point, Point][] = [];
  const STEPS = 8;
  for (const { from, control, to } of pieces) {
    let prev = from;
    for (let i = 1; i <= STEPS; i++) {
      const t = i / STEPS;
      const u = 1 - t;
      const next = {
        x: u * u * from.x + 2 * u * t * control.x + t * t * to.x,
        y: u * u * from.y + 2 * u * t * control.y + t * t * to.y,
      };
      out.push([prev, next]);
      prev = next;
    }
  }
  return out;
}

/** True when the drawn mark of `a` meets the box `m` (normalized). */
function markMeetsBox(a: Annotation, m: Box, shortSide: number, measure: TextMeasure): boolean {
  if (!boxesMeet(boundsOf(a, shortSide, measure), m)) return false;
  const hw = strokePixels(a.style, shortSide) / 2;
  if (isBoxAnnotation(a)) {
    const b = normalizeBox(a.box);
    const filled = a.kind === 'redaction' || a.style.fill !== 'none';
    if (a.kind === 'ellipse') {
      const rx = b.width / 2;
      const ry = b.height / 2;
      const cx = b.x + rx;
      const cy = b.y + ry;
      const inside = (p: Point, ex: number, ey: number) =>
        ex > 0 && ey > 0 && ((p.x - cx) / ex) ** 2 + ((p.y - cy) / ey) ** 2 <= 1;
      // The box's point nearest the centre lies within the ellipse and its outline, or one of the
      // ellipse's extreme points lies in the box (a thin ellipse).
      const near = { x: Math.max(m.x, Math.min(cx, m.x + m.width)), y: Math.max(m.y, Math.min(cy, m.y + m.height)) };
      const tips = [
        { x: cx - rx, y: cy },
        { x: cx + rx, y: cy },
        { x: cx, y: cy - ry },
        { x: cx, y: cy + ry },
      ];
      const g = grow(m, hw);
      if (!inside(near, rx + hw, ry + hw) && !tips.some((p) => boxesMeet({ ...p, width: 0, height: 0 }, g)))
        return false;
      // An outline: a box wholly inside its hole does not touch it.
      return filled || !cornersOf(m).every((p) => inside(p, rx - hw, ry - hw));
    }
    if (filled) return true;
    const hole = { x: b.x + hw, y: b.y + hw, width: b.width - 2 * hw, height: b.height - 2 * hw };
    return !(hole.width > 0 && hole.height > 0 && boxWithin(m, hole));
  }
  if (isLineAnnotation(a)) {
    if (segmentMeetsBox(a.tail, a.head, grow(m, hw))) return true;
    if (a.kind !== 'arrow') return false;
    const head = arrowHead(a.tail, a.head, hw * 2);
    const [t, l, r] = head;
    return (
      segmentMeetsBox(t, l, m) ||
      segmentMeetsBox(l, r, m) ||
      segmentMeetsBox(r, t, m) ||
      cornersOf(m).some((p) => inTriangle(p, head))
    );
  }
  if (isPathAnnotation(a)) {
    const g = grow(m, markWidth(a, shortSide) / 2);
    return curveSegments(a.points).some(([p, q]) => segmentMeetsBox(p, q, g));
  }
  // Text and steps are solid marks: their box (a step's badge box) is the mark.
  return true;
}

/**
 * F-008.R1 (MOD-Core `marqueeHits`): the ids of every annotation whose drawn shape the selection box
 * `box` touches, in drawing order (the box may have been dragged in any direction). A line or arrow is
 * touched only where its segment or head passes, not anywhere in its bounds; an outline not when the box
 * sits wholly inside it; a stroke or highlight along its curve.
 */
export function marqueeHits(
  annotations: readonly Annotation[],
  box: Box,
  shortSide: number,
  measure: TextMeasure,
): readonly string[] {
  const m = normalizeBox(box);
  return annotations.filter((a) => markMeetsBox(a, m, shortSide, measure)).map((a) => a.id);
}

// ---------- position and size fields (F-008.R8, D-008) ----------

/** A field of CMP-StylePanel's position and size (COPY-geometry.*): `start…` and `end…` are a line's ends. */
export type GeometryField = 'x' | 'y' | 'width' | 'height' | 'startX' | 'startY' | 'endX' | 'endY';

/**
 * F-008.R8: the position and size fields of an annotation, in image pixels rounded to whole pixels:
 * rectangles, ellipses and redactions X, Y, W, H of their box; lines and arrows start and end X and Y;
 * strokes and highlights X, Y, W, H of their points' box; text X and Y of its anchor; steps X and Y of
 * their centre.
 */
export function geometryOf(a: Annotation): readonly (readonly [GeometryField, number])[] {
  const r = Math.round;
  if (isLineAnnotation(a))
    return [
      ['startX', r(a.tail.x)],
      ['startY', r(a.tail.y)],
      ['endX', r(a.head.x)],
      ['endY', r(a.head.y)],
    ];
  if (isStepAnnotation(a))
    return [
      ['x', r(a.centre.x)],
      ['y', r(a.centre.y)],
    ];
  if (isTextAnnotation(a))
    return [
      ['x', r(a.anchor.x)],
      ['y', r(a.anchor.y)],
    ];
  const b = shapeBox(a);
  return [
    ['x', r(b.x)],
    ['y', r(b.y)],
    ['width', r(b.width)],
    ['height', r(b.height)],
  ];
}

/**
 * F-008.R8: `a` with one position or size field set to `value` (whole image pixels). X and Y move it;
 * W and H resize a box, or scale a stroke's or highlight's points from the top-left corner, never below
 * 1 × 1 (the same limit as Alt+arrows); a line's start and end fields move its tail and head. A field the
 * kind does not show returns `a` itself.
 */
export function withGeometry(a: Annotation, field: GeometryField, value: number): Annotation {
  if (isLineAnnotation(a)) {
    if (field === 'startX') return { ...a, tail: { ...a.tail, x: value } };
    if (field === 'startY') return { ...a, tail: { ...a.tail, y: value } };
    if (field === 'endX') return { ...a, head: { ...a.head, x: value } };
    if (field === 'endY') return { ...a, head: { ...a.head, y: value } };
    return a;
  }
  const at = isStepAnnotation(a) ? a.centre : isTextAnnotation(a) ? a.anchor : shapeBox(a);
  if (field === 'x') return moved(a, value - at.x, 0);
  if (field === 'y') return moved(a, 0, value - at.y);
  if (isStepAnnotation(a) || isTextAnnotation(a)) return a;
  const b = shapeBox(a);
  if (field === 'width') return sizedTo(a, value, b.height);
  if (field === 'height') return sizedTo(a, b.width, value);
  return a;
}
