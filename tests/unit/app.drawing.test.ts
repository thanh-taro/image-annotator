// MOD-App drawing commands and MOD-Document add/restyle (F-003): creating is one undo step that selects
// the new shape (RULE-11, F-003.R6); styles follow RULE-04; the panel shows the right choices; the
// RULE-19 Esc chain; tool changes and placing are announced (NFR-06).
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { setBackground } from '../../src/app/padding';
import { createAnnotation, escape, panelModel, select, setStyle, setTool, summaryDetail } from '../../src/app/drawing';
import {
  currentStyleModel,
  currentStyles,
  doc,
  loaded,
  polite,
  selection,
  sheetOpen,
  startNewSession,
  tool,
  unexported,
} from '../../src/app/state';
import { canvasCommands } from '../../src/canvas';
import { DEFAULT_CURRENT_STYLES, DEFAULT_STYLES, type Annotation } from '../../src/core';
import { add, restyle, startSession } from '../../src/document';
import type { DecodedImage } from '../../src/io';

const image = (): DecodedImage => ({
  info: { width: 1000, height: 800, sourceName: null, sourceType: 'png' },
  bitmap: { width: 1000, height: 800, close: vi.fn() } as unknown as ImageBitmap,
});
const draft = (kind: 'rectangle' | 'arrow' = 'rectangle'): Annotation =>
  kind === 'arrow'
    ? { id: 'draft', kind, style: DEFAULT_STYLES.arrow, tail: { x: 0, y: 0 }, head: { x: 50, y: 0 } }
    : { id: 'draft', kind, style: DEFAULT_STYLES.rectangle, box: { x: 100, y: 100, width: 200, height: 100 } };
const lastPolite = () => polite.value.at(-1)?.text;

describe('MOD-Document add and restyle', () => {
  it('RULE-11 ADR-0008 adding a shape is one step that shares every other object; undo removes it', () => {
    const s = startSession(image().info);
    const before = s.doc;
    const r = s.history.apply(add(draft()), ['a1']);
    expect(r.doc.annotations).toHaveLength(1);
    expect(r.doc.frame).toBe(before.frame);
    expect(Object.isFrozen(r.doc.annotations[0])).toBe(true);
    expect(s.history.undo()).toEqual({ doc: before, selection: [] });
  });

  it('RULE-04 restyle changes only the named annotations; an unchanged style is no step', () => {
    const s = startSession(image().info);
    s.history.apply(add({ ...draft(), id: 'a1' }), ['a1']);
    s.history.apply(add({ ...draft('arrow'), id: 'a2' }), ['a2']);
    const d = s.doc;
    const next = restyle(['a1'], { color: 'blue' })(d);
    expect(next.annotations[0]?.style.color).toBe('blue');
    expect(next.annotations[1]).toBe(d.annotations[1]);
    expect(restyle(['a1'], { color: 'red' })(d)).toBe(d);
  });

  it('ENT-Annotation ids are unique within the session and never reused after undo', () => {
    const s = startSession(image().info);
    const ids = [s.newId(), s.newId()];
    s.history.undo();
    ids.push(s.newId());
    expect(new Set(ids).size).toBe(3);
  });
});

