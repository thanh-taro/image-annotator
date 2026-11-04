// MOD-App edit commands (F-008): delete, duplicate, select all, reorder, arrow-key nudges and Alt+arrow
// resizes (coalesced into one step, RULE-11), the position and size fields (R8), committing a drag, and
// what CMP-StylePanel shows for a selection (R4, R8).
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createAnnotation, panelModel, select, setStyle, setTool } from '../../src/app/drawing';
import {
  altResizeSelection,
  commitDrag,
  deleteSelection,
  duplicateSelection,
  nudgeSelection,
  reorderSelection,
  selectAll,
  setGeometry,
} from '../../src/app/editing';
import { currentStyles, doc, loaded, polite, selection, startNewSession, tool } from '../../src/app/state';
import { DEFAULT_STYLES, shapeBox, type Annotation } from '../../src/core';
import type { DecodedImage } from '../../src/io';

const image = (): DecodedImage => ({
  info: { width: 1000, height: 800, sourceName: null, sourceType: 'png' },
  bitmap: { width: 1000, height: 800, close: vi.fn() } as unknown as ImageBitmap,
});
const rect = (x = 100, y = 100, width = 100, height = 50): Annotation => ({
  id: 'draft',
  kind: 'rectangle',
  style: DEFAULT_STYLES.rectangle,
  box: { x, y, width, height },
});
const arrow: Annotation = {
  id: 'draft',
  kind: 'arrow',
  style: DEFAULT_STYLES.arrow,
  tail: { x: 0, y: 0 },
  head: { x: 50, y: 0 },
};
const text: Annotation = {
  id: 'draft',
  kind: 'text',
  style: DEFAULT_STYLES.text,
  anchor: { x: 40, y: 50 },
  text: 'Hi',
};
const history = () => loaded.value?.session.history;
const all = () => doc.value?.annotations ?? [];
const only = () => all()[0] as Annotation;
const undo = () => {
  const r = history()?.undo();
  if (r) {
    doc.value = r.doc;
    selection.value = r.selection;
  }
  return r;
};

