// MOD-Canvas — the display canvas (CMP-Canvas). It owns the view (./view.ts): fitted when an image
// loads, zoomed and panned by the wheel, Space+drag, two fingers and the view commands. Each change
// schedules one `requestAnimationFrame` paint into a canvas sized to its box × device pixel ratio
// (capped at 2); the paint copies the image layer (./layer.ts, ADR-0016), which MOD-Render `paintBase`
// rebuilds only when its inputs change. On it MOD-Render `paint` draws the annotations and the selection
// handles; while a shape is drawn (./draw.ts) the split drag layers (./drag.ts, ADR-0022) hold the rest.
// The accessible list arrives with F-013.
// Implements: F-001.R6, F-002.R1/R3/R4, F-003.R1/R5/R6, RULE-12, CMP-Canvas "Behavior" (two fingers pan
// and zoom) and "drawing" / "selected", architecture A5 (crisp from 200 %), ADR-0016, ADR-0022.
import { useEffect, useRef } from 'preact/hooks';
import {
  canvasRect,
  CRISP_ZOOM,
  defaultAnnotationAt,
  toImage,
  type Annotation,
  type Point,
  type Style,
  type ToolName,
  type View,
} from '../core';
import type { Doc } from '../document';
import { paint as paintScene, type BaseView, type OverlayLook, type Patches, type Transform } from '../render';
import { DragLayers } from './drag';
import { DRAFT_ID, DrawTool, shapeKindOf } from './draw';
import { InputController } from './input';
import { ImageLayer } from './layer';
import { ViewController } from './view';

export interface CanvasProps {
  readonly image: ImageBitmap;
  readonly doc: Doc;
  /** Changes when the theme changes, so the checkerboard is repainted in the new colours. */
  readonly theme: string;
  /** Every new view (zoom, pan), for CMP-StatusBar's level (F-002.R5). */
  readonly onView?: (view: View | null) => void;
  /** The active tool (CMP-Toolbar) and its current style (RULE-04). */
  readonly tool?: ToolName;
  readonly style?: Style | undefined;
  /** The selected annotations' ids (handles on a single selection, CMP-Canvas "selected"). */
  readonly selection?: readonly string[];
  /** A finished shape (F-003.R1/R5); its id is DRAFT_ID, MOD-App gives it a session id. */
  readonly onCreate?: (draft: Annotation) => void;
}

/** What the view commands reach while a canvas is shown (MOD-Canvas public surface). */
export interface ActiveCanvas {
  readonly controller: ViewController;
  /** RULE-19 Space held: a drag pans instead of drawing (F-002.R4; ./input.ts). */
  holdSpace(held: boolean): void;
  /** D-019: the narrow bottom sheet covers this much of the work area. */
  setBottomInset(px: number): void;
  /** RULE-19 Esc: cancels the current drag; true if there was one. */
  cancelDrag(): boolean;
  /** RULE-19 Enter: places the active tool's default annotation at the centre of the view; true if placed. */
  placeAtCentre(): boolean;
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
function baseView(el: Element, dpr: number): BaseView {
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
  };
}

/** The selection overlay's look, from the theme's tokens (style.md principle 3; CMP-Canvas "selected"). */
function overlayLook(el: Element, dpr: number): OverlayLook {
  const style = getComputedStyle(el);
  return {
    outline: style.getPropertyValue('--tk-color-selection-outline').trim(),
    halo: style.getPropertyValue('--tk-color-work-area').trim(),
    handleFill: style.getPropertyValue('--tk-color-handle-fill').trim(),
    handleBorder: style.getPropertyValue('--tk-color-handle-border').trim(),
    lineWidth: cssPx(el, '--tk-border-width-focus') * dpr,
    handleSize: cssPx(el, '--tk-size-handle') * dpr,
  };
}

/** Finished blur/pixelate patches (MOD-Effects, F-007); none yet. */
const NO_PATCHES: Patches = new Map();

