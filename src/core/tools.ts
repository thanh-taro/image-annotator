// MOD-Core — the tools of CMP-Toolbar and the default current style of each drawing tool.
// Implements: RULE-04 (default current style per tool), RULE-19 (tool keys V R O A L P H T N X C).
import type { AnnotationKind, Style } from './types';

/** CMP-Toolbar tools in toolbar order (COPY-tool.*), with their RULE-19 keys. */
export const TOOLS = [
  'select',
  'rectangle',
  'ellipse',
  'arrow',
  'line',
  'pen',
  'highlight',
  'text',
  'step',
  'redact',
  'crop',
] as const;
export type ToolName = (typeof TOOLS)[number];

/** RULE-19 tool keys (the letter as typed on Latin layouts, or its US key position). */
export const TOOL_KEYS: Readonly<Record<ToolName, string>> = {
  select: 'V',
  rectangle: 'R',
  ellipse: 'O',
  arrow: 'A',
  line: 'L',
  pen: 'P',
  highlight: 'H',
  text: 'T',
  step: 'N',
  redact: 'X',
  crop: 'C',
};

/** A tool that creates annotations, and the kind it creates (ENT-Annotation `kind`). */
export const TOOL_KIND = {
  rectangle: 'rectangle',
  ellipse: 'ellipse',
  arrow: 'arrow',
  line: 'line',
  pen: 'stroke',
  highlight: 'highlight',
  text: 'text',
  step: 'step',
  redact: 'redaction',
} as const satisfies Partial<Record<ToolName, AnnotationKind>>;
export type DrawingTool = keyof typeof TOOL_KIND;

export const isDrawingTool = (tool: ToolName): tool is DrawingTool => tool in TOOL_KIND;

/** The tool that creates annotations of this kind (RULE-04: a restyle becomes that tool's current style). */
export function toolOf(kind: AnnotationKind): DrawingTool {
  const entry = (Object.entries(TOOL_KIND) as [DrawingTool, AnnotationKind][]).find(([, k]) => k === kind);
  return entry ? entry[0] : 'rectangle';
}

/** The kinds drawn by dragging a box or a line (F-003): RULE-05 clicks place them at the default size. */
export const SHAPE_KINDS = ['rectangle', 'ellipse', 'line', 'arrow'] as const;
export type ShapeKind = (typeof SHAPE_KINDS)[number];
export const isShapeKind = (kind: AnnotationKind): kind is ShapeKind =>
  (SHAPE_KINDS as readonly string[]).includes(kind);

/** RULE-04: fill applies to rectangles and ellipses only. */
export const hasFill = (kind: AnnotationKind): boolean => kind === 'rectangle' || kind === 'ellipse';

const style = (s: Partial<Style>): Style =>
  Object.freeze({ color: 'red', strokeSize: 'M', fill: 'none', redactionKind: 'solid', strength: 'M', ...s });

/**
 * RULE-04 default current style per tool: rectangle, ellipse, line, arrow, pen, text and step: red, M,
 * fill none; highlight: yellow, L; redaction: solid, black, strength M.
 */
export const DEFAULT_STYLES: Readonly<Record<DrawingTool, Style>> = Object.freeze({
  rectangle: style({}),
  ellipse: style({}),
  arrow: style({}),
  line: style({}),
  pen: style({}),
  text: style({}),
  step: style({}),
  highlight: style({ color: 'yellow', strokeSize: 'L' }),
  redact: style({ color: 'black', redactionKind: 'solid', strength: 'M' }),
});
