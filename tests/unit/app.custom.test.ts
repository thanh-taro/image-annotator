// MOD-App custom colour and size (F-019, RULE-21): the custom swatch's picker session (live preview, one
// undo step, cancel), the remembered custom colour, custom sizes from the field and slider, and what
// CMP-StylePanel shows for them (the custom swatch, the size field, the narrow summary's detail).
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  beginCustomPick,
  cancelCustomPick,
  chooseCustomSwatch,
  customSwatch,
  endCustomPick,
  pickerStart,
  previewCustomColour,
} from '../../src/app/custom';
import {
  beginSizeDrag,
  createAnnotation,
  endSizeDrag,
  panelModel,
  select,
  setCustomSize,
  setSliderSize,
  setStyle,
  setTool,
  summaryDetail,
} from '../../src/app/drawing';
import { duplicateSelection } from '../../src/app/editing';
import {
  currentStyleModel,
  currentStyles,
  customColour,
  doc,
  exported,
  loaded,
  selection,
  startNewSession,
  tool,
  unexported,
} from '../../src/app/state';
import { DEFAULT_CURRENT_STYLES, type Annotation } from '../../src/core';
import { colourValue, contrastPair } from '../../src/render';
import type { DecodedImage } from '../../src/io';

const image = (width = 1000, height = 800): DecodedImage => ({
  info: { width, height, sourceName: null, sourceType: 'png' },
  bitmap: { width, height, close: vi.fn() } as unknown as ImageBitmap,
});
const SHORT = 800;
const rect = (): Annotation => ({
  id: 'draft',
  kind: 'rectangle',
  style: currentStyles.value.rectangle,
  box: { x: 100, y: 100, width: 200, height: 100 },
});
const arrow = (): Annotation => ({
  id: 'draft',
  kind: 'arrow',
  style: currentStyles.value.arrow,
  tail: { x: 0, y: 0 },
  head: { x: 50, y: 0 },
});
const text = (): Annotation => ({
  id: 'draft',
  kind: 'text',
  style: currentStyles.value.text,
  anchor: { x: 10, y: 10 },
  text: 'Bug',
});
const step = (): Annotation => ({
  id: 'draft',
  kind: 'step',
  style: currentStyles.value.step,
  centre: { x: 300, y: 300 },
  number: 1,
});
const model = () =>
  panelModel(tool.value, selection.value, doc.value, currentStyles.value, false, loaded.value ? SHORT : null);
const history = () => loaded.value?.session.history;
const first = () => doc.value?.annotations[0];
/** One full picker session: the swatch clicked, the colours moved through, then closed. */
function pick(...colours: string[]): void {
  beginCustomPick('style', true);
  for (const c of colours) previewCustomColour(c);
  endCustomPick();
}

beforeEach(() => {
  tool.value = 'select';
  currentStyleModel.value = DEFAULT_CURRENT_STYLES;
  customColour.value = null;
  startNewSession(image());
});

