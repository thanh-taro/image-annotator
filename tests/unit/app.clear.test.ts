// MOD-App F-014: the leave-page warning follows RULE-18 (R1/R2), and COPY-action.clear (start over, R3)
// asks with CMP-ConfirmDialog "clear" only while there are unexported changes; a new (empty) session
// can't be undone (RULE-11).
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { clearImage } from '../../src/app/clear';
import { startLeaveWarning } from '../../src/app/leave';
import { moreItems } from '../../src/app/MoreMenu';
import { undo } from '../../src/app/history';
import {
  canRedo,
  canUndo,
  commit,
  dialog,
  doc,
  exported,
  loaded,
  selection,
  startNewSession,
  unexported,
} from '../../src/app/state';
import type { DecodedImage } from '../../src/io';

const image = (): DecodedImage => ({
  info: { width: 400, height: 300, sourceName: null, sourceType: 'png' },
  bitmap: { width: 400, height: 300, close: vi.fn() } as unknown as ImageBitmap,
});

/** One RULE-11 step: a padding change. */
const change = () => {
  const session = loaded.value!.session;
  commit(session.history.apply((d) => ({ ...d, padding: { ...d.padding, size: 'M' } }), []));
};

const settle = () => new Promise((r) => setTimeout(r, 0));

beforeEach(() => {
  dialog.value = null;
});

describe('F-014 leave-page warning (RULE-18)', () => {
  it('F-014.R1 F-014.R2 the warning is on exactly while the session has unexported changes', () => {
    const calls: boolean[] = [];
    const stop = startLeaveWarning((on) => calls.push(on));
    startNewSession(image());
    expect(calls.at(-1)).toBe(false); // RULE-18: loading by itself is not a change (F-014.AC3)
    change();
    expect(calls.at(-1)).toBe(true); // F-014.AC1
    exported();
    expect(calls.at(-1)).toBe(false); // F-014.AC2
    undo();
    expect(calls.at(-1)).toBe(true); // F-014.AC5: an undo after the export is a change
    stop();
  });
});

describe('F-014 COPY-action.clear', () => {
  it('F-014.AC6 with no unexported changes, the empty state shows at once with no dialog', async () => {
    const shown = image();
    startNewSession(shown);
    await clearImage();
    expect(dialog.value).toBeNull();
    expect(loaded.value).toBeNull();
    expect(doc.value).toBeNull();
    expect(selection.value).toEqual([]);
    expect(shown.bitmap.close).toHaveBeenCalledOnce(); // NFR-04
  });

  it('F-014.AC4 with unexported changes, CMP-ConfirmDialog "clear" asks; confirming returns to the empty state', async () => {
    startNewSession(image());
    change();
    const done = clearImage();
    await settle();
    expect(dialog.value?.kind).toBe('clear');
    expect(loaded.value).not.toBeNull();
    dialog.value!.answer(true);
    await done;
    expect(dialog.value).toBeNull();
    expect(loaded.value).toBeNull();
    // RULE-11: starting over can't be undone, and the empty state has nothing unexported.
    expect([canUndo.value, canRedo.value, unexported.value]).toEqual([false, false, false]);
  });

  it('F-014.R3 CMP-ConfirmDialog cancelling the clear confirmation keeps everything', async () => {
    const session = startNewSession(image());
    change();
    const before = doc.value;
    const done = clearImage();
    await settle();
    dialog.value!.answer(false);
    await done;
    expect(loaded.value?.session).toBe(session);
    expect(doc.value).toBe(before);
    expect(unexported.value).toBe(true);
    expect(canUndo.value).toBe(true);
  });

  it('F-014.R3 with no image, clearing does nothing', async () => {
    startNewSession(image());
    await clearImage();
    await clearImage();
    expect(dialog.value).toBeNull();
    expect(loaded.value).toBeNull();
  });

  it('CMP-Toolbar COPY-action.more holds COPY-action.clear in a group of its own, last; unavailable with no image', () => {
    const ids = (narrow: boolean, has: boolean) => moreItems(narrow, has).map((g) => g.map((i) => i.id));
    expect(ids(false, true)).toEqual([['shortcuts'], ['clear']]);
    expect(ids(true, true)).toEqual([['download', 'shortcuts'], ['clear']]);
    expect(moreItems(false, false).at(-1)?.[0]?.disabled).toBe(true);
    expect(moreItems(false, true).at(-1)?.[0]?.disabled).toBeFalsy();
    expect(moreItems(false, true).at(-1)?.[0]?.label).toBe('Start over');
  });
});
