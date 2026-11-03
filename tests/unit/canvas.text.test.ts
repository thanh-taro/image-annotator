// MOD-Canvas text tool (F-005): a click places a text at the click (top-left) and edits it; a click on
// an existing text edits it with the caret where clicked; a press while editing only ends the edit; Enter
// starts a text at the centre; a double-click with the select tool edits a text. The field is a fake.
import { describe, expect, it } from 'vitest';
import { DEFAULT_STYLES, textAt, type Annotation, type Point, type TextMeasure, type ToolName } from '../../src/core';
import { DRAFT_ID } from '../../src/canvas/draw';
import type { PointerInput } from '../../src/canvas/input';
import { TextTool, type TextEdit, type TextEndReason } from '../../src/canvas/text';

const fake: TextMeasure = (font, s) => Array.from(s).length * 0.5 * parseFloat(font.split(' ')[1] ?? '0');

function setup(tool: ToolName = 'text', annotations: Annotation[] = [], ready = true) {
  const field = {
    value: '',
    caret: -1,
    shown: false,
    open(value: string, caret: number) {
      this.value = value;
      this.caret = caret;
      this.shown = true;
    },
    close() {
      this.shown = false;
    },
  };
  const ended: { edit: TextEdit; text: Annotation | null; reason: TextEndReason }[] = [];
  const begun: TextEdit[] = [];
  const state = { tool, annotations };
  const text = new TextTool(
    () => ({
      tool: state.tool,
      style: DEFAULT_STYLES.text,
      shortSide: 800,
      annotations: state.annotations,
      canvas: { x: 0, y: 0, width: 1000, height: 800 },
      measure: fake,
      tolerance: 3,
      toImage: (p: Point) => ({ x: p.x / 2, y: p.y / 2 }),
    }),
    field,
    { begin: (e) => begun.push(e), end: (edit, t, reason) => ended.push({ edit, text: t, reason }) },
    { ready },
  );
  return { text, field, ended, begun, state };
}

const at = (x: number, y: number, id = 1, button = 0, type = 'mouse'): PointerInput => ({
  id,
  type,
  button,
  point: { x, y },
});
const click = (t: TextTool, x: number, y: number, id = 1) => {
  const took = t.down(at(x, y, id));
  t.up(at(x, y, id));
  return took;
};

