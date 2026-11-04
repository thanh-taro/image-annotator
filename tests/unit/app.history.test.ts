// MOD-App undo and redo (F-009): the commands over MOD-Document's History, the selection that goes with
// each change (R3), the enabled state of the toolbar controls (AC5), announcements (CMP-Canvas
// "Accessibility", NFR-06), coalesced nudges (AC6, RULE-11) and the unexported state (RULE-18).
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createAnnotation, select, setStyle } from '../../src/app/drawing';
import { commitDrag, nudgeSelection, setGeometry } from '../../src/app/editing';
import { commands } from '../../src/app/commands';
import { redo, undo, viewChanged } from '../../src/app/history';
import {
  canRedo,
  canUndo,
  currentStyles,
  doc,
  exported,
  loaded,
  polite,
  selection,
  startNewSession,
  textEditing,
  tool,
  unexported,
} from '../../src/app/state';
import { DEFAULT_STYLES, moved, type Annotation } from '../../src/core';
import type { DecodedImage } from '../../src/io';

const image = (): DecodedImage => ({
  info: { width: 1000, height: 800, sourceName: null, sourceType: 'png' },
  bitmap: { width: 1000, height: 800, close: vi.fn() } as unknown as ImageBitmap,
});
const rect = (x = 100, y = 100): Annotation => ({
  id: 'draft',
  kind: 'rectangle',
  style: DEFAULT_STYLES.rectangle,
  box: { x, y, width: 100, height: 50 },
});
const arrow: Annotation = {
  id: 'draft',
  kind: 'arrow',
  style: DEFAULT_STYLES.arrow,
  tail: { x: 0, y: 0 },
  head: { x: 50, y: 0 },
};
const all = () => doc.value?.annotations ?? [];
const boxX = (a: Annotation | undefined) => (a && 'box' in a ? a.box.x : undefined);
const lastPolite = () => polite.value.at(-1)?.text;

