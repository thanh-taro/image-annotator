// CMP-ConfirmDialog, variants "replace" (F-001.R7), "scale-down" (F-001.R5, RULE-02) and "clear"
// (F-014.R3; its primary action is the danger style, as on the artboard). Modal: focus
// moves to the safe choice (cancel), stays inside and returns on close; Esc and cancel keep everything;
// clicking outside does nothing. The rest of the tool is made inert by the shell. The text is rendered
// from COPY IDs, so a language switch changes it without changing the pending choice.
import { useLayoutEffect, useRef } from 'preact/hooks';
import { t } from '../copy';
import { returnFocusLater } from './focus';
import type { DialogRequest } from './state';

function texts(request: DialogRequest) {
  if (request.kind === 'replace') {
    return { title: t('confirm.replace_title'), message: t('confirm.replace'), action: t('action.replace') };
  }
  // F-014.R3: the "clear" variant (COPY-action.clear while there are unexported changes).
  if (request.kind === 'clear') {
    return { title: t('confirm.clear_title'), message: t('confirm.clear'), action: t('action.clear') };
  }
  const { width, height } = request.size ?? { width: 0, height: 0 };
  return {
    title: t('load.scale_down_title'),
    message: t('load.scale_down', { width, height }),
    action: t('load.scale_down_action'),
  };
}

export function ConfirmDialog({ request }: { request: DialogRequest }) {
  const box = useRef<HTMLDivElement>(null);
  const cancel = useRef<HTMLButtonElement>(null);

  // Layout effect: focus and the key trap are in place as soon as the dialog shows (no key slips past).
  useLayoutEffect(() => {
    const returnTo = document.activeElement;
    cancel.current?.focus();
    // While the dialog is open only Esc acts (RULE-19), and Tab stays inside the dialog.
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        request.answer(false);
      } else if (e.key === 'Tab') {
        const items = Array.from(box.current?.querySelectorAll<HTMLElement>('button') ?? []);
        const i = items.indexOf(document.activeElement as HTMLElement);
        const step = e.shiftKey ? items.length - 1 : 1;
        e.preventDefault();
        items[i < 0 ? 0 : (i + step) % items.length]?.focus();
      }
    };
    document.addEventListener('keydown', onKeyDown, true);
    return () => {
      document.removeEventListener('keydown', onKeyDown, true);
      // F-013 (review M3): after the render that clears `inert` from the rest of the tool (./focus.ts).
      returnFocusLater(returnTo);
    };
  }, [request]);

  const { title, message, action } = texts(request);
  return (
    <div class="tk-scrim">
      <div
        ref={box}
        class="tk-dialog"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="tk-dialog-title"
        aria-describedby="tk-dialog-message"
        data-variant={request.kind}
      >
        <h2 id="tk-dialog-title" class="tk-dialog__title">
          {title}
        </h2>
        <p id="tk-dialog-message" class="tk-dialog__message">
          {message}
        </p>
        <div class="tk-dialog__actions">
          <button ref={cancel} type="button" class="tk-button tk-button--quiet" onClick={() => request.answer(false)}>
            {t('action.cancel')}
          </button>
          <button
            type="button"
            class={`tk-button ${request.kind === 'scale-down' ? 'tk-button--primary' : 'tk-button--danger'}`}
            onClick={() => request.answer(true)}
          >
            {action}
          </button>
        </div>
      </div>
    </div>
  );
}
