// MOD-App signals (ADR-0008 §6): a new session closes the previous bitmap (NFR-04), edits and exports
// recompute `unexported` (RULE-18), and polite announcements queue instead of replacing each other.
import { describe, expect, it, vi } from 'vitest';
import {
  announcePolite,
  clearPolite,
  commit,
  doc,
  exported,
  loaded,
  polite,
  setNotice,
  startNewSession,
  unexported,
} from '../../src/app/state';
import type { DecodedImage } from '../../src/io';

const image = (width: number): DecodedImage => ({
  info: { width, height: 100, sourceName: null, sourceType: 'png' },
  bitmap: { width, height: 100, close: vi.fn() } as unknown as ImageBitmap,
});

describe('MOD-App state', () => {
  it('F-001.R7 NFR-04 a new session closes the previous image bitmap and resets the document', () => {
    const first = image(100);
    startNewSession(first);
    const second = image(200);
    const session = startNewSession(second);
    expect(first.bitmap.close).toHaveBeenCalledOnce();
    expect(second.bitmap.close).not.toHaveBeenCalled();
    expect(loaded.value?.image).toBe(second);
    expect(doc.value).toBe(session.doc);
  });

  it('RULE-18 ADR-0008 §6 an edit, then an export, recompute unexported and repaint the document', () => {
    const session = startNewSession(image(100));
    expect(unexported.value).toBe(false);
    commit(session.history.apply((d) => ({ ...d, padding: { ...d.padding, size: 'M' } }), []));
    expect(unexported.value).toBe(true);
    expect(doc.value?.padding.size).toBe('M');
    exported();
    expect(unexported.value).toBe(false);
  });

  it('CMP-Notice a success notice after "Image opened" is announced too (polite messages queue)', () => {
    clearPolite();
    announcePolite('Image opened');
    setNotice({ kind: 'success', id: 'load.first_only', text: () => 'Opened the first image only.' });
    expect(polite.value.map((m) => m.text)).toEqual(['Image opened', 'Opened the first image only.']);
    setNotice(null);
  });

  it('CMP-Notice a progress message is cleared from the polite region when its result arrives', () => {
    clearPolite();
    setNotice({ kind: 'progress', id: 'load.loading', text: () => 'Loading…' });
    expect(polite.value).toHaveLength(1);
    setNotice(null);
    expect(polite.value).toEqual([]);
  });
});
