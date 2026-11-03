// MOD-App — SCR-Annotator (layout regions 1, 2 and 4; style.md "Regions"). F-001 builds the empty
// state, the image fitted in the work area, the drop overlay, notices and the confirm dialog; the style
// panel (region 3) and the status-bar contents arrive with their features.
// Implements: SCR-Annotator states empty, default (image fitted), dragging-file, loading, error;
// F-001.R6, F-001.R8; CMP-ConfirmDialog "the rest of the tool is inert".
import { t } from '../copy';
import { Canvas } from '../canvas';
import { theme } from '../host';
import { ConfirmDialog } from './ConfirmDialog';
import { DropOverlay } from './DropOverlay';
import { EmptyState } from './EmptyState';
import { NoticeView } from './NoticeView';
import { PrivacyStatus } from './PrivacyStatus'; // F-016
import { Toolbar } from './Toolbar';
import { ZoomControl } from './ZoomControl';
import { assertive, dialog, doc, dragging, loaded, notice, polite, view } from './state';

function screenState(): string {
  if (dialog.value) return dialog.value.kind === 'replace' ? 'confirm-replace' : 'confirm-scale-down';
  if (dragging.value) return 'dragging-file';
  if (notice.value?.kind === 'progress') return 'loading';
  if (notice.value?.kind === 'error') return 'error';
  return loaded.value ? 'default' : 'empty';
}

export function Shell() {
  const current = loaded.value;
  const scene = doc.value;
  const modal = dialog.value;
  const inert = modal ? true : undefined;
  const info = current?.image.info;
  return (
    <div class="tk-annotator" data-screen="SCR-Annotator" data-state={screenState()}>
      <header class="tk-toolbar" inert={inert}>
        <Toolbar />
      </header>
      <main
        class="tk-work-area"
        aria-label={t('a11y.canvas')}
        aria-describedby={info ? 'tk-canvas-summary' : undefined}
        // CMP-Canvas: one focusable region while an image is shown (RULE-19 canvas keys, F-002.R4); its
        // role becomes the annotation list's with F-013.
        // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex -- CMP-Canvas "Accessibility"
        tabIndex={current ? 0 : undefined}
        inert={inert}
      >
        {current && info && scene ? (
          <>
            <Canvas
              image={current.image.bitmap}
              doc={scene}
              theme={theme.value}
              onView={(next) => (view.value = next)}
            />
            <span id="tk-canvas-summary" class="tk-sr">
              {t('a11y.canvas_summary', {
                width: info.width,
                height: info.height,
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
      <footer class="tk-status-bar" inert={inert}>
        {/* F-016: privacy statement, details and source link (start of CMP-StatusBar). */}
        <PrivacyStatus />
        {/* F-002: the zoom control at the end of CMP-StatusBar. */}
        <ZoomControl />
      </footer>
      {dragging.value && <DropOverlay />}
      {modal && <ConfirmDialog request={modal} />}
    </div>
  );
}
