// MOD-App — F-013: the annotation options' names and the selection announcements (CMP-Canvas
// "Accessibility"), the COPY-action.more items per layout (CMP-Toolbar), and the `showShortcuts` command.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { annotationName, createAnnotation, pick } from '../../src/app/drawing';
import { selectAll } from '../../src/app/editing';
import { moreItems } from '../../src/app/MoreMenu';
import { closeShortcuts, showShortcuts } from '../../src/app/shortcuts';
import { dialog, doc, polite, shortcutsOpen, startNewSession } from '../../src/app/state';
import { DEFAULT_STYLES, type Annotation } from '../../src/core';
import type { DecodedImage } from '../../src/io';

const image = (): DecodedImage => ({
  info: { width: 1000, height: 800, sourceName: null, sourceType: 'png' },
  bitmap: { width: 1000, height: 800, close: vi.fn() } as unknown as ImageBitmap,
});
const rect: Annotation = {
  id: 'r',
  kind: 'rectangle',
  style: DEFAULT_STYLES.rectangle,
  box: { x: 100, y: 120, width: 50, height: 40 },
};
const said = () => polite.value.map((m) => m.text);

beforeEach(() => {
  startNewSession(image());
  polite.value = [];
  shortcutsOpen.value = false;
  dialog.value = null;
});

describe('MOD-App annotation names (CMP-Canvas "Accessibility")', () => {
  it('CMP-Canvas a shape is named with its tool and position; a line by its start', () => {
    expect(annotationName(rect)).toBe('Rectangle at 100, 120');
    const line: Annotation = {
      id: 'l',
      kind: 'arrow',
      style: DEFAULT_STYLES.arrow,
      tail: { x: 5, y: 6 },
      head: { x: 50, y: 6 },
    };
    expect(annotationName(line)).toBe('Arrow at 5, 6');
  });

  it('CMP-Canvas a redaction is named with its kind; a step with its label; a text with its text', () => {
    const blur: Annotation = {
      id: 'b',
      kind: 'redaction',
      style: { ...DEFAULT_STYLES.redact, redactionKind: 'blur' },
      box: { x: 1, y: 2, width: 30, height: 30 },
    };
    expect(annotationName(blur)).toBe('Blur at 1, 2');
    const step: Annotation = {
      id: 's',
      kind: 'step',
      style: DEFAULT_STYLES.step,
      centre: { x: 1200, y: 40 },
      number: 12,
    };
    expect(annotationName(step)).toBe('Step 12 at 1,200, 40');
    const text: Annotation = { id: 't', kind: 'text', style: DEFAULT_STYLES.text, anchor: { x: 7, y: 8 }, text: 'Hi' };
    expect(annotationName(text)).toBe('Text “Hi” at 7, 8');
  });
});

describe('MOD-App selection announcements (CMP-Canvas "Accessibility", NFR-06)', () => {
  it('CMP-Canvas a pointer selection of one is announced with its name; Tab (keyboard) is not, its option is read', () => {
    createAnnotation({ ...rect, id: 'draft' });
    createAnnotation({ ...rect, id: 'draft', box: { x: 300, y: 300, width: 10, height: 10 } });
    const [a, b] = doc.value?.annotations ?? [];
    polite.value = [];
    pick([a?.id ?? '']);
    expect(said()).toEqual(['Rectangle at 100, 120']);
    pick([b?.id ?? ''], 'keyboard');
    expect(said()).toEqual(['Rectangle at 100, 120']);
    pick([b?.id ?? '']); // unchanged: not announced again
    expect(said()).toEqual(['Rectangle at 100, 120']);
  });

  it('CMP-Canvas select all is announced with COPY-a11y.selected_count', () => {
    createAnnotation({ ...rect, id: 'draft' });
    createAnnotation({ ...rect, id: 'draft' });
    polite.value = [];
    selectAll();
    expect(said()).toEqual(['2 annotations selected']);
  });
});

describe('MOD-App COPY-action.more and showShortcuts', () => {
  const labels = (narrow: boolean, image = true) => moreItems(narrow, image).map((g) => g.map((i) => i.label));

  it('CMP-Toolbar wide and compact: COPY-action.more holds COPY-action.shortcuts; narrow also COPY-action.download first', () => {
    expect(labels(false)).toEqual([['Keyboard shortcuts'], ['Start over']]);
    expect(labels(true)).toEqual([['Download', 'Keyboard shortcuts'], ['Start over']]);
  });

  it('CMP-Toolbar with no image the download and clear items are unavailable and the shortcuts item is not', () => {
    const items = moreItems(true, false).flat();
    expect(items.map((i) => !!i.disabled)).toEqual([true, false, true]);
  });

  it('F-013.R3 COPY-action.shortcuts opens CMP-ShortcutHelp; not while a confirm dialog is open', () => {
    const [items = []] = moreItems(false, true);
    items.find((i) => i.id === 'shortcuts')?.run();
    expect(shortcutsOpen.value).toBe(true);
    closeShortcuts();
    expect(shortcutsOpen.value).toBe(false);
    dialog.value = { kind: 'replace', answer: () => {} };
    showShortcuts();
    expect(shortcutsOpen.value).toBe(false);
  });
});