describe('MOD-App edit commands', () => {
  beforeEach(() => {
    tool.value = 'select';
    currentStyles.value = DEFAULT_STYLES;
    startNewSession(image());
  });

  it('F-008.AC6 Delete removes the selected rectangle; after undo, Mod+D puts a selected copy at (110, 110)', () => {
    createAnnotation(rect(100, 100));
    deleteSelection();
    expect(all()).toEqual([]);
    expect(selection.value).toEqual([]);
    expect(polite.value.at(-1)?.text).toBe('1 annotation deleted');
    undo();
    expect(all()).toHaveLength(1);
    duplicateSelection();
    expect(all()).toHaveLength(2);
    const copy = all()[1] as Annotation;
    expect(shapeBox(copy)).toMatchObject({ x: 110, y: 110 });
    expect(selection.value).toEqual([copy.id]);
    expect(polite.value.at(-1)?.text).toBe('1 annotation duplicated');
  });

  it('F-008.R1 select all selects every annotation, in drawing order; it is not an undo step', () => {
    createAnnotation(rect());
    createAnnotation(arrow);
    select([]);
    const steps = history()?.canUndo;
    selectAll();
    expect(selection.value).toEqual(all().map((a) => a.id));
    expect(history()?.canUndo).toBe(steps);
  });

  it('F-008.AC7 sending the top of two overlapping annotations backward draws the other on top, one step', () => {
    createAnnotation(rect());
    createAnnotation(rect(120, 110));
    const [bottom, top] = all().map((a) => a.id);
    reorderSelection('backward');
    expect(all().map((a) => a.id)).toEqual([top, bottom]);
    expect(selection.value).toEqual([top]);
    undo();
    expect(all().map((a) => a.id)).toEqual([bottom, top]);
  });

  it('F-008.AC9 F-008.R7 Shift+Right three times moves a text 30 px right, as one undo step', () => {
    setTool('text');
    createAnnotation(text);
    setTool('select');
    for (let i = 0; i < 3; i++) nudgeSelection(10, 0);
    expect(only()).toMatchObject({ anchor: { x: 70, y: 50 } });
    undo();
    expect(only()).toMatchObject({ anchor: { x: 40, y: 50 } });
  });

  it('RULE-11 a nudge after another command is a new step', () => {
    createAnnotation(rect());
    nudgeSelection(1, 0);
    setTool('arrow');
    nudgeSelection(1, 0);
    undo();
    expect(shapeBox(only())).toMatchObject({ x: 101 });
  });

  it('F-008.AC10 Alt+Right makes a 100 × 50 rectangle 101 × 50, top-left kept; with a text it does nothing', () => {
    createAnnotation(rect(100, 100, 100, 50));
    altResizeSelection(1, 0);
    expect(shapeBox(only())).toEqual({ x: 100, y: 100, width: 101, height: 50 });
    startNewSession(image());
    createAnnotation(text);
    const before = doc.value;
    altResizeSelection(1, 0);
    expect(doc.value).toBe(before);
    // With several selected it does nothing either.
    createAnnotation(rect());
    selectAll();
    const many = doc.value;
    altResizeSelection(1, 0);
    expect(doc.value).toBe(many);
  });

  it('F-008.AC12 typing 200 in the width field sets the rectangle to 200 wide, as one undo step', () => {
    createAnnotation(rect(100, 100, 100, 50));
    setGeometry('width', 200);
    expect(shapeBox(only())).toEqual({ x: 100, y: 100, width: 200, height: 50 });
    undo();
    expect(shapeBox(only())).toMatchObject({ width: 100 });
  });

  it('F-008.AC13 setting a line’s start X and Y moves the tail; the head stays', () => {
    createAnnotation({ ...arrow, kind: 'line' } as Annotation);
    setGeometry('startX', 300);
    setGeometry('startY', 200);
    expect(only()).toMatchObject({ tail: { x: 300, y: 200 }, head: { x: 50, y: 0 } });
  });

  it('F-008.AC15 setting a 100 × 40 highlight’s width to 200 scales it to 200 × 40 with the same top-left', () => {
    createAnnotation({
      id: 'draft',
      kind: 'highlight',
      style: DEFAULT_STYLES.highlight,
      points: [
        { x: 10, y: 20 },
        { x: 110, y: 60 },
      ],
    });
    setGeometry('width', 200);
    expect(shapeBox(only())).toEqual({ x: 10, y: 20, width: 200, height: 40 });
  });

  it('F-008.R2 F-008.R7 a finished drag is one undo step that keeps the selection', () => {
    createAnnotation(rect());
    const moved = { ...only(), box: { x: 300, y: 300, width: 100, height: 50 } } as Annotation;
    commitDrag([moved]);
    expect(shapeBox(only())).toMatchObject({ x: 300 });
    expect(selection.value).toEqual([moved.id]);
    undo();
    expect(shapeBox(only())).toMatchObject({ x: 100 });
  });

  it('F-008.AC4 F-008.R4 a red arrow and a red rectangle picked blue both turn blue, and so do the next ones', () => {
    createAnnotation(arrow);
    createAnnotation(rect());
    selectAll();
    setStyle({ color: 'blue' });
    expect(all().map((a) => a.style.color)).toEqual(['blue', 'blue']);
    expect(currentStyles.value.arrow.color).toBe('blue');
    expect(currentStyles.value.rectangle.color).toBe('blue');
  });

  it('F-008.AC5 with a rectangle and a text selected, colour and size are offered and fill is not', () => {
    createAnnotation(rect());
    createAnnotation(text);
    selectAll();
    const m = panelModel(tool.value, selection.value, doc.value, currentStyles.value);
    expect(m).toHaveProperty('color');
    expect(m).toHaveProperty('size');
    expect(m).not.toHaveProperty('fill');
    // Several selected: the actions, no position and size fields.
    expect(m.actions).toBe(true);
    expect(m.geometry).toBeUndefined();
  });

  it('F-008.AC14 F-008.R8 a single selected step shows X and Y fields and no width or height', () => {
    setTool('step');
    createAnnotation({ id: 'draft', kind: 'step', style: DEFAULT_STYLES.step, centre: { x: 30, y: 40 }, number: 0 });
    const m = panelModel(tool.value, selection.value, doc.value, currentStyles.value);
    expect(m.geometry).toEqual({
      kind: 'point',
      fields: [
        ['x', 30],
        ['y', 40],
      ],
    });
  });

  it('SCR-Annotator editing-text: no position and size fields or actions while a text is edited', () => {
    createAnnotation(text);
    const m = panelModel(tool.value, selection.value, doc.value, currentStyles.value, true);
    expect(m.geometry).toBeUndefined();
    expect(m.actions).toBeUndefined();
  });
});