describe('F-019 custom colour', () => {
  it('F-019.AC1 #1e90ff picked with the rectangle tool draws #1e90ff, the custom swatch marked; the next arrow is #1e90ff', () => {
    setTool('rectangle');
    pick('#1e90ff');
    createAnnotation(rect());
    expect(first()?.style.color).toBe('#1e90ff');
    expect(colourValue('#1e90ff')).toBe('#1e90ff');
    expect(customSwatch(model())).toEqual({ colour: '#1e90ff', checked: true });
    setTool('arrow');
    expect(customSwatch(model())).toEqual({ colour: '#1e90ff', checked: true });
    expect(currentStyles.value.arrow.color).toBe('#1e90ff');
  });

  it('F-019.AC2 a selected step given #ffe4b5 has a black number, as one undo step; #2f4f4f gives white', () => {
    setTool('step');
    createAnnotation(step());
    const before = doc.value;
    pick('#ffe4b5');
    expect(first()?.style.color).toBe('#ffe4b5');
    expect(contrastPair('#ffe4b5')).toBe('black');
    expect(history()?.undo()?.doc).toBe(before);
    history()?.redo();
    pick('#2f4f4f');
    expect(contrastPair(first()?.style.color ?? 'red')).toBe('white');
  });

  it('F-019.AC3 #d62828 picked with the custom swatch marks Red, not the custom swatch', () => {
    setTool('rectangle');
    pick('#d62828');
    expect(model().color).toBe('red');
    expect(customSwatch(model()).checked).toBe(false);
    expect(customColour.value).toBeNull();
  });

  it('F-019.AC13 the custom swatch has no colour before one is picked, then shows it (named in uppercase by the panel)', () => {
    setTool('rectangle');
    expect(customSwatch(model())).toEqual({ colour: null, checked: false });
    pick('#1E90FF');
    expect(customSwatch(model()).colour).toBe('#1e90ff');
  });

  it('F-019.AC14 the remembered colour applies when the swatch is clicked and the picker closes unchanged, as one undo step', () => {
    setTool('rectangle');
    pick('#1e90ff');
    setStyle({ color: 'red' });
    createAnnotation(rect());
    const before = doc.value;
    beginCustomPick('style', true);
    endCustomPick(); // closed without a choice
    expect(first()?.style.color).toBe('#1e90ff');
    expect(history()?.undo()?.doc).toBe(before);
  });

  it('F-019.AC14 arrowing onto a remembered custom swatch checks it; with none remembered nothing changes', () => {
    setTool('rectangle');
    setStyle({ color: 'white' });
    expect(chooseCustomSwatch('style')).toBe(false);
    expect(currentStyles.value.rectangle.color).toBe('white');
    customColour.value = '#1e90ff';
    expect(chooseCustomSwatch('style')).toBe(true);
    expect(currentStyles.value.rectangle.color).toBe('#1e90ff');
  });

  it('F-019.AC15 the swatch shows the subject’s custom colour, else the last one picked', () => {
    setTool('rectangle');
    pick('#1e90ff');
    setTool('highlight');
    pick('#00ff00');
    setTool('rectangle');
    expect(customSwatch(model())).toEqual({ colour: '#1e90ff', checked: true });
    setTool('redact');
    expect(model().color).toBe('black');
    expect(customSwatch(model())).toEqual({ colour: '#00ff00', checked: false });
  });

  it('F-019.AC16 F-019.R8 moving through colours previews each; one undo restores the arrow’s red', () => {
    setTool('arrow');
    createAnnotation(arrow());
    customColour.value = '#1e90ff';
    const before = doc.value;
    beginCustomPick('style', true);
    for (const c of ['#112233', '#445566', '#778899']) {
      previewCustomColour(c);
      expect(first()?.style.color).toBe(c); // the subject follows at once
    }
    previewCustomColour('#2f4f4f');
    endCustomPick();
    expect(first()?.style.color).toBe('#2f4f4f');
    const undone = history()?.undo();
    expect(undone?.doc).toBe(before);
    expect(undone?.doc.annotations[0]?.style.color).toBe('red');
  });

  it('F-019.R8 RULE-11 a later picker opening is a separate step', () => {
    setTool('arrow');
    createAnnotation(arrow());
    pick('#112233');
    pick('#445566');
    expect(history()?.undo()?.doc.annotations[0]?.style.color).toBe('#112233');
  });

  it('F-019.AC23 F-019.R8 a cancelled picker returns the arrow to red and adds no undo step', () => {
    setTool('arrow');
    createAnnotation(arrow());
    const before = doc.value;
    beginCustomPick('style', true);
    previewCustomColour('#2f4f4f');
    expect(first()?.style.color).toBe('#2f4f4f');
    cancelCustomPick();
    expect(first()?.style.color).toBe('red');
    expect(doc.value).toBe(before);
    expect(history()?.canRedo).toBe(false);
    expect(history()?.undo()?.doc.annotations).toEqual([]); // only the creation is left
    expect(currentStyles.value.arrow.color).toBe('red');
    expect(customColour.value).toBeNull();
  });

  it('F-019.R8 a cancel with nothing selected restores the current colour and the remembered one', () => {
    setTool('rectangle');
    customColour.value = '#1e90ff';
    beginCustomPick('style', true);
    expect(currentStyles.value.rectangle.color).toBe('#1e90ff');
    previewCustomColour('#2f4f4f');
    cancelCustomPick();
    expect(currentStyles.value.rectangle.color).toBe('red');
    expect(customColour.value).toBe('#1e90ff');
    expect(history()?.canUndo).toBe(false);
  });

  it('F-019.AC18 D-047 #1e90ff picked as the drawing colour is the next rectangle’s colour; no undo step', () => {
    expect(model().variant).toBe('canvas');
    beginCustomPick('drawing', true);
    previewCustomColour('#1e90ff');
    endCustomPick();
    expect(model().canvas?.drawColor).toBe('#1e90ff');
    expect(customSwatch(model())).toEqual({ colour: '#1e90ff', checked: true });
    expect(history()?.canUndo).toBe(false);
    setTool('rectangle');
    createAnnotation(rect());
    expect(first()?.style.color).toBe('#1e90ff');
  });

  it('F-019.AC21 a selected solid redaction takes #1e90ff; a blur redaction offers no colour and no size', () => {
    setTool('redact');
    createAnnotation({
      id: 'draft',
      kind: 'redaction',
      style: currentStyles.value.redact,
      box: { x: 10, y: 10, width: 50, height: 20 },
    });
    pick('#1e90ff');
    expect(first()?.style).toMatchObject({ redactionKind: 'solid', color: '#1e90ff' });
    setStyle({ redactionKind: 'blur' });
    const m = model();
    expect(m).not.toHaveProperty('color');
    expect(m).not.toHaveProperty('size');
    expect(m).not.toHaveProperty('sizeField');
  });
});

