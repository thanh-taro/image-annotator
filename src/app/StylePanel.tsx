// CMP-StylePanel (F-003 scope): the colour swatches, size and fill of the active drawing tool's current
// style, or of the selection (only the choices every selected kind shares; a choice whose selected
// annotations differ has nothing marked). Changes apply immediately (RULE-04). Position and size
// fields and selection actions (F-008), canvas settings (F-011) and crop fields (F-010) are added in the
// slots marked below. Redactions (F-007) show COPY-redact.kind first (solid with a check icon; blur and
// pixelate tagged COPY-redact.not_secure_short); blur and pixelate add the inline not-secure note
// (COPY-redact.not_secure, not a dialog) with COPY-redact.use_solid, then COPY-style.strength; solid has
// colour only — never opacity, fill or size (F-007.R2).
// Narrow widths (D-019): a summary bar (COPY-style.sheet_toggle: COPY-style.sheet_summary) between the
// work area and the status bar; it, or the active tool tapped again, opens the panel as a bottom sheet
// over the lower part of the work area, at most half its height including the bar, scrolling inside.
// The view moves above it (MOD-Canvas bottom inset) and is restored when it closes; Esc closes it.
// Opening it does not move focus. Selecting annotations updates the bar and does not open it.
// Implements: CMP-StylePanel (anatomy: colour, size, fill; variants tool, selection, narrow), F-003.R3,
// RULE-04, NFR-06 (colour choices named, not shown by colour alone); F-007.R2/R4/R6, RULE-10 (not-secure
// labels wherever blur and pixelate are shown or chosen), style.md principle 5 (honest safety).
import { useLayoutEffect, useRef } from 'preact/hooks';
import { viewCommands } from '../canvas';
import { t, type MessageId } from '../copy';
import type { ComponentChildren } from 'preact';
import { PALETTE_NAMES, type Colour, type Fill, type RedactionKind, type Size } from '../core';
import { panelModel, setStyle, sizeLabel, summaryDetail, type PanelModel } from './drawing';
import { Icon } from './icons';
import { currentStyles, doc, layout, selection, sheetOpen, tool } from './state';

const COLOUR_COPY = {
  red: 'color.red',
  orange: 'color.orange',
  yellow: 'color.yellow',
  green: 'color.green',
  blue: 'color.blue',
  purple: 'color.purple',
  black: 'color.black',
  white: 'color.white',
} as const satisfies Record<Colour, MessageId>;

const FILL_COPY = {
  none: 'style.fill_none',
  solid: 'style.fill_solid',
  translucent: 'style.fill_translucent',
} as const satisfies Record<Fill, MessageId>;

const KIND_COPY = {
  solid: 'redact.solid',
  blur: 'redact.blur',
  pixelate: 'redact.pixelate',
} as const satisfies Record<RedactionKind, MessageId>;
const KIND_ICON = { solid: 'shieldCheck', blur: 'blur', pixelate: 'pixelate' } as const;
const KINDS: readonly RedactionKind[] = ['solid', 'blur', 'pixelate'];

const SIZES: readonly Size[] = ['S', 'M', 'L'];
const FILLS: readonly Fill[] = ['none', 'solid', 'translucent'];

/** A labelled group of native radio buttons (arrow keys move and choose, as in any radio group). */
function Choice<T extends string>(props: {
  name: string;
  legend: string;
  values: readonly T[];
  value: T | null | undefined;
  label: (v: T) => string;
  onPick: (v: T) => void;
  swatches?: boolean;
  /** A vertical list of choices with their own content (the redaction kinds). */
  list?: (v: T) => ComponentChildren;
  children?: ComponentChildren;
}) {
  const { name, legend, values, value, label, onPick, swatches, list, children } = props;
  const group = swatches ? 'tk-swatches' : list ? 'tk-kinds' : 'tk-segmented';
  const item = (v: T) => (swatches ? `tk-swatch tk-swatch--${v}` : list ? 'tk-kind' : 'tk-segment');
  return (
    <fieldset class="tk-panel__section">
      <legend class="tk-panel__heading">{legend}</legend>
      <div class={group}>
        {values.map((v) => (
          <label key={v} class={item(v)} title={swatches ? label(v) : undefined}>
            <input
              type="radio"
              class="tk-choice"
              name={name}
              value={v}
              checked={v === value}
              onChange={() => onPick(v)}
            />
            {list ? list(v) : <span class={swatches ? 'tk-sr' : 'tk-segment__text'}>{label(v)}</span>}
          </label>
        ))}
      </div>
      {children}
    </fieldset>
  );
}

/** A redaction kind choice: its icon and name; blur and pixelate carry the not-secure tag (RULE-10). */
function KindLabel({ kind }: { kind: RedactionKind }) {
  return (
    <>
      <Icon name={KIND_ICON[kind]} />
      <span class="tk-kind__text">{t(KIND_COPY[kind])}</span>
      {kind !== 'solid' && (
        <span class="tk-tag">
          <Icon name="warning" />
          {t('redact.not_secure_short')}
        </span>
      )}
    </>
  );
}

