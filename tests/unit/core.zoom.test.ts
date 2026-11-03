// MOD-Core view maths (RULE-12): zoom steps, the zoom-out floor, fit, zoom at a point and the pan
// limits. The controller and the UI around them are tested in canvas.view.test.ts and e2e/zoom-pan.
import { describe, expect, it } from 'vitest';
import { clampView, fitView, panBy, toImage, zoomAt, zoomFloor, zoomIn, zoomOut, type Viewport } from '../../src/core';

const port = (width: number, height: number, area = { width: 1200, height: 800 }, margin = 0): Viewport => ({
  content: { x: 0, y: 0, width, height },
  area,
  margin,
});

describe('MOD-Core zoom steps (RULE-12)', () => {
  it('RULE-12 zoom in goes to the next step and stops at 800 %', () => {
    expect(zoomIn(10)).toBe(25);
    expect(zoomIn(50)).toBe(67);
    expect(zoomIn(67)).toBe(100);
    expect(zoomIn(600)).toBe(800);
    expect(zoomIn(800)).toBe(800);
  });

  it('RULE-12 from a level between steps zoom goes to the next step in that direction', () => {
    expect(zoomIn(31.25)).toBe(50);
    expect(zoomOut(31.25, 31.25)).toBe(25);
    expect(zoomIn(7.03)).toBe(10);
    expect(zoomIn(66.99999999)).toBe(100); // a level within rounding of a step counts as that step
    expect(zoomOut(150.0000001, 50)).toBe(100);
  });

  it('RULE-12 zooming out stops at 10 % or the fit level, whichever is lower', () => {
    expect(zoomOut(25, 50)).toBe(10);
    expect(zoomOut(10, 50)).toBe(10);
    expect(zoomOut(10, 7)).toBe(7);
    expect(zoomOut(7, 7)).toBe(7);
    expect(zoomFloor(7)).toBe(7);
    expect(zoomFloor(31)).toBe(10);
    expect(zoomFloor(0)).toBe(10); // no area yet: never below the 10 % step
  });

  it('F-002.AC3 at 50 % one step in is 67 %; at 800 % zooming in does nothing', () => {
    expect(zoomIn(50)).toBe(67);
    expect(zoomIn(800)).toBe(800);
  });

  it('F-002.AC9 at 31 % after fitting one step in is 50 % and one step out is 25 %', () => {
    const fit = fitView(port(3840, 2160)).zoom; // 31.25 % in a 1200 × 800 area
    expect(Math.round(fit)).toBe(31);
    expect(zoomIn(fit)).toBe(50);
    expect(zoomOut(fit, fit)).toBe(25);
  });

  it('F-002.AC8 a 16,384 × 1024 canvas fits below 10 %; out does nothing; in goes to 10 %', () => {
    const fit = fitView(port(16_384, 1024)).zoom;
    expect(fit).toBeLessThan(10);
    expect(zoomOut(fit, fit)).toBe(fit);
    expect(zoomIn(fit)).toBe(10);
  });
});

describe('MOD-Core fit, zoom at a point and pan (RULE-12, F-002.R3/R4)', () => {
  it('RULE-12 fit centres the whole canvas in the area inside the margin, never above 100 %', () => {
    const big = fitView(port(3840, 2160, { width: 1200, height: 800 }, 24));
    expect(big.zoom).toBeCloseTo(30); // (1200 − 48) / 3840
    expect(big.fitted).toBe(true);
    expect(big.x).toBeCloseTo(24);
    expect(big.y).toBeCloseTo((800 - 2160 * 0.3) / 2);
    const small = fitView(port(400, 300, { width: 1200, height: 800 }, 24));
    expect(small).toEqual({ zoom: 100, x: 400, y: 250, fitted: true });
  });

  it('RULE-12 fit centres a canvas whose origin is not 0 (padding)', () => {
    const v = fitView({
      content: { x: -50, y: -50, width: 500, height: 400 },
      area: { width: 1200, height: 800 },
      margin: 0,
    });
    expect(v.zoom).toBe(100);
    expect(v.x).toBe(350 + 50);
    expect(v.y).toBe(200 + 50);
  });

  it('F-002.R3 zooming at a point keeps the image point under it when the canvas overflows', () => {
    const p = port(3840, 2160, { width: 1200, height: 800 }, 24);
    const fit = fitView(p);
    const pointer = { x: 900, y: 300 };
    const before = toImage(fit, pointer);
    const after = zoomAt(fit, zoomIn(fit.zoom), pointer, p);
    expect(after.zoom).toBe(50);
    expect(after.fitted).toBe(false);
    const now = toImage(after, pointer);
    expect(now.x).toBeCloseTo(before.x, 6);
    expect(now.y).toBeCloseTo(before.y, 6);
  });

  it('F-002.R4 a canvas smaller than the area stays centred; panning does nothing', () => {
    const p = port(400, 300, { width: 1200, height: 800 }, 24);
    const fit = fitView(p);
    expect(panBy(fit, 100, -100, p)).toEqual(fit);
  });

  it('F-002.R4 a larger canvas pans but its edges never pass the margin', () => {
    const p = port(3840, 2160, { width: 1200, height: 800 }, 24);
    const actual = clampView({ zoom: 100, x: 24, y: 24, fitted: false }, p);
    expect(actual).toEqual({ zoom: 100, x: 24, y: 24, fitted: false });
    const right = panBy(actual, -100, 0, p);
    expect(right.x).toBe(-76);
    const far = panBy(actual, -100_000, -100_000, p);
    expect(far.x).toBe(1200 - 24 - 3840);
    expect(far.y).toBe(800 - 24 - 2160);
    const back = panBy(far, 100_000, 100_000, p);
    expect(back.x).toBe(24);
    expect(back.y).toBe(24);
  });
});
