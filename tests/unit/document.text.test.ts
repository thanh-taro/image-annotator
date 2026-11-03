// MOD-Document text commits (F-005.R6, RULE-08, RULE-11, ADR-0008): creating a text and finishing its
// first edit is one step; a new text left empty adds nothing; editing an existing text to empty is one
// deletion step; an unchanged edit adds no step; committed text is kept composed (NFC).
import { describe, expect, it } from 'vitest';
import { DEFAULT_STYLES, textAt, type TextAnnotation } from '../../src/core';
import { commitText, startSession } from '../../src/document';

const image = { width: 1000, height: 800, sourceName: 'a.png', sourceType: 'png' as const };
const text = (s: string, id = 't1'): TextAnnotation => textAt({ x: 100, y: 50 }, id, DEFAULT_STYLES.text, s);

describe('MOD-Document commitText', () => {
  it('F-005.AC12 F-005.R6 creating a text "Bug" is one step; one undo removes it', () => {
    const session = startSession(image);
    session.history.apply(commitText(text('Bug'), true), ['t1']);
    expect(session.doc.annotations).toEqual([text('Bug')]);
    expect(session.history.undo()?.doc.annotations).toEqual([]);
    expect(session.history.canUndo).toBe(false);
  });

  it('F-005.AC4 RULE-08 RULE-11 a new text left empty (or only whitespace) adds nothing and no step', () => {
    const session = startSession(image);
    session.history.apply(commitText(text(''), true), []);
    session.history.apply(commitText(text('  \n '), true), []);
    expect(session.doc.annotations).toEqual([]);
    expect(session.history.canUndo).toBe(false);
    expect(session.unexported).toBe(false);
  });

  it('F-005.AC12 F-005.R6 editing an existing text to empty deletes it as one step; undo brings it back', () => {
    const session = startSession(image);
    session.history.apply(commitText(text('Bug'), true), ['t1']);
    session.history.apply(commitText(text(' '), false), []);
    expect(session.doc.annotations).toEqual([]);
    expect(session.history.undo()?.doc.annotations).toEqual([text('Bug')]);
  });

  it('RULE-11 editing an existing text is one step; an unchanged edit adds none', () => {
    const session = startSession(image);
    session.history.apply(commitText(text('Bug'), true), ['t1']);
    session.history.apply(commitText(text('Bug'), false), ['t1']);
    expect(session.history.undo()?.doc.annotations).toEqual([]);
    session.history.redo();
    session.history.apply(commitText(text('Bugs\nhere'), false), ['t1']);
    expect(session.doc.annotations).toMatchObject([{ id: 't1', text: 'Bugs\nhere', anchor: { x: 100, y: 50 } }]);
    expect(session.history.undo()?.doc.annotations).toMatchObject([{ text: 'Bug' }]);
  });

  it('RULE-08 committed text is kept composed (NFC) as a safety net', () => {
    const session = startSession(image);
    session.history.apply(commitText(text('Đường'), true), ['t1']);
    expect(session.doc.annotations).toMatchObject([{ text: 'Đường' }]);
  });
});
