// MOD-Core — custom colours and sizes (F-019, M-1b). A custom colour is a 6-digit sRGB hex value; a
// picked value equal to a palette colour's value (ignoring case) is that palette colour; a custom colour
// pairs with black or white by WCAG contrast ratio (black on a tie). A custom size is a whole number of
// image pixels whose meaning and range depend on how the kind is sized; a preset's width in pixels is its
// RULE-04 width for the loaded image.
// Implements: RULE-21, RULE-07 (contrast pairing of a custom colour), RULE-04 (preset widths in pixels),
// F-019.R2 (palette match), F-019.R3/R5 (the field's value, rounding halves up, range); RULE-22 / F-020.R2/R4
// (fill colour copied once from the colour, withFill; automatic text background colour).
import { styleSizes } from './sizes';
import type { AnnotationKind, Colour, HexColour, Style, StyleColour, StyleSize } from './types';
import { PALETTE_NAMES } from './types';

const HEX = /^#[0-9a-f]{6}$/i;

/** RULE-21: a custom colour value (as kept: lowercase `#rrggbb`). */
export const isHexColour = (c: unknown): c is HexColour => typeof c === 'string' && HEX.test(c);

/**
 * RULE-21 / F-019.R2: the style colour of a value from the colour picker — the palette colour whose value
 * it equals, ignoring case, else the value as a lowercase custom colour; null for anything but `#rrggbb`.
 */
export function pickedColour(value: string, palette: Readonly<Record<Colour, string>>): StyleColour | null {
  if (!HEX.test(value)) return null;
  const hex = value.toLowerCase() as HexColour;
  return PALETTE_NAMES.find((name) => palette[name].toLowerCase() === hex) ?? hex;
}

/** COPY-style.color_custom_value: the hex in uppercase (#1E90FF), whatever case the picker reports. */
export const hexLabel = (hex: HexColour): string => hex.toUpperCase();

/** `#rrggbb` → [r, g, b] (0–255). */
export function hexChannels(hex: string): [number, number, number] {
  const v = parseInt(hex.replace('#', '').slice(0, 6), 16);
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
}

/** WCAG 2 relative luminance of an sRGB colour. */
function luminance(hex: string): number {
  const [r, g, b] = hexChannels(hex).map((c) => {
    const v = c / 255;
    return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG 2 contrast ratio of two sRGB colours (1–21). */
export function contrastRatio(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

/** RULE-07: the pairing with the higher contrast ratio; black on a tie. */
export const pairingFor = (blackRatio: number, whiteRatio: number): 'black' | 'white' =>
  whiteRatio > blackRatio ? 'white' : 'black';

/** RULE-07: a custom colour pairs with black or white, whichever has the higher contrast ratio with it. */
export const customContrast = (hex: HexColour): 'black' | 'white' =>
  pairingFor(contrastRatio(hex, '#000000'), contrastRatio(hex, '#ffffff'));

/**
 * RULE-07 contrast pairing of any style colour: black on yellow, orange, green and white; white on red,
 * blue, purple and black; a custom colour by contrast ratio (RULE-21, black on a tie).
 */
export function contrastPairing(c: StyleColour): 'black' | 'white' {
  if (isHexColour(c)) return customContrast(c);
  return c === 'yellow' || c === 'orange' || c === 'green' || c === 'white' ? 'black' : 'white';
}

/**
 * RULE-22 (F-020.R2/R4, D-054): a rectangle's or ellipse's fill colour as stored (null while unset, which
 * occurs only with fill none), or a text's text background colour with automatic resolved to the contrast
 * pairing of its colour (RULE-07), following that colour. A text always has a text background colour.
 */
export function fillColourOf(kind: 'text', style: Pick<Style, 'color' | 'fillColor'>): StyleColour;
export function fillColourOf(kind: AnnotationKind, style: Pick<Style, 'color' | 'fillColor'>): StyleColour | null;
export function fillColourOf(kind: AnnotationKind, style: Pick<Style, 'color' | 'fillColor'>): StyleColour | null {
  if (style.fillColor !== 'unset' && style.fillColor !== 'automatic') return style.fillColor;
  return kind === 'text' ? contrastPairing(style.color) : null;
}

/**
 * Implements: RULE-22 / F-020.R2 / F-020.R6 (D-054) — sets the fill; turning it on (solid or translucent)
 * while the fill colour is unset copies the colour at that moment, so a filled rectangle, ellipse or tool
 * always has a fill colour. A kept fill colour, and a text's automatic background colour, stay as they are.
 * Used for tools (with their current colour) and for each selected annotation (with its own colour).
 */
export function withFill<S extends Pick<Style, 'color' | 'fill' | 'fillColor'>>(style: S, fill: Style['fill']): S {
  const copy = fill !== 'none' && style.fillColor === 'unset';
  return { ...style, fill, ...(copy ? { fillColor: style.color } : {}) };
}

/** RULE-21: how a kind is sized — its stroke, a highlight's width, or a text size (text and steps). */
export type SizeClass = 'stroke' | 'highlight' | 'text';

/** RULE-21: the sizing class of a kind; redactions have no size (RULE-10). */
export function sizeClassOf(kind: AnnotationKind): SizeClass | null {
  if (kind === 'redaction') return null;
  if (kind === 'highlight') return 'highlight';
  return kind === 'text' || kind === 'step' ? 'text' : 'stroke';
}

/** RULE-21: the range of a custom size, in image pixels. */
export const CUSTOM_SIZE_RANGE: Readonly<Record<SizeClass, { readonly min: number; readonly max: number }>> = {
  stroke: { min: 1, max: 100 },
  highlight: { min: 1, max: 300 },
  text: { min: 6, max: 400 },
};

/** F-019.R5: a number as a custom size — rounded to whole pixels (halves up), kept within RULE-21's range. */
export function customSize(cls: SizeClass, value: number): number {
  const { min, max } = CUSTOM_SIZE_RANGE[cls];
  return Math.min(max, Math.max(min, Math.floor(value + 0.5)));
}

/** F-019.R5: the text of the size field as a custom size; null when empty or not a number. */
export function parseCustomSize(cls: SizeClass, text: string): number | null {
  const trimmed = text.trim();
  const value = trimmed === '' ? NaN : Number(trimmed);
  return Number.isFinite(value) ? customSize(cls, value) : null;
}

/**
 * RULE-21 / F-019.R3: a size in pixels as the size field shows it — a custom size itself; a preset's
 * RULE-04 width for the image whose shorter side is `shortSide` (a highlight: 3 × its stroke size, the
 * stroke size rounded first), or null with no image loaded.
 */
export function sizePixels(cls: SizeClass, size: StyleSize, shortSide: number | null): number | null {
  if (typeof size === 'number') return size;
  if (shortSide === null) return null;
  const sizes = styleSizes(shortSide, size);
  return cls === 'text' ? sizes.text : cls === 'highlight' ? sizes.highlight : sizes.stroke;
}
