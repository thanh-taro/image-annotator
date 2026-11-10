// MOD-App fill colour and text background (F-020, RULE-22): what CMP-StylePanel offers and marks (the
// fill colour after a solid or translucent fill; for a text the text background and its colour; automatic
// colours as drawn), the per-tool current style (RULE-04), restyling a selection as one undo step
// (RULE-11), and the custom swatch with one remembered custom colour for every colour choice (F-019).
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { beginCustomPick, customSwatch, endCustomPick, previewCustomColour } from '../../src/app/custom';
import { createAnnotation, panelModel, select, setStyle, setTool } from '../../src/app/drawing';
import { duplicateSelection } from '../../src/app/editing';
import {
  currentStyleModel,
  currentStyles,
  customColour,
  doc,
  loaded,
  selection,
  startNewSession,
  tool,
} from '../../src/app/state';
import { DEFAULT_CURRENT_STYLES, type Annotation, type Style } from '../../src/core';
import type { DecodedImage } from '../../src/io';

const image = (width = 1000, height = 800): DecodedImage => ({
  info: { width, height, sourceName: null, sourceType: 'png' },
  bitmap: { width, height, close: vi.fn() } as unknown as ImageBitmap,
});
const shape = (kind: 'rectangle' | 'ellipse', style: Partial<Style> = {}): Annotation => ({
  id: 'draft',
  kind,
  style: { ...currentStyles.value[kind], ...style },
  box: { x: 100, y: 100, width: 200, height: 100 },
});
const text = (style: Partial<Style> = {}): Annotation => ({
  id: 'draft',
  kind: 'text',
  style: { ...currentStyles.value.text, ...style },
  anchor: { x: 10, y: 10 },
  text: 'Bug',
});
const model = () => panelModel(tool.value, selection.value, doc.value, currentStyles.value, false, 800);
const history = () => loaded.value?.session.history;
const byIndex = (i: number) => doc.value?.annotations[i];
/** The number of undo steps (undone and redone again, so nothing changes). */
function depth(): number {
  const h = history();
  let n = 0;
  while (h?.canUndo) {
    h.undo();
    n++;
  }
  for (let i = 0; i < n; i++) h?.redo();
  return n;
}
/** One full picker session on a colour group: the swatch clicked, the colours moved through, then closed. */
function pick(target: 'style' | 'fill', ...colours: string[]): void {
  beginCustomPick(target, true);
  for (const c of colours) previewCustomColour(c);
  endCustomPick();
}

beforeEach(() => {
  tool.value = 'select';
  currentStyleModel.value = DEFAULT_CURRENT_STYLES;
  customColour.value = null;
  startNewSession(image());
});

