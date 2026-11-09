// MOD-IO leave-page warning (F-014.R1/R2, platform-mapping.md "Leave-page warning"): while enabled, a
// `beforeunload` event is cancelled (the browser then asks whether to leave); while disabled, the handler
// is not even registered, so leaving never asks.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { setLeaveWarning } from '../../src/io';

const leave = () => {
  const e = new Event('beforeunload', { cancelable: true });
  window.dispatchEvent(e);
  return e.defaultPrevented;
};

describe('MOD-IO setLeaveWarning', () => {
  vi.stubGlobal('window', new EventTarget());
  afterEach(() => setLeaveWarning(false));

  it('F-014.R1 while enabled, leaving the page is cancelled so the browser asks', () => {
    setLeaveWarning(true);
    expect(leave()).toBe(true);
  });

  it('F-014.R2 while disabled, leaving is not cancelled and no handler is registered', () => {
    const add = vi.spyOn(window, 'addEventListener');
    setLeaveWarning(false);
    expect(leave()).toBe(false);
    expect(add).not.toHaveBeenCalled();
    setLeaveWarning(true);
    setLeaveWarning(true); // idempotent: one handler
    expect(add).toHaveBeenCalledOnce();
    setLeaveWarning(false);
    expect(leave()).toBe(false);
    add.mockRestore();
  });
});
