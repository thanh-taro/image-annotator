// CMP-Toolbar's COPY-action.more overflow: a menu button at the end of the toolbar row on every layout
// (since F-013; F-012 showed it on narrow widths only). Its items come in groups with a line between them,
// so a feature adds its own (F-014 adds COPY-action.clear as a group of its own after the shortcuts):
// on narrow widths COPY-action.download, then COPY-action.shortcuts. The first enabled item takes focus when
// it opens; Up and Down move between items, Esc closes it and returns focus to the button, Tab or a press
// outside closes it. Choosing an item closes the menu (focus back on the button) before it runs.
// Implements: CMP-Toolbar (anatomy: COPY-action.more; variant narrow), F-013.R3 (COPY-action.shortcuts),
// F-012.R2 (download on narrow widths), adapters/design.md "COPY-action.more".
import { useLayoutEffect, useRef, useState } from 'preact/hooks';
import { t } from '../copy';
import { downloadNow } from './exporter';
import { Icon } from './icons';
import { modShortcut } from './platform';
import { showShortcuts } from './shortcuts';
import { layout, loaded } from './state';

/** One item of the overflow menu. */
export interface MenuItem {
  readonly id: string;
  readonly label: string;
  /** aria-keyshortcuts (RULE-19), when the item has a shortcut that works from the menu's context. */
  readonly keys?: string;
  readonly disabled?: boolean;
  readonly run: () => void;
}

/** The items per layout, in groups (CMP-Toolbar anatomy and "narrow"; the Clear group joins with F-014). */
export function moreItems(narrow: boolean, hasImage: boolean): readonly (readonly MenuItem[])[] {
  const download: MenuItem = {
    id: 'download',
    label: t('action.download'),
    keys: modShortcut('S'),
    disabled: !hasImage,
    run: downloadNow,
  };
  const shortcuts: MenuItem = {
    id: 'shortcuts',
    label: t('action.shortcuts'),
    // No aria-keyshortcuts: ? works only while the canvas has focus (RULE-19), not from the menu.
    run: showShortcuts,
  };
  return [narrow ? [download, shortcuts] : [shortcuts]];
}

/** COPY-action.more: the menu button and, while open, its menu. */
export function MoreMenu() {
  const [open, setOpen] = useState(false);
  const button = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const groups = moreItems(layout.value === 'narrow', !!loaded.value);

  useLayoutEffect(() => {
    if (!open) return;
    menu.current?.querySelector<HTMLButtonElement>('[role="menuitem"]:not(:disabled)')?.focus();
    const onPointer = (e: PointerEvent) => {
      const target = e.target as Node;
      if (!menu.current?.contains(target) && !button.current?.contains(target)) setOpen(false);
    };
    document.addEventListener('pointerdown', onPointer, true);
    return () => document.removeEventListener('pointerdown', onPointer, true);
  }, [open]);

  const close = () => {
    setOpen(false);
    button.current?.focus();
  };
  const onKeyDown = (e: KeyboardEvent) => {
    const items = Array.from(menu.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]') ?? []).filter(
      (b) => !b.disabled,
    );
    const i = items.indexOf(document.activeElement as HTMLButtonElement);
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      close();
    } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      const n = items.length;
      if (n) items[(i + (e.key === 'ArrowDown' ? 1 : n - 1)) % n]?.focus();
    } else if (e.key === 'Tab') setOpen(false);
  };

  return (
    <div class="tk-more">
      <button
        ref={button}
        type="button"
        class="tk-tool"
        aria-label={t('action.more')}
        title={t('action.more')}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        <Icon name="more" size={20} />
      </button>
      {open && (
        // eslint-disable-next-line jsx-a11y/interactive-supports-focus -- APG menu: the items take focus
        <div ref={menu} class="tk-menu" role="menu" aria-label={t('action.more')} onKeyDown={onKeyDown}>
          {groups.map((group, g) => [
            g > 0 && <div key={`sep-${g}`} class="tk-menu__separator" role="separator" />,
            ...group.map((item) => (
              <button
                key={item.id}
                type="button"
                role="menuitem"
                class="tk-menu__item"
                data-item={item.id}
                aria-keyshortcuts={item.keys}
                disabled={item.disabled}
                tabIndex={-1}
                onClick={() => {
                  close();
                  item.run();
                }}
              >
                {item.label}
              </button>
            )),
          ])}
        </div>
      )}
    </div>
  );
}