describe('F-020 fill colour', () => {
  it('F-020.AC1 the rectangle tool with fill none offers no fill colour; solid shows it with the colour marked', () => {
    setTool('rectangle');
    expect(model().fill).toBe('none');
    expect(model().fillColor).toBeUndefined();
    setStyle({ fill: 'solid' });
    expect(model().fillColor).toBe('red');
  });

  it('F-020.AC2 red, fill solid, White picked: the rectangle has a red outline and a white fill', () => {
    setTool('rectangle');
    setStyle({ fill: 'solid' });
    setStyle({ fillColor: 'white' });
    createAnnotation(shape('rectangle'));
    expect(byIndex(0)?.style).toMatchObject({ color: 'red', fill: 'solid', fillColor: 'white' });
  });

  it('F-020.AC3 an automatic fill follows the colour; a picked fill colour no longer does', () => {
    setTool('ellipse');
    setStyle({ fill: 'translucent' });
    setStyle({ color: 'blue' });
    expect(model().fillColor).toBe('blue');
    createAnnotation(shape('ellipse'));
    expect(byIndex(0)?.style).toMatchObject({ color: 'blue', fill: 'translucent', fillColor: 'automatic' });
    setTool('ellipse'); // clears the selection
    setStyle({ fillColor: 'yellow' });
    setStyle({ color: 'green' });
    createAnnotation(shape('ellipse'));
    expect(byIndex(1)?.style).toMatchObject({ color: 'green', fillColor: 'yellow' });
  });

  it('F-020.AC4 F-020.R6 Black on a selected rectangle: its fill is black as one undo step and the next rectangle is black', () => {
    setTool('rectangle');
    setStyle({ fill: 'solid' });
    createAnnotation(shape('rectangle')); // selected (F-003.R6)
    const steps = depth();
    setStyle({ fillColor: 'black' });
    expect(byIndex(0)?.style.fillColor).toBe('black');
    expect(depth()).toBe(steps + 1);
    expect(currentStyles.value.rectangle.fillColor).toBe('black');
    const restore = history()?.undo();
    expect(restore?.doc.annotations[0]?.style.fillColor).toBe('automatic');
  });

  it('F-020.AC5 F-020.R1 #1e90ff with the fill colour custom swatch keeps the outline; a text background shows it unmarked', () => {
    tool.value = 'ellipse';
    setStyle({ fill: 'solid' });
    createAnnotation(shape('ellipse'));
    pick('fill', '#1e90ff');
    expect(byIndex(0)?.style).toMatchObject({ color: 'red', fillColor: '#1e90ff' });
    expect(customSwatch(model(), 'fill')).toEqual({ colour: '#1e90ff', checked: true });
    expect(customSwatch(model(), 'style')).toEqual({ colour: '#1e90ff', checked: false });
    setTool('text');
    setStyle({ fill: 'solid' });
    createAnnotation(text());
    expect(model().textBackgroundColor).toBe('white');
    expect(customSwatch(model(), 'fill')).toEqual({ colour: '#1e90ff', checked: false });
  });

  it('F-020.AC6 F-020.R6 the fill colour is per tool: White for rectangles leaves the ellipse automatic (red)', () => {
    setTool('rectangle');
    setStyle({ fill: 'solid' });
    setStyle({ fillColor: 'white' });
    setTool('ellipse');
    setStyle({ fill: 'solid' });
    createAnnotation(shape('ellipse'));
    expect(byIndex(0)?.style.fillColor).toBe('automatic');
    expect(model().fillColor).toBe('red');
  });

  it('F-020.AC17 an automatic fill shows its colour marked; Blue as the colour turns the fill blue too', () => {
    setTool('rectangle');
    setStyle({ fill: 'solid' });
    createAnnotation(shape('rectangle'));
    expect(model().fillColor).toBe('red');
    setStyle({ color: 'blue' });
    expect(byIndex(0)?.style).toMatchObject({ color: 'blue', fillColor: 'automatic' });
    expect(model().fillColor).toBe('blue');
  });

  it('F-020.AC20 RULE-22 fill none and back to solid keeps the picked White', () => {
    setTool('rectangle');
    setStyle({ fill: 'solid' });
    createAnnotation(shape('rectangle', { fillColor: 'white' }));
    setStyle({ fill: 'none' });
    expect(model().fillColor).toBeUndefined();
    setStyle({ fill: 'solid' });
    expect(byIndex(0)?.style.fillColor).toBe('white');
    expect(model().fillColor).toBe('white');
  });
});

