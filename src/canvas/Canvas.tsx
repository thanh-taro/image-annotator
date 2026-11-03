// MOD-Canvas — the display canvas (CMP-Canvas). F-001 scope: a fixed fit view of the loaded image,
// painted by MOD-Render `paintBase` into a canvas sized to its box × device pixel ratio (capped at 2).
// Zoom, pan, the rAF loop and pointer input arrive with F-002 and the drawing features.
// Implements: F-001.R6 (fitted to the view), RULE-12 (fit never above 100 %), ADR-0016 (image layer).
import { useEffect, useRef } from 'preact/hooks';
import { canvasRect, fitZoom } from '../core';
import type { Doc } from '../document';
import { paintBase, type Transform } from '../render';

export interface CanvasProps {
  readonly image: ImageBitmap;
  readonly doc: Doc;
  /** Changes when the theme changes, so the checkerboard is repainted in the new colours. */
  readonly theme: string;
}

const MAX_DPR = 2;

function cssPx(el: Element, name: string): number {
  return parseFloat(getComputedStyle(el).getPropertyValue(name)) || 0;
}

/** RULE-12 fit: the canvas (frame plus padding) centred in the view; style.md "Work area": Fit leaves space.6. */
export function fitTransform(
  doc: Doc,
  view: { width: number; height: number },
  margin: number,
  dpr: number,
): Transform {
  const content = canvasRect(doc.frame, doc.padding.size);
  const zoom = fitZoom(content, { width: view.width - 2 * margin, height: view.height - 2 * margin }) / 100;
  const scale = zoom * dpr;
  return {
    scale,
    dx: Math.round((view.width * dpr - content.width * scale) / 2 - content.x * scale),
    dy: Math.round((view.height * dpr - content.height * scale) / 2 - content.y * scale),
  };
}

export function Canvas({ image, doc, theme }: CanvasProps) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const paint = () => {
      const box = el.getBoundingClientRect();
      const dpr = Math.min(MAX_DPR, window.devicePixelRatio || 1);
      const width = Math.round(box.width * dpr);
      const height = Math.round(box.height * dpr);
      if (el.width !== width) el.width = width;
      if (el.height !== height) el.height = height;
      // ADR-0005 §4: every canvas the tool creates is sRGB.
      const ctx = el.getContext('2d', { colorSpace: 'srgb' });
      if (!ctx || !width || !height) return;
      const style = getComputedStyle(el);
      paintBase(ctx, doc, image, fitTransform(doc, box, cssPx(el, '--tk-space-6'), dpr), {
        checkerA: style.getPropertyValue('--tk-color-checker-a').trim(),
        checkerB: style.getPropertyValue('--tk-color-checker-b').trim(),
        checkerSize: cssPx(el, '--tk-size-checker') * dpr,
        outline: {
          colour: style.getPropertyValue('--tk-color-line-strong').trim(),
          width: cssPx(el, '--tk-border-width-hairline') * dpr,
        },
      });
    };
    paint();
    const observer = new ResizeObserver(paint);
    observer.observe(el);
    return () => observer.disconnect();
  }, [image, doc, theme]);

  return <canvas ref={ref} class="tk-canvas" aria-hidden="true" />;
}
