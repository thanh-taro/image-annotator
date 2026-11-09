// MOD-Canvas view controller (F-002, RULE-12, RULE-19 view keys): the DOM-free state machine behind
// the canvas, the status bar's zoom control and the view keys. Pixels and the real UI are checked in
// tests/e2e/zoom-pan.spec.ts.
import { describe, expect, it } from 'vitest';
import { canvasRect, toImage, toScreen, type Annotation, type View } from '../../src/core';
import { ViewController } from '../../src/canvas/view';
import { startSession } from '../../src/document';

const AREA = { width: 1200, height: 800 };
const box = (width: number, height: number) => ({ x: 0, y: 0, width, height });

function controller(width: number, height: number, area = AREA, margin = 0) {
  const changes: View[] = [];
  const c = new ViewController((v) => changes.push(v));
  c.setArea(area, margin);
  c.setContent(box(width, height), true);
  return { c, changes };
}

const view = (c: ViewController): View => {
  if (!c.view) throw new Error('no view');
  return c.view;
};

/** The whole content lies inside the area. */
function wholeVisible(c: ViewController, w: number, h: number, area = AREA) {
  const tl = toScreen(view(c), { x: 0, y: 0 });
  const br = toScreen(view(c), { x: w, y: h });
  return tl.x >= -1e-9 && tl.y >= -1e-9 && br.x <= area.width + 1e-9 && br.y <= area.height + 1e-9;
}

