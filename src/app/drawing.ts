// MOD-App — the drawing commands (MOD-App surface: `setTool`, `setStyle`) and what CMP-StylePanel
// shows. Creating a shape is one undo step that selects it (RULE-11, F-003.R6); a style change applies
// to the selection as one step and becomes the current style of its tools, else it is the active tool's
// current style and no step (RULE-04, RULE-11). Tool changes and placing are announced (NFR-06).
// A text edit (F-005) mirrors into `textEditing`; when it ends the text is committed with MOD-Document
// `commitText` (create + first edit one step, an emptied text one deletion step, RULE-11).
// The redaction tool (F-007) has a kind (solid when first used), a colour for solid and a strength for blur
// and pixelate, which carry the not-secure note and the "Use solid" offer (RULE-10); switching a redaction
// to solid gives it the current solid colour (F-007.AC8).
// Implements: F-003.R3/R6, F-004.R1/R2 (the pen and highlight tools), F-006.R1 (the step tool), F-005.R1/R3/R4/R6
// (the text tool), F-007.R1/R2/R4/R6 (the redaction tool and its choices), RULE-04, RULE-10, RULE-08, RULE-11, RULE-19 (Esc chain, Enter on a text), CMP-Toolbar "Behavior",
// CMP-StylePanel "tool" and "selection" variants, CMP-Canvas "Accessibility" (tool_active, placed, deleted_count;
// F-013: the annotation options' names and the selection announcements).
import { canvasCommands, type TextEdit, type TextEndReason } from '../canvas';
import { t, type MessageId } from '../copy';
import {
  availablePaddings,
  geometryOf,
  hasFill,
  isBlankText,
  isLineAnnotation,
  isEffectRedaction,
  isDrawingTool,
  TOOL_KIND,
  toolOf,
  withToolStyle,
  type Annotation,
  type Colour,
  type DrawingTool,
  type Fill,
  type Frame,
  type GeometryField,
  type PaddingSize,
  type RedactionKind,
  type Size,
  type Style,
  type TextAnnotation,
  type ToolName,
} from '../core';
import { add, commitText, restyle, type Doc, type Op, type Selection } from '../document';
import {
  announcePolite,
  commit,
  currentStyleModel,
  currentStyles,
  doc,
  loaded,
  selection,
  sheetOpen,
  textEditing,
  tool,
} from './state';

/** The tools, in CMP-Toolbar order (all built since F-010). */
export const BUILT_TOOLS: readonly ToolName[] = [
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
];

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

/**
 * CMP-Toolbar "Behavior" (D-043): picks the active tool, with the pointer or its key (RULE-19). Any tool
 * other than select clears the selection, so CMP-StylePanel shows that tool's current style and a style
 * choice changes only what is drawn next (RULE-04); select keeps it. Not an undo step (RULE-11).
 */
// Implements: CMP-Toolbar "Behavior" (D-043), F-008.AC19
export function setTool(next: ToolName): void {
  const l = loaded.value;
  if (!l || !BUILT_TOOLS.includes(next)) return;
  // Implements: CMP-Toolbar (D-043) — picking any tool but select, even the one already active,
  // clears the selection, so a style choice changes only what is drawn next.
  if (next !== 'select' && selection.value.length) select([]);
  if (tool.value === next) return;
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
 * CMP-Canvas "Accessibility": an annotation's name in the annotation list and in announcements —
 * COPY-a11y.step_annotation for steps (their label, plain digits, RULE-07), COPY-a11y.text_annotation for
 * text, else COPY-a11y.annotation with the tool's name (a redaction: its kind's). The position is the
 * first two position fields (F-008.R8): a box's top-left, a line's start, a text's anchor, a step's centre.
 */
export function annotationName(a: Annotation): string {
  const [[, x] = ['x', 0], [, y] = ['y', 0]] = geometryOf(a);
  if (a.kind === 'step') return t('a11y.step_annotation', { number: String(Math.trunc(a.number)), x, y });
  if (a.kind === 'text') return t('a11y.text_annotation', { text: a.text, x, y });
  const kind = a.kind === 'redaction' ? kindLabel(a.style.redactionKind) : toolLabel(toolOf(a.kind));
  return t('a11y.annotation', { kind, x, y });
}

/**
 * CMP-Canvas "Accessibility": a new selection is announced politely — one annotation with its name,
 * several with COPY-a11y.selected_count. Not for Tab (its option takes focus and is read out itself).
 */
export function announceSelection(ids: Selection): void {
  if (!ids.length) return;
  const [id] = ids;
  const one = ids.length === 1 ? doc.value?.annotations.find((a) => a.id === id) : undefined;
  announcePolite(one ? annotationName(one) : t('a11y.selected_count', { count: ids.length }));
}

