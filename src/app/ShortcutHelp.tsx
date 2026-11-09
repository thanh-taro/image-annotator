// CMP-ShortcutHelp (F-013.R3): every RULE-19 key with its action, grouped as RULE-19 groups them, from
// MOD-Keys `shortcutList` with Ctrl or ⌘ for the user's OS. Entries reuse the tool and action names and
// COPY-shortcut.*; key labels are printed as on the keyboard (never translated), pointer words and spoken
// key names come from COPY-key.* in the tool's language (MOD-Keys gives their IDs), and for screen readers
// each row reads "name, spoken keys" (a hidden separator between them). Modal: focus moves to COPY-action.close, Tab stays inside (the close
// button and the scrolling list), Esc closes, and focus returns to what opened it; the shell makes the
// rest of the tool inert, so RULE-19 keys and the canvas live regions are off while it is open.
// Two columns over the work area; one on narrow widths, inside 16 px gutters (CMP-ShortcutHelp design).
// Implements: F-013.R3, CMP-ShortcutHelp (anatomy, behaviour, accessibility).
import { useLayoutEffect, useRef } from 'preact/hooks';
import { t, type MessageId } from '../copy';
import { keyText, shortcutList } from '../keys';
import { returnFocusLater } from './focus';
import { Icon } from './icons';
import { isMac } from './platform';
import { closeShortcuts, takeOpener } from './shortcuts';
import { layout } from './state';

const GROUPS = shortcutList(isMac);

/** MOD-Keys names its groups, entries and key words by COPY ID; none has placeholders (keys.map.test.ts). */
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
      returnFocusLater(takeOpener());
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
        {/* No role or name of its own: it would repeat the dialog's (a11y review m5). */}
        {/* eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex -- a scrolling region must be focusable (axe scrollable-region-focusable) */}
        <div class="tk-shortcuts__body" tabIndex={0}>
          <div class="tk-shortcuts__cols">
            {GROUPS.map((group) => (
              <section key={group.copyId} class="tk-shortcuts__group">
                <h3 class="tk-shortcuts__group-title">{label(group.copyId)}</h3>
                <ul class="tk-shortcuts__rows">
                  {group.rows.map((row) => (
                    <li key={`${row.copyId}-${keyText(row.printed, label)}`} class="tk-shortcuts__row">
                      <span>{label(row.copyId)}</span>
                      <kbd class="tk-kbd" aria-hidden="true">
                        {keyText(row.printed, label)}
                      </kbd>
                      <span class="tk-sr">, {keyText(row.spoken, label, true)}</span>
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
