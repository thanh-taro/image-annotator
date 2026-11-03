// MOD-App — the drawing commands (MOD-App surface: `setTool`, `setStyle`) and what CMP-StylePanel
// shows. Creating a shape is one undo step that selects it (RULE-11, F-003.R6); a style change applies
// to the selection as one step and becomes the current style of its tools, else it is the active tool's
// current style and no step (RULE-04, RULE-11). Tool changes and placing are announced (NFR-06).
// Implements: F-003.R3/R6, F-004.R1/R2 (the pen and highlight tools), RULE-04, RULE-11, RULE-19 (Esc chain), CMP-Toolbar "Behavior",
// CMP-StylePanel "tool" and "selection" variants, CMP-Canvas "Accessibility" (tool_active, placed).
import { canvasCommands } from '../canvas';
import { t, type MessageId } from '../copy';
import {
  hasFill,
  isDrawingTool,
  TOOL_KIND,
  toolOf,
  type Annotation,
  type Colour,
  type DrawingTool,
  type Fill,
  type Size,
  type Style,
  type ToolName,
} from '../core';
import { add, restyle, type Doc, type Selection } from '../document';
import { announcePolite, commit, currentStyles, doc, loaded, selection, sheetOpen, tool } from './state';

/** The tools built so far, in CMP-Toolbar order; the others join with their features (F-005…F-010). */
export const BUILT_TOOLS: readonly ToolName[] = ['select', 'rectangle', 'ellipse', 'arrow', 'line', 'pen', 'highlight'];

const TOOL_COPY = {
  select: 'tool.select',
  rectangle: 'tool.rectangle',
  ellipse: 'tool.ellipse',
  arrow: 'tool.arrow',
  line: 'tool.line',
  pen: 'tool.pen',
  highlight: 'tool.highlight',
  text: 'tool.text',
  step: 'tool.step',
  redact: 'tool.redact',
  crop: 'tool.crop',
} as const satisfies Record<ToolName, MessageId>;

/** The tool's name (COPY-tool.*). */
export const toolLabel = (name: ToolName): string => t(TOOL_COPY[name]);

/** CMP-Toolbar: picks the active tool (clears nothing, the selection stays). Not an undo step (RULE-11). */
export function setTool(next: ToolName): void {
  const l = loaded.value;
  if (!l || !BUILT_TOOLS.includes(next) || tool.value === next) return;
  tool.value = next;
  l.session.history.breakChain(); // ADR-0008 §3: a tool change breaks the coalescing chain
  announcePolite(t('a11y.tool_active', { tool: toolLabel(next) }));
}

/** The selection changes outside a step (not an undo step, RULE-11; F-009.R3 records it for the next step). */
export function select(ids: Selection): void {
  selection.value = ids;
  loaded.value?.session.history.noteSelection(ids);
}

/**
 * F-003.R1/R5/R6: adds a drawn or placed shape as one undo step (RULE-11); it becomes the selection and
 * the tool stays. Announced with COPY-a11y.placed.
 */
export function createAnnotation(draft: Annotation): void {
  const l = loaded.value;
  if (!l) return;
  const id = l.session.newId();
  const annotation = { ...draft, id } as Annotation;
  commit(l.session.history.apply(add(annotation), [id]));
  announcePolite(t('a11y.placed', { kind: toolLabel(toolOf(annotation.kind)) }));
}

/** The style choices CMP-StylePanel offers (RULE-04). */
export type StylePatch = Partial<Pick<Style, 'color' | 'strokeSize' | 'fill'>>;

function selectedAnnotations(d: Doc | null, ids: Selection): Annotation[] {
  if (!d || !ids.length) return [];
  const wanted = new Set(ids);
  return d.annotations.filter((a) => wanted.has(a.id));
}

/** The part of a patch that applies to a kind (fill only to rectangles and ellipses, RULE-04). */
const patchFor = (patch: StylePatch, kind: Annotation['kind']): StylePatch => {
  if (hasFill(kind) || patch.fill === undefined) return patch;
  const { fill: _fill, ...rest } = patch;
  return rest;
};