describe('MOD-App drawing commands', () => {
  beforeEach(() => {
    tool.value = 'select';
    currentStyleModel.value = DEFAULT_CURRENT_STYLES;
    sheetOpen.value = false;
    startNewSession(image());
  });

  it('F-003.AC9 F-003.R6 a new shape is selected, the tool stays, and it is one undo step (RULE-11)', () => {
    setTool('arrow');
    createAnnotation(draft('arrow'));
    const [a] = doc.value?.annotations ?? [];
    expect(a?.id).toMatch(/^a\d+$/);
    expect(selection.value).toEqual([a?.id]);
    expect(tool.value).toBe('arrow');
    expect(unexported.value).toBe(true); // RULE-18
    expect(lastPolite()).toBe('Arrow added');
    const undone = loaded.value?.session.history.undo();
    expect(undone?.doc.annotations).toEqual([]);
    expect(undone?.selection).toEqual([]);
  });

  it('CMP-Toolbar D-043 picking a tool other than select clears the selection and is announced (the crop tool too, F-010)', () => {
    createAnnotation(draft());
    setTool('ellipse');
    expect(tool.value).toBe('ellipse');
    expect(selection.value).toEqual([]);
    expect(lastPolite()).toBe('Ellipse tool');
    select([doc.value?.annotations[0]?.id ?? '']);
    setTool('crop');
    expect(tool.value).toBe('crop');
    expect(selection.value).toEqual([]);
    expect(lastPolite()).toBe('Crop tool');
    expect(loaded.value?.session.history.canRedo).toBe(false);
  });

  it('CMP-Toolbar D-043 picking the select tool keeps the selection', () => {
    setTool('rectangle');
    createAnnotation(draft());
    const selected = selection.value;
    setTool('select');
    expect(tool.value).toBe('select');
    expect(selection.value).toBe(selected);
  });

  it('F-008.AC19 CMP-Toolbar a selected rectangle, the ellipse tool picked, green: the rectangle keeps its colour and the next ellipse is green', () => {
    createAnnotation(draft());
    expect(selection.value).toHaveLength(1);
    setTool('ellipse');
    expect(selection.value).toEqual([]);
    expect(panelModel(tool.value, selection.value, doc.value, currentStyles.value)).toMatchObject({
      variant: 'tool',
      subject: 'Ellipse',
    });
    setStyle({ color: 'green' });
    expect(doc.value?.annotations[0]?.style.color).toBe('red');
    expect(currentStyles.value.ellipse.color).toBe('green');
    expect(currentStyles.value.rectangle.color).toBe('green'); // RULE-04 the colour is shared (D-045)
    expect(loaded.value?.session.history.canUndo).toBe(true); // only the creation
    loaded.value?.session.history.undo();
    expect(loaded.value?.session.history.canUndo).toBe(false);
  });

  it('F-008.AC19 CMP-Toolbar re-picking the active drawing tool also clears the selection; picking select keeps it', () => {
    setTool('rectangle');
    createAnnotation(draft()); // a new annotation is selected
    expect(selection.value).toHaveLength(1);
    setTool('rectangle');
    expect(selection.value).toEqual([]);
    expect(tool.value).toBe('rectangle');
    const id = doc.value?.annotations[0]?.id as string;
    select([id]);
    setTool('select');
    expect(selection.value).toEqual([id]);
  });

  it('F-003.AC1 F-003.R3 RULE-04 with nothing selected a style change is the tool’s current style, no step', () => {
    setTool('rectangle');
    setStyle({ color: 'blue', fill: 'translucent' });
    expect(currentStyles.value.rectangle).toMatchObject({ color: 'blue', fill: 'translucent', strokeSize: 'M' });
    // RULE-04 (D-045): the colour is shared, the fill stays the rectangle's own.
    expect(currentStyles.value.ellipse).toEqual({ ...DEFAULT_STYLES.ellipse, color: 'blue' });
    expect(loaded.value?.session.history.canUndo).toBe(false);
    setTool('arrow');
    setStyle({ fill: 'solid' }); // arrows have no fill (RULE-04)
    expect(currentStyles.value.arrow.fill).toBe('none');
  });

  it('RULE-04 RULE-11 a style change with a selection restyles it as one step and becomes its tool’s style', () => {
    setTool('arrow');
    createAnnotation(draft('arrow'));
    setStyle({ color: 'blue' });
    expect(doc.value?.annotations[0]?.style.color).toBe('blue');
    expect(currentStyles.value.arrow.color).toBe('blue');
    const h = loaded.value?.session.history;
    h?.undo();
    expect(h?.undo()?.doc.annotations).toEqual([]); // create + restyle = two steps
  });

  it('CMP-StylePanel shows the tool’s style, the selection’s shared choices, or the canvas', () => {
    setTool('rectangle');
    expect(panelModel('rectangle', [], doc.value, currentStyles.value)).toMatchObject({
      variant: 'tool',
      subject: 'Rectangle',
      color: 'red',
      size: 'M',
      fill: 'none',
    });
    expect(panelModel('arrow', [], doc.value, currentStyles.value)).not.toHaveProperty('fill');
    createAnnotation(draft());
    setTool('arrow');
    createAnnotation(draft('arrow'));
    setStyle({ color: 'blue' });
    const both = (doc.value?.annotations ?? []).map((a) => a.id);
    const m = panelModel('arrow', both, doc.value, currentStyles.value);
    expect(m).toMatchObject({ variant: 'selection', subject: '2 annotations selected', color: null, size: 'M' });
    expect(m).not.toHaveProperty('fill'); // only choices every selected kind shares
    expect(panelModel('select', [], doc.value, currentStyles.value).variant).toBe('canvas');
    expect(summaryDetail(panelModel('rectangle', [], doc.value, currentStyles.value))).toBe('Medium');
  });

  it('RULE-19 Esc: close the narrow sheet, else clear the selection, else switch to the select tool', () => {
    setTool('rectangle');
    createAnnotation(draft());
    sheetOpen.value = true;
    escape();
    expect(sheetOpen.value).toBe(false);
    expect(selection.value).toHaveLength(1);
    escape();
    expect(selection.value).toEqual([]);
    expect(tool.value).toBe('rectangle');
    escape();
    expect(tool.value).toBe('select');
    select(['x']);
    expect(selection.value).toEqual(['x']);
  });

  it('RULE-19 Esc during a drag cancels the drag first; the narrow sheet closes on the next Esc', () => {
    setTool('rectangle');
    sheetOpen.value = true;
    const cancel = vi.spyOn(canvasCommands, 'cancelDrag').mockReturnValueOnce(true);
    escape();
    expect(cancel).toHaveBeenCalledTimes(1);
    expect(sheetOpen.value).toBe(true);
    escape();
    expect(sheetOpen.value).toBe(false);
    expect(tool.value).toBe('rectangle');
    cancel.mockRestore();
  });

  it('F-004.R1 F-004.R2 CMP-Toolbar the pen and highlight tools can be picked and are announced', () => {
    setTool('pen');
    expect(tool.value).toBe('pen');
    expect(lastPolite()).toBe('Pen tool');
    setTool('highlight');
    expect(tool.value).toBe('highlight');
    expect(lastPolite()).toBe('Highlight tool');
  });

  it('F-004.R4 RULE-11 a finished stroke is one undo step, selected, announced as placed', () => {
    setTool('pen');
    createAnnotation({ id: 'draft', kind: 'stroke', style: DEFAULT_STYLES.pen, points: [{ x: 1, y: 2 }] });
    const [a] = doc.value?.annotations ?? [];
    expect(a).toMatchObject({ kind: 'stroke', points: [{ x: 1, y: 2 }] });
    expect(selection.value).toEqual([a?.id]);
    expect(lastPolite()).toBe('Pen added');
    expect(loaded.value?.session.history.undo()?.doc.annotations).toEqual([]);
  });

  it('F-004.AC2 CMP-StylePanel RULE-04 the highlight tool offers colour and size (yellow, L), never fill', () => {
    const m = panelModel('highlight', [], doc.value, currentStyles.value);
    expect(m).toMatchObject({ variant: 'tool', subject: 'Highlight', color: 'yellow', size: 'L' });
    expect(m).not.toHaveProperty('fill');
    expect(panelModel('pen', [], doc.value, currentStyles.value)).toMatchObject({ color: 'red', size: 'M' });
    setTool('highlight');
    setStyle({ color: 'green', strokeSize: 'M', fill: 'solid' });
    expect(currentStyles.value.highlight).toMatchObject({ color: 'green', strokeSize: 'M', fill: 'none' });
    expect(currentStyles.value.pen).toEqual(DEFAULT_STYLES.pen);
  });
});

