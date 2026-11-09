// CMP-Toolbar export actions (F-012): the live redaction count (COPY-export.redaction_count, RULE-20,
// hidden at 0), COPY-action.copy (primary) and COPY-action.download, which on narrow widths is in the
// COPY-action.more overflow instead (./MoreMenu.tsx, moved into the toolbar with F-013). In compact and
// narrow layouts the count shows an icon and the number only, with its full text as the accessible name,
// whenever its full text would not fit on its row (CMP-Toolbar "count fallback"). Export is disabled with
// no image (CMP-Toolbar "no image").
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
      // Measured with COPY-action.copy's label on one line: its label wraps (narrow, F-018.R7) only when
      // the row does not fit even with the short count.
      row.classList.add('tk-toolbar__row--measuring');
      const spacer = row.querySelector<HTMLElement>('.tk-toolbar__spacer');
      const full = probe.current?.offsetWidth ?? 0;
      // The row's content without the flexible spacer, with the full text in place of what is shown now,
      // and with what the other items were squeezed by added back (a squeezed tool group still needs it).
      let squeezed = 0;
      for (const c of row.children)
        if (c !== el && c !== spacer && !c.contains(probe.current) && c instanceof HTMLElement)
          squeezed += Math.max(0, c.scrollWidth - c.offsetWidth);
      const needed = row.scrollWidth - (spacer?.offsetWidth ?? 0) - el.offsetWidth + full + squeezed;
      row.classList.remove('tk-toolbar__row--measuring');
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

/** The export end of the toolbar row, per layout (CMP-Toolbar anatomy and variants). */
export function ExportActions() {
  const disabled = !loaded.value;
  const mode = layout.value;
  return (
    <>
      <RedactionCount />
      <CopyButton disabled={disabled} />
      {/* Narrow: COPY-action.download is in the COPY-action.more menu (./MoreMenu.tsx). */}
      {mode !== 'narrow' && <DownloadButton disabled={disabled} icon={mode === 'compact'} />}
    </>
  );
}
