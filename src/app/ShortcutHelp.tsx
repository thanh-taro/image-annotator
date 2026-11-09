// CMP-ShortcutHelp (F-013.R3): every RULE-19 key with its action, grouped as RULE-19 groups them, from
// MOD-Keys `shortcutList` with Ctrl or ⌘ for the user's OS. Entries reuse the tool and action names and
// COPY-shortcut.*; key labels are printed as on the keyboard (never translated) and, for screen readers,
// also given as spoken names in text. Modal: focus moves to COPY-action.close, Tab stays inside (the close
// button and the scrolling list), Esc closes, and focus returns to what opened it; the shell makes the
// rest of the tool inert, so RULE-19 keys and the canvas live regions are off while it is open.
// Two columns over the work area; one on narrow widths, inside 16 px gutters (CMP-ShortcutHelp design).
// Implements: F-013.R3, CMP-ShortcutHelp (anatomy, behaviour, accessibility).
import { useLayoutEffect, useRef } from 'preact/hooks';
import { t, type MessageId } from '../copy';
import { shortcutList } from '../keys';
import { Icon } from './icons';
import { isMac } from './platform';
import { closeShortcuts, takeOpener } from './shortcuts';
import { layout } from './state';

const GROUPS = shortcutList(isMac);

/** MOD-Keys names its groups and entries by COPY ID; none of them has placeholders (keys.map.test.ts). */
const label = (id: string): string => (t as (id: MessageId) => string)(id as MessageId);

export function ShortcutHelp() {
  const box = useRef<HTMLDivElement>(null);
  const close = useRef<HTMLButtonElement>(null);

  // Layout effect: focus and the key trap are in place as soon as the dialog shows (no key slips past).
  useLayoutEffect(() => {
    close.current?.focus();
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        closeShortcuts();
      } else if (e.key === 'Tab') {
        const items = Array.from(box.current?.querySelectorAll<HTMLElement>('button, [tabindex="0"]') ?? []);
        const i = items.indexOf(document.activeElement as HTMLElement);
        const step = e.shiftKey ? items.length - 1 : 1;
        e.preventDefault();
        e.stopPropagation();
        items[i < 0 ? 0 : (i + step) % items.length]?.focus();
      }
    };
    document.addEventListener('keydown', onKeyDown, true);
    return () => {
      document.removeEventListener('keydown', onKeyDown, true);
      const returnTo = takeOpener();
      // After this render, once the rest of the tool is no longer inert. What opened it may be gone (the
      // menu item, or the canvas after a new image): the canvas region keeps keyboard users in the tool.
      queueMicrotask(() => {
        const target =
          returnTo instanceof HTMLElement && returnTo.isConnected
            ? returnTo
            : document.querySelector<HTMLElement>('.tk-work-area');
        target?.focus({ preventScroll: true });
      });
    };
  }, []);

  const narrow = layout.value === 'narrow';
  return (
    <div class="tk-scrim tk-scrim--shortcuts">
      <div
        ref={box}
        class={narrow ? 'tk-shortcuts tk-shortcuts--narrow' : 'tk-shortcuts'}
        role="dialog"
        aria-modal="true"
        aria-labelledby="tk-shortcuts-title"
        data-component="CMP-ShortcutHelp"
      >
        <div class="tk-shortcuts__head">
          <h2 id="tk-shortcuts-title" class="tk-shortcuts__title">
            {t('shortcuts.title')}
          </h2>
          <button
            ref={close}
            type="button"
            class="tk-icon-button tk-shortcuts__close"
            aria-label={t('action.close')}
            title={t('action.close')}
            onClick={closeShortcuts}
          >
            <Icon name="close" />
          </button>
        </div>
        <p class="tk-shortcuts__note">{t('shortcuts.scope_note')}</p>
        {/* The list scrolls when it does not fit, so it is focusable for keyboard scrolling (WCAG 2.1.1). */}
        {/* eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex -- a scrolling region must be focusable (axe scrollable-region-focusable) */}
        <div class="tk-shortcuts__body" role="region" tabIndex={0} aria-label={t('shortcuts.title')}>
          <div class="tk-shortcuts__cols">
            {GROUPS.map((group) => (
              <section key={group.copyId} class="tk-shortcuts__group" aria-labelledby={`tk-sg-${group.copyId}`}>
                <h3 id={`tk-sg-${group.copyId}`} class="tk-shortcuts__group-title">
                  {label(group.copyId)}
                </h3>
                <ul class="tk-shortcuts__rows">
                  {group.rows.map((row) => (
                    <li key={`${row.copyId}-${row.keys}`} class="tk-shortcuts__row">
                      <span>{label(row.copyId)}</span>
                      <kbd class="tk-kbd" aria-hidden="true">
                        {row.keys}
                      </kbd>
                      <span class="tk-sr">{row.spoken}</span>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