/** F-008.R1 / F-013: the canvas changed the selection — by pointer (announced) or by Tab (focus shows it). */
export function pick(ids: Selection, via: 'pointer' | 'keyboard' = 'pointer'): void {
  const before = selection.value;
  select(ids);
  const same = before.length === ids.length && before.every((x, i) => x === ids[i]);
  if (via === 'pointer' && !same) announceSelection(ids);
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

/**
 * F-005.R1/R4: a text edit started. An existing text becomes the selection (the style panel shows and
 * changes its colour and size, SCR-Annotator "editing-text"); a new one is not in the document yet, so
 * the panel shows the text tool's current style. Not an undo step.
 */
export function textEditStarted(edit: TextEdit): void {
  textEditing.value = { id: edit.id };
  select(edit.id ? [edit.id] : []);
}

/**
 * F-005.R3/R6, RULE-08, RULE-11: a text edit ended. The text stays and is selected; a new text and its
 * first edit are one step (announced with COPY-a11y.placed); a new text left empty adds nothing; an
 * existing text left empty is deleted as one step (COPY-a11y.deleted_count). A discarded edit (a new
 * image) changes nothing.
 */
export function textEditEnded(edit: TextEdit, text: TextAnnotation | null, reason: TextEndReason): void {
  textEditing.value = null;
  const l = loaded.value;
  if (!l || !text || reason === 'discard') return;
  const isNew = edit.id === null;
  const blank = isBlankText(text.text);
  if (isNew && blank) {
    select([]);
    return;
  }
  const id = isNew ? l.session.newId() : text.id;
  commit(l.session.history.apply(commitText({ ...text, id }, isNew), blank ? [] : [id]));
  if (isNew) announcePolite(t('a11y.placed', { kind: toolLabel('text') }));
  else if (blank) announcePolite(t('a11y.deleted_count', { count: 1 }));
}

/** RULE-19 Enter with the select tool and one text selected: edits it (F-005.R4). */
export function editSelectedText(): void {
  const [id] = selection.value;
  if (id && selection.value.length === 1) canvasCommands.beginTextEdit(id);
}

/** The style choices CMP-StylePanel offers (RULE-04). */
export type StylePatch = Partial<Pick<Style, 'color' | 'strokeSize' | 'fill' | 'redactionKind' | 'strength'>>;

function selectedAnnotations(d: Doc | null, ids: Selection): Annotation[] {
  if (!d || !ids.length) return [];
  const wanted = new Set(ids);
  return d.annotations.filter((a) => wanted.has(a.id));
}

/**
 * The part of a patch that applies to a kind: fill only to rectangles and ellipses (RULE-04); the
 * redaction kind and strength only to redactions, which have no stroke size (RULE-10).
 */
const patchFor = (patch: StylePatch, kind: Annotation['kind']): StylePatch => {
  const out: { -readonly [K in keyof StylePatch]: StylePatch[K] } = { ...patch };
  if (!hasFill(kind)) delete out.fill;
  if (kind === 'redaction') delete out.strokeSize;
  else {
    delete out.redactionKind;
    delete out.strength;
  }
  return out;
};

/**
 * F-007.AC8: a redaction switched to solid becomes an opaque box in the current solid colour (the
 * redaction tool's current colour, RULE-04); one already solid keeps its own.
 */
const toSolid = (patch: StylePatch, a: Annotation, current: Style): StylePatch =>
  patch.redactionKind === 'solid' && patch.color === undefined && isEffectRedaction(a)
    ? { ...patch, color: current.color }
    : patch;

/**
 * RULE-04: changing a style while annotations are selected changes them (one undo step, RULE-11) and
 * becomes the current style for their tools; with nothing selected it changes the active drawing
 * tool's current style (no step). A colour is shared by the seven tools of D-045, so it is the next
 * colour of all of them; highlight and redaction keep their own.
 */
export function setStyle(patch: StylePatch): void {
  const l = loaded.value;
  const picked = selectedAnnotations(doc.value, selection.value);
  let styles = currentStyleModel.value;
  if (l && picked.length) {
    // One step (RULE-11) of one restyle per distinct patch (only F-007.AC8 makes them differ).
    const groups = new Map<string, { patch: StylePatch; ids: string[] }>();
    for (const a of picked) {
      const p = toSolid(patchFor(patch, a.kind), a, currentStyles.value.redact);
      const key = JSON.stringify(p);
      const g = groups.get(key) ?? { patch: p, ids: [] };
      g.ids.push(a.id);
      groups.set(key, g);
    }
    const op: Op = (d) => [...groups.values()].reduce((acc, g) => restyle(g.ids, g.patch)(acc), d);
    commit(l.session.history.apply(op, selection.value));
    // Implements: RULE-04 (D-045) — a colour becomes the shared colour, or highlight's or redaction's own.
    for (const a of picked) styles = withToolStyle(styles, toolOf(a.kind), patchFor(patch, a.kind));
  } else {
    const active = tool.value;
    if (!isDrawingTool(active)) return;
    styles = withToolStyle(styles, active, patchFor(patch, TOOL_KIND[active]));
  }
  currentStyleModel.value = styles;
}

/**
 * RULE-04 / D-047: the drawing colour picked in canvas settings (select tool, nothing selected) is the
 * shared current colour of rectangle, ellipse, line, arrow, pen, text and step. Not an undo step (RULE-11).
 */
export function setDrawingColour(color: Colour): void {
  const styles = currentStyleModel.value;
  currentStyleModel.value = { ...styles, colours: { ...styles.colours, shared: color } };
}

/**
 * RULE-19 Esc: cancel the current drag; else (D-019) close the narrow sheet; else end text editing,
 * keeping the text (F-005.R3); else clear the selection; else switch to the select tool.
 */
export function escape(): void {
  if (canvasCommands.cancelDrag()) return;
  if (sheetOpen.value) {
    sheetOpen.value = false;
    return;
  }
  if (canvasCommands.endTextEdit()) return;
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
  /** CMP-StylePanel variant: the active tool, the selection, the canvas (F-011), or the crop frame (F-010). */
  readonly variant: 'tool' | 'selection' | 'canvas' | 'crop';
  /** The summary bar's subject (COPY-style.sheet_summary): the tool, the selected kind, or the count. */
  readonly subject: string;
  /** D-031 / RULE-10: the subject is a blur or pixelate redaction, so COPY-redact.not_secure_short follows it. */
  readonly subjectNotSecure?: true;
  /** Offered unless a subject is a blur or pixelate redaction (RULE-10: only solid has a colour). */
  readonly color?: Colour | null;
  /** Offered unless a subject is a redaction (RULE-10: redactions have no stroke size). */
  readonly size?: Size | null;
  /** Offered only when every subject kind has a fill (rectangle, ellipse). */
  readonly fill?: Fill | null;
  /** COPY-redact.kind: offered when every subject is a redaction (F-007.R4/R6). */
  readonly kind?: RedactionKind | null;
  /** COPY-style.strength: offered when every subject is a blur or pixelate redaction (RULE-10). */
  readonly strength?: Size | null;
  /** RULE-10 / F-007.R4: COPY-redact.not_secure and COPY-redact.use_solid show (a subject is blur or pixelate). */
  readonly notSecure?: boolean;
  /**
   * F-008.R8: the position and size fields of a single selection (COPY-geometry.title): a box's X, Y, W, H
   * (also a stroke's or highlight's bounding box), a line's start and end, or a text's or step's X and Y.
   */
  readonly geometry?: {
    readonly kind: 'box' | 'line' | 'point';
    readonly fields: readonly (readonly [GeometryField, number])[];
  };
  /** F-008.R5: the selection actions (duplicate, delete, bring forward, send backward) are offered. */
  readonly actions?: true;
  /** F-010.R4/R6 (CMP-StylePanel "crop"): the frame, for its size, position and size fields and reset. */
  readonly frame?: Frame;
  /**
   * F-011 (CMP-StylePanel "canvas"): the padding size, the background, and the sizes that are offered
   * (RULE-14: the others would make the canvas exceed RULE-02 and are unavailable).
   */
  readonly canvas?: {
    readonly padding: PaddingSize;
    readonly background: 'transparent' | Colour;
    readonly available: readonly PaddingSize[];
    /** D-047: the shared drawing colour (RULE-04), offered first as COPY-style.color. */
    readonly drawColor: Colour;
  };
}

/** F-008.R8: the position and size fields of `a`, grouped as CMP-StylePanel lays them out. */
function geometryModel(a: Annotation): NonNullable<PanelModel['geometry']> {
  const fields = geometryOf(a);
  return { kind: isLineAnnotation(a) ? 'line' : fields.length === 2 ? 'point' : 'box', fields };
}

/** The redaction choices (and which general ones apply) for subjects with these styles and kinds. */
function choices(
  subjects: readonly { kind: Annotation['kind']; style: Style }[],
): Omit<PanelModel, 'variant' | 'subject'> {
  const styles = subjects.map((x) => x.style);
  const redactions = subjects.filter((x) => x.kind === 'redaction');
  const effects = redactions.filter((x) => x.style.redactionKind !== 'solid');
  const allRedactions = redactions.length === subjects.length;
  return {
    ...(effects.length ? {} : { color: shared(styles.map((x) => x.color)) }),
    ...(redactions.length ? {} : { size: shared(styles.map((x) => x.strokeSize)) }),
    ...(subjects.every((x) => hasFill(x.kind)) ? { fill: shared(styles.map((x) => x.fill)) } : {}),
    ...(allRedactions ? { kind: shared(styles.map((x) => x.redactionKind)), notSecure: effects.length > 0 } : {}),
    ...(allRedactions && effects.length === subjects.length ? { strength: shared(styles.map((x) => x.strength)) } : {}),
  };
}

const shared = <T>(values: readonly T[]): T | null =>
  values.every((v) => v === values[0]) ? (values[0] ?? null) : null;

/**
 * CMP-StylePanel "tool", "selection" and "canvas" variants for the current state (RULE-04, F-008.R4); a
 * selection also offers its actions (F-008.R5) and, when single, its position and size fields (F-008.R8).
 * While a text is edited (`editing`, SCR-Annotator "editing-text") only its colour and size are shown.
 */
export function panelModel(
  active: ToolName,
  ids: Selection,
  d: Doc | null,
  styles: Readonly<Record<DrawingTool, Style>>,
  editing = false,
): PanelModel {
  // CMP-StylePanel "crop": with the crop tool the panel is the frame's (F-010.R4/R6), whatever is selected.
  if (active === 'crop' && d && !editing) return { variant: 'crop', subject: toolLabel('crop'), frame: d.frame };
  const picked = selectedAnnotations(d, ids);
  if (picked.length) {
    const kinds = new Set(picked.map((a) => a.kind));
    const [first] = picked;
    const subject =
      kinds.size === 1 && first ? toolLabel(toolOf(first.kind)) : t('a11y.selected_count', { count: picked.length });
    const c = choices(picked);
    const edits =
      editing || !first
        ? {}
        : { actions: true as const, ...(picked.length === 1 ? { geometry: geometryModel(first) } : {}) };
    return { variant: 'selection', ...subjectOf(c, subject), ...c, ...edits };
  }
  if (isDrawingTool(active)) {
    const c = choices([{ kind: TOOL_KIND[active], style: styles[active] }]);
    return { variant: 'tool', ...subjectOf(c, toolLabel(active)), ...c };
  }
  if (!d) return { variant: 'canvas', subject: t('canvas.title') };
  const { size, background } = d.padding;
  const canvas = {
    padding: size,
    background,
    available: availablePaddings(d.frame),
    drawColor: styles.rectangle.color,
  };
  // CMP-StylePanel "narrow": the summary bar shows a palette background's colour, none when transparent.
  const color = background === 'transparent' ? {} : { color: background };
  return { variant: 'canvas', subject: t('canvas.title'), ...color, canvas };
}

/**
 * COPY-style.sheet_summary's subject: a redaction's kind when the subjects share one, else `otherwise`;
 * a blur or pixelate kind carries the not-secure tag (D-031, RULE-10).
 */
function subjectOf(c: { readonly kind?: RedactionKind | null }, otherwise: string) {
  if (!c.kind) return { subject: otherwise };
  return { subject: kindLabel(c.kind), ...(c.kind !== 'solid' ? { subjectNotSecure: true as const } : {}) };
}

// COPY-style.sheet_summary: for a redaction the subject is its kind (COPY-redact.solid/blur/pixelate).
const KIND_COPY = { solid: 'redact.solid', blur: 'redact.blur', pixelate: 'redact.pixelate' } as const satisfies Record<
  RedactionKind,
  MessageId
>;
export const kindLabel = (kind: RedactionKind): string => t(KIND_COPY[kind]);

const SIZE_COPY = { S: 'style.size_s', M: 'style.size_m', L: 'style.size_l' } as const satisfies Record<
  Size,
  MessageId
>;
export const sizeLabel = (size: Size): string => t(SIZE_COPY[size]);

/** F-011: a padding size's name — COPY-canvas.padding_none, or COPY-style.size_s/m/l (CMP-StylePanel). */
export const paddingLabel = (size: PaddingSize): string =>
  size === 'none' ? t('canvas.padding_none') : sizeLabel(size);

/**
 * COPY-style.sheet_summary's detail: the size (a blur or pixelate redaction's strength; none for solid), or
 * for the canvas COPY-canvas.padding, a space and the padding size ("Padding None", F-011).
 */
export function summaryDetail(model: PanelModel): string {
  // COPY-style.sheet_summary: COPY-tool.crop · COPY-crop.size.
  if (model.frame) return t('crop.size', { width: model.frame.width, height: model.frame.height });
  if (model.variant === 'canvas') return `${t('canvas.padding')} ${paddingLabel(model.canvas?.padding ?? 'none')}`;
  const size = model.size ?? model.strength;
  return size ? sizeLabel(size) : '';
}