describe('MOD-Canvas view controller (F-002)', () => {
  it('F-002.AC1 a 3840 × 2160 image in a 1200 × 800 area loads whole and below 100 %', () => {
    const { c } = controller(3840, 2160);
    expect(view(c).zoom).toBeLessThan(100);
    expect(view(c).fitted).toBe(true);
    expect(wholeVisible(c, 3840, 2160)).toBe(true);
  });

  it('F-002.AC2 a 400 × 300 image in a 1200 × 800 area loads at 100 %', () => {
    const { c } = controller(400, 300);
    expect(view(c).zoom).toBe(100);
  });

  it('F-002.AC4 fit shows the whole canvas from any zoom; actual size is 100 %', () => {
    const { c } = controller(3840, 2160, AREA, 24);
    for (let i = 0; i < 5; i++) c.zoomIn();
    c.panBy(-500, -300);
    c.fit();
    expect(wholeVisible(c, 3840, 2160)).toBe(true);
    expect(view(c).fitted).toBe(true);
    c.actualSize();
    expect(view(c).zoom).toBe(100);
    expect(view(c).fitted).toBe(false);
  });

  it('F-002.AC3 zoom in steps from 50 % to 67 %; at 800 % it does nothing', () => {
    const { c, changes } = controller(3840, 2160);
    c.zoomIn(); // 31.25 → 50
    expect(view(c).zoom).toBe(50);
    c.zoomIn();
    expect(view(c).zoom).toBe(67);
    for (let i = 0; i < 20; i++) c.zoomIn();
    expect(view(c).zoom).toBe(800);
    const count = changes.length;
    c.zoomIn();
    expect(view(c).zoom).toBe(800);
    expect(changes.length).toBe(count); // nothing changed, nothing repainted
  });

  it('F-002.AC5 Ctrl+wheel keeps the detail under the pointer', () => {
    const { c } = controller(3840, 2160, AREA, 24);
    const pointer = { x: 850, y: 420 };
    const detail = toImage(view(c), pointer);
    c.wheel({ deltaX: 0, deltaY: -100, deltaMode: 0, mod: true }, pointer); // one notch in
    expect(view(c).zoom).toBe(50);
    const after = toImage(view(c), pointer);
    expect(after.x).toBeCloseTo(detail.x, 6);
    expect(after.y).toBeCloseTo(detail.y, 6);
  });

  it('F-002.R3 a trackpad pinch (small Ctrl+wheel deltas) zooms smoothly at the pointer', () => {
    const { c } = controller(3840, 2160, AREA, 24);
    const pointer = { x: 600, y: 400 };
    const z0 = view(c).zoom;
    const detail = toImage(view(c), pointer);
    c.wheel({ deltaX: 0, deltaY: -4, deltaMode: 0, mod: true }, pointer);
    expect(view(c).zoom).toBeGreaterThan(z0);
    expect(view(c).zoom).toBeLessThan(50);
    const after = toImage(view(c), pointer);
    expect(after.x).toBeCloseTo(detail.x, 6);
  });

  it('F-002.R3 a two-finger pinch zooms around the fingers and follows them', () => {
    const { c } = controller(3840, 2160, AREA, 24);
    c.actualSize();
    const start = view(c);
    const mid = { x: 600, y: 400 };
    const detail = toImage(start, mid);
    c.pinch({ x: 500, y: 400 }, { x: 700, y: 400 }, true);
    c.pinch({ x: 450, y: 400 }, { x: 750, y: 400 }, false); // fingers 1.5 × apart, same centre
    expect(view(c).zoom).toBeCloseTo(150);
    const after = toImage(view(c), mid);
    expect(after.x).toBeCloseTo(detail.x, 6);
    expect(after.y).toBeCloseTo(detail.y, 6);
  });

  it('F-002.R4 scrolling without a modifier pans the view', () => {
    const { c } = controller(3840, 2160, AREA, 24);
    c.actualSize();
    const x0 = view(c).x;
    c.wheel({ deltaX: 120, deltaY: 0, deltaMode: 0, mod: false }, { x: 0, y: 0 });
    expect(view(c).x).toBe(x0 - 120);
  });

  it('F-002.AC10 the Right arrow pans the view right', () => {
    const { c } = controller(3840, 2160, AREA, 24);
    c.actualSize();
    const centreBefore = toImage(view(c), { x: 600, y: 400 });
    c.panView(40, 0);
    const centreAfter = toImage(view(c), { x: 600, y: 400 });
    expect(centreAfter.x).toBeGreaterThan(centreBefore.x);
    expect(centreAfter.y).toBeCloseTo(centreBefore.y);
  });

  it('RULE-19 the arrow-key pan moves the view by its screen pixels (40, Shift: 200)', () => {
    const { c } = controller(3840, 2160, AREA, 24);
    c.actualSize();
    const x0 = view(c).x;
    c.panView(40, 0);
    expect(view(c).x).toBe(x0 - 40);
    c.panView(200, 0);
    expect(view(c).x).toBe(x0 - 240);
  });

  it('F-002.R3 zoom at a point keeps that point and stays within RULE-12', () => {
    const { c } = controller(3840, 2160, AREA, 24);
    const at = { x: 300, y: 200 };
    const before = toImage(view(c), at);
    c.zoomAt(150, at);
    expect(view(c).zoom).toBe(150);
    expect(toImage(view(c), at).x).toBeCloseTo(before.x, 6);
    c.zoomAt(5000, at);
    expect(view(c).zoom).toBe(800);
    c.zoomAt(1, at);
    expect(view(c).zoom).toBe(10);
  });

  it('F-002.R3 a Safari trackpad pinch (gesture scale) zooms at the pointer', () => {
    const { c } = controller(3840, 2160, AREA, 24);
    c.actualSize();
    const at = { x: 400, y: 300 };
    const detail = toImage(view(c), at);
    c.gesture(1, at, true);
    c.gesture(2, at, false);
    expect(view(c).zoom).toBeCloseTo(200);
    expect(toImage(view(c), at).x).toBeCloseTo(detail.x, 6);
    c.endPinch();
  });

  it('F-002 edge case: a resize keeps the zoom, and refits a fitted view', () => {
    const { c } = controller(3840, 2160, AREA, 24);
    c.setArea({ width: 900, height: 600 }, 24);
    expect(view(c).fitted).toBe(true);
    expect(wholeVisible(c, 3840, 2160, { width: 900, height: 600 })).toBe(true);
    c.zoomIn();
    const z = view(c).zoom;
    c.setArea({ width: 1200, height: 800 }, 24);
    expect(view(c).zoom).toBe(z);
    expect(view(c).fitted).toBe(false);
  });

  it('F-002 a new image is fitted again (R1), whatever the previous zoom', () => {
    const { c } = controller(3840, 2160, AREA, 24);
    c.actualSize();
    c.setContent(box(400, 300), true);
    expect(view(c)).toMatchObject({ zoom: 100, fitted: true });
  });

  it('F-002.AC7 zooming and panning leave the document, its history and the unexported state unchanged (INV-05)', () => {
    const session = startSession({ width: 3840, height: 2160, sourceName: null, sourceType: 'image/png' } as never);
    const rect = {
      id: 'a1',
      kind: 'rectangle',
      x: 100,
      y: 100,
      width: 200,
      height: 100,
    } as unknown as Annotation;
    session.history.apply((d) => ({ ...d, annotations: [rect] }), ['a1']);
    session.markExported();
    const doc = session.doc;
    const { c } = controller(3840, 2160, AREA, 24);
    c.setContent(canvasRect(doc.frame, doc.padding.size), true);
    c.zoomIn();
    c.wheel({ deltaX: 0, deltaY: -100, deltaMode: 0, mod: true }, { x: 300, y: 300 });
    c.panBy(-200, -100);
    c.panView(0, 40);
    c.pinch({ x: 100, y: 100 }, { x: 200, y: 100 }, true);
    c.pinch({ x: 100, y: 100 }, { x: 300, y: 100 }, false);
    c.fit();
    c.actualSize();
    expect(session.doc).toBe(doc);
    expect(session.unexported).toBe(false);
    expect(session.history.canRedo).toBe(false);
    expect(session.history.undo()?.doc.annotations).toEqual([]); // the one step is still the only one
    expect(session.history.canUndo).toBe(false);
  });
});

