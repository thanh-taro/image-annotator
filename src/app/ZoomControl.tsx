// CMP-StatusBar — the zoom control (F-002.R2/R5): COPY-action.zoom_out, COPY-status.zoom,
// COPY-action.zoom_in, COPY-action.zoom_fit and COPY-action.zoom_actual at the end of the status bar.
// Narrow widths (D-014) move Fit and Actual size into a menu opened from the level (COPY-a11y.zoom_menu).
// With no image the controls are disabled (CMP-StatusBar "no image"). The level updates live but is not
// announced; the zoom buttons are described by it, so it is read when they get focus.
// Implements: F-002.R2, F-002.R5, CMP-StatusBar (zoom; variants narrow and no image).
import { useLayoutEffect, useRef, useState } from 'preact/hooks';
import { viewCommands } from '../canvas';
import { t } from '../copy';
import { Icon } from './icons';
import { modShortcut } from './platform';
import { zoomLevel } from './state';

/** The level shown: whole percent, at least 1 (COPY-status.zoom). */
export const zoomPercent = (zoom: number) => Math.max(1, Math.round(zoom));

function ZoomMenu({ onClose }: { onClose: (refocus: boolean) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  // Focus moves into the menu as soon as it is shown, so the next key already reaches it.
  useLayoutEffect(() => {
    ref.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus();
  }, []);
  const choose = (run: () => void) => () => {
    run();
    onClose(true);
  };
  const onKeyDown = (e: KeyboardEvent) => {
    const items = Array.from(ref.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? []);
    const i = items.indexOf(document.activeElement as HTMLElement);
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      onClose(true);
    } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      const step = e.key === 'ArrowDown' ? 1 : -1;
      items[(i + step + items.length) % items.length]?.focus();
    } else if (e.key === 'Tab') {
      onClose(false);
    }
  };
  const onFocusOut = (e: FocusEvent) => {
    // Focus moving to the level button is left to its click, which toggles the menu closed.
    if (!ref.current?.parentElement?.contains(e.relatedTarget as Node | null)) onClose(false);
  };
  return (
    // eslint-disable-next-line jsx-a11y/interactive-supports-focus -- focus lives on the menu items
    <div ref={ref} class="tk-zoom__menu" role="menu" onKeyDown={onKeyDown} onFocusOut={onFocusOut}>
      <button type="button" role="menuitem" class="tk-zoom__item" onClick={choose(viewCommands.fit)}>
        {t('action.zoom_fit')}
      </button>
      <button type="button" role="menuitem" class="tk-zoom__item" onClick={choose(viewCommands.actualSize)}>
        {t('action.zoom_actual')}
      </button>
    </div>
  );
}

export function ZoomControl() {
  const zoom = zoomLevel.value; // the zoom only: a pan does not re-render this control
  const percent = zoom === null ? 0 : zoomPercent(zoom);
  const off = zoom === null;
  const [menu, setMenu] = useState(false);
  const menuButton = useRef<HTMLButtonElement>(null);
  const closeMenu = (refocus: boolean) => {
    setMenu(false);
    if (refocus) menuButton.current?.focus();
  };

  return (
    <div class="tk-zoom" data-state={off ? 'no-image' : 'default'}>
      <button
        type="button"
        class="tk-zoom__step"
        aria-label={t('action.zoom_out')}
        aria-describedby={off ? undefined : 'tk-zoom-level'}
        aria-keyshortcuts={modShortcut('-')}
        disabled={off}
        onClick={viewCommands.zoomOut}
      >
        <Icon name="minus" />
      </button>
      {off ? (
        <span class="tk-zoom__level" aria-hidden="true">
          {t('status.zoom_none')}
        </span>
      ) : (
        <span id="tk-zoom-level" class="tk-zoom__level tk-zoom__level--wide">
          {t('status.zoom', { percent })}
        </span>
      )}
      {!off && (
        // eslint-disable-next-line jsx-a11y/no-static-element-interactions -- Esc from the level button
        <span
          class="tk-zoom__anchor"
          onKeyDown={(e) => {
            if (menu && e.key === 'Escape') {
              e.preventDefault();
              closeMenu(true);
            }
          }}
        >
          <button
            ref={menuButton}
            type="button"
            class="tk-zoom__menu-button"
            aria-haspopup="menu"
            aria-expanded={menu}
            aria-label={t('a11y.zoom_menu', { percent })}
            onClick={() => setMenu(!menu)}
          >
            <span aria-hidden="true">{t('status.zoom', { percent })}</span>
            <Icon name="chevronDown" />
          </button>
          {menu && <ZoomMenu onClose={closeMenu} />}
        </span>
      )}
      <button
        type="button"
        class="tk-zoom__step"
        aria-label={t('action.zoom_in')}
        aria-describedby={off ? undefined : 'tk-zoom-level'}
        aria-keyshortcuts={modShortcut('=')}
        disabled={off}
        onClick={viewCommands.zoomIn}
      >
        <Icon name="plus" />
      </button>
      <button type="button" class="tk-zoom__text" aria-keyshortcuts="Shift+1" disabled={off} onClick={viewCommands.fit}>
        {t('action.zoom_fit')}
      </button>
      <button
        type="button"
        class="tk-zoom__text"
        aria-keyshortcuts="Shift+0"
        disabled={off}
        onClick={viewCommands.actualSize}
      >
        {t('action.zoom_actual')}
      </button>
    </div>
  );
}