describe('F-019 custom size', () => {
  it('F-019.AC4 M shows 5 in the field; 7 unmarks M, shows 7, and the next rectangle has a 7-pixel stroke', () => {
    setTool('rectangle');
    expect(model()).toMatchObject({ size: 'M', sizeField: { value: 5, min: 1, max: 100, slider: true } });
    setCustomSize(7);
    expect(model()).toMatchObject({ size: 7, sizeField: { value: 7 } });
    createAnnotation(rect());
    expect(first()?.style.strokeSize).toBe(7);
  });

  it('F-019.AC5 the text tool at 64 is the next text’s size; the step tool at 64 likewise (range 6–400)', () => {
    setTool('text');
    expect(model().sizeField).toMatchObject({ min: 6, max: 400, value: 32 });
    setCustomSize(64);
    expect(currentStyles.value.text.strokeSize).toBe(64);
    setTool('step');
    setCustomSize(64);
    expect(currentStyles.value.step.strokeSize).toBe(64);
  });

  it('F-019.AC6 the highlight tool at L shows 30; 40 is the next highlight’s width (range 1–300)', () => {
    setTool('highlight');
    expect(model()).toMatchObject({ size: 'L', sizeField: { value: 30, min: 1, max: 300 } });
    setCustomSize(40);
    expect(currentStyles.value.highlight.strokeSize).toBe(40);
  });

  it('F-019.AC7 a selected rectangle at a custom 7 given L has a 10-pixel stroke, L marked, as one undo step', () => {
    setTool('rectangle');
    setCustomSize(7);
    createAnnotation(rect());
    const before = doc.value;
    setStyle({ strokeSize: 'L' });
    expect(model()).toMatchObject({ variant: 'selection', size: 'L', sizeField: { value: 10 } });
    expect(history()?.undo()?.doc).toBe(before);
  });

  it('F-019.AC9 F-019.R5 slider moves on one selection coalesce into one undo step that restores M', () => {
    setTool('arrow');
    createAnnotation(arrow());
    const before = doc.value;
    const key = `slider:${selection.value.join(',')}:1`;
    for (const v of [6, 9, 14, 20]) {
      setCustomSize(v, key);
      expect(first()?.style.strokeSize).toBe(v);
    }
    history()?.breakChain();
    const undone = history()?.undo();
    expect(undone?.doc).toBe(before);
    expect(undone?.doc.annotations[0]?.style.strokeSize).toBe('M');
  });

  it('F-019.AC10 F-019.R7 a rectangle and a text: S, M and L, no field; an M and a custom 7: field empty, none marked', () => {
    setTool('rectangle');
    createAnnotation(rect());
    setTool('text');
    createAnnotation(text());
    setTool('select');
    select((doc.value?.annotations ?? []).map((a) => a.id));
    expect(model()).toMatchObject({ size: 'M' });
    expect(model()).not.toHaveProperty('sizeField');

    startNewSession(image());
    setTool('rectangle');
    createAnnotation(rect());
    setTool('rectangle'); // nothing selected: the size is the tool's
    setCustomSize(7);
    createAnnotation(rect());
    setTool('select');
    select((doc.value?.annotations ?? []).map((a) => a.id));
    expect(doc.value?.annotations.map((a) => a.style.strokeSize)).toEqual(['M', 7]);
    // F-019.R7 (a11y audit): the field is empty and the slider is not shown.
    expect(model()).toMatchObject({ size: null, sizeField: { value: null, slider: false } });
  });

  it('F-019.R7 an M and a custom 5 have the same width: the field shows 5 and no preset is marked', () => {
    setTool('rectangle');
    createAnnotation(rect());
    setTool('rectangle');
    setCustomSize(5);
    createAnnotation(rect());
    setTool('select');
    select((doc.value?.annotations ?? []).map((a) => a.id));
    expect(model()).toMatchObject({ size: null, sizeField: { value: 5 } });
  });

  it('F-019.AC11 a custom 7-pixel stroke stays 7 pixels after a new image is loaded', () => {
    setTool('rectangle');
    setCustomSize(7);
    startNewSession(image(4000, 3000));
    createAnnotation(rect());
    expect(first()?.style.strokeSize).toBe(7);
  });

  it('F-019.AC12 COPY-style.size_value is the narrow summary’s detail for a custom size', () => {
    setTool('rectangle');
    setCustomSize(7);
    expect(summaryDetail(model())).toBe('7 px');
  });

  it('F-019.AC17 a typed 5 equal to M’s width is still a custom 5', () => {
    setTool('rectangle');
    createAnnotation(rect());
    setCustomSize(5);
    expect(first()?.style.strokeSize).toBe(5);
    expect(model()).toMatchObject({ size: 5, sizeField: { value: 5 } });
  });

  it('F-019.AC20 a duplicated rectangle keeps its #1e90ff colour and custom 7-pixel stroke', () => {
    setTool('rectangle');
    pick('#1e90ff');
    setCustomSize(7);
    createAnnotation(rect());
    duplicateSelection();
    expect(doc.value?.annotations.map((a) => [a.style.color, a.style.strokeSize])).toEqual([
      ['#1e90ff', 7],
      ['#1e90ff', 7],
    ]);
  });

  it('F-019.R7 an M and a custom 5 have the same width: the slider is shown', () => {
    setTool('rectangle');
    createAnnotation(rect());
    setTool('rectangle');
    setCustomSize(5);
    createAnnotation(rect());
    setTool('select');
    select((doc.value?.annotations ?? []).map((a) => a.id));
    expect(model().sizeField).toMatchObject({ value: 5, slider: true });
  });

  it('F-019.R5 RULE-11 a slider pressed without moving leaves no drag key: three slider keys are one step', () => {
    setTool('rectangle');
    createAnnotation(rect());
    const before = doc.value;
    beginSizeDrag();
    endSizeDrag(); // released without any input
    for (const v of [6, 7, 8]) setSliderSize(v);
    expect(first()?.style.strokeSize).toBe(8);
    expect(history()?.undo()?.doc).toBe(before);
  });

  it('F-019.R5 RULE-11 one slider drag is one step; the next drag is another', () => {
    setTool('rectangle');
    createAnnotation(rect());
    beginSizeDrag();
    for (const v of [6, 9]) setSliderSize(v);
    endSizeDrag();
    beginSizeDrag();
    setSliderSize(12);
    endSizeDrag();
    expect(history()?.undo()?.doc.annotations[0]?.style.strokeSize).toBe(9);
  });
});