describe('MOD-Canvas view across the crop view (RULE-12, F-010)', () => {
  const frame = { x: 200, y: 0, width: 1720, height: 1080 };
  const image = box(1920, 1080);

  it('RULE-12 F-010 at 200 % with a cropped frame, switching to crop and back keeps zoom and position', () => {
    const c = new ViewController(() => undefined);
    c.setArea(AREA, 24);
    c.setContent(frame, true);
    c.zoomAt(200, { x: 600, y: 400 });
    const before = view(c);
    expect(before).toMatchObject({ zoom: 200, fitted: false });
    c.setContent(image, false); // the crop tool shows the whole image
    expect(view(c)).toEqual(before);
    c.setContent(frame, false); // back to the canvas
    expect(view(c)).toEqual(before);
  });

  it('RULE-12 F-002.R4 back from the crop view, the pan limits of the canvas clamp the position', () => {
    const c = new ViewController(() => undefined);
    c.setArea(AREA, 24);
    c.setContent(frame, true);
    c.zoomAt(200, { x: 600, y: 400 });
    c.setContent(image, false);
    c.panBy(10000, 0); // the image's left edge at the margin
    expect(toScreen(view(c), { x: 0, y: 0 }).x).toBe(24);
    c.setContent(frame, false);
    expect(view(c).zoom).toBe(200);
    expect(toScreen(view(c), { x: 200, y: 0 }).x).toBe(24); // the frame's left edge at the margin
  });
});

describe('MOD-Canvas view centre (F-003.R5, RULE-19 Enter)', () => {
  it('F-003.AC8 the centre of the view follows a pan and leaves out the bottom inset (D-019)', () => {
    const { c } = controller(2000, 1600, AREA, 0);
    c.actualSize();
    const before = c.centreImage();
    c.panView(-40, 0); // an arrow-key pan of 40 screen px at 100 %: the centre moves 40 image px
    const after = c.centreImage();
    expect(Math.abs(after!.x - before!.x)).toBeCloseTo(40, 6);
    expect(after!.y).toBeCloseTo(before!.y, 6);
    // A 300 px sheet over the bottom of the work area: the visible part is 500 px high, its centre higher.
    c.setArea({ width: AREA.width, height: AREA.height - 300 }, 0);
    const v = view(c);
    expect(c.centreImage()).toEqual(toImage(v, { x: AREA.width / 2, y: (AREA.height - 300) / 2 }));
  });
});