/**
 * RULE-04: changing a style while annotations are selected changes them (one undo step, RULE-11) and
 * becomes the current style for their tools; with nothing selected it changes the active drawing
 * tool's current style (no step).
 */
export function setStyle(patch: StylePatch): void {
  const l = loaded.value;
  const picked = selectedAnnotations(doc.value, selection.value);
  const styles = { ...currentStyles.value };
  if (l && picked.length) {
    const ids = picked.map((a) => a.id);
    commit(l.session.history.apply(restyle(ids, patch), selection.value));
    for (const a of picked) {
      const owner = toolOf(a.kind);
      styles[owner] = { ...styles[owner], ...patchFor(patch, a.kind) };
    }
  } else {
    const active = tool.value;
    if (!isDrawingTool(active)) return;
    styles[active] = { ...styles[active], ...patchFor(patch, TOOL_KIND[active]) };
  }
  currentStyles.value = styles;
}

/**
 * RULE-19 Esc: cancel the current drag; else (D-019) close the narrow sheet; else clear the selection;
 * else switch to the select tool. (Ending a text edit joins with F-005.)
 */
export function escape(): void {
  if (canvasCommands.cancelDrag()) return;
  if (sheetOpen.value) {
    sheetOpen.value = false;
    return;
  }
  if (selection.value.length) {
    select([]);
    return;
  }
  setTool('select');
}

/** RULE-19 Enter with a drawing tool: places its default annotation at the centre of the view (F-003.R5). */
export function placeAtCentre(): void {
  canvasCommands.placeAtCentre();
}

/** What CMP-StylePanel shows. `null` marks a choice whose selected annotations differ (nothing marked). */
export interface PanelModel {
  /** CMP-StylePanel variant: the active tool, the selection, or the canvas (F-011). */
  readonly variant: 'tool' | 'selection' | 'canvas';
  /** The summary bar's subject (COPY-style.sheet_summary): the tool, the selected kind, or the count. */
  readonly subject: string;
  readonly color?: Colour | null;
  readonly size?: Size | null;
  /** Offered only when every subject kind has a fill (rectangle, ellipse). */
  readonly fill?: Fill | null;
}

const shared = <T>(values: readonly T[]): T | null =>
  values.every((v) => v === values[0]) ? (values[0] ?? null) : null;

/** CMP-StylePanel "tool", "selection" and "canvas" variants for the current state (RULE-04, F-008.R4). */
export function panelModel(
  active: ToolName,
  ids: Selection,
  d: Doc | null,
  styles: Readonly<Record<DrawingTool, Style>>,
): PanelModel {
  const picked = selectedAnnotations(d, ids);
  if (picked.length) {
    const kinds = new Set(picked.map((a) => a.kind));
    const [first] = picked;
    const subject =
      kinds.size === 1 && first ? toolLabel(toolOf(first.kind)) : t('a11y.selected_count', { count: picked.length });
    const fill = picked.every((a) => hasFill(a.kind)) ? { fill: shared(picked.map((a) => a.style.fill)) } : {};
    return {
      variant: 'selection',
      subject,
      color: shared(picked.map((a) => a.style.color)),
      size: shared(picked.map((a) => a.style.strokeSize)),
      ...fill,
    };
  }
  if (isDrawingTool(active)) {
    const s = styles[active];
    return {
      variant: 'tool',
      subject: toolLabel(active),
      color: s.color,
      size: s.strokeSize,
      ...(hasFill(TOOL_KIND[active]) ? { fill: s.fill } : {}),
    };
  }
  return { variant: 'canvas', subject: t('canvas.title') };
}

const SIZE_COPY = { S: 'style.size_s', M: 'style.size_m', L: 'style.size_l' } as const satisfies Record<
  Size,
  MessageId
>;
export const sizeLabel = (size: Size): string => t(SIZE_COPY[size]);

/** COPY-style.sheet_summary's detail: the size, or for the canvas "Padding None" (F-011 fills in the rest). */
export function summaryDetail(model: PanelModel): string {
  if (model.variant === 'canvas') return `${t('canvas.padding')} ${t('canvas.padding_none')}`;
  return model.size ? sizeLabel(model.size) : '';
}
