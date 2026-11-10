// MOD-App padding and background commands (F-011): `setPadding` and `setBackground` are one undo step each
// (RULE-11), CMP-StylePanel's canvas variant (padding with the unavailable sizes, background), the narrow
// summary's detail ("Padding None"), the canvas size in CMP-StatusBar (D-017), and the step-down a frame
// change causes (F-011.R6) in the same undo step.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { commands } from '../../src/app/commands';
import { commitFrame, shownCanvasSize } from '../../src/app/crop';
import { panelModel, summaryDetail } from '../../src/app/drawing';
import { undo } from '../../src/app/history';
import { currentStyleModel, currentStyles, doc, loaded, selection, startNewSession, tool } from '../../src/app/state';
import { DEFAULT_CURRENT_STYLES } from '../../src/core';
import type { DecodedImage } from '../../src/io';

const image = (width: number, height: number): DecodedImage => ({
  info: { width, height, sourceName: null, sourceType: 'png' },
  bitmap: { width, height, close: vi.fn() } as unknown as ImageBitmap,
});
const model = () => panelModel(tool.value, selection.value, doc.value, currentStyles.value);

describe('MOD-App padding and background', () => {
  beforeEach(() => {
    tool.value = 'select';
    currentStyleModel.value = DEFAULT_CURRENT_STYLES;
    selection.value = [];
  });

  it('F-011.AC1 choosing padding M on a 1000 × 500 image makes the canvas 1120 × 620 (status bar, D-017)', () => {
    startNewSession(image(1000, 500));
    expect(shownCanvasSize()).toBeNull();
    commands.setPadding('M');
    expect(doc.value?.padding.size).toBe('M');
    expect(doc.value?.frame).toEqual({ x: 0, y: 0, width: 1000, height: 500 });
    expect(shownCanvasSize()).toEqual({ width: 1120, height: 620 });
  });

  it('F-011.AC4 a 400 × 200 frame with padding M on white: a 448 × 248 canvas, 24 px on each side', () => {
    startNewSession(image(1000, 500));
    commitFrame({ x: 300, y: 150, width: 400, height: 200 });
    commands.setPadding('M');
    commands.setBackground('white');
    expect(doc.value?.frame).toEqual({ x: 300, y: 150, width: 400, height: 200 });
    expect(doc.value?.padding).toEqual({ size: 'M', background: 'white' });
    expect(shownCanvasSize()).toEqual({ width: 448, height: 248 });
  });

  it('F-011.AC5 F-011.R4 adding padding is one undo step; undo removes it', () => {
    startNewSession(image(1000, 500));
    commands.setPadding('L');
    expect(loaded.value?.session.unexported).toBe(true);
    undo();
    expect(doc.value?.padding.size).toBe('none');
    expect(loaded.value?.session.history.canUndo).toBe(false);
  });

  it('F-011.R2 RULE-11 the background is one step of its own', () => {
    startNewSession(image(1000, 500));
    commands.setPadding('S');
    commands.setBackground('blue');
    undo();
    expect(doc.value?.padding).toEqual({ size: 'S', background: 'transparent' });
  });

  it('CMP-StylePanel "canvas": the select tool with nothing selected shows the padding and background', () => {
    startNewSession(image(1000, 500));
    commands.setPadding('M');
    commands.setBackground('white');
    const m = model();
    expect(m.variant).toBe('canvas');
    expect(m.subject).toBe('Canvas');
    expect(m.canvas).toEqual({ padding: 'M', background: 'white', available: ['none', 'S', 'M', 'L'] });
  });

  it('F-011.AC6 F-011.R5 a 4096 × 4096 image: S, M and L are unavailable', () => {
    startNewSession(image(4096, 4096));
    expect(model().canvas?.available).toEqual(['none']);
    commands.setPadding('S');
    expect(doc.value?.padding.size).toBe('none');
    expect(loaded.value?.session.history.canUndo).toBe(false);
  });

  it('F-011.AC7 F-011.R6 resetting a 1000 × 1000 crop of a 3600 × 3600 image steps padding L down to M (4032 × 4032), one undo step', () => {
    startNewSession(image(3600, 3600));
    commitFrame({ x: 0, y: 0, width: 1000, height: 1000 });
    commands.setPadding('L');
    expect(shownCanvasSize()).toEqual({ width: 1240, height: 1240 });
    commands.resetFrame();
    expect(doc.value?.padding.size).toBe('M');
    expect(shownCanvasSize()).toEqual({ width: 4032, height: 4032 });
    expect(model().canvas?.available).toEqual(['none', 'S', 'M']);
    undo();
    expect(doc.value?.frame).toEqual({ x: 0, y: 0, width: 1000, height: 1000 });
    expect(doc.value?.padding.size).toBe('L');
  });

  it('COPY-style.sheet_summary the narrow summary detail for the canvas is "Padding None", then the chosen size', () => {
    startNewSession(image(1000, 500));
    expect(summaryDetail(model())).toBe('Padding None');
    commands.setPadding('M');
    expect(summaryDetail(model())).toBe('Padding Medium');
  });

  it('CMP-StylePanel "narrow" the summary shows a palette background\'s colour, none when transparent', () => {
    startNewSession(image(1000, 500));
    expect(model().color).toBeUndefined();
    commands.setBackground('blue');
    expect(model().color).toBe('blue');
    commands.setBackground('transparent');
    expect(model().color).toBeUndefined();
  });
});
