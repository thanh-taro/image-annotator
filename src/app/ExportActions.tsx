// CMP-Toolbar export actions (F-012): the live redaction count (COPY-export.redaction_count, RULE-20,
// hidden at 0), COPY-action.copy (primary) and COPY-action.download, and on narrow widths the overflow
// (COPY-action.more) holding the download. In compact and narrow layouts the count shows an icon and the
// number only, with its full text as the accessible name, whenever its full text would not fit on its row
// (CMP-Toolbar "count fallback"). Export is disabled with no image (CMP-Toolbar "no image").
// The overflow's other items (COPY-action.clear, COPY-action.shortcuts) join with F-014 and F-013; until
// then the overflow is shown only on narrow widths, where it holds the download.
// Implements: F-012.R1/R2/R8, RULE-20, CMP-Toolbar (anatomy, variants compact, narrow, count fallback).
import { useLayoutEffect, useRef, useState } from 'preact/hooks';
import { formatNumber, language, t } from '../copy';
import { copyNow, downloadNow } from './exporter';
import { Icon } from './icons';
import { modShortcut } from './platform';
import { layout, loaded, redactions } from './state';

/** The live redaction count; switches to icon + number when its full text would not fit (compact, narrow). */
function RedactionCount() {
  const count = redactions.value;
  const lang = language.value;
  const full = t('export.redaction_count', { count });
  const pill = useRef<HTMLSpanElement>(null);
  const probe = useRef<HTMLSpanElement>(null);
  const [short, setShort] = useState(false);
  const wide = layout.value === 'wide';

  useLayoutEffect(() => {
    const el = pill.current;
    const row = el?.closest<HTMLElement>('.tk-toolbar__row');
    if (!el || !row || wide) {
      setShort(false);
      return;
    }
    const measure = () => {
      const spacer = row.querySelector<HTMLElement>('.tk-toolbar__spacer');
      const full = probe.current?.offsetWidth ?? 0;
      // The row's content without the flexible spacer, with the full text in place of what is shown now,
      // and with what the other items were squeezed by added back (a squeezed tool group still needs it).
      let squeezed = 0;
      for (const c of row.children)
        if (c !== el && c !== spacer && !c.contains(probe.current) && c instanceof HTMLElement)
          squeezed += Math.max(0, c.scrollWidth - c.offsetWidth);
      const needed = row.scrollWidth - (spacer?.offsetWidth ?? 0) - el.offsetWidth + full + squeezed;
      setShort(needed > row.clientWidth);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(row);
    return () => observer.disconnect();
  }, [count, lang, wide]);

  if (count < 1) return null;
  return (
    <>
      {short ? (
        <span ref={pill} class="tk-count tk-count--short" role="img" aria-label={full} title={full}>
          <Icon name="redact" />
          {formatNumber(count)}
        </span>
      ) : (
        <span ref={pill} class="tk-count">
          {full}
        </span>
      )}
      {!wide && (
        <span class="tk-count-probe" aria-hidden="true">
          <span ref={probe} class="tk-count">
            {full}
          </span>
        </span>
      )}
    </>
  );
}

function CopyButton({ disabled }: { disabled: boolean }) {
  return (
    <button
      type="button"
      class="tk-button tk-button--filled"
      aria-keyshortcuts={modShortcut('C')}
      disabled={disabled}
      onClick={copyNow}
    >
      <Icon name="copy" />
      {t('action.copy')}
    </button>
  );
}

function DownloadButton({ disabled, icon }: { disabled: boolean; icon: boolean }) {
  return (
    <button
      type="button"
      class={icon ? 'tk-tool' : 'tk-button'}
      aria-label={icon ? t('action.download') : undefined}
      title={icon ? t('action.download') : undefined}
      aria-keyshortcuts={modShortcut('S')}
      disabled={disabled}
      onClick={downloadNow}
    >
      <Icon name="download" size={icon ? 20 : 16} />
      {!icon && t('action.download')}
    </button>
  );
}

/** COPY-action.more: a menu button (narrow: it holds COPY-action.download). Esc closes it, focus returns. */
function MoreMenu({ disabled }: { disabled: boolean }) {
  const [open, setOpen] = useState(false);
  const button = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);

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
          <button
            type="button"
            role="menuitem"
            class="tk-menu__item"
            aria-keyshortcuts={modShortcut('S')}
            disabled={disabled}
            tabIndex={-1}
            onClick={() => {
              close();
              downloadNow();
            }}
          >
            {t('action.download')}
          </button>
        </div>
      )}
    </div>
  );
}

/** The export end of the toolbar row, per layout (CMP-Toolbar anatomy and variants). */
export function ExportActions() {
  const disabled = !loaded.value;
  const mode = layout.value;
  return (
    <>
      <RedactionCount />
      <CopyButton disabled={disabled} />
      {mode === 'narrow' ? (
        <MoreMenu disabled={disabled} />
      ) : (
        <DownloadButton disabled={disabled} icon={mode === 'compact'} />
      )}
    </>
  );
}
