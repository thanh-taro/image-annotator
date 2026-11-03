// MOD-Core canvas maths and the fit level used when an image loads (RULE-12, RULE-14, F-001.R6).
import { describe, expect, it } from 'vitest';
import { canvasRect, fitZoom, paddingPixels } from '../../src/core';

describe('MOD-Core canvas and fit', () => {
  it('RULE-14 padding is 0 / 0.03 / 0.06 / 0.12 of the longer frame side, rounded', () => {
    const frame = { x: 0, y: 0, width: 1000, height: 500 };
    expect(paddingPixels(frame, 'none')).toBe(0);
    expect(paddingPixels(frame, 'S')).toBe(30);
    expect(paddingPixels(frame, 'M')).toBe(60);
    expect(paddingPixels(frame, 'L')).toBe(120);
    expect(paddingPixels({ x: 0, y: 0, width: 50, height: 10 }, 'S')).toBe(2); // 1.5 rounds up
  });

  it('RULE-14 the canvas is the frame plus its padding on every side', () => {
    const frame = { x: 10, y: 20, width: 1000, height: 500 };
    expect(canvasRect(frame, 'none')).toEqual(frame);
    expect(canvasRect(frame, 'S')).toEqual({ x: -20, y: -10, width: 1060, height: 560 });
  });

  it('RULE-12 fit shows the whole content and never goes above 100 %', () => {
    const area = { width: 1200, height: 800 };
    expect(fitZoom({ x: 0, y: 0, width: 400, height: 300 }, area)).toBe(100);
    expect(fitZoom({ x: 0, y: 0, width: 3840, height: 2160 }, area)).toBeCloseTo(31.25);
    expect(fitZoom({ x: 0, y: 0, width: 16_384, height: 1024 }, area)).toBeLessThan(10);
  });

  it('RULE-12 an empty view area fits nothing (zoom 0, no division by zero)', () => {
    expect(fitZoom({ x: 0, y: 0, width: 400, height: 300 }, { width: 0, height: 0 })).toBe(0);
  });
});