function Sections({ model }: { model: PanelModel }) {
  if (model.variant === 'canvas') return null; // Slot: padding and background (F-011).
  return (
    <>
      {model.kind !== undefined && (
        <Choice
          name="tk-style-kind"
          legend={t('redact.kind')}
          values={KINDS}
          value={model.kind}
          label={(k) => t(KIND_COPY[k])}
          onPick={(redactionKind) => setStyle({ redactionKind })}
          list={(k) => <KindLabel kind={k} />}
        >
          {model.notSecure && (
            <>
              {/* F-007.R4: inline, not a dialog; style.md principle 5 (accent2Fg on warnBg, icon and words). */}
              <p class="tk-warn" role="note">
                <Icon name="warning" />
                <span>{t('redact.not_secure')}</span>
              </p>
              <button
                type="button"
                class="tk-button tk-button--primary tk-panel__action"
                onClick={() => setStyle({ redactionKind: 'solid' })}
              >
                {t('redact.use_solid')}
              </button>
            </>
          )}
        </Choice>
      )}
      {model.color !== undefined && (
        <Choice
          name="tk-style-color"
          legend={t('style.color')}
          values={PALETTE_NAMES}
          value={model.color}
          label={(c) => t(COLOUR_COPY[c])}
          onPick={(color) => setStyle({ color })}
          swatches
        />
      )}
      {model.size !== undefined && (
        <Choice
          name="tk-style-size"
          legend={t('style.size')}
          values={SIZES}
          value={model.size}
          label={sizeLabel}
          onPick={(strokeSize) => setStyle({ strokeSize })}
        />
      )}
      {model.fill !== undefined && (
        <Choice
          name="tk-style-fill"
          legend={t('style.fill')}
          values={FILLS}
          value={model.fill}
          label={(f) => t(FILL_COPY[f])}
          onPick={(fill) => setStyle({ fill })}
        />
      )}
      {model.strength !== undefined && (
        <Choice
          name="tk-style-strength"
          legend={t('style.strength')}
          values={SIZES}
          value={model.strength}
          label={sizeLabel}
          onPick={(strength) => setStyle({ strength })}
        />
      )}
      {/* Slot: position and size fields, selection actions (F-008). */}
    </>
  );
}

export function StylePanel() {
  const model = panelModel(tool.value, selection.value, doc.value, currentStyles.value);
  const narrow = layout.value === 'narrow';
  const open = narrow && sheetOpen.value;
  const ref = useRef<HTMLElement>(null);
  const inner = useRef<HTMLDivElement>(null);
  const bar = useRef<HTMLButtonElement>(null);

  // D-019: the sheet is at most half the work area's height (including the bar); the canvas view moves
  // above it while it is open and comes back when it closes.
  useLayoutEffect(() => {
    const aside = ref.current;
    const box = inner.current;
    const work = aside?.closest('.tk-body')?.querySelector<HTMLElement>('.tk-work-area');
    if (!aside || !box || !work) return;
    if (!open) {
      viewCommands.setBottomInset(0);
      return;
    }
    const update = () => {
      const barHeight = bar.current?.offsetHeight ?? 0;
      aside.style.setProperty('--tk-sheet-max', `${Math.max(barHeight, (work.offsetHeight + barHeight) / 2)}px`);
      viewCommands.setBottomInset(Math.max(0, box.offsetHeight - barHeight));
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(box);
    observer.observe(work);
    return () => observer.disconnect();
  }, [open]);

  // Leaving the narrow layout closes the sheet.
  useLayoutEffect(() => {
    if (!narrow && sheetOpen.value) sheetOpen.value = false;
  }, [narrow]);

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key !== 'Escape' || !open) return;
    e.preventDefault();
    e.stopPropagation();
    sheetOpen.value = false;
    bar.current?.focus();
  };

  const detail = summaryDetail(model);
  const summary = detail ? t('style.sheet_summary', { subject: model.subject, detail }) : model.subject;
  return (
    // eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions -- Esc closes the sheet (D-019)
    <aside
      ref={ref}
      class={open ? 'tk-panel tk-panel--open' : 'tk-panel'}
      aria-label={t('a11y.style_panel')}
      data-variant={model.variant}
      onKeyDown={onKeyDown}
    >
      <div ref={inner} class="tk-panel__inner">
        {narrow && (
          <button
            ref={bar}
            type="button"
            class="tk-panel__bar"
            aria-expanded={open}
            aria-controls="tk-style-sheet"
            onClick={() => (sheetOpen.value = !sheetOpen.value)}
          >
            <span class="tk-sr">{`${t('style.sheet_toggle')}: `}</span>
            {model.color && <span class={`tk-panel__chip tk-swatch--${model.color}`} aria-hidden="true" />}
            <span class="tk-panel__summary">{summary}</span>
            <Icon name="chevronUp" class="tk-panel__chevron" />
          </button>
        )}
        <div id="tk-style-sheet" class="tk-panel__body" hidden={narrow && !open}>
          <Sections model={model} />
        </div>
      </div>
    </aside>
  );
}
