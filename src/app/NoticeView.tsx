// CMP-Notice: one short, non-blocking message. Errors stay until dismissed or the next action;
// success disappears after 4 s (paused while the pointer or focus is on it); progress has no close.
// It has no live role and never takes focus: ./state.ts writes its text into the live regions.
import { useEffect, useRef, useState } from 'preact/hooks';
import { t } from '../copy';
import { Icon, type IconName } from './icons';
import type { Notice } from './notice';
import { setNotice } from './state';

export const SUCCESS_MS = 4000;

const ICONS: Record<Notice['kind'], IconName> = { success: 'check', error: 'alert', progress: 'spinner' };

export function NoticeView({ notice }: { notice: Notice }) {
  const [paused, setPaused] = useState(0);
  const close = () => setNotice(null);

  useEffect(() => {
    if (notice.kind !== 'success' || paused > 0) return;
    const id = setTimeout(close, SUCCESS_MS);
    return () => clearTimeout(id);
  }, [notice, paused]);

  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const pause = () => setPaused((n) => n + 1);
    const resume = () => setPaused((n) => Math.max(0, n - 1));
    // Esc closes the notice while focus is on it (CMP-Notice "Accessibility").
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && notice.kind !== 'progress') {
        e.stopPropagation();
        setNotice(null);
      }
    };
    const events = [
      ['pointerenter', pause],
      ['pointerleave', resume],
      ['focusin', pause],
      ['focusout', resume],
      ['keydown', onKeyDown],
    ] as const;
    for (const [type, fn] of events) el.addEventListener(type, fn as EventListener);
    return () => {
      for (const [type, fn] of events) el.removeEventListener(type, fn as EventListener);
    };
  }, [notice]);

  return (
    <div class={`tk-notice tk-notice--${notice.kind}`} ref={box} data-copy-id={notice.id}>
      <Icon name={ICONS[notice.kind]} size={20} class="tk-notice__icon" />
      <p class="tk-notice__text">{notice.text()}</p>
      {notice.kind !== 'progress' && (
        <button type="button" class="tk-icon-button" aria-label={t('action.close')} onClick={close}>
          <Icon name="close" />
        </button>
      )}
    </div>
  );
}
