// MOD-App drawing commands and MOD-Document add/restyle (F-003): creating is one undo step that selects
// the new shape (RULE-11, F-003.R6); styles follow RULE-04; the panel shows the right choices; the
// RULE-19 Esc chain; tool changes and placing are announced (NFR-06).
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createAnnotation, escape, panelModel, select, setStyle, setTool, summaryDetail } from '../../src/app/drawing';
import {
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
import { DEFAULT_STYLES, type Annotation } from '../../src/core';
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
    currentStyles.value = DEFAULT_STYLES;
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

  it('CMP-Toolbar picking a tool clears nothing and is announced; unbuilt tools are ignored', () => {
    createAnnotation(draft());
    const selected = selection.value;
    setTool('ellipse');
    expect(tool.value).toBe('ellipse');
    expect(selection.value).toBe(selected);
    expect(lastPolite()).toBe('Ellipse tool');
    setTool('pen');
    expect(tool.value).toBe('ellipse');
  });

  it('F-003.AC1 F-003.R3 RULE-04 with nothing selected a style change is the tool’s current style, no step', () => {
    setTool('rectangle');
    setStyle({ color: 'blue', fill: 'translucent' });
    expect(currentStyles.value.rectangle).toMatchObject({ color: 'blue', fill: 'translucent', strokeSize: 'M' });
    expect(currentStyles.value.ellipse).toBe(DEFAULT_STYLES.ellipse);
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
});
