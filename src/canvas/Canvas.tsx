// MOD-Canvas — the display canvas (CMP-Canvas). It owns the view (./view.ts): fitted when an image
// loads, zoomed and panned by the wheel, Space+drag, two fingers and the view commands. Each change
// schedules one `requestAnimationFrame` paint into a canvas sized to its box × device pixel ratio
// (capped at 2); the paint copies the image layer (./layer.ts, ADR-0016), which MOD-Render `paintBase`
// rebuilds only when its inputs change. On it MOD-Render `paint` draws the annotations and the selection
// handles; while a shape, stroke or highlight is drawn (./draw.ts) the split drag layers (./drag.ts,
// ADR-0022) hold the rest. Pointer moves pass their coalesced samples on, so strokes follow the
// pointer's full path (F-004.R1). The step tool (F-006) places a step per click or on Enter. Drawing
// is accepted only once the tool's face is ready (ADR-0009 §4, ./fonts.ts), and the canvas repaints
// then, so step numbers never show in a fallback face. The text tool (F-005, ./text.ts) places and
// edits text through CMP-TextEditor, the transparent field over the canvas glyphs (./editor.ts,
// ADR-0009 §2), which is placed here with CSSOM on every paint so it follows zoom and pan; while it is
// open the canvas paints the edited text with the field's value.
// The accessible list arrives with F-013.
// Implements: F-001.R6, F-002.R1/R3/R4, F-003.R1/R5/R6, F-004.R1/R2/R4, F-006.R1/R4, ADR-0009 §4, RULE-12, CMP-Canvas "Behavior" (two fingers pan
// and zoom) and "drawing" / "selected", architecture A5 (crisp from 200 %), ADR-0016, ADR-0022;
// F-005.R1/R2/R3/R4, CMP-TextEditor, ADR-0009, ADR-0020.
import { useEffect, useRef } from 'preact/hooks';
import { t } from '../copy';
import {
  canvasRect,
  CRISP_ZOOM,
  DEFAULT_STYLES,
  EDITOR_EXTRA_EM,
  HIT_TOLERANCE_PX,
  textFont,
  textLayout,
  toImage,
  type Annotation,
  type Point,
  type Style,
  type TextAnnotation,
  type ToolName,
  type View,
} from '../core';
import type { Doc } from '../document';
import {
  measureWith,
  paint as paintScene,
  paletteColour,
  type BaseView,
  type OverlayLook,
  type Patches,
  type Transform,
} from '../render';
import { DragLayers } from './drag';
import { DrawTool } from './draw';
import { bindTextField } from './editor';
import { connectFontGate, fontGate } from './fonts';
import { InputController, pointerInput, type ToolInput } from './input';
import { TextTool, type TextEdit, type TextEndReason } from './text';
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
  /** The text tool's current style (RULE-04), for a new text (F-005). */
  readonly textStyle?: Style;
  /** A text edit started (F-005.R1/R4): SCR-Annotator "editing-text". */
  readonly onTextEdit?: (edit: TextEdit) => void;
  /** A text edit ended with the text as it is now (null when discarded); MOD-App commits it (F-005.R6). */
  readonly onTextEnd?: (edit: TextEdit, text: TextAnnotation | null, reason: TextEndReason) => void;
  /** Focus may move to this element while a text is edited without ending the edit (the style panel). */
  readonly keepsTextEdit?: (target: Element) => boolean;
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
  /** F-005.R4 / RULE-19 Enter: edits the text with this id (caret at the end); true if started. */
  beginTextEdit(id: string): boolean;
  /** RULE-19 Esc: ends the text edit, keeping the text, and returns focus to the canvas; true if one was open. */
  endTextEdit(): boolean;
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

/** SP-text: the field is this much wider than its text, so the caret after the last letter never scrolls it. */
const CARET_ROOM_PX = 2;

/** The document with the edited text in it: replacing the existing one, or a new one on top (F-005.R2). */
function withText(scene: Doc, text: TextAnnotation | null, isNew: boolean): Doc {
  if (!text) return scene;
  const annotations = isNew
    ? [...scene.annotations, text]
    : scene.annotations.map((a) => (a.id === text.id ? text : a));
  return { ...scene, annotations };
}

