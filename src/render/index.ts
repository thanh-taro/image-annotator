// MOD-Render — one paint function for the screen and the export
// (specs/40-technical/modules/MOD-Render.md, ADR-0004, ADR-0016). Imports MOD-Core only and never
// reads language, theme or view state beyond the transform it is given (INV-05).
// Phase 3.3 scaffold: the palette constants are generated from the tokens (scripts/gen-tokens.mjs);
// painting throws until F-003…F-007 are built.
import type { Annotation, Box, Colour, Frame, Padding } from '../core';
import { PALETTE_HEX } from './palette.gen';

export { PALETTE, PALETTE_HEX, type PaletteColour } from './palette.gen';

/** The document as MOD-Render reads it (structurally the same as MOD-Document's Doc). */
export interface Scene {
  readonly annotations: readonly Annotation[];
  readonly frame: Frame;
  readonly padding: Padding;
}

/** Image pixels → context pixels: a uniform scale and a translation. */
export interface Transform {
  readonly scale: number;
  readonly dx: number;
  readonly dy: number;
}

/** Finished blur/pixelate patches by annotation id (MOD-Effects). */
export type Patches = ReadonlyMap<string, { readonly box: Box; readonly bitmap: CanvasImageSource }>;

/** Screen-only overlays (selection, handles, crop frame, checkerboard); never passed by the export. */
export interface Overlays {
  readonly selection?: readonly string[];
  readonly crop?: boolean;
}

type Ctx = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;

const notImplemented = (name: string): never => {
  throw new Error(`not implemented: MOD-Render ${name}`);
};

export function paint(
  _ctx: Ctx,
  _scene: Scene,
  _image: CanvasImageSource,
  _transform: Transform,
  _patches: Patches,
  _overlays?: Overlays,
  _layer?: CanvasImageSource,
): void {
  notImplemented('paint');
}

export function paintBase(_ctx: Ctx, _scene: Scene, _image: CanvasImageSource, _transform: Transform): void {
  notImplemented('paintBase');
}

/** The sRGB value of a palette colour (tokens.json, ADR-0013). */
export function paletteColour(name: Colour): string {
  return PALETTE_HEX[name];
}

/** RULE-07 contrast pairing: black on yellow, orange, green, white; white on red, blue, purple, black. */
export function contrastPair(name: Colour): 'black' | 'white' {
  return name === 'yellow' || name === 'orange' || name === 'green' || name === 'white' ? 'black' : 'white';
}
