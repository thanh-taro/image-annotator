// F-007 Redact in MOD-App: the redaction tool, its kind (solid when first used), the style panel's
// choices for redactions (no opacity or fill; colour only for solid; strength and the not-secure note for
// blur and pixelate), "Use solid", and changing a placed redaction's kind (RULE-04, RULE-10, F-007.R4/R6).
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BUILT_TOOLS, createAnnotation, panelModel, setStyle, setTool, summaryDetail } from '../../src/app/drawing';
import { currentStyles, doc, loaded, selection, startNewSession, tool } from '../../src/app/state';
import { defaultAt, drawKindOf, placeKindOf } from '../../src/canvas';
import { DEFAULT_STYLES, type Annotation, type Style } from '../../src/core';
import type { DecodedImage } from '../../src/io';

const image = (): DecodedImage => ({
  info: { width: 1000, height: 800, sourceName: null, sourceType: 'png' },
  bitmap: { width: 1000, height: 800, close: vi.fn() } as unknown as ImageBitmap,
});
const redaction = (style: Partial<Style> = {}): Annotation => ({
  id: 'draft',
  kind: 'redaction',
  style: { ...DEFAULT_STYLES.redact, ...style },
  box: { x: 100, y: 100, width: 200, height: 40 },
});
const rectangle: Annotation = {
  id: 'draft',
  kind: 'rectangle',
  style: DEFAULT_STYLES.rectangle,
  box: { x: 400, y: 100, width: 100, height: 100 },
};
const model = () => panelModel(tool.value, selection.value, doc.value, currentStyles.value);

describe('F-007 the redaction tool (MOD-App)', () => {
  beforeEach(() => {
    tool.value = 'select';
    currentStyles.value = DEFAULT_STYLES;
    startNewSession(image());
  });

  it('F-007.AC6 F-007.R4 RULE-04 when the tool is first picked after the page opens, its kind is solid, black', () => {
    expect(BUILT_TOOLS).toContain('redact');
    setTool('redact');
    expect(tool.value).toBe('redact');
    expect(currentStyles.value.redact).toMatchObject({ redactionKind: 'solid', color: 'black', strength: 'M' });
    expect(model()).toMatchObject({ variant: 'tool', kind: 'solid', color: 'black', notSecure: false });
  });

  it('F-007.R1 RULE-05 RULE-19 the redaction tool draws and places boxes (a click or Enter: 20 % of s, centred)', () => {
    expect(drawKindOf('redact')).toBe('redaction');
    expect(placeKindOf('redact')).toBe('redaction');
    const placed = defaultAt({ x: 500, y: 400 }, 'redaction', 800, DEFAULT_STYLES.redact);
    expect(placed).toMatchObject({ kind: 'redaction', box: { x: 420, y: 320, width: 160, height: 160 } });
  });

  it('F-007.AC2 F-007.R2 a solid redaction offers no opacity, fill or size, alone or with a rectangle selected', () => {
    setTool('redact');
    expect(model()).not.toHaveProperty('fill');
    expect(model()).not.toHaveProperty('size');
    createAnnotation(redaction());
    const solid = selection.value[0] as string;
    expect(model()).toMatchObject({ variant: 'selection', kind: 'solid', color: 'black' });
    expect(model()).not.toHaveProperty('fill');
    createAnnotation(rectangle);
    selection.value = [solid, selection.value[0] as string];
    const both = model();
    expect(both).not.toHaveProperty('fill');
    expect(both).not.toHaveProperty('size');
    expect(both).not.toHaveProperty('kind');
    expect(Object.keys(both)).not.toContain('opacity');
    expect(both.color).toBe(null); // black and red differ: nothing marked
  });

  it('F-007.AC5 F-007.R4 RULE-10 choosing blur or pixelate shows the not-secure note and strength, and hides colour', () => {
    setTool('redact');
    for (const kind of ['blur', 'pixelate'] as const) {
      setStyle({ redactionKind: kind });
      expect(model()).toMatchObject({ kind, notSecure: true, strength: 'M' });
      expect(model()).not.toHaveProperty('color');
      expect(summaryDetail(model())).toBe('Medium');
    }
    // COPY-redact.use_solid: with nothing selected it switches the tool's current kind to solid.
    setStyle({ redactionKind: 'solid' });
    expect(currentStyles.value.redact.redactionKind).toBe('solid');
    expect(model()).toMatchObject({ kind: 'solid', notSecure: false });
    expect(model()).not.toHaveProperty('strength');
  });

  it('F-007.AC8 F-007.R6 a selected pixelate redaction switched to solid becomes an opaque box in the current solid colour, one step', () => {
    setTool('redact');
    setStyle({ color: 'blue' }); // the current solid colour
    setStyle({ redactionKind: 'pixelate', strength: 'L' });
    createAnnotation(redaction({ redactionKind: 'pixelate', strength: 'L', color: 'black' }));
    const id = selection.value[0] as string;
    const steps = () => (loaded.value?.session.history.canUndo ? 1 : 0);
    expect(steps()).toBe(1);
    setStyle({ redactionKind: 'solid' });
    const a = doc.value?.annotations.find((x) => x.id === id);
    expect(a?.style).toMatchObject({ redactionKind: 'solid', color: 'blue' });
    // RULE-04: the change becomes the redaction tool's current style.
    expect(currentStyles.value.redact.redactionKind).toBe('solid');
    // One undo step brings the pixelate back.
    loaded.value?.session.history.undo();
    expect(loaded.value?.session.doc.annotations.find((x) => x.id === id)?.style.redactionKind).toBe('pixelate');
  });

  it('F-007.R6 RULE-10 strength changes apply to a selected blur; size and fill never reach a redaction', () => {
    createAnnotation(redaction({ redactionKind: 'blur' }));
    setStyle({ strength: 'S' });
    const [a] = doc.value?.annotations ?? [];
    expect(a?.style).toMatchObject({ redactionKind: 'blur', strength: 'S' });
  });
});