describe('MOD-App undo and redo', () => {
  beforeEach(() => {
    tool.value = 'select';
    currentStyles.value = DEFAULT_STYLES;
    textEditing.value = null;
    startNewSession(image());
  });

  it('F-009.AC1 F-009.R1 drawing then moving a rectangle: undo twice reverts the move, then the rectangle; redo twice brings both back', () => {
    createAnnotation(rect());
    const [r] = all();
    commitDrag([moved(r as Annotation, 50, 0)]);
    expect(boxX(all()[0])).toBe(150);
    undo();
    expect(boxX(all()[0])).toBe(100);
    undo();
    expect(all()).toHaveLength(0);
    redo();
    expect(boxX(all()[0])).toBe(100);
    redo();
    expect(boxX(all()[0])).toBe(150);
  });

  it('F-009.AC2 F-009.R2 a new arrow after an undo makes redo unavailable', () => {
    createAnnotation(rect());
    undo();
    expect(canRedo.value).toBe(true);
    createAnnotation(arrow);
    expect(canRedo.value).toBe(false);
    redo();
    expect(all().map((a) => a.kind)).toEqual(['arrow']);
  });

  it('F-009.AC3 F-009.R3 undoing a recolour of two annotations gives both their old colour back, selected', () => {
    createAnnotation(rect());
    createAnnotation(arrow);
    const ids = all().map((a) => a.id);
    select([]);
    select(ids);
    setStyle({ color: 'blue' });
    expect(all().every((a) => a.style.color === 'blue')).toBe(true);
    select([]); // the user clicks away (not a step)
    undo();
    expect(all().map((a) => a.style.color)).toEqual(['red', 'red']);
    expect(selection.value).toEqual(ids);
    redo();
    expect(all().every((a) => a.style.color === 'blue')).toBe(true);
    expect(selection.value).toEqual(ids);
  });

  it('F-009.AC4 F-009.R4 RULE-11 of 250 changes, 200 undos revert one change each, in order', () => {
    createAnnotation(rect(0, 0));
    for (let i = 1; i <= 249; i++) setGeometry('x', i); // 249 more steps: 250 in all
    for (let i = 249; i >= 50; i--) {
      expect(boxX(all()[0])).toBe(i);
      undo();
      expect(boxX(all()[0])).toBe(i - 1);
    }
    expect(canUndo.value).toBe(true);
  });

  it('F-009.AC5 F-009.R1 with a new image undo and redo are unavailable; after one change and one undo only redo is', () => {
    expect(canUndo.value).toBe(false);
    expect(canRedo.value).toBe(false);
    createAnnotation(rect());
    expect(canUndo.value).toBe(true);
    expect(canRedo.value).toBe(false);
    undo();
    expect(canUndo.value).toBe(false);
    expect(canRedo.value).toBe(true);
  });

  it('F-009.AC5 CMP-Toolbar "no image": with no image both are unavailable and the commands do nothing', () => {
    loaded.value = null;
    doc.value = null;
    expect(canUndo.value).toBe(false);
    expect(canRedo.value).toBe(false);
    expect(() => {
      undo();
      redo();
    }).not.toThrow();
  });

  it('F-009.AC6 RULE-11 an arrow nudged 40 times to the right is back where it started after one undo', () => {
    createAnnotation(arrow);
    for (let i = 0; i < 40; i++) nudgeSelection(1, 0);
    const a = all()[0];
    expect(a && 'tail' in a ? a.tail.x : undefined).toBe(40);
    undo();
    const b = all()[0];
    expect(b && 'tail' in b ? b.tail : undefined).toEqual({ x: 0, y: 0 });
    expect(selection.value).toEqual([b?.id]);
  });

  it('CMP-Canvas "Accessibility" NFR-06 undo and redo are announced with COPY-a11y.undone and COPY-a11y.redone', () => {
    createAnnotation(rect());
    undo();
    expect(lastPolite()).toBe('Undone');
    redo();
    expect(lastPolite()).toBe('Redone');
    const before = polite.value.length;
    redo(); // nothing to redo: nothing announced
    expect(polite.value.length).toBe(before);
  });

  it('F-009.R1 MOD-App commands.undo and commands.redo are the undo and redo commands', () => {
    createAnnotation(rect());
    commands.undo();
    expect(all()).toHaveLength(0);
    commands.redo();
    expect(all()).toHaveLength(1);
  });

  it('F-009 edge case an edit that cannot be ended first leaves the document alone (no undo under an open text edit)', () => {
    createAnnotation(rect());
    textEditing.value = { id: null }; // no canvas here to end it
    undo();
    expect(all()).toHaveLength(1);
  });

  it('RULE-18 ADR-0008 §5 an undo after an export makes the session unexported again', () => {
    createAnnotation(rect());
    exported();
    expect(unexported.value).toBe(false);
    undo();
    expect(unexported.value).toBe(true);
    redo(); // back to the exported document: still counts (ADR-0008 §5)
    expect(unexported.value).toBe(true);
  });
  it('RULE-11 ADR-0008 §3 a zoom or pan between nudges ends the chain; an unchanged view does not', () => {
    createAnnotation(rect(0, 0));
    viewChanged({ zoom: 1, x: 0, y: 0, fitted: false });
    nudgeSelection(1, 0);
    viewChanged({ zoom: 1, x: 0, y: 0, fitted: false }); // the same view reported again
    nudgeSelection(1, 0);
    viewChanged({ zoom: 2, x: 0, y: 0, fitted: false }); // zoom
    nudgeSelection(1, 0);
    viewChanged({ zoom: 2, x: 40, y: 0, fitted: false }); // pan
    nudgeSelection(1, 0);
    expect(boxX(all()[0])).toBe(4);
    undo();
    expect(boxX(all()[0])).toBe(3);
    undo();
    expect(boxX(all()[0])).toBe(2);
    undo();
    expect(boxX(all()[0])).toBe(0);
  });
});
