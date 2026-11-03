// MOD-App step commands (F-006): the step tool is offered, a placed step gets the next number, is
// selected and announced (NFR-06), the panel offers colour and size (no fill), and steps are named
// with COPY-a11y.step_annotation (CMP-Canvas "Accessibility").
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BUILT_TOOLS, createAnnotation, panelModel, setStyle, setTool, stepName } from '../../src/app/drawing';
import { currentStyles, doc, loaded, polite, selection, startNewSession, tool } from '../../src/app/state';
import { language } from '../../src/copy';
import { DEFAULT_STYLES, type StepAnnotation } from '../../src/core';
import type { DecodedImage } from '../../src/io';

const image = (): DecodedImage => ({
  info: { width: 1000, height: 800, sourceName: null, sourceType: 'png' },
  bitmap: { width: 1000, height: 800, close: vi.fn() } as unknown as ImageBitmap,
});
const draft = (x = 100, y = 100): StepAnnotation => ({
  id: 'draft',
  kind: 'step',
  style: currentStyles.value.step,
  centre: { x, y },
  number: 0,
});
const steps = () => (doc.value?.annotations ?? []).flatMap((a) => (a.kind === 'step' ? [a.number] : []));

describe('MOD-App steps', () => {
  beforeEach(() => {
    language.value = 'en-US';
    tool.value = 'select';
    currentStyles.value = DEFAULT_STYLES;
    startNewSession(image());
  });

  it('F-006 CMP-Toolbar the step tool is built and can be picked (COPY-tool.step)', () => {
    expect(BUILT_TOOLS).toContain('step');
    setTool('step');
    expect(tool.value).toBe('step');
    expect(polite.value.at(-1)?.text).toBe('Step tool');
  });

  it('F-006.AC1 F-006.R1 three placed steps read 1, 2, 3; each is selected and announced', () => {
    setTool('step');
    for (const x of [100, 200, 300]) createAnnotation(draft(x));
    expect(steps()).toEqual([1, 2, 3]);
    expect(selection.value).toEqual([doc.value?.annotations[2]?.id]);
    expect(polite.value.at(-1)?.text).toBe('Step added');
  });

  it('F-006.AC3 given steps 1 and 2, the next one placed is 3 (one undo step each)', () => {
    setTool('step');
    createAnnotation(draft());
    createAnnotation(draft());
    createAnnotation(draft());
    expect(steps()).toEqual([1, 2, 3]);
    loaded.value?.session.history.undo();
    expect(loaded.value?.session.doc.annotations).toHaveLength(2);
  });

  it('F-006.R3 RULE-04 CMP-StylePanel offers colour and size for the step tool, never fill', () => {
    setTool('step');
    const model = panelModel('step', [], doc.value, currentStyles.value);
    expect(model).toMatchObject({ variant: 'tool', subject: 'Step', color: 'red', size: 'M' });
    expect(model).not.toHaveProperty('fill');
    setStyle({ color: 'yellow', strokeSize: 'L' });
    createAnnotation({ ...draft(), style: currentStyles.value.step });
    expect(doc.value?.annotations[0]?.style).toMatchObject({ color: 'yellow', strokeSize: 'L' });
  });

  it('F-008 edge case selecting a step and changing its size keeps its number', () => {
    setTool('step');
    createAnnotation(draft());
    createAnnotation(draft());
    setStyle({ strokeSize: 'S' });
    expect(steps()).toEqual([1, 2]);
  });

  it('CMP-Canvas "Accessibility" a step is named with COPY-a11y.step_annotation (its number and centre)', () => {
    const step = { ...draft(120.4, 80.6), number: 3 } as const;
    expect(stepName(step)).toBe('Step 3 at 120, 81');
    language.value = 'vi-VN';
    expect(stepName(step)).toBe('Bước 3 tại 120, 81');
    // RULE-07: step numbers are plain digits in every language (no grouping separator).
    expect(stepName({ ...step, number: 1234 })).toBe('Bước 1234 tại 120, 81');
  });
});
