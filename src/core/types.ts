// MOD-Core — domain types as plain data (specs/10-domain/model.md). Coordinates and sizes are in
// image pixels, origin at the image's top-left corner; annotation coordinates are never clamped.
// Implements: ENT-Session (parts), ENT-Image (metadata), ENT-Annotation, ENT-Style (with F-019's custom colour
// and size, RULE-21; F-020's fill colour and text background, RULE-22), ENT-Frame, ENT-Padding.

/** RULE-04 palette, in order. */
export const PALETTE_NAMES = ['red', 'orange', 'yellow', 'green', 'blue', 'purple', 'black', 'white'] as const;
export type Colour = (typeof PALETTE_NAMES)[number];

/** RULE-21 (F-019): a custom colour, a lowercase 6-digit sRGB hex value (`#1e90ff`). */
export type HexColour = `#${string}`;
/** ENT-Style `color`: a palette colour (RULE-04) or, from M-1b, a custom colour (RULE-21). */
export type StyleColour = Colour | HexColour;

/** S / M / L of RULE-04 (stroke and text sizes) and RULE-10 (redaction strength). */
export type Size = 'S' | 'M' | 'L';
/** ENT-Style `strokeSize`: a preset (RULE-04) or, from M-1b, a custom size in whole image pixels (RULE-21). */
export type StyleSize = Size | number;
export type Fill = 'none' | 'solid' | 'translucent';
/**
 * ENT-Style `fillColor` (M-1c, RULE-22): the fill colour of a rectangle or ellipse, or the text background
 * colour of a text — `automatic` until one is picked, else a palette or custom colour.
 */
export type FillColour = 'automatic' | StyleColour;
export type RedactionKind = 'solid' | 'blur' | 'pixelate';

/** RULE-01 input formats (AVIF only where the browser decodes it). */
export type SourceType = 'png' | 'jpeg' | 'webp' | 'gif' | 'bmp' | 'avif';

export interface Point {
  readonly x: number;
  readonly y: number;
}

export interface Box {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

/**
 * ENT-Style. `fill` applies to rectangle and ellipse (their fill) and, from M-1c, to text (its text
 * background); `fillColor` is their fill colour or text background colour (RULE-22); `redactionKind` and
 * `strength` apply to redactions.
 */
export interface Style {
  readonly color: StyleColour;
  readonly strokeSize: StyleSize;
  readonly fill: Fill;
  /** Implements: F-020.R2/R4, RULE-22 — `automatic` follows the colour (a text: its contrast pairing). */
  readonly fillColor: FillColour;
  readonly redactionKind: RedactionKind;
  readonly strength: Size;
}

export type AnnotationKind =
  'rectangle' | 'ellipse' | 'line' | 'arrow' | 'stroke' | 'highlight' | 'text' | 'step' | 'redaction';

interface AnnotationBase<K extends AnnotationKind> {
  readonly id: string;
  readonly kind: K;
  readonly style: Style;
}

/** ENT-Annotation, geometry by kind. */
export type Annotation =
  | (AnnotationBase<'rectangle' | 'ellipse' | 'redaction'> & { readonly box: Box })
  | (AnnotationBase<'line' | 'arrow'> & { readonly tail: Point; readonly head: Point })
  | (AnnotationBase<'stroke' | 'highlight'> & { readonly points: readonly Point[] })
  | (AnnotationBase<'text'> & { readonly anchor: Point; readonly text: string })
  | (AnnotationBase<'step'> & { readonly centre: Point; readonly number: number });

/** ENT-Image metadata (the pixels live outside the core, INV-01). */
export interface ImageInfo {
  readonly width: number;
  readonly height: number;
  readonly sourceName: string | null;
  readonly sourceType: SourceType;
}

/** ENT-Frame: whole image pixels, inside the image (RULE-13). */
export type Frame = Box;

export type PaddingSize = 'none' | Size;

/** ENT-Padding. */
export interface Padding {
  readonly size: PaddingSize;
  readonly background: 'transparent' | Colour;
}