describe('F-020 text background', () => {
  it('F-020.AC7 the text tool offers the text background with none marked and no background colour', () => {
    setTool('text');
    expect(model().textBackground).toBe('none');
    expect(model().textBackgroundColor).toBeUndefined();
    expect(model().fill).toBeUndefined();
    expect(model().fillColor).toBeUndefined();
  });

  it('F-020.AC10 a red text with a solid automatic background: white box; Blue → white, Yellow → black', () => {
    setTool('text');
    setStyle({ fill: 'solid' });
    createAnnotation(text());
    select([byIndex(0)?.id ?? '']);
    expect(model().textBackgroundColor).toBe('white');
    setStyle({ color: 'blue' });
    expect(model().textBackgroundColor).toBe('white');
    setStyle({ color: 'yellow' });
    expect(model().textBackgroundColor).toBe('black');
    expect(byIndex(0)?.style.fillColor).toBe('automatic');
  });

  it('F-020.AC12 none on a selected text with a solid background is one undo step', () => {
    setTool('text');
    setStyle({ fill: 'solid' });
    createAnnotation(text());
    const steps = depth();
    setStyle({ fill: 'none' });
    expect(byIndex(0)?.style.fill).toBe('none');
    expect(depth()).toBe(steps + 1);
    expect(model().textBackgroundColor).toBeUndefined();
  });

  it('F-020.AC14 F-020.R7 a rectangle and a text offer neither fill nor background', () => {
    createAnnotation(shape('rectangle', { fill: 'solid' }));
    createAnnotation(text({ fill: 'solid' }));
    select(doc.value?.annotations.map((a) => a.id) ?? []);
    const m = model();
    expect(m.fill).toBeUndefined();
    expect(m.fillColor).toBeUndefined();
    expect(m.textBackground).toBeUndefined();
    expect(m.textBackgroundColor).toBeUndefined();
  });

  it('F-020.AC14 F-020.R7 two texts on black and white boxes mark no colour; Blue makes both blue as one step', () => {
    createAnnotation(text({ fill: 'solid', fillColor: 'black' }));
    createAnnotation(text({ fill: 'solid', fillColor: 'white' }));
    select(doc.value?.annotations.map((a) => a.id) ?? []);
    expect(model().textBackground).toBe('solid');
    expect(model().textBackgroundColor).toBeNull();
    const steps = depth();
    setStyle({ fillColor: 'blue' });
    expect(doc.value?.annotations.map((a) => a.style.fillColor)).toEqual(['blue', 'blue']);
    expect(depth()).toBe(steps + 1);
  });

  it('F-020.AC14 F-020.R7 automatic colours compare as drawn: a red text on automatic and one on White mark White', () => {
    createAnnotation(text({ fill: 'solid' }));
    createAnnotation(text({ fill: 'translucent', fillColor: 'white' }));
    select(doc.value?.annotations.map((a) => a.id) ?? []);
    expect(model().textBackground).toBeNull();
    expect(model().textBackgroundColor).toBe('white');
  });

  it('F-020.AC14 F-020.R7 two rectangles, fill none and solid: no fill marked and no fill colour', () => {
    createAnnotation(shape('rectangle'));
    createAnnotation(shape('rectangle', { fill: 'solid' }));
    select(doc.value?.annotations.map((a) => a.id) ?? []);
    expect(model().fill).toBeNull();
    expect(model().fillColor).toBeUndefined();
  });

  it('F-020.AC15 F-020.R5 duplicates keep the fill colour and the background', () => {
    createAnnotation(shape('rectangle', { fill: 'solid', fillColor: 'white' }));
    createAnnotation(text({ fill: 'solid', fillColor: 'yellow' }));
    select(doc.value?.annotations.map((a) => a.id) ?? []);
    duplicateSelection();
    const all = doc.value?.annotations ?? [];
    expect(all).toHaveLength(4);
    expect(all[2]?.style).toMatchObject({ fill: 'solid', fillColor: 'white' });
    expect(all[3]?.style).toMatchObject({ fill: 'solid', fillColor: 'yellow' });
  });

  it('F-020.AC21 F-020.R6 the text background is the text tool’s own: a rectangle drawn next has no fill', () => {
    setTool('text');
    setStyle({ fill: 'solid' });
    setStyle({ fillColor: 'yellow' });
    setTool('rectangle');
    expect(model().fill).toBe('none');
    createAnnotation(shape('rectangle'));
    expect(byIndex(0)?.style).toMatchObject({ fill: 'none', fillColor: 'automatic' });
    setTool('text');
    expect(model().textBackground).toBe('solid');
    expect(model().textBackgroundColor).toBe('yellow');
  });

  it('F-020.R6 RULE-11 changes with nothing selected are no undo step', () => {
    setTool('text');
    const steps = depth();
    setStyle({ fill: 'solid' });
    setStyle({ fillColor: 'yellow' });
    expect(depth()).toBe(steps);
  });

  it('F-020.R6 a fill or background patch never reaches lines, arrows, steps or redactions', () => {
    tool.value = 'arrow';
    setStyle({ fill: 'solid', fillColor: 'yellow' });
    expect(currentStyles.value.arrow).toMatchObject({ fill: 'none', fillColor: 'automatic' });
  });
});
