// MOD-Core — the tools of CMP-Toolbar and the default current style of each drawing tool.
// Implements: RULE-04 (default current styles; one colour shared by seven tools, D-045), RULE-19 (tool keys V R O A L P H T N X C).
import type { AnnotationKind, Colour, Style } from './types';

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
 * RULE-04 / D-045: which current colour a tool uses — rectangle, ellipse, line, arrow, pen, text and
 * step share one; highlight and redaction keep their own.
 */
export type ColourGroup = 'shared' | 'highlight' | 'redact';
export const colourGroup = (tool: DrawingTool): ColourGroup =>
  tool === 'highlight' || tool === 'redact' ? tool : 'shared';

/** A tool's current style apart from its colour (size, fill, redaction kind and strength: per tool). */
export type ToolStyle = Omit<Style, 'color'>;

/**
 * RULE-04 current styles (ADR-0008 `currentStyles`, page lifetime): one current colour per colour group
 * (D-045) and each drawing tool's other choices.
 */
export interface CurrentStyles {
  readonly colours: Readonly<Record<ColourGroup, Colour>>;
  readonly tools: Readonly<Record<DrawingTool, ToolStyle>>;
}

const toolStyle = ({ color: _colour, ...rest }: Style): ToolStyle => Object.freeze(rest);

const DEFAULTS: Readonly<Record<DrawingTool, Style>> = {
  rectangle: style({}),
  ellipse: style({}),
  arrow: style({}),
  line: style({}),
  pen: style({}),
  text: style({}),
  step: style({}),
  highlight: style({ color: 'yellow', strokeSize: 'L' }),
  redact: style({ color: 'black', redactionKind: 'solid', strength: 'M' }),
};

/**
 * RULE-04 default current styles: the shared colour red; highlight yellow, L; redaction solid, black,
 * strength M; every other tool M, fill none.
 */
export const DEFAULT_CURRENT_STYLES: CurrentStyles = Object.freeze({
  colours: Object.freeze({ shared: 'red', highlight: 'yellow', redact: 'black' }),
  tools: Object.freeze(
    Object.fromEntries(Object.entries(DEFAULTS).map(([k, v]) => [k, toolStyle(v)])) as Record<DrawingTool, ToolStyle>,
  ),
});

/** Each drawing tool's full current style: its own choices with its group's colour (RULE-04, D-045). */
export function resolveStyles(current: CurrentStyles): Readonly<Record<DrawingTool, Style>> {
  const out = {} as Record<DrawingTool, Style>;
  for (const name of Object.keys(TOOL_KIND) as DrawingTool[])
    out[name] = Object.freeze({ ...current.tools[name], color: current.colours[colourGroup(name)] });
  return Object.freeze(out);
}

/**
 * RULE-04: a style choice that becomes `tool`'s current style — the colour goes to its colour group
 * (shared by seven tools, D-045), every other choice to the tool alone.
 */
export function withToolStyle(current: CurrentStyles, tool: DrawingTool, patch: Partial<Style>): CurrentStyles {
  const { color, ...rest } = patch;
  const colours = color === undefined ? current.colours : { ...current.colours, [colourGroup(tool)]: color };
  const tools = Object.keys(rest).length
    ? { ...current.tools, [tool]: { ...current.tools[tool], ...rest } }
    : current.tools;
  return { colours, tools };
}

/**
 * RULE-04 default current style of each drawing tool, resolved (rectangle, ellipse, line, arrow, pen,
 * text and step: red, M, fill none; highlight: yellow, L; redaction: solid, black, strength M).
 */
export const DEFAULT_STYLES: Readonly<Record<DrawingTool, Style>> = resolveStyles(DEFAULT_CURRENT_STYLES);
