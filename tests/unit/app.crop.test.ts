// MOD-App frame commands (F-010): a crop drag, the arrow keys, the fields and the reset are one undo step
// each (RULE-11), the size is announced once (CMP-Canvas "Accessibility"), the panel's crop variant, and
// the canvas size in CMP-StatusBar once a crop exists (D-017).
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { commands } from '../../src/app/commands';
import { commitFrame, moveFrame, resizeFrame, setFrameField, shownCanvasSize } from '../../src/app/crop';
import { panelModel, setTool, summaryDetail } from '../../src/app/drawing';
import { undo } from '../../src/app/history';
import {
  currentStyleModel,
  currentStyles,
  doc,
  loaded,
  polite,
  selection,
  startNewSession,
  tool,
} from '../../src/app/state';
import { DEFAULT_CURRENT_STYLES } from '../../src/core';
import type { DecodedImage } from '../../src/io';

const image = (): DecodedImage => ({
  info: { width: 1920, height: 1080, sourceName: null, sourceType: 'png' },
  bitmap: { width: 1920, height: 1080, close: vi.fn() } as unknown as ImageBitmap,
});
const frame = () => doc.value?.frame;
const lastPolite = () => polite.value.at(-1)?.text;

describe('MOD-App frame commands', () => {
  beforeEach(() => {
    tool.value = 'select';
    currentStyleModel.value = DEFAULT_CURRENT_STYLES;
    startNewSession(image());
    polite.value = [];
  });

  it('F-010.AC1 F-010.R4 a crop drag is one step, announced once with COPY-crop.size', () => {
    commitFrame({ x: 200, y: 0, width: 1720, height: 1080 });
    expect(frame()).toEqual({ x: 200, y: 0, width: 1720, height: 1080 });
    expect(polite.value.map((m) => m.text)).toEqual(['1,720 × 1,080 px']);
    commitFrame({ x: 200, y: 0, width: 1720, height: 1080 }); // the same frame: no step, no announcement
    expect(polite.value).toHaveLength(1);
  });

  it('F-010.AC4 F-010.R3 COPY-action.crop_reset covers the whole image again, as one step', () => {
    commitFrame({ x: 100, y: 100, width: 800, height: 600 });
    commands.resetFrame();
    expect(frame()).toEqual({ x: 0, y: 0, width: 1920, height: 1080 });
    undo();
    expect(frame()).toEqual({ x: 100, y: 100, width: 800, height: 600 });
  });

  it('F-010.AC5 F-010.R5 cropped, then cropped again: one undo restores the first crop', () => {
    commitFrame({ x: 100, y: 100, width: 800, height: 600 });
    commitFrame({ x: 150, y: 150, width: 400, height: 300 });
    undo();
    expect(frame()).toEqual({ x: 100, y: 100, width: 800, height: 600 });
  });

  it('F-010.AC9 typing 800 in the width field makes the frame 800 pixels wide (one step, announced)', () => {
    setFrameField('width', 800);
    expect(frame()).toEqual({ x: 0, y: 0, width: 800, height: 1080 });
    expect(lastPolite()).toBe('800 × 1,080 px');
    expect(loaded.value?.session.history.canUndo).toBe(true);
  });

  it('F-010.AC7 F-010.R6 Alt+Shift+Left: the right edge moves 10 px left; repeats coalesce into one step', () => {
    commitFrame({ x: 100, y: 100, width: 800, height: 600 });
    resizeFrame(-10, 0);
    expect(frame()).toEqual({ x: 100, y: 100, width: 790, height: 600 });
    resizeFrame(-10, 0);
    moveFrame(1, 0); // a move is another chain
    moveFrame(1, 0);
    expect(frame()).toEqual({ x: 102, y: 100, width: 780, height: 600 });
    undo();
    expect(frame()).toEqual({ x: 100, y: 100, width: 780, height: 600 });
    undo();
    expect(frame()).toEqual({ x: 100, y: 100, width: 800, height: 600 });
  });

  it('F-010.R5 a frame change keeps the selection', () => {
    selection.value = ['a1'];
    commitFrame({ x: 10, y: 10, width: 500, height: 500 });
    expect(selection.value).toEqual(['a1']);
  });

  it('CMP-StylePanel "crop": the crop tool shows the frame, its size in the summary bar', () => {
    setTool('crop');
    commitFrame({ x: 29, y: 127, width: 1707, height: 683 });
    const model = panelModel(tool.value, selection.value, doc.value, currentStyles.value);
    expect(model.variant).toBe('crop');
    expect(model.subject).toBe('Crop');
    expect(model.frame).toEqual({ x: 29, y: 127, width: 1707, height: 683 });
    expect(summaryDetail(model)).toBe('1,707 × 683 px');
  });

  it('CMP-StatusBar D-017 the canvas size shows once a crop exists', () => {
    expect(shownCanvasSize()).toBeNull();
    commitFrame({ x: 0, y: 0, width: 1707, height: 683 });
    expect(shownCanvasSize()).toEqual({ width: 1707, height: 683 });
  });
});