export function Canvas({ image, doc, theme, onView, tool = 'select', style, selection = [], onCreate }: CanvasProps) {
  const ref = useRef<HTMLCanvasElement>(null);
  // Mutable per-mount state (MOD-Canvas: transient state stays in a plain controller, not signals).
  const live = useRef({ image, doc, theme, onView, tool, style, selection, onCreate, schedule: () => {} });
  Object.assign(live.current, { image, doc, theme, onView, tool, style, selection, onCreate });
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
    let tokens: { key: string; view: BaseView; look: OverlayLook } | null = null;
    const dpr = () => Math.min(MAX_DPR, window.devicePixelRatio || 1);
    const drag = new DragLayers();
    const themed = (th: string, ratio: number) => {
      // The theme's tokens are read once per (theme, device pixel ratio), not on every frame.
      const key = `${th}|${ratio}`;
      if (!tokens || tokens.key !== key) tokens = { key, view: baseView(el, ratio), look: overlayLook(el, ratio) };
      return tokens;
    };

    // F-003: the shape tools (./draw.ts) take one-finger, mouse and pen drags the view does not take.
    const draw = new DrawTool(
      () => {
        const { image: img, tool: active, style: current } = live.current;
        const v = view.view;
        if (!v || !current) return null;
        return {
          tool: active,
          style: current,
          shortSide: Math.min(img.width, img.height),
          toImage: (p: Point) => toImage(v, p),
        };
      },
      () => schedule(),
      (draft) => live.current.onCreate?.(draft),
    );

    const paint = () => {
      raf = 0;
      const { image: img, doc: scene, theme: th, selection: selected } = live.current;
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
        () => ({ ...themed(th, ratio).view, crisp }),
      );
      if (!source) return;
      const transform = viewTransform(v, ratio);
      const preview = draw.preview;
      if (preview) {
        // ADR-0022: while drawing, the new shape is on top, so only the lower layer is used.
        const n = scene.annotations.length;
        drag.paint(ctx, {
          base: source,
          baseVersion: layer.rebuilds,
          scene,
          image: img,
          transform,
          patches: NO_PATCHES,
          width,
          height,
          lo: n,
          hi: n - 1,
          middle: { ...scene, annotations: [preview] },
        });
        return;
      }
      drag.release();
      paintScene(ctx, scene, img, transform, NO_PATCHES, { selection: selected, look: themed(th, ratio).look }, source);
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

    // F-002.R4 Space+drag (mouse and pen) and two touch fingers (CMP-Canvas), routed by ./input.ts.
    const input = new InputController(view, (cursor) => (el.dataset['pan'] = cursor), draw);
    const read = (e: PointerEvent) => ({
      id: e.pointerId,
      type: e.pointerType,
      button: e.button,
      point: local(e),
      shift: e.shiftKey,
      alt: e.altKey,
    });
    const onPointerDown = (e: PointerEvent) => {
      // RULE-19: the canvas keys (Enter, Esc, tool letters) need the canvas region to have focus; the
      // default focus move is lost to preventDefault below, so the region is focused here.
      (el.closest('[tabindex]') as HTMLElement | null)?.focus({ preventScroll: true });
      if (!input.down(read(e))) return;
      if (e.pointerType !== 'touch') e.preventDefault();
      el.setPointerCapture(e.pointerId);
    };
    const onPointerMove = (e: PointerEvent) => input.move(read(e));
    const onPointerEnd = (e: PointerEvent) => input.up(read(e));

    // F-002.R3 Safari trackpad pinch: WebKit on macOS sends `gesturestart` / `gesturechange` /
    // `gestureend` (with `scale` and the pointer position) instead of Ctrl+wheel. A real trackpad pinch
    // cannot be automated; tests/e2e/zoom-pan.spec.ts dispatches synthetic gesture events instead.
    const onGesture = (e: Event) => {
      e.preventDefault(); // the page itself is never zoomed by the pinch
      const g = e as Event & { scale?: number; clientX?: number; clientY?: number };
      if (e.type === 'gestureend') {
        view.endPinch();
        return;
      }
      view.gesture(
        g.scale ?? 1,
        local({ clientX: g.clientX ?? 0, clientY: g.clientY ?? 0 }),
        e.type === 'gesturestart',
      );
    };
    const GESTURES = ['gesturestart', 'gesturechange', 'gestureend'] as const;

    active = {
      controller: view,
      holdSpace: (held) => input.holdSpace(held),
      setBottomInset(px) {
        inset = Math.max(0, px);
        measure();
      },
      cancelDrag: () => draw.cancel(),
      placeAtCentre() {
        // RULE-19 Enter / F-003.R5: the default shape (RULE-05) at the centre of the view.
        const { image: img, tool: active, style: current } = live.current;
        const kind = shapeKindOf(active);
        const centre = view.centreImage();
        if (!kind || !current || !centre) return false;
        live.current.onCreate?.(defaultAnnotationAt(centre, kind, Math.min(img.width, img.height), DRAFT_ID, current));
        return true;
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
    for (const g of GESTURES) el.addEventListener(g, onGesture, { passive: false });
    return () => {
      cancelAnimationFrame(raf);
      observer.disconnect();
      media?.removeEventListener('change', onDpr);
      el.removeEventListener('wheel', onWheel);
      el.removeEventListener('pointerdown', onPointerDown);
      el.removeEventListener('pointermove', onPointerMove);
      el.removeEventListener('pointerup', onPointerEnd);
      el.removeEventListener('pointercancel', onPointerEnd);
      for (const g of GESTURES) el.removeEventListener(g, onGesture);
      layer.release();
      drag.release();
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

  useEffect(() => live.current.schedule(), [theme, selection]);

  // CMP-Canvas: the pointer cursor per tool (crosshair for the drawing tools, ./zoom.css).
  return <canvas ref={ref} class="tk-canvas" data-tool={tool} aria-hidden="true" />;
}
