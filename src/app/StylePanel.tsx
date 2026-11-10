// CMP-StylePanel (F-003 scope): the colour swatches, size and fill of the active drawing tool's current
// style, or of the selection (only the choices every selected kind shares; a choice whose selected
// annotations differ has nothing marked). Changes apply immediately (RULE-04). F-008 adds the position
// and size fields of a single selection and the selection actions (not while a text is edited); canvas
// settings (F-011: padding and background, with nothing selected and the select tool); the crop tool shows the frame's (F-010). Redactions (F-007) show COPY-redact.kind first (solid with a check icon; blur and
// pixelate tagged COPY-redact.not_secure_short); blur and pixelate add the inline not-secure note
// (COPY-redact.not_secure, not a dialog) with COPY-redact.use_solid, then COPY-style.strength; solid has
// colour only — never opacity, fill or size (F-007.R2).
// Narrow widths (D-019): a summary bar (COPY-style.sheet_toggle: COPY-style.sheet_summary) between the
// work area and the status bar; it, or the active tool tapped again, opens the panel as a bottom sheet
// over the lower part of the work area, at most half its height including the bar, scrolling inside.
// The view moves above it (MOD-Canvas bottom inset) and is restored when it closes; Esc closes it.
// Opening it does not move focus. Selecting annotations updates the bar and does not open it.
// Implements: CMP-StylePanel (anatomy: colour, size, fill; variants tool, selection, narrow; the canvas heading, D-046; the drawing colour in canvas settings, D-047), F-003.R3,
// RULE-04, NFR-06 (colour choices named, not shown by colour alone); F-007.R2/R4/R6, RULE-10 (not-secure
// labels wherever blur and pixelate are shown or chosen), style.md principle 5 (honest safety);
// F-008.R4/R5/R8, D-008, NFR-06 (the position and size fields are the non-drag alternative); F-010.R3/R4/R6
// (CMP-StylePanel "crop": frame size, position and size fields, reset); F-011.R1/R2/R5, RULE-14 (CMP-StylePanel
// "canvas": the padding sizes, the unavailable ones disabled with COPY-canvas.padding_unavailable, and the
// background, transparent or a palette colour).
// F-019 (M-1b): the annotation colour groups (the style's and the canvas drawing colour, not the background)
// are an ARIA radio group with a roving tabindex whose ninth option is the custom swatch: it drives a
// visually hidden colour input (showPicker, else click) whose `input` events preview and chain into one
// step, `change` or focus leaving ends the chain, and `cancel` restores the colour (platform-mapping). The
// size choice adds the pixel field (COPY-style.size_px, applied on Enter or blur only when typed into,
// Esc restores) and, on the wide panel, a slider that applies while it moves (one step per drag).
// Implements: F-019.R1/R2/R3/R4/R5/R8/R9, RULE-21, CMP-StylePanel "Accessibility" (9 colour choices in 2
// rows of 5 on narrow widths or a coarse pointer), style.md (the custom swatch's neutral mark).
import { useEffect, useLayoutEffect, useRef, useState } from 'preact/hooks';
import { canvasCommands, viewCommands } from '../canvas';
import { t, type MessageId } from '../copy';
import type { ComponentChildren } from 'preact';
import {
  hexLabel,
  isHexColour,
  PALETTE_NAMES,
  parseCustomSize,
  type Colour,
  type Fill,
  type Frame,
  type FrameField,
  type GeometryField,
  type PaddingSize,
  type RedactionKind,
  type Size,
  type StyleColour,
} from '../core';
import { cropSizeText, resetFrame, setFrameField } from './crop';
import {
  beginCustomPick,
  cancelCustomPick,
  chooseCustomSwatch,
  customPickOpen,
  customSwatch,
  endCustomPick,
  previewCustomColour,
  type ColourTarget,
} from './custom';
import {
  paddingLabel,
  panelModel,
  setCustomSize,
  setDrawingColour,
  setStyle,
  sizeLabel,
  sizeValue,
  summaryDetail,
  type PanelModel,
} from './drawing';
import { setBackground, setPadding } from './padding';
import { deleteSelection, duplicateSelection, reorderSelection, setGeometry } from './editing';
import { Icon } from './icons';
import { currentStyles, doc, layout, loaded, selection, sheetOpen, textEditing, tool } from './state';

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
const PADDINGS: readonly PaddingSize[] = ['none', 'S', 'M', 'L'];
/** F-011.R2: the background choices, transparent first, then the palette (CMP-StylePanel "canvas"). */
const BACKGROUNDS: readonly ('transparent' | Colour)[] = ['transparent', ...PALETTE_NAMES];
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
  /** F-011.R5: choices that are shown but unavailable. */
  disabled?: (v: T) => boolean;
  /** The id of a note that describes the group. */
  describedBy?: string | undefined;
  /**
   * An explicit grid for the group: four segments (the padding sizes), or swatches in rows of five on
   * narrow widths or a coarse pointer (the 9 background choices, CMP-StylePanel "Accessibility").
   */
  columns?: 4 | 5;
  children?: ComponentChildren;
}) {
  const { name, legend, values, value, label, onPick, swatches, list, disabled, describedBy, columns, children } =
    props;
  const base = swatches ? 'tk-swatches' : list ? 'tk-kinds' : 'tk-segmented';
  const group = columns ? `${base} ${base}--${columns}` : base;
  const item = (v: T) => (swatches ? `tk-swatch tk-swatch--${v}` : list ? 'tk-kind' : 'tk-segment');
  return (
    <fieldset class="tk-panel__section" aria-describedby={describedBy}>
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
              disabled={disabled?.(v)}
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

/** The custom swatch's place in the colour radio group: the ninth option, after the palette (F-019.R1). */
const CUSTOM = 'custom';
type ColourOption = Colour | typeof CUSTOM;
const COLOUR_OPTIONS: readonly ColourOption[] = [...PALETTE_NAMES, CUSTOM];

/** The custom swatch as CMP-StylePanel shows it (F-019.R2). */
type CustomSwatch = ReturnType<typeof customSwatch>;

/** F-019.R9: while a text is edited, focus returns to it after the field applies or the picker closes. */
const backToText = () => {
  if (textEditing.value) canvasCommands.focusTextEdit();
};

/** The loaded image's shorter side, for the size field's preset widths (RULE-21); null with no image. */
const shortSideOf = (): number | null => {
  const info = loaded.value?.image.info;
  return info ? Math.min(info.width, info.height) : null;
};

/** The current panel model (the custom swatch's colour after the remembered one is applied). */
const currentModel = (): PanelModel =>
  panelModel(tool.value, selection.value, doc.value, currentStyles.value, textEditing.value !== null, shortSideOf());

const arrowStep = (key: string): number =>
  key === 'ArrowRight' || key === 'ArrowDown' ? 1 : key === 'ArrowLeft' || key === 'ArrowUp' ? -1 : 0;

/**
 * CMP-StylePanel colour swatches for annotations (COPY-style.color; the drawing colour in canvas settings,
 * D-047): an ARIA radio group with a roving tabindex, named by colour (NFR-06). An option is checked only
 * when its colour is applied: arrow keys move and choose, but arrowing onto a custom swatch with no
 * remembered colour only moves focus (F-019.R1). Clicking the custom swatch, or Enter or Space on it,
 * applies the remembered custom colour and opens the browser's picker at the swatch's colour.
 */
function ColourGroup({
  id,
  legend,
  value,
  custom,
  target,
}: {
  id: string;
  legend: string;
  value: StyleColour | null;
  custom: CustomSwatch;
  target: ColourTarget;
}) {
  const refs = useRef<(HTMLDivElement | null)[]>([]);
  const picker = useRef<HTMLInputElement>(null);
  const checked: ColourOption | null = custom.checked ? CUSTOM : value && !isHexColour(value) ? value : null;
  const tabStop = checked ?? COLOUR_OPTIONS[0];
  const pick = (c: Colour) => (target === 'drawing' ? setDrawingColour(c) : setStyle({ color: c }));

  // F-019.R8 (platform-mapping): the picker's colours preview, `change` ends the chain, and `cancel`, where
  // the browser fires one, restores the colour from before the swatch was chosen; focus moving to another
  // control also ends the chain.
  useEffect(() => {
    const input = picker.current;
    if (!input) return;
    const onInput = () => previewCustomColour(input.value);
    const onChange = () => {
      previewCustomColour(input.value);
      endCustomPick();
      backToText();
    };
    const onCancel = () => {
      cancelCustomPick();
      backToText();
    };
    const onFocusIn = (e: FocusEvent) => {
      if (customPickOpen() && e.target !== refs.current[PALETTE_NAMES.length] && e.target !== input) endCustomPick();
    };
    input.addEventListener('input', onInput);
    input.addEventListener('change', onChange);
    input.addEventListener('cancel', onCancel);
    document.addEventListener('focusin', onFocusIn);
    return () => {
      input.removeEventListener('input', onInput);
      input.removeEventListener('change', onChange);
      input.removeEventListener('cancel', onCancel);
      document.removeEventListener('focusin', onFocusIn);
    };
  }, []);

  const openPicker = () => {
    const input = picker.current;
    if (!input) return;
    beginCustomPick(target, true);
    // F-019.R1: the picker starts at the swatch's colour (the remembered one, now applied).
    const start = customSwatch(currentModel()).colour;
    if (start) input.value = start;
    try {
      input.showPicker();
    } catch {
      input.click(); // browsers without showPicker() for colour inputs
    }
  };

  const onKeyDown = (e: KeyboardEvent, index: number) => {
    const option = COLOUR_OPTIONS[index];
    if (!option) return;
    if (e.key === ' ' || e.key === 'Enter') {
      // F-019.R1: Space or Enter on the custom swatch opens the picker; Space checks a palette colour.
      if (option === CUSTOM) {
        e.preventDefault();
        openPicker();
      } else if (e.key === ' ') {
        e.preventDefault();
        pick(option);
      }
      return;
    }
    const step = arrowStep(e.key);
    if (!step || e.altKey || e.ctrlKey || e.metaKey) return;
    e.preventDefault();
    const next = (index + step + COLOUR_OPTIONS.length) % COLOUR_OPTIONS.length;
    const nextOption = COLOUR_OPTIONS[next];
    refs.current[next]?.focus();
    // Arrow keys never open the picker; an unused custom swatch only takes focus.
    if (nextOption === CUSTOM) chooseCustomSwatch(target);
    else if (nextOption) pick(nextOption);
  };

  const headingId = `${id}-label`;
  return (
    <div class="tk-panel__section">
      <div id={headingId} class="tk-panel__heading">
        {legend}
      </div>
      <div role="radiogroup" aria-labelledby={headingId} class="tk-swatches tk-swatches--5">
        {COLOUR_OPTIONS.map((option, i) => {
          const isCustom = option === CUSTOM;
          const name = !isCustom
            ? t(COLOUR_COPY[option])
            : custom.colour
              ? t('style.color_custom_value', { hex: hexLabel(custom.colour) })
              : t('style.color_custom');
          return (
            <div
              key={option}
              ref={(el) => {
                refs.current[i] = el;
              }}
              role="radio"
              aria-checked={checked === option}
              aria-label={name}
              title={name}
              tabIndex={option === tabStop ? 0 : -1}
              class={
                isCustom
                  ? `tk-swatch tk-swatch--custom${custom.colour ? ' tk-swatch--custom-set' : ''}`
                  : `tk-swatch tk-swatch--${option}`
              }
              style={isCustom && custom.colour ? { '--tk-custom-colour': custom.colour } : undefined}
              onClick={() => (isCustom ? openPicker() : pick(option))}
              onKeyDown={(e) => onKeyDown(e, i)}
            >
              {/* style.md: before any pick a neutral "pick a colour" mark, with no colour of its own. */}
              {isCustom && !custom.colour && <Icon name="palette" />}
            </div>
          );
        })}
      </div>
      {/* platform-mapping: the browser's own colour picker, opened by the custom swatch only. */}
      <input ref={picker} type="color" class="tk-sr" tabIndex={-1} aria-hidden="true" />
    </div>
  );
}

let sliderDrags = 0;

/**
 * F-019.R3/R4/R5 (RULE-21): the size in image pixels after S, M and L — a number field that applies on
 * Enter or when focus leaves it, only when typed into since it was last shown (Esc restores the shown
 * value), and on the wide panel a slider with the same range that applies while it moves (one drag, or
 * repeated keys on the same selection, one step, RULE-11). Either makes a custom size.
 */
function SizeField({ field, slider }: { field: NonNullable<PanelModel['sizeField']>; slider: boolean }) {
  const shown = field.value === null ? '' : String(field.value);
  const [draft, setDraft] = useState(shown);
  const typed = useRef(false);
  const shownValue = useRef(shown);
  useEffect(() => {
    if (shownValue.current === shown) return;
    shownValue.current = shown;
    typed.current = false;
    setDraft(shown);
  }, [shown]);
  const apply = () => {
    const px = typed.current ? parseCustomSize(field.cls, draft) : null;
    typed.current = false;
    setDraft(shown); // the new value, if any, arrives with the next render
    if (px !== null) setCustomSize(px);
  };
  const drag = useRef<string | null>(null);
  const labelId = 'tk-style-size-px';
  return (
    <div class="tk-size">
      <label class="tk-size__field">
        <span id={labelId} class="tk-size__label">
          {t('style.size_px')}
        </span>
        <input
          class="tk-size__input"
          type="number"
          inputMode="numeric"
          min={field.min}
          max={field.max}
          step={1}
          autocomplete="off"
          disabled={!field.available}
          value={draft}
          onInput={(e) => {
            typed.current = true;
            setDraft(e.currentTarget.value);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              apply();
              backToText();
            } else if (e.key === 'Escape' && typed.current) {
              // F-019.R5: Esc restores the shown value without applying it.
              e.preventDefault();
              e.stopPropagation();
              typed.current = false;
              setDraft(shown);
            }
          }}
          onBlur={apply}
        />
      </label>
      {slider && (
        <input
          class="tk-size__slider"
          type="range"
          aria-labelledby={labelId}
          aria-valuetext={field.value === null ? undefined : sizeValue(field.value)}
          min={field.min}
          max={field.max}
          step={1}
          disabled={!field.available}
          value={field.value ?? field.min}
          onPointerDown={() => {
            drag.current = `slider:${selection.value.join(',')}:${++sliderDrags}`;
          }}
          onInput={(e) => {
            const px = parseCustomSize(field.cls, e.currentTarget.value);
            if (px !== null) setCustomSize(px, drag.current ?? `slider:${selection.value.join(',')}:keys`);
          }}
          onChange={() => {
            // RULE-11: one drag is one step; repeated keys on the same selection go on chaining.
            if (!drag.current) return;
            drag.current = null;
            loaded.value?.session.history.breakChain();
          }}
        />
      )}
    </div>
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

function Sections({ model, narrow }: { model: PanelModel; narrow: boolean }) {
  if (model.canvas) return <CanvasSettings canvas={model.canvas} narrow={narrow} custom={customSwatch(model)} />;
  if (model.frame) return <Crop frame={model.frame} />;
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
        <ColourGroup
          id="tk-style-color"
          legend={t('style.color')}
          value={model.color}
          custom={customSwatch(model)}
          target="style"
        />
      )}
      {model.size !== undefined && (
        <Choice
          name="tk-style-size"
          legend={t('style.size')}
          values={SIZES}
          // F-019.R4: a custom size marks no preset.
          value={typeof model.size === 'number' ? null : model.size}
          label={sizeLabel}
          onPick={(strokeSize) => setStyle({ strokeSize })}
        >
          {model.sizeField && <SizeField field={model.sizeField} slider={!narrow} />}
        </Choice>
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
      {model.geometry && <Geometry geometry={model.geometry} />}
      {model.actions && <Actions />}
    </>
  );
}

const GEOMETRY_COPY = {
  x: 'geometry.x',
  y: 'geometry.y',
  width: 'geometry.width',
  height: 'geometry.height',
  startX: 'geometry.x',
  startY: 'geometry.y',
  endX: 'geometry.x',
  endY: 'geometry.y',
} as const satisfies Record<GeometryField, MessageId>;

/** Whole image pixels, optionally negative (a selection may sit partly off the canvas, F-008 edge case). */
const WHOLE = /^-?\d+$/;

/**
 * F-008.R8 / CMP-StylePanel "Behavior": one position or size field. It takes whole image pixels and
 * applies on Enter or when focus leaves it, as one undo step; while focused, every key is the field's
 * own (RULE-19 scope, F-008.AC16). Anything else typed goes back to the current value.
 */
function NumberField({
  field,
  value,
  onApply = setGeometry,
}: {
  field: GeometryField;
  value: number;
  /** Where a typed value goes: the selection (F-008.R8), or the frame (F-010.R6). */
  onApply?: (field: GeometryField, value: number) => void;
}) {
  const [draft, setDraft] = useState(String(value));
  // Typed into since it last applied: retyping the shown (rounded) number still applies it, so a
  // fractional position snaps to whole pixels (F-008 review m8); leaving an untouched field changes nothing.
  const typed = useRef(false);
  // Only a new value replaces the draft: the effect also runs once after mounting, which may be after the
  // user (or a test) has already typed into a freshly shown field (F-010: the crop panel appears on a click).
  const shownValue = useRef(value);
  useEffect(() => {
    if (shownValue.current === value) return;
    shownValue.current = value;
    setDraft(String(value));
  }, [value]);
  const apply = () => {
    const text = draft.trim();
    if (typed.current && WHOLE.test(text)) onApply(field, Number(text));
    typed.current = false;
    setDraft(String(value)); // the new value arrives with the next render
  };
  return (
    <label class="tk-geometry__field">
      <span>{t(GEOMETRY_COPY[field])}</span>
      <input
        class="tk-geometry__input"
        type="text"
        inputMode="numeric"
        autocomplete="off"
        spellcheck={false}
        value={draft}
        onInput={(e) => {
          typed.current = true;
          setDraft(e.currentTarget.value);
        }}
        onKeyDown={(e) => {
          if (e.key !== 'Enter') return;
          e.preventDefault();
          apply();
        }}
        onBlur={apply}
      />
    </label>
  );
}

/**
 * F-008.R8 (D-008, NFR-06): the position and size fields of a single selection under COPY-geometry.title —
 * the non-drag alternative to moving and resizing. A line's are grouped under COPY-geometry.start and
 * COPY-geometry.end, so each X and Y is named with its end.
 */
function Geometry({ geometry }: { geometry: NonNullable<PanelModel['geometry']> }) {
  const fields = (list: readonly (readonly [GeometryField, number])[]) => (
    <div class="tk-geometry__fields">
      {list.map(([field, value]) => (
        <NumberField key={field} field={field} value={value} />
      ))}
    </div>
  );
  return (
    <fieldset class="tk-panel__section">
      <legend class="tk-panel__heading">{t('geometry.title')}</legend>
      {geometry.kind === 'line' ? (
        <>
          <fieldset class="tk-panel__section">
            <legend class="tk-geometry__sub">{t('geometry.start')}</legend>
            {fields(geometry.fields.slice(0, 2))}
          </fieldset>
          <fieldset class="tk-panel__section">
            <legend class="tk-geometry__sub">{t('geometry.end')}</legend>
            {fields(geometry.fields.slice(2))}
          </fieldset>
        </>
      ) : (
        fields(geometry.fields)
      )}
    </fieldset>
  );
}

const FRAME_FIELDS: readonly FrameField[] = ['x', 'y', 'width', 'height'];

/**
 * CMP-StylePanel "crop" (F-010.R3/R4/R6, D-008): the frame's size (COPY-crop.size) under COPY-tool.crop,
 * its position and size fields under COPY-geometry.title — the non-drag alternative to dragging the frame
 * (NFR-06), applied on Enter or when focus leaves, one undo step each — and COPY-action.crop_reset.
 */
function Crop({ frame }: { frame: Frame }) {
  const values: Record<FrameField, number> = frame;
  return (
    <>
      <div class="tk-panel__section">
        <div class="tk-panel__heading">{t('tool.crop')}</div>
        <p class="tk-crop__size">{cropSizeText(frame)}</p>
      </div>
      <fieldset class="tk-panel__section">
        <legend class="tk-panel__heading">{t('geometry.title')}</legend>
        <div class="tk-geometry__fields">
          {FRAME_FIELDS.map((field) => (
            <NumberField
              key={field}
              field={field}
              value={values[field]}
              onApply={(f, v) => setFrameField(f as FrameField, v)}
            />
          ))}
        </div>
      </fieldset>
      <div class="tk-panel__section">
        <button type="button" class="tk-button tk-button--outlined tk-panel__action" onClick={resetFrame}>
          {t('action.crop_reset')}
        </button>
      </div>
    </>
  );
}

const UNAVAILABLE_NOTE = 'tk-padding-unavailable';

/**
 * CMP-StylePanel "canvas" (F-011.R1/R2/R5, RULE-14): COPY-canvas.padding — COPY-canvas.padding_none, then
 * COPY-style.size_s/m/l, the sizes whose canvas would exceed RULE-02 disabled and, when there are any,
 * COPY-canvas.padding_unavailable below them (describing the group) — and COPY-canvas.background:
 * COPY-canvas.transparent (the checkerboard), then the palette, named by colour (NFR-06). One step each.
 */
function CanvasSettings({
  canvas,
  narrow,
  custom,
}: {
  canvas: NonNullable<PanelModel['canvas']>;
  narrow: boolean;
  custom: CustomSwatch;
}) {
  const unavailable = PADDINGS.some((p) => !canvas.available.includes(p));
  return (
    <>
      {/* Implements: D-047, F-003.AC11/AC12, RULE-04 — the shared drawing colour comes first, so a colour
          picked here is the next shape's; the Canvas heading (D-046) then heads padding and background. */}
      {/* F-019.R1: the drawing colour ends with the custom swatch; the background never does (D-049). */}
      <ColourGroup
        id="tk-canvas-draw-color"
        legend={t('style.color')}
        value={canvas.drawColor}
        custom={custom}
        target="drawing"
      />
      {/* Same level and style as D-035's heading; the narrow bar's summary names it instead. */}
      {!narrow && <h2 class="tk-panel__count">{t('canvas.title')}</h2>}
      <Choice
        name="tk-canvas-padding"
        legend={t('canvas.padding')}
        values={PADDINGS}
        value={canvas.padding}
        label={paddingLabel}
        onPick={setPadding}
        disabled={(p) => !canvas.available.includes(p)}
        describedBy={unavailable ? UNAVAILABLE_NOTE : undefined}
        columns={4}
      >
        {unavailable && (
          <p id={UNAVAILABLE_NOTE} class="tk-panel__note">
            {t('canvas.padding_unavailable')}
          </p>
        )}
      </Choice>
      <Choice
        name="tk-canvas-background"
        legend={t('canvas.background')}
        values={BACKGROUNDS}
        value={canvas.background}
        label={(b) => (b === 'transparent' ? t('canvas.transparent') : t(COLOUR_COPY[b]))}
        onPick={setBackground}
        swatches
        columns={5}
      />
    </>
  );
}

/** Stands for the subject inside the translated COPY-style.sheet_summary, so the tag can follow it. */
const SUBJECT = '\uE000';

/**
 * COPY-style.sheet_summary in the narrow summary bar: "{subject} · {detail}" (just the subject without a
 * detail). D-031 / RULE-10: a blur or pixelate subject is followed by COPY-redact.not_secure_short, shown
 * as the same tag as on the panel's kind choices; it is part of the bar's accessible name.
 */
function Summary({ model, detail }: { model: PanelModel; detail: string }) {
  const text = detail ? t('style.sheet_summary', { subject: SUBJECT, detail }) : SUBJECT;
  const [before = '', after = ''] = text.split(SUBJECT);
  return (
    <>
      {before}
      {model.subject}
      {model.subjectNotSecure && (
        <>
          {' '}
          <span class="tk-tag tk-panel__tag">
            <Icon name="warning" />
            {t('redact.not_secure_short')}
          </span>
        </>
      )}
      {after}
    </>
  );
}

/** F-008.R5: the selection actions, in the artboard's order. */
function Actions() {
  return (
    <div class="tk-panel__section">
      <div class="tk-actions">
        <button type="button" class="tk-button tk-button--outlined" onClick={duplicateSelection}>
          {t('action.duplicate')}
        </button>
        <button
          type="button"
          class="tk-button tk-button--outlined"
          onClick={() => {
            // F-008 review M3 (NFR-06): the actions go with the selection, so focus moves to the canvas
            // region (its Tab stop with nothing selected, CMP-Canvas) and the Edit keys keep working.
            document.querySelector<HTMLElement>('.tk-work-area')?.focus({ preventScroll: true });
            deleteSelection();
          }}
        >
          {t('action.delete')}
        </button>
        <button type="button" class="tk-button tk-button--outlined" onClick={() => reorderSelection('forward')}>
          {t('action.bring_forward')}
        </button>
        <button type="button" class="tk-button tk-button--outlined" onClick={() => reorderSelection('backward')}>
          {t('action.send_backward')}
        </button>
      </div>
    </div>
  );
}

export function StylePanel() {
  const model = currentModel();
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
            {model.color &&
              (isHexColour(model.color) ? (
                // F-019: a custom colour's chip shows the colour itself.
                <span
                  class="tk-panel__chip tk-swatch--custom-set"
                  style={{ '--tk-custom-colour': model.color }}
                  aria-hidden="true"
                />
              ) : (
                <span class={`tk-panel__chip tk-swatch--${model.color}`} aria-hidden="true" />
              ))}
            <span class="tk-panel__summary">
              <Summary model={model} detail={detail} />
            </span>
            <Icon name="chevronUp" class="tk-panel__chevron" />
          </button>
        )}
        <div id="tk-style-sheet" class="tk-panel__body" hidden={narrow && !open}>
          {/* Implements: D-035 — a multi-selection's count heads the wide panel (the narrow bar's summary
              names it instead); level 2 under the tool's h1 (D-036). */}
          {!narrow && model.variant === 'selection' && selection.value.length > 1 && (
            <h2 class="tk-panel__count">{t('a11y.selected_count', { count: selection.value.length })}</h2>
          )}
          <Sections model={model} narrow={narrow} />
        </div>
      </div>
    </aside>
  );
}