export function Canvas({
  image,
  doc,
  theme,
  onView,
  tool = 'select',
  style,
  selection = [],
  onCreate,
  textStyle = DEFAULT_STYLES.text,
  onTextEdit,
  onTextEnd,
  keepsTextEdit,
}: CanvasProps) {
  const ref = useRef<HTMLCanvasElement>(null);
  const editorRef = useRef<HTMLTextAreaElement>(null);
  const textRef = useRef<TextTool | null>(null);
  // Mutable per-mount state (MOD-Canvas: transient state stays in a plain controller, not signals).
  const live = useRef({
    image,
    doc,
    theme,
    onView,
    tool,
    style,
    selection,
    onCreate,
    textStyle,
    onTextEdit,
    onTextEnd,
    keepsTextEdit,
    schedule: () => {},
    onViewChanged: () => {},
  });
  Object.assign(live.current, {
    image,
    doc,
    theme,
    onView,
    tool,
    style,
    selection,
    onCreate,
    textStyle,
    onTextEdit,
    onTextEnd,
    keepsTextEdit,
  });
  const controller = useRef<ViewController | null>(null);
  controller.current ??= new ViewController((v) => {
    live.current.onView?.(v);
    live.current.onViewChanged();
    live.current.schedule();
  });

  // Mount: the paint loop, the box and device pixel ratio watchers, and the pointer input.
  useEffect(() => {
    const el = ref.current;
    const ta = editorRef.current;
    const view = controller.current;
    if (!el || !ta || !view) return;
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

    // F-003/F-004: the shape, pen and highlight tools (./draw.ts) take one-finger, mouse and pen drags
    // the view does not take.
    // ADR-0009 §4: no drawing until the tool's face is ready; then repaint in it.
    const fonts = fontGate();
    const draw = new DrawTool(
      () => {
        const { image: img, tool: active, style: current } = live.current;
        if (!view.view || !current) return null;
        return {
          tool: active,
          style: current,
          shortSide: Math.min(img.width, img.height),
          // Read the view on every call: a scroll or zoom mid-drag keeps the end under the pointer.
          toImage: (p: Point) => {
            const now = view.view;
            return now ? toImage(now, p) : p;
          },
        };
      },
      () => schedule(),
      (draft) => live.current.onCreate?.(draft),
      // ADR-0022 / NFR-02: the next frame builds the drag layers, so the first drag frame only composites.
      () => schedule(),
      fonts,
    );

    // F-005: the text tool and CMP-TextEditor. Lines are measured in the tool's face (ADR-0020).
    const measureCanvas =
      typeof OffscreenCanvas === 'function' ? new OffscreenCanvas(1, 1) : document.createElement('canvas');
    const measureCtx = measureCanvas.getContext('2d') as CanvasRenderingContext2D | null;
    const measureLine = measureCtx ? measureWith(measureCtx) : () => 0;
    const region = () => el.closest<HTMLElement>('[tabindex]');
    const textSetup = () => {
      const { image: img, tool: active, textStyle: current, doc: scene } = live.current;
      const now = view.view;
      if (!now) return null;
      return {
        tool: active,
        style: current,
        shortSide: Math.min(img.width, img.height),
        annotations: scene.annotations,
        measure: measureLine,
        tolerance: HIT_TOLERANCE_PX / (now.zoom / 100),
        toImage: (p: Point) => toImage(now, p),
      };
    };
    const draft = () => text.draft(live.current.doc.annotations, live.current.textStyle);
    /** ADR-0009 §2: the field exactly over the text — same face, size × zoom and line height (CSSOM). */
    const placeEditor = () => {
      const v = view.view;
      const a = draft();
      if (!v || !a) return;
      const { image: img } = live.current;
      const z = v.zoom / 100;
      const ratio = dpr();
      const L = textLayout(a, Math.min(img.width, img.height), measureLine);
      const cs = getComputedStyle(ta);
      const left = ta.clientLeft + parseFloat(cs.paddingLeft);
      const top = ta.clientTop + parseFloat(cs.paddingTop);
      // CMP-TextEditor: while empty the field is as wide as COPY-text.placeholder.
      const width = Math.max(L.box.width, ta.value ? 0 : measureLine(L.font, ta.placeholder)) * z;
      const s = ta.style;
      // The display canvas snaps the view's offset to device pixels (viewTransform); so does the field.
      s.left = `${Math.round(v.x * ratio) / ratio + a.anchor.x * z - left}px`;
      s.top = `${Math.round(v.y * ratio) / ratio + a.anchor.y * z - top}px`;
      s.font = textFont(L.size * z);
      s.lineHeight = `${L.lineHeight * z}px`;
      s.width = `${Math.ceil(width) + CARET_ROOM_PX}px`;
      // ADR-0020: 0.2 em taller than the lines, so the field never scrolls inside.
      s.height = `${L.lines.length * L.lineHeight * z + Math.ceil(EDITOR_EXTRA_EM * L.size * z)}px`;
      s.setProperty('--tk-text-colour', paletteColour(a.style.color));
      ta.scrollLeft = 0;
      ta.scrollTop = 0;
    };
    const bound = bindTextField(ta, {
      onInput: () => {
        placeEditor();
        schedule();
      },
      onFocusLeft: () => text.end('focus'),
      // The canvas region takes focus on every press, which then ends the edit (TextTool.down).
      keepsEdit: (target) => target === region() || !!live.current.keepsTextEdit?.(target),
    });
    const text = new TextTool(
      textSetup,
      bound.field,
      {
        begin: (edit) => {
          live.current.onTextEdit?.(edit);
          schedule();
        },
        end: (edit, result, reason) => {
          live.current.onTextEnd?.(edit, result, reason);
          schedule();
        },
      },
      fonts,
    );
    textRef.current = text;
    // F-005 before the shape tools: a press while editing only ends the edit (F-005.R3).
    const tools: ToolInput = {
      down: (i) => text.down(i) || draw.down(i),
      move: (i) => {
        text.move();
        draw.move(i);
      },
      up: (i) => {
        text.up(i);
        draw.up(i);
      },
      cancel: () => text.cancel() || draw.cancel(),
    };

    const paint = () => {
      raf = 0;
      const { image: img, doc: shown, theme: th, selection: chosen } = live.current;
      // F-005.R2: while a text is edited it is painted with the field's value, at its final size and colour.
      const edited = draft();
      const scene = withText(shown, edited, text.edit?.id === null);
      const selected = text.edit?.id ? chosen.filter((id) => id !== text.edit?.id) : chosen;
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
        { image: img, doc: shown, transform: viewTransform(v, ratio), width, height, theme: th, crisp },
        () => ({ ...themed(th, ratio).view, crisp }),
      );
      if (!source) return;
      const transform = viewTransform(v, ratio);
      const preview = draw.preview;
      // ADR-0022: while drawing, the new shape is on top, so only the lower layer is used.
      const n = scene.annotations.length;
      const dragFrame = {
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
        middle: { ...scene, annotations: preview ? [preview] : [] },
      };
      if (preview) {
        drag.paint(ctx, dragFrame);
        return;
      }
      paintScene(ctx, scene, img, transform, NO_PATCHES, { selection: selected, look: themed(th, ratio).look }, source);
      // NFR-02: a gesture is pressed but not yet a drag: build the layers now (nothing new is drawn).
      if (draw.dragging) drag.prepare(dragFrame);
      else drag.release();
      if (edited) placeEditor();
    };
    const schedule = () => {
      if (!raf) raf = requestAnimationFrame(paint);
    };
    live.current.schedule = schedule;
    const stopFonts = connectFontGate(fonts, el, schedule);
    live.current.onViewChanged = () => draw.viewChanged();

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
    const input = new InputController(view, (cursor) => (el.dataset['pan'] = cursor), tools);
    // The canvas position is read once per event (not once per coalesced sample).
    const read = (e: PointerEvent, withSamples = false) => {
      const r = el.getBoundingClientRect();
      return pointerInput(e, { x: r.left, y: r.top }, withSamples);
    };
    const onPointerDown = (e: PointerEvent) => {
      // RULE-19: the canvas keys (Enter, Esc, tool letters) need the canvas region to have focus; the
      // default focus move is lost to preventDefault below, so the region is focused here.
      region()?.focus({ preventScroll: true });
      if (!input.down(read(e))) return;
      if (e.pointerType !== 'touch') e.preventDefault();
      el.setPointerCapture(e.pointerId);
    };
    // F-004.R1: every position the browser sampled since the last move (where it reports them).
    const onPointerMove = (e: PointerEvent) => input.move(read(e, true));
    const onPointerEnd = (e: PointerEvent) => input.up(read(e));
    const onPointerCancel = (e: PointerEvent) => input.cancel(read(e));
    // RULE-06: Shift pressed or released mid-drag constrains the preview at once, without a move.
    const onShift = (e: KeyboardEvent) => {
      if (e.key === 'Shift') draw.setShift(e.type === 'keydown');
    };

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

    // F-005.R4: a double-click with the select tool on a text edits it, caret where clicked.
    const onDoubleClick = (e: MouseEvent) => {
      if (text.editAtScreen(local(e))) e.preventDefault();
    };

    active = {
      controller: view,
      holdSpace: (held) => input.holdSpace(held),
      setBottomInset(px) {
        inset = Math.max(0, px);
        measure();
      },
      cancelDrag: () => draw.cancel(),
      // RULE-19 Enter: the active tool's default annotation at the centre of the view (./draw.ts); with
      // the text tool, a new text there, editing (./text.ts).
      placeAtCentre: () => text.placeAt(view.centreImage()) || draw.placeAt(view.centreImage()),
      beginTextEdit: (id) => text.editById(id),
      endTextEdit: () => {
        // CMP-TextEditor "Accessibility": focus returns to the canvas, with the text selected.
        const ended = text.end('escape');
        if (ended) region()?.focus({ preventScroll: true });
        return ended;
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
    el.addEventListener('pointercancel', onPointerCancel);
    el.addEventListener('dblclick', onDoubleClick);
    window.addEventListener('keydown', onShift);
    window.addEventListener('keyup', onShift);
    for (const g of GESTURES) el.addEventListener(g, onGesture, { passive: false });
    return () => {
      cancelAnimationFrame(raf);
      stopFonts();
      observer.disconnect();
      media?.removeEventListener('change', onDpr);
      el.removeEventListener('wheel', onWheel);
      el.removeEventListener('pointerdown', onPointerDown);
      el.removeEventListener('pointermove', onPointerMove);
      el.removeEventListener('pointerup', onPointerEnd);
      el.removeEventListener('pointercancel', onPointerCancel);
      el.removeEventListener('dblclick', onDoubleClick);
      text.end('discard');
      bound.stop();
      textRef.current = null;
      window.removeEventListener('keydown', onShift);
      window.removeEventListener('keyup', onShift);
      for (const g of GESTURES) el.removeEventListener(g, onGesture);
      layer.release();
      drag.release();
      live.current.schedule = () => {};
      live.current.onViewChanged = () => {};
      if (active?.controller === view) active = null;
      live.current.onView?.(null);
    };
  }, []);

  // F-002.R1: a new image is fitted; a content change (padding, crop) refits a fitted view.
  const shown = useRef<ImageBitmap | null>(null);
  useEffect(() => {
    const fresh = shown.current !== image;
    // A new image starts a new session (F-001.R7): an open text edit belongs to the old one.
    if (fresh && shown.current) textRef.current?.end('discard');
    shown.current = image;
    controller.current?.setContent(canvasRect(doc.frame, doc.padding.size), fresh);
    live.current.schedule();
  }, [image, doc]);

  useEffect(() => live.current.schedule(), [theme, selection, textStyle]);

  // CMP-Canvas: the pointer cursor per tool (crosshair for the drawing tools, ./zoom.css). CMP-TextEditor:
  // a multi-line text field named COPY-tool.text with COPY-text.placeholder while empty; shown, placed and
  // focused by the text tool (data-open, ./editor.ts), never wrapping (RULE-08).
  return (
    <>
      <canvas ref={ref} class="tk-canvas" data-tool={tool} aria-hidden="true" />
      <textarea
        ref={editorRef}
        class="tk-text-editor"
        aria-label={t('tool.text')}
        placeholder={t('text.placeholder')}
        wrap="off"
        spellcheck={false}
        autocomplete="off"
        autocapitalize="off"
      />
    </>
  );
}
