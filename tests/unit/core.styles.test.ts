// MOD-Core current styles (RULE-04, D-045): one colour shared by rectangle, ellipse, line, arrow, pen,
// text and step; highlight and redaction keep their own; size and fill stay per tool.
import { describe, expect, it } from 'vitest';
import { colourGroup, DEFAULT_CURRENT_STYLES, DEFAULT_STYLES, resolveStyles, withToolStyle } from '../../src/core';

const SHARED = ['rectangle', 'ellipse', 'line', 'arrow', 'pen', 'text', 'step'] as const;

describe('MOD-Core current styles', () => {
  it('RULE-04 the defaults: red M fill none for the seven, yellow L highlight, solid black M redaction', () => {
    for (const name of SHARED)
      expect(DEFAULT_STYLES[name]).toMatchObject({ color: 'red', strokeSize: 'M', fill: 'none' });
    expect(DEFAULT_STYLES.highlight).toMatchObject({ color: 'yellow', strokeSize: 'L' });
    expect(DEFAULT_STYLES.redact).toMatchObject({ color: 'black', redactionKind: 'solid', strength: 'M' });
  });

  it('RULE-04 D-045 a colour given to one of the seven tools is the colour of all seven, not of highlight or redaction', () => {
    const next = resolveStyles(withToolStyle(DEFAULT_CURRENT_STYLES, 'step', { color: 'purple' }));
    for (const name of SHARED) expect(next[name].color).toBe('purple');
    expect(next.highlight.color).toBe('yellow');
    expect(next.redact.color).toBe('black');
    expect(colourGroup('highlight')).toBe('highlight');
    expect(colourGroup('text')).toBe('shared');
  });

  it('RULE-04 highlight’s and redaction’s colours are their own; size and fill stay with their tool', () => {
    let s = withToolStyle(DEFAULT_CURRENT_STYLES, 'highlight', { color: 'green', strokeSize: 'S' });
    s = withToolStyle(s, 'ellipse', { fill: 'solid', strokeSize: 'L' });
    const r = resolveStyles(s);
    expect(r.highlight).toMatchObject({ color: 'green', strokeSize: 'S' });
    expect(r.rectangle).toEqual(DEFAULT_STYLES.rectangle);
    expect(r.ellipse).toMatchObject({ color: 'red', fill: 'solid', strokeSize: 'L' });
    expect(withToolStyle(s, 'pen', {})).toEqual(s);
  });
});
