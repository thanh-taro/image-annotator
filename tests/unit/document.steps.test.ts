// MOD-Document steps (F-006, RULE-07, ADR-0008): a new step gets the next number; deleting renumbers
// the later ones and undo restores the earlier numbers; a duplicated step gets the next number.
// The delete and duplicate commands are wired to keys and the panel by F-008; these are the model
// operations they call.
import { describe, expect, it } from 'vitest';
import { DEFAULT_STYLES, DUPLICATE_OFFSET, type Annotation } from '../../src/core';
import { add, duplicate, remove, startSession, type Doc } from '../../src/document';

const image = { width: 1000, height: 800, sourceName: 'a.png', sourceType: 'png' as const };
const step = (id: string, x = 100, y = 100): Annotation => ({
  id,
  kind: 'step',
  style: DEFAULT_STYLES.step,
  centre: { x, y },
  number: 0, // the draft's number is ignored: `add` gives the next one
});
const rect: Annotation = {
  id: 'r',
  kind: 'rectangle',
  style: DEFAULT_STYLES.rectangle,
  box: { x: 100, y: 100, width: 50, height: 50 },
};
const numbers = (d: Doc) => d.annotations.map((a) => (a.kind === 'step' ? `${a.id}:${a.number}` : a.id));

function threeSteps() {
  const session = startSession(image);
  for (const id of ['s1', 's2', 's3']) session.history.apply(add(step(id)), [id]);
  return session;
}

describe('MOD-Document steps', () => {
  it('F-006.AC1 F-006.R1 RULE-07 steps added one after another are numbered 1, 2, 3 in that order', () => {
    expect(numbers(threeSteps().doc)).toEqual(['s1:1', 's2:2', 's3:3']);
  });

  it('F-006.AC3 given steps 1 and 2 (and other annotations), another step is 3', () => {
    const session = startSession(image);
    session.history.apply(add(step('s1')), ['s1']);
    session.history.apply(add(rect), ['r']);
    session.history.apply(add(step('s2')), ['s2']);
    session.history.apply(add(step('s3')), ['s3']);
    expect(numbers(session.doc)).toEqual(['s1:1', 'r', 's2:2', 's3:3']);
  });

  it('F-006.AC2 F-006.R2 deleting step 2 of 1, 2, 3 leaves 1 and 2; undo restores 1, 2, 3', () => {
    const session = threeSteps();
    session.history.apply(remove(['s2']), []);
    expect(numbers(session.doc)).toEqual(['s1:1', 's3:2']);
    const undone = session.history.undo();
    expect(undone && numbers(undone.doc)).toEqual(['s1:1', 's2:2', 's3:3']);
    expect(undone?.selection).toEqual(['s3']);
    const redone = session.history.redo();
    expect(redone && numbers(redone.doc)).toEqual(['s1:1', 's3:2']);
  });

  it('RULE-07 deleting several steps and other annotations keeps the rest consecutive in one step', () => {
    const session = threeSteps();
    session.history.apply(add(rect), ['r']);
    session.history.apply(add(step('s4')), ['s4']);
    session.history.apply(remove(['s1', 'r', 's3']), []);
    expect(numbers(session.doc)).toEqual(['s2:1', 's4:2']);
    expect(session.history.undo() && numbers(session.doc)).toEqual(['s1:1', 's2:2', 's3:3', 'r', 's4:4']);
  });

  it('RULE-11 deleting nothing that exists is no step', () => {
    const session = threeSteps();
    const before = session.doc;
    session.history.apply(remove(['nope']), []);
    expect(session.doc).toBe(before);
  });

  it('F-006.AC7 F-006.R5 duplicating step 1 of 1, 2, 3 makes step 4, offset 10 px right and down, on top', () => {
    const session = threeSteps();
    const ids = ['c1'];
    session.history.apply(duplicate(['s1'], ids), ids);
    const copy = session.doc.annotations[3];
    expect(numbers(session.doc)).toEqual(['s1:1', 's2:2', 's3:3', 'c1:4']);
    expect(copy).toMatchObject({ centre: { x: 100 + DUPLICATE_OFFSET, y: 100 + DUPLICATE_OFFSET } });
  });

  it('RULE-07 duplicating several steps numbers the copies in drawing order after the last', () => {
    const session = threeSteps();
    session.history.apply(duplicate(['s3', 's1'], ['c3', 'c1']), ['c3', 'c1']);
    expect(numbers(session.doc)).toEqual(['s1:1', 's2:2', 's3:3', 'c1:4', 'c3:5']);
  });
});
