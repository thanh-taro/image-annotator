// CMP-StylePanel (F-003 scope): the colour swatches, size and fill of the active drawing tool's current
// style, or of the selection (only the choices every selected kind shares; a choice whose selected
// annotations differ has nothing marked). Changes apply immediately (RULE-04). Position and size
// fields and selection actions (F-008), redaction choices (F-007), canvas settings (F-011) and crop
// fields (F-010) are added in the slots marked below.
// Narrow widths (D-019): a summary bar (COPY-style.sheet_toggle: COPY-style.sheet_summary) between the
// work area and the status bar; it, or the active tool tapped again, opens the panel as a bottom sheet
// over the lower part of the work area, at most half its height including the bar, scrolling inside.
// The view moves above it (MOD-Canvas bottom inset) and is restored when it closes; Esc closes it.
// Opening it does not move focus. Selecting annotations updates the bar and does not open it.
// Implements: CMP-StylePanel (anatomy: colour, size, fill; variants tool, selection, narrow), F-003.R3,
// RULE-04, NFR-06 (colour choices named, not shown by colour alone).
import { useLayoutEffect, useRef } from 'preact/hooks';
import { viewCommands } from '../canvas';
import { t, type MessageId } from '../copy';
import { PALETTE_NAMES, type Colour, type Fill, type Size } from '../core';
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
}) {
  const { name, legend, values, value, label, onPick, swatches } = props;
  return (
    <fieldset class="tk-panel__section">
      <legend class="tk-panel__heading">{legend}</legend>
      <div class={swatches ? 'tk-swatches' : 'tk-segmented'}>
        {values.map((v) => (
          <label
            key={v}
            class={swatches ? `tk-swatch tk-swatch--${v}` : 'tk-segment'}
            title={swatches ? label(v) : undefined}
          >
            <input
              type="radio"
              class="tk-choice"
              name={name}
              value={v}
              checked={v === value}
              onChange={() => onPick(v)}
            />
            <span class={swatches ? 'tk-sr' : 'tk-segment__text'}>{label(v)}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

function Sections({ model }: { model: PanelModel }) {
  if (model.variant === 'canvas') return null; // Slot: padding and background (F-011).
  return (
    <>
      <Choice
        name="tk-style-color"
        legend={t('style.color')}
        values={PALETTE_NAMES}
        value={model.color}
        label={(c) => t(COLOUR_COPY[c])}
        onPick={(color) => setStyle({ color })}
        swatches
      />
      <Choice
        name="tk-style-size"
        legend={t('style.size')}
        values={SIZES}
        value={model.size}
        label={sizeLabel}
        onPick={(strokeSize) => setStyle({ strokeSize })}
      />
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
      {/* Slot: position and size fields, selection actions (F-008); redaction kind and strength (F-007). */}
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
