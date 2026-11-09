// MOD-App — focus return for the modal dialogs (CMP-ConfirmDialog, CMP-ShortcutHelp: "focus returns to
// what opened it on close"). A dialog closes in the same render that clears `inert` from the rest of the
// tool, and an inert element ignores focus(), so the return waits for that render to finish. When what
// opened the dialog is gone (a menu item, or the canvas after a new image), the canvas region takes focus,
// keeping keyboard users in the tool.
// Implements: CMP-ConfirmDialog and CMP-ShortcutHelp "Accessibility", NFR-06.

/**
 * Where focus goes when the opener is gone: the canvas region while it is focusable (an image is shown),
 * else the empty state's COPY-action.open (CMP-EmptyState), e.g. after starting over (F-014).
 */
const fallback = (): HTMLElement | null =>
  document.querySelector<HTMLElement>('.tk-work-area[tabindex]') ??
  document.querySelector<HTMLElement>('.tk-empty button');

/** Returns focus to `opener` (else the canvas region) once the current render has finished. */
export function returnFocusLater(opener: Element | null): void {
  queueMicrotask(() => {
    const target =
      opener instanceof HTMLElement && opener.isConnected && !opener.closest('[inert]') ? opener : fallback();
    target?.focus({ preventScroll: true });
  });
}