const SHARED = ['rectangle', 'ellipse', 'line', 'arrow', 'pen', 'text', 'step'] as const;

describe('RULE-04 D-045 one shared current colour', () => {
  beforeEach(() => {
    tool.value = 'select';
    currentStyleModel.value = DEFAULT_CURRENT_STYLES;
    sheetOpen.value = false;
    startNewSession(image());
  });

  it('F-003.AC10 green picked with the rectangle tool is the arrow’s colour; the highlight keeps yellow', () => {
    setTool('rectangle');
    setStyle({ color: 'green' });
    setTool('arrow');
    expect(panelModel(tool.value, selection.value, doc.value, currentStyles.value)).toMatchObject({
      variant: 'tool',
      subject: 'Arrow',
      color: 'green',
    });
    for (const name of SHARED) expect(currentStyles.value[name].color).toBe('green');
    setTool('highlight');
    expect(panelModel(tool.value, selection.value, doc.value, currentStyles.value)).toMatchObject({ color: 'yellow' });
    expect(currentStyles.value.redact.color).toBe('black');
  });

  it('RULE-04 size and fill stay per tool while the colour is shared', () => {
    setTool('rectangle');
    setStyle({ strokeSize: 'L', fill: 'solid' });
    expect(currentStyles.value.rectangle).toMatchObject({ strokeSize: 'L', fill: 'solid' });
    expect(currentStyles.value.ellipse).toMatchObject({ color: 'red', strokeSize: 'M', fill: 'none' });
    expect(currentStyles.value.arrow.strokeSize).toBe('M');
  });

  it('F-003.AC11 F-011.R2 picking a background with canvas settings leaves the next rectangle’s colour unchanged', () => {
    expect(panelModel('select', [], doc.value, currentStyles.value).variant).toBe('canvas');
    setStyle({ color: 'green' }); // the select tool with nothing selected: no current style changes
    setBackground('green');
    expect(doc.value?.padding.background).toBe('green');
    expect(currentStyles.value.rectangle.color).toBe('red');
    expect(panelModel('rectangle', [], doc.value, currentStyles.value)).toMatchObject({ color: 'red' });
  });

  it('RULE-04 F-008.R4 a rectangle and a highlight selected, given blue: both blue, the shared and the highlight colour blue', () => {
    setTool('rectangle');
    createAnnotation(draft());
    setTool('highlight');
    createAnnotation({
      id: 'draft',
      kind: 'highlight',
      style: DEFAULT_STYLES.highlight,
      points: [
        { x: 10, y: 10 },
        { x: 90, y: 10 },
      ],
    });
    setTool('select');
    select((doc.value?.annotations ?? []).map((a) => a.id));
    setStyle({ color: 'blue' });
    expect(doc.value?.annotations.map((a) => a.style.color)).toEqual(['blue', 'blue']);
    expect(currentStyles.value.highlight.color).toBe('blue');
    for (const name of SHARED) expect(currentStyles.value[name].color).toBe('blue');
    expect(currentStyles.value.redact.color).toBe('black');
  });
});
