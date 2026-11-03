// MOD-Canvas — the display canvas (CMP-Canvas). It owns the view (./view.ts): fitted when an image
// loads, zoomed and panned by the wheel, Space+drag, two fingers and the view commands. Each change
// schedules one `requestAnimationFrame` paint into a canvas sized to its box × device pixel ratio
// (capped at 2); the paint copies the image layer (./layer.ts, ADR-0016), which MOD-Render `paintBase`
// rebuilds only when its inputs change. Drawing tools and the accessible list arrive with F-003…F-013.
// Implements: F-001.R6, F-002.R1/R3/R4, RULE-12, CMP-Canvas "Behavior" (two fingers pan and zoom),
// architecture A5 (crisp from 200 %), ADR-0016.
import { useEffect, useRef } from 'preact/hooks';
import { canvasRect, CRISP_ZOOM, type Point, type View } from '../core';
import type { Doc } from '../document';
import type { BaseView, Transform } from '../render';
import { ImageLayer } from './layer';
import { ViewController } from './view';

export interface CanvasProps {
  readonly image: ImageBitmap;
  readonly doc: Doc;
  /** Changes when the theme changes, so the checkerboard is repainted in the new colours. */
  readonly theme: string;
  /** Every new view (zoom, pan), for CMP-StatusBar's level (F-002.R5). */
  readonly onView?: (view: View | null) => void;
}

/** What the view commands reach while a canvas is shown (MOD-Canvas public surface). */
export interface ActiveCanvas {
  readonly controller: ViewController;
  /** RULE-19 Space held: a drag pans instead of drawing (F-002.R4). */
  holdSpace(held: boolean): void;
  /** D-019: the narrow bottom sheet covers this much of the work area. */
  setBottomInset(px: number): void;
}

let active: ActiveCanvas | null = null;

/** The canvas currently shown, or null in the empty state. */
export const activeCanvas = (): ActiveCanvas | null => active;

const MAX_DPR = 2;

function cssPx(el: Element, name: string): number {
  return parseFloat(getComputedStyle(el).getPropertyValue(name)) || 0;
}

/** Image pixels → device pixels of the display canvas, snapped to whole pixels. */
export function viewTransform(view: View, dpr: number): Transform {
  return { scale: (view.zoom / 100) * dpr, dx: Math.round(view.x * dpr), dy: Math.round(view.y * dpr) };
}

/** The screen-only inputs of paintBase, read from the theme's tokens (style.md "Work area"). */
function baseView(el: Element, dpr: number, crisp: boolean): BaseView {
  const style = getComputedStyle(el);
  return {
    surround: style.getPropertyValue('--tk-color-work-area').trim(),
    checkerA: style.getPropertyValue('--tk-color-checker-a').trim(),
    checkerB: style.getPropertyValue('--tk-color-checker-b').trim(),
    checkerSize: cssPx(el, '--tk-size-checker') * dpr,
    outline: {
      colour: style.getPropertyValue('--tk-color-line-strong').trim(),
      width: cssPx(el, '--tk-border-width-hairline') * dpr,
    },
    crisp,
  };
}