describe('MOD-Canvas text tool', () => {
  it('F-005.AC1 F-005.R1 a click places a new text whose top-left corner is the click point, editing it', () => {
    const { text, field, begun } = setup();
    expect(click(text, 200, 100)).toBe(true);
    expect(begun).toEqual([{ id: null, anchor: { x: 100, y: 50 } }]);
    expect(field).toMatchObject({ shown: true, value: '', caret: 0 });
    field.value = 'Wrong total';
    expect(text.draft([], DEFAULT_STYLES.text)).toEqual(
      textAt({ x: 100, y: 50 }, DRAFT_ID, DEFAULT_STYLES.text, 'Wrong total'),
    );
  });

  it('F-005.AC3 Esc ends the edit, keeping the text (MOD-App commits and selects it)', () => {
    const { text, field, ended } = setup();
    click(text, 200, 100);
    field.value = 'Bug';
    expect(text.end('escape')).toBe(true);
    expect(field.shown).toBe(false);
    expect(ended).toMatchObject([{ reason: 'escape', text: { kind: 'text', text: 'Bug', anchor: { x: 100, y: 50 } } }]);
    expect(text.active).toBe(false);
  });

  it('F-005.AC10 F-005.AC4 while editing, a click on the canvas only ends the edit; a second click creates a text', () => {
    const { text, ended, begun } = setup();
    click(text, 200, 100);
    expect(click(text, 600, 400)).toBe(true);
    expect(ended).toHaveLength(1);
    expect(ended[0]).toMatchObject({ reason: 'press', text: { text: '' } });
    expect(begun).toHaveLength(1);
    expect(text.active).toBe(false);
    click(text, 600, 400);
    expect(begun).toHaveLength(2);
    expect(begun[1]).toEqual({ id: null, anchor: { x: 300, y: 200 } });
  });

  it('F-005.AC11 F-005.R1 a click on an existing text edits it, with the caret where clicked, instead of a new one', () => {
    const existing = textAt({ x: 100, y: 50 }, 't1', DEFAULT_STYLES.text, 'abcd');
    const { text, field, begun } = setup('text', [existing]);
    // Image (133, 60): 33 px into the line, nearest the boundary after "ab" (16 px per character).
    click(text, 266, 120);
    expect(begun).toEqual([{ id: 't1', anchor: { x: 100, y: 50 } }]);
    expect(field).toMatchObject({ value: 'abcd', caret: 2 });
    field.value = 'abXcd';
    expect(text.draft([existing], DEFAULT_STYLES.text)).toMatchObject({ id: 't1', text: 'abXcd' });
  });

  it('F-005.AC13 RULE-19 Enter with the text tool starts a text at the centre of the view', () => {
    const { text, begun } = setup();
    expect(text.placeAt({ x: 500, y: 400 })).toBe(true);
    expect(begun).toEqual([{ id: null, anchor: { x: 500, y: 400 } }]);
    expect(setup('rectangle').text.placeAt({ x: 1, y: 1 })).toBe(false);
  });

  it('F-005.AC5 F-005.R4 a double-click with the select tool on a text edits it with the caret where clicked', () => {
    const existing = textAt({ x: 100, y: 50 }, 't1', DEFAULT_STYLES.text, 'abcd\nef');
    const { text, field, begun } = setup('select', [existing]);
    // Image (117, 95): the second line, after "e".
    expect(text.editAtScreen({ x: 234, y: 190 })).toBe(true);
    expect(begun).toEqual([{ id: 't1', anchor: { x: 100, y: 50 } }]);
    expect(field.caret).toBe(6);
    expect(setup('select', [existing]).text.editAtScreen({ x: 1000, y: 1000 })).toBe(false);
    expect(setup('text', [existing]).text.editAtScreen({ x: 234, y: 190 })).toBe(false);
  });

  it('F-005.R4 RULE-19 Enter with the select tool on the selected text edits it, caret at the end', () => {
    const existing = textAt({ x: 100, y: 50 }, 't1', DEFAULT_STYLES.text, 'Bug');
    const { text, field } = setup('select', [existing]);
    expect(text.editById('t1')).toBe(true);
    expect(field.caret).toBe(3);
  });

  it('ADR-0009 §4 no text is placed until the fonts are ready; a new image discards an open edit', () => {
    expect(click(setup('text', [], false).text, 10, 10)).toBe(false);
    const { text, ended } = setup();
    click(text, 10, 10);
    text.end('discard');
    expect(ended).toMatchObject([{ reason: 'discard', text: null }]);
  });

  it('F-005.R3 a right-button press while editing also only ends the edit; other tools ignore plain clicks', () => {
    const { text, ended } = setup();
    click(text, 10, 10);
    expect(text.down(at(50, 50, 2, 2))).toBe(true);
    expect(ended).toHaveLength(1);
    expect(setup('rectangle').text.down(at(1, 1))).toBe(false);
  });

  it('F-005.AC16 D-030 a text-tool click outside the canvas creates nothing and edits nothing', () => {
    const { text, begun, field } = setup();
    // Screen (-20, 100) is image (-10, 50), left of the canvas; (2200, 100) right of it.
    expect(click(text, -20, 100)).toBe(true);
    click(text, 2200, 100);
    click(text, 100, 1700);
    expect(begun).toEqual([]);
    expect(field.shown).toBe(false);
  });

  it('F-005 edge case a press that moves before release places one text at the press point', () => {
    const { text, begun } = setup();
    text.down(at(200, 100));
    text.move();
    text.up(at(400, 300));
    expect(begun).toEqual([{ id: null, anchor: { x: 100, y: 50 } }]);
  });

  it('CMP-Canvas a touch ends the edit on release; a second finger (pinch or pan) keeps it open', () => {
    const { text, ended } = setup();
    click(text, 200, 100);
    expect(text.down(at(600, 400, 5, 0, 'touch'))).toBe(true);
    expect(ended).toHaveLength(0);
    text.cancel(); // the second finger turns the gesture into a pinch
    text.up(at(600, 400, 5, 0, 'touch'));
    expect(text.active).toBe(true);
    text.down(at(600, 400, 6, 0, 'touch'));
    text.up(at(600, 400, 6, 0, 'touch'));
    expect(ended).toMatchObject([{ reason: 'press' }]);
    expect(text.active).toBe(false);
  });
});
