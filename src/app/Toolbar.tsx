// CMP-Toolbar: COPY-action.open (F-001) and the tool group (F-003): one active tool, named with its
// shortcut (COPY-tool.shortcut_hint, NFR-06), arrow keys moving between tools, all disabled with no image.
// Narrow widths (D-014) use two rows: actions, then the tools scrolling sideways with a fade on each edge
// only while tools are hidden beyond it, the active or focused tool scrolled into view; tapping the
// active tool again opens or closes the style sheet (D-019). The redaction count, copy, download and, on
// narrow widths, the overflow holding the download are F-012's (./ExportActions.tsx). COPY-action.undo and
// COPY-action.redo (F-009) are icons named by their labels with their shortcuts, after the tools on one
// row and after COPY-action.open on the narrow actions row, each disabled while there is nothing to undo
// or redo (and with no image); focus moves to the other when the clicked one becomes disabled. COPY-action.more
// (./MoreMenu.tsx, F-013) ends the row on every layout; F-014 adds its Clear item there.
// Implements: CMP-Toolbar (tool group, undo/redo, variants no image, compact and narrow; behaviour),
// F-003 UX notes, F-009.R1, F-009 UX notes.
import { useLayoutEffect, useRef, useState } from 'preact/hooks';
import { t } from '../copy';
import { TOOL_KEYS, type ToolName } from '../core';
import { BUILT_TOOLS, setTool, toolLabel } from './drawing';
import { ExportActions } from './ExportActions';
import { MoreMenu } from './MoreMenu';
import { Icon, type IconName } from './icons';
import { redo, undo } from './history';
import { openImage } from './loader';
import { isMac, modShortcut } from './platform';
import { canRedo, canUndo, layout, loaded, sheetOpen, tool } from './state';

const TOOL_ICONS: Partial<Record<ToolName, IconName>> = {
  select: 'select',
  rectangle: 'rectangle',
  ellipse: 'ellipse',
  arrow: 'arrow',
  line: 'line',
  pen: 'pen',
  highlight: 'highlight',
  text: 'text',
  step: 'step',
  redact: 'redact',
  crop: 'crop',
};

function OpenButton({ icon }: { icon: boolean }) {
  return (
    <button
      type="button"
      class={icon ? 'tk-tool' : 'tk-button tk-button--bar'}
      aria-label={icon ? t('action.open') : undefined}
      title={icon ? t('action.open') : undefined}
      aria-keyshortcuts={modShortcut('O')}
      onClick={openImage}
    >
      <Icon name="image" size={icon ? 20 : 16} />
      {!icon && t('action.open')}
    </button>
  );
}

/** RULE-19 History keys as aria-keyshortcuts: Mod+Z; Mod+Shift+Z, and Ctrl+Y off macOS. */
const UNDO_KEYS = modShortcut('Z');
const REDO_KEYS = isMac ? 'Meta+Shift+Z' : 'Control+Shift+Z Control+Y';

/**
 * F-009.R1: COPY-action.undo and COPY-action.redo, unavailable while there is nothing to undo or redo.
 * CMP-Toolbar "Accessibility": when the clicked one becomes disabled, focus moves to the other of the two
 * (after an undo there is always a redo, and the other way round), so a keyboard user keeps their place.
 */
function HistoryButtons() {
  const undoRef = useRef<HTMLButtonElement>(null);
  const redoRef = useRef<HTMLButtonElement>(null);
  const moveFocus = useRef<'undo' | 'redo' | null>(null);
  const can = { undo: canUndo.value, redo: canRedo.value };

  useLayoutEffect(() => {
    const to = moveFocus.current;
    if (!to) return;
    moveFocus.current = null;
    const target = (to === 'undo' ? undoRef : redoRef).current;
    if (target && !target.disabled) target.focus();
  });

  const run = (which: 'undo' | 'redo') => {
    if (which === 'undo') undo();
    else redo();
    const left = which === 'undo' ? canUndo.value : canRedo.value;
    if (!left) moveFocus.current = which === 'undo' ? 'redo' : 'undo';
  };

  return (
    <>
      <button
        ref={undoRef}
        type="button"
        class="tk-tool"
        aria-label={t('action.undo')}
        title={t('action.undo')}
        aria-keyshortcuts={UNDO_KEYS}
        disabled={!can.undo}
        onClick={() => run('undo')}
      >
        <Icon name="undo" size={20} />
      </button>
      <button
        ref={redoRef}
        type="button"
        class="tk-tool"
        aria-label={t('action.redo')}
        title={t('action.redo')}
        aria-keyshortcuts={REDO_KEYS}
        disabled={!can.redo}
        onClick={() => run('redo')}
      >
        <Icon name="redo" size={20} />
      </button>
    </>
  );
}