export function Canvas({ image, doc, theme, onView }: CanvasProps) {
  const ref = useRef<HTMLCanvasElement>(null);
  // Mutable per-mount state (MOD-Canvas: transient state stays in a plain controller, not signals).
  const live = useRef({ image, doc, theme, onView, schedule: () => {} });
  live.current.image = image;
  live.current.doc = doc;
  live.current.theme = theme;
  live.current.onView = onView;
  const controller = useRef<ViewController | null>(null);
  controller.current ??= new ViewController((v) => {
    live.current.onView?.(v);
    live.current.schedule();
  });

  // Mount: the paint loop, the box and device pixel ratio watchers, and the pointer input.
  useEffect(() => {
    const el = ref.current;
    const view = controller.current;
    if (!el || !view) return;
    const layer = new ImageLayer();
    let raf = 0;
    let box = { width: 0, height: 0 };
    let inset = 0;
    let media: MediaQueryList | undefined;
    const dpr = () => Math.min(MAX_DPR, window.devicePixelRatio || 1);

    const paint = () => {
      raf = 0;
      const { image: img, doc: scene, theme: th } = live.current;
      const v = view.view;
      // The previous image's bitmap is closed when a new one loads (NFR-04); a closed (0 × 0) one is skipped.
      if (!v || img.width === 0) return;
      const ratio = dpr();
      const width = Math.round(box.width * ratio);
      const height = Math.round(box.height * ratio);
      if (!width || !height) return;
      if (el.width !== width) el.width = width;
      if (el.height !== height) el.height = height;
      // ADR-0005 §4: every canvas the tool creates is sRGB.
      const ctx = el.getContext('2d', { colorSpace: 'srgb' });
      if (!ctx) return;
      const crisp = v.zoom >= CRISP_ZOOM;
      const source = layer.get(
        { image: img, doc: scene, transform: viewTransform(v, ratio), width, height, theme: th, crisp },
        () => baseView(el, ratio, crisp),
      );
      if (source) ctx.drawImage(source, 0, 0);
    };
    const schedule = () => {
      if (!raf) raf = requestAnimationFrame(paint);
    };
    live.current.schedule = schedule;

    const measure = () => {
      const r = el.getBoundingClientRect();
      box = { width: r.width, height: r.height };
      // style.md "Work area": Fit leaves space.6 between the canvas and the work area's edges.
      view.setArea({ width: box.width, height: Math.max(0, box.height - inset) }, cssPx(el, '--tk-space-6'));
      schedule();
    };

    // ADR-0016: the layer depends on the device pixel ratio, which ResizeObserver does not report.
    const watchDpr = () => {
      media?.removeEventListener('change', onDpr);
      media = matchMedia(`(resolution: ${window.devicePixelRatio || 1}dppx)`);
      media.addEventListener('change', onDpr);
    };
    const onDpr = () => {
      watchDpr();
      schedule();
    };

    const local = (e: { clientX: number; clientY: number }): Point => {
      const r = el.getBoundingClientRect();
      return { x: e.clientX - r.left, y: e.clientY - r.top };
    };

    // F-002.R3/R4: Ctrl/Cmd+wheel (and trackpad pinch) zooms at the pointer; plain scrolling pans.
    const onWheel = (e: WheelEvent) => {
      e.preventDefault(); // the page itself never scrolls or zooms over the canvas
      const mod = e.ctrlKey || e.metaKey;
      view.wheel({ deltaX: e.deltaX, deltaY: e.deltaY, deltaMode: e.deltaMode, mod }, local(e));
    };

    // F-002.R4 Space+drag (mouse and pen), and two touch fingers pan and zoom (CMP-Canvas).
    let space = false;
    let drag: { id: number; last: Point } | null = null;
    const touches = new Map<number, Point>();
    const setCursor = () => {
      el.dataset['pan'] = drag ? 'active' : space ? 'ready' : '';
    };
    const pinchPoints = (): [Point, Point] | null => {
      const [a, b] = Array.from(touches.values());
      return a && b ? [a, b] : null;
    };
    const onPointerDown = (e: PointerEvent) => {
      if (e.pointerType === 'touch') {
        touches.set(e.pointerId, local(e));
        el.setPointerCapture(e.pointerId);
        const pair = pinchPoints();
        if (pair && touches.size === 2) view.pinch(pair[0], pair[1], true);
        return;
      }
      if (space && e.button === 0 && !drag) {
        e.preventDefault();
        drag = { id: e.pointerId, last: local(e) };
        el.setPointerCapture(e.pointerId);
        setCursor();
      }
    };
    const onPointerMove = (e: PointerEvent) => {
      if (touches.has(e.pointerId)) {
        touches.set(e.pointerId, local(e));
        const pair = pinchPoints();
        if (pair) view.pinch(pair[0], pair[1], false);
        return;
      }
      if (drag && e.pointerId === drag.id) {
        const p = local(e);
        view.panBy(p.x - drag.last.x, p.y - drag.last.y);
        drag.last = p;
      }
    };
    const onPointerEnd = (e: PointerEvent) => {
      if (touches.delete(e.pointerId)) {
        view.endPinch();
        const pair = pinchPoints();
        if (pair) view.pinch(pair[0], pair[1], true); // a third finger lifted: continue with the two left
        return;
      }
      if (drag && e.pointerId === drag.id) {
        drag = null;
        setCursor();
      }
    };

    active = {
      controller: view,
      holdSpace(held) {
        if (space === held) return;
        space = held;
        if (!held) drag = null;
        setCursor();
      },
      setBottomInset(px) {
        inset = Math.max(0, px);
        measure();
      },
    };

    measure();
    watchDpr();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    el.addEventListener('wheel', onWheel, { passive: false });
    el.addEventListener('pointerdown', onPointerDown);
    el.addEventListener('pointermove', onPointerMove);
    el.addEventListener('pointerup', onPointerEnd);
    el.addEventListener('pointercancel', onPointerEnd);
    return () => {
      cancelAnimationFrame(raf);
      observer.disconnect();
      media?.removeEventListener('change', onDpr);
      el.removeEventListener('wheel', onWheel);
      el.removeEventListener('pointerdown', onPointerDown);
      el.removeEventListener('pointermove', onPointerMove);
      el.removeEventListener('pointerup', onPointerEnd);
      el.removeEventListener('pointercancel', onPointerEnd);
      layer.release();
      live.current.schedule = () => {};
      if (active?.controller === view) active = null;
      live.current.onView?.(null);
    };
  }, []);

  // F-002.R1: a new image is fitted; a content change (padding, crop) refits a fitted view.
  const shown = useRef<ImageBitmap | null>(null);
  useEffect(() => {
    const fresh = shown.current !== image;
    shown.current = image;
    controller.current?.setContent(canvasRect(doc.frame, doc.padding.size), fresh);
    live.current.schedule();
  }, [image, doc]);

  useEffect(() => live.current.schedule(), [theme]);

  return <canvas ref={ref} class="tk-canvas" aria-hidden="true" />;
}
