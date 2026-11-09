// MOD-App — SCR-Annotator (layout regions 1–4; style.md "Regions"). F-001 builds the empty state, the
// image fitted in the work area, the drop overlay, notices and the confirm dialog; F-003 the tools and
// the style panel (region 3: docked on the right, or the narrow summary bar and sheet of D-019), which
// comes before the canvas in reading order (SCR-Annotator "Accessibility").
// F-005: while a text is edited (SCR-Annotator "editing-text") the style panel shows and changes the
// edited text's colour and size and keeps the edit open; a mouse press there keeps focus in the field.
// F-010: the crop tool (SCR-Annotator "cropping"); CMP-StatusBar shows the canvas size once a crop exists.
// F-011: the select tool with nothing selected (SCR-Annotator "canvas-settings"): the panel shows the
// padding and background; the status bar shows the canvas size once padding exists too.
// Implements: SCR-Annotator states empty, default (image fitted), canvas-settings, selecting, editing-text, cropping, dragging-file,
// loading, error; F-001.R6, F-001.R8; CMP-ConfirmDialog "the rest of the tool is inert"; D-014 layout widths.
import { useLayoutEffect, useRef } from 'preact/hooks';
import { t } from '../copy';
import { Canvas } from '../canvas';
import { theme } from '../host';
import { ConfirmDialog } from './ConfirmDialog';
import { DropOverlay } from './DropOverlay';
import { EmptyState } from './EmptyState';
import { NoticeView } from './NoticeView';
import { PrivacyStatus } from './PrivacyStatus'; // F-016
import { createAnnotation, select, textEditEnded, textEditStarted } from './drawing';
import { commitDrag } from './editing'; // F-008
import { commitFrame, shownCanvasSize } from './crop'; // F-010
import { viewChanged } from './history'; // F-009: a zoom or pan ends a nudge chain (RULE-11)
import { StylePanel } from './StylePanel';
import { Toolbar } from './Toolbar';
import { ZoomControl } from './ZoomControl';
import {
  assertive,
  currentStyles,
  dialog,
  doc,
  dragging,
  layout,
  loaded,
  notice,
  polite,
  selection,
  textEditing,
  tool,
  type Layout,
} from './state';
import { isDrawingTool } from '../core';
import { isEditing } from '../io';

/** D-014 layout widths, measured on the tool's own width (the frame when embedded). */
const layoutOf = (width: number): Layout => (width >= 1000 ? 'wide' : width >= 800 ? 'compact' : 'narrow');

/** F-005: focus may move into the style panel while a text is edited; the edit stays open. */
const inPanel = (target: Element) => !!target.closest('.tk-body__panel');

/**
 * SCR-Annotator "editing-text": CMP-TextEditor has focus. A mouse press on a panel control applies it
 * to the edited text and leaves focus in the field (keyboard users reach the panel with Shift+Tab).
 */
function keepEditorFocus(e: MouseEvent): void {
  // Text and number fields in the panel (F-008 position fields) still take focus on a press.
  if (textEditing.value && e.button === 0 && !isEditing(e.target)) e.preventDefault();
}

function screenState(): string {
  if (dialog.value) return dialog.value.kind === 'replace' ? 'confirm-replace' : 'confirm-scale-down';
  if (dragging.value) return 'dragging-file';
  if (notice.value?.kind === 'progress') return 'loading';
  if (notice.value?.kind === 'error') return 'error';
  if (loaded.value && textEditing.value) return 'editing-text';
  if (loaded.value && tool.value === 'crop') return 'cropping'; // F-010
  if (loaded.value && selection.value.length) return 'selecting';
  if (loaded.value && tool.value === 'select') return 'canvas-settings'; // F-011: padding and background
  return loaded.value ? 'default' : 'empty';
}

export function Shell() {
  const current = loaded.value;
  const scene = doc.value;
  const modal = dialog.value;
  const inert = modal ? true : undefined;
  const info = current?.image.info;
  const active = tool.value;
  // CMP-StatusBar / D-017: the canvas size once a crop or padding exists (RULE-15: the export size); the
  // canvas summary always names the canvas size (CMP-Canvas "Accessibility").
  const size = shownCanvasSize();
  const root = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const el = root.current;
    if (!el) return;
    const measure = () => {
      const next = layoutOf(el.getBoundingClientRect().width);
      if (layout.value !== next) layout.value = next;
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return (
    <div
      ref={root}
      class="tk-annotator"
      data-screen="SCR-Annotator"
      data-state={screenState()}
      data-layout={layout.value}
    >
      <header class="tk-toolbar" inert={inert}>
        <Toolbar />
      </header>
      <div class="tk-body">
        {current && (
          // eslint-disable-next-line jsx-a11y/no-static-element-interactions -- keeps focus in CMP-TextEditor (SCR-Annotator "editing-text")
          <div class="tk-body__panel" inert={inert} onMouseDown={keepEditorFocus}>
            <StylePanel />
          </div>
        )}
        <main
          class="tk-work-area"
          aria-label={t('a11y.canvas')}
          aria-describedby={info ? 'tk-canvas-summary' : undefined}
          // CMP-Canvas: one focusable region while an image is shown (RULE-19 canvas keys, F-002.R4); its
          // role becomes the annotation list's with F-013. While CMP-TextEditor is open it has no Tab stop.
          tabIndex={current ? (textEditing.value ? -1 : 0) : undefined}
          inert={inert}
        >
          {current && info && scene ? (
            <>
              <Canvas
                image={current.image.bitmap}
                doc={scene}
                theme={theme.value}
                onView={viewChanged}
                tool={active}
                style={isDrawingTool(active) ? currentStyles.value[active] : undefined}
                selection={selection.value}
                onCreate={createAnnotation}
                textStyle={currentStyles.value.text}
                onTextEdit={textEditStarted}
                onTextEnd={textEditEnded}
                keepsTextEdit={inPanel}
                onSelect={select}
                onEdit={commitDrag}
                onFrame={commitFrame}
              />
              <span id="tk-canvas-summary" class="tk-sr">
                {t('a11y.canvas_summary', {
                  width: size?.width ?? info.width,
                  height: size?.height ?? info.height,
                  count: scene.annotations.length,
                })}
              </span>
            </>
          ) : (
            <EmptyState />
          )}
          {notice.value && <NoticeView notice={notice.value} />}
          <div class="tk-sr" role="status" aria-live="polite">
            {polite.value.map((m) => (
              <div key={m.id}>{m.text}</div>
            ))}
          </div>
          <div class="tk-sr" role="alert">
            {assertive.value}
          </div>
        </main>
      </div>
      <footer class="tk-status-bar" inert={inert}>
        {/* F-016: privacy statement, details and source link (start of CMP-StatusBar). */}
        <PrivacyStatus />
        {/* F-010: COPY-status.image_size, the canvas size, once a crop exists (hidden on compact and narrow). */}
        {size && <span class="tk-status-size">{t('status.image_size', size)}</span>}
        {/* F-002: the zoom control at the end of CMP-StatusBar. */}
        <ZoomControl />
      </footer>
      {dragging.value && <DropOverlay />}
      {modal && <ConfirmDialog request={modal} />}
    </div>
  );
}