/** The tool buttons: a single choice with a roving tab stop and arrow-key navigation (CMP-Toolbar a11y). */
function ToolGroup({ narrow }: { narrow: boolean }) {
  const active = tool.value;
  const disabled = !loaded.value;
  const ref = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({ start: false, end: false });

  const measure = () => {
    const el = ref.current;
    if (!el) return;
    const start = el.scrollLeft > 1;
    const end = el.scrollLeft + el.clientWidth < el.scrollWidth - 1;
    setEdges((e) => (e.start === start && e.end === end ? e : { start, end }));
  };

  // Narrow: the active tool is scrolled into view; the fades follow the scroll position and the width.
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || !narrow) return;
    el.querySelector<HTMLElement>('[aria-checked="true"]')?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [narrow, active]);

  const onKeyDown = (e: KeyboardEvent) => {
    const buttons = Array.from(ref.current?.querySelectorAll<HTMLButtonElement>('button') ?? []);
    const i = buttons.indexOf(document.activeElement as HTMLButtonElement);
    if (i < 0) return;
    const next =
      e.key === 'ArrowRight' || e.key === 'ArrowDown'
        ? (i + 1) % buttons.length
        : e.key === 'ArrowLeft' || e.key === 'ArrowUp'
          ? (i - 1 + buttons.length) % buttons.length
          : e.key === 'Home'
            ? 0
            : e.key === 'End'
              ? buttons.length - 1
              : -1;
    if (next < 0) return;
    e.preventDefault();
    // CMP-Toolbar: a single-choice radio group; per the radio pattern, moving with the arrows checks.
    const to = buttons[next];
    to?.focus();
    const name = to?.dataset['tool'] as ToolName | undefined;
    if (name && name !== active) setTool(name);
  };

  const pick = (name: ToolName) => {
    // D-019: on narrow widths, tapping the active tool again opens or closes the style sheet. Picking it
    // again on any layout still clears the selection (CMP-Toolbar, D-043; setTool does that).
    if (name === active && narrow) sheetOpen.value = !sheetOpen.value;
    setTool(name);
  };

  return (
    <div class={narrow ? 'tk-tools tk-tools--narrow' : 'tk-tools'}>
      {/* CMP-Toolbar "Accessibility": the tool group is a radio group named COPY-a11y.tool_group. */}
      {/* eslint-disable-next-line jsx-a11y/interactive-supports-focus -- APG radio group: the radios take focus (roving tab stop), not the group */}
      <div
        ref={ref}
        class="tk-tools__strip"
        data-disabled={disabled || undefined}
        role="radiogroup"
        aria-label={t('a11y.tool_group')}
        onKeyDown={onKeyDown}
        onScroll={measure}
      >
        {BUILT_TOOLS.map((name) => {
          const label = t('tool.shortcut_hint', { tool: toolLabel(name), key: TOOL_KEYS[name] });
          const on = name === active;
          return (
            <button
              key={name}
              type="button"
              class="tk-tool"
              role="radio"
              aria-checked={on}
              aria-label={label}
              aria-keyshortcuts={TOOL_KEYS[name]}
              title={label}
              tabIndex={on ? 0 : -1}
              disabled={disabled}
              data-tool={name}
              onClick={() => pick(name)}
              onFocus={(e) =>
                narrow && (e.currentTarget as HTMLElement).scrollIntoView({ block: 'nearest', inline: 'nearest' })
              }
            >
              <Icon name={TOOL_ICONS[name] ?? 'select'} size={20} />
            </button>
          );
        })}
      </div>
      {narrow && edges.start && (
        <span class="tk-tools__fade tk-tools__fade--start" aria-hidden="true">
          <Icon name="chevronLeft" />
        </span>
      )}
      {narrow && edges.end && (
        <span class="tk-tools__fade tk-tools__fade--end" aria-hidden="true">
          <Icon name="chevronRight" />
        </span>
      )}
    </div>
  );
}

export function Toolbar() {
  const narrow = layout.value === 'narrow';
  if (narrow) {
    return (
      <div class="tk-toolbar__rows" role="toolbar" aria-label={t('a11y.toolbar')}>
        <div class="tk-toolbar__row">
          <OpenButton icon />
          <HistoryButtons />
          <div class="tk-toolbar__spacer" />
          {/* F-012: redaction count and copy; the overflow holds the download (and the shortcuts, F-013). */}
          <ExportActions />
          <MoreMenu />
        </div>
        <div class="tk-toolbar__row tk-toolbar__row--tools">
          <ToolGroup narrow />
        </div>
      </div>
    );
  }
  return (
    <div class="tk-toolbar__row" role="toolbar" aria-label={t('a11y.toolbar')}>
      {/* CMP-Toolbar "compact" (800–999 px): COPY-action.open as an icon named by its label. */}
      <OpenButton icon={layout.value === 'compact'} />
      <span class="tk-toolbar__sep" aria-hidden="true" />
      <ToolGroup narrow={false} />
      <span class="tk-toolbar__sep" aria-hidden="true" />
      <HistoryButtons />
      <div class="tk-toolbar__spacer" />
      {/* F-012: redaction count, copy, download; then COPY-action.more (F-013 shortcuts, F-014 clear). */}
      <ExportActions />
      <MoreMenu />
    </div>
  );
}