describe('F-019 custom swatch, review round 1', () => {
  it('F-019.R1 the picker starts at the swatch’s colour, else at the subject’s colour (a palette colour’s value)', () => {
    setTool('arrow');
    setStyle({ color: 'green' });
    createAnnotation(arrow());
    expect(pickerStart('style')).toBe('#2db84d');
    customColour.value = '#1e90ff';
    expect(pickerStart('style')).toBe('#1e90ff');
    setStyle({ color: '#2f4f4f' });
    expect(pickerStart('style')).toBe('#2f4f4f'); // the swatch shows the subject's custom colour
    setTool('select');
    select([]);
    customColour.value = null;
    setStyle({ color: 'red' }); // nothing selected with the select tool: no change
    expect(pickerStart('drawing')).toBe('#2f4f4f'); // the drawing colour (D-047) is the shared one
  });

  it('F-019.R1 F-019.AC15 a checked custom swatch chosen again applies nothing, even with another colour remembered', () => {
    setTool('rectangle');
    pick('#1e90ff');
    setTool('highlight');
    pick('#00ff00');
    setTool('rectangle');
    createAnnotation(rect()); // #1e90ff, selected
    const before = doc.value;
    expect(customSwatch(model())).toEqual({ colour: '#1e90ff', checked: true });
    beginCustomPick('style', true);
    endCustomPick();
    expect(first()?.style.color).toBe('#1e90ff');
    expect(doc.value).toBe(before);
    expect(currentStyles.value.rectangle.color).toBe('#1e90ff');
    expect(chooseCustomSwatch('style')).toBe(true);
    expect(doc.value).toBe(before);
  });

  it('F-019.R1 an unchecked custom swatch applies the colour it shows (the remembered one)', () => {
    setTool('rectangle');
    customColour.value = '#00ff00';
    beginCustomPick('style', true);
    endCustomPick();
    expect(currentStyles.value.rectangle.color).toBe('#00ff00');
  });

  it('F-019.R8 a colour the picker reports after its opening ended is ignored', () => {
    setTool('arrow');
    createAnnotation(arrow());
    beginCustomPick('style', true);
    previewCustomColour('#112233');
    endCustomPick();
    previewCustomColour('#445566');
    expect(first()?.style.color).toBe('#112233');
  });

  it('F-019.R8 RULE-18 a cancelled picker after an export leaves the session exported', () => {
    setTool('arrow');
    createAnnotation(arrow());
    exported();
    expect(unexported.value).toBe(false);
    beginCustomPick('style', true);
    previewCustomColour('#2f4f4f');
    expect(unexported.value).toBe(true);
    cancelCustomPick();
    expect(first()?.style.color).toBe('red');
    expect(unexported.value).toBe(false);
  });
});
