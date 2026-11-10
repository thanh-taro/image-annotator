// MOD-App text commands (F-005): the text tool is offered; an edit mirrors into SCR-Annotator
// "editing-text"; when it ends the text stays and is selected, as one undo step for a new text
// (announced), none for an empty new text, one deletion step for an emptied existing text. The style
// panel shows the edited text's style (the tool's for a new text, the text's own for an existing one).
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BUILT_TOOLS, panelModel, setStyle, setTool, textEditEnded, textEditStarted } from '../../src/app/drawing';
import {
  currentStyleModel,
  currentStyles,
  doc,
  loaded,
  polite,
  selection,
  startNewSession,
  textEditing,
  tool,
} from '../../src/app/state';
import { DEFAULT_CURRENT_STYLES, textAt, type TextAnnotation } from '../../src/core';
import type { DecodedImage } from '../../src/io';

const image = (): DecodedImage => ({
  info: { width: 1000, height: 800, sourceName: null, sourceType: 'png' },
  bitmap: { width: 1000, height: 800, close: vi.fn() } as unknown as ImageBitmap,
});
const draft = (text: string, id = 'draft'): TextAnnotation =>
  textAt({ x: 100, y: 50 }, id, currentStyles.value.text, text);
const history = () => loaded.value?.session.history;

/** Creates a text "Bug" the way the canvas does (begin, type, Esc) and returns its id. */
function createBug(): string {
  textEditStarted({ id: null, anchor: { x: 100, y: 50 } });
  textEditEnded({ id: null, anchor: { x: 100, y: 50 } }, draft('Bug'), 'escape');
  return selection.value[0] ?? '';
}

describe('MOD-App text', () => {
  beforeEach(() => {
    tool.value = 'select';
    currentStyleModel.value = DEFAULT_CURRENT_STYLES;
    textEditing.value = null;
    startNewSession(image());
  });

  it('F-005 CMP-Toolbar the text tool is built and can be picked (COPY-tool.text)', () => {
    expect(BUILT_TOOLS).toContain('text');
    setTool('text');
    expect(tool.value).toBe('text');
    expect(polite.value.at(-1)?.text).toBe('Text tool');
  });

  it('F-005.AC3 F-005.R3 SCR-Annotator editing-text; when it ends the text stays, is selected and announced', () => {
    setTool('text');
    textEditStarted({ id: null, anchor: { x: 100, y: 50 } });
    expect(textEditing.value).toEqual({ id: null });
    expect(selection.value).toEqual([]);
    textEditEnded({ id: null, anchor: { x: 100, y: 50 } }, draft('Bug'), 'escape');
    expect(textEditing.value).toBeNull();
    expect(doc.value?.annotations).toMatchObject([{ kind: 'text', text: 'Bug', anchor: { x: 100, y: 50 } }]);
    expect(selection.value).toEqual([doc.value?.annotations[0]?.id]);
    expect(tool.value).toBe('text');
    expect(polite.value.at(-1)?.text).toBe('Text added');
  });

  it('F-005.AC4 a text placed with nothing typed leaves no annotation and no undo step', () => {
    textEditStarted({ id: null, anchor: { x: 1, y: 1 } });
    textEditEnded({ id: null, anchor: { x: 1, y: 1 } }, draft(''), 'press');
    expect(doc.value?.annotations).toEqual([]);
    expect(history()?.canUndo).toBe(false);
  });

  it('F-005.AC12 F-005.R6 one undo removes a created text; an existing text edited to empty is back after one undo', () => {
    const id = createBug();
    history()?.undo();
    expect(loaded.value?.session.doc.annotations).toEqual([]);
    history()?.redo();
    textEditStarted({ id, anchor: { x: 100, y: 50 } });
    expect(selection.value).toEqual([id]);
    textEditEnded({ id, anchor: { x: 100, y: 50 } }, draft('', id), 'escape');
    expect(doc.value?.annotations).toEqual([]);
    expect(selection.value).toEqual([]);
    expect(polite.value.at(-1)?.text).toBe('1 annotation deleted');
    expect(history()?.undo()?.doc.annotations).toMatchObject([{ id, text: 'Bug' }]);
  });

  it('SCR-Annotator editing-text the panel shows the edited text’s colour and size, and changes apply to it', () => {
    // A new text: the text tool's current style (no step).
    setTool('text');
    textEditStarted({ id: null, anchor: { x: 1, y: 1 } });
    expect(panelModel('text', selection.value, doc.value, currentStyles.value)).toMatchObject({
      variant: 'tool',
      subject: 'Text',
      color: 'red',
      size: 'M',
    });
    setStyle({ color: 'blue', strokeSize: 'L' });
    expect(currentStyles.value.text).toMatchObject({ color: 'blue', strokeSize: 'L' });
    expect(history()?.canUndo).toBe(false);
    textEditEnded({ id: null, anchor: { x: 1, y: 1 } }, draft('Hi'), 'escape');
    // An existing text: its own style; a change restyles it.
    const id = selection.value[0] ?? '';
    setTool('select');
    textEditStarted({ id, anchor: { x: 1, y: 1 } });
    expect(panelModel('select', selection.value, doc.value, currentStyles.value)).toMatchObject({
      variant: 'selection',
      color: 'blue',
      size: 'L',
    });
    expect(panelModel('select', selection.value, doc.value, currentStyles.value)).not.toHaveProperty('fill');
    setStyle({ color: 'white' });
    expect(doc.value?.annotations[0]?.style.color).toBe('white');
  });

  it('F-001.R7 an edit discarded by a new image changes nothing', () => {
    textEditStarted({ id: null, anchor: { x: 1, y: 1 } });
    textEditEnded({ id: null, anchor: { x: 1, y: 1 } }, null, 'discard');
    expect(textEditing.value).toBeNull();
    expect(doc.value?.annotations).toEqual([]);
  });
});
