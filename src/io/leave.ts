// MOD-IO — the leave-page warning (MOD-IO "Responsibility"; platform-mapping.md "Leave-page warning").
// The `beforeunload` handler is registered only while it is wanted, so without unexported changes the
// page never asks (and stays eligible for the back/forward cache). The browser shows its own text, which
// can't be changed (F-014 "UX notes"). Embedded, the host frame must allow leave-page dialogs (RULE-16);
// WebKit never shows them from an embedded page (ADR-0021, D-028).
// Implements: F-014.R1, F-014.R2.

const onBeforeUnload = (e: BeforeUnloadEvent): void => {
  e.preventDefault();
  // Older engines ask only when `returnValue` is set (as verified by SP-host, ADR-0021).
  e.returnValue = '';
};

let on = false;

/** Turns the leave-page warning on or off (MOD-IO public surface). */
export function setLeaveWarning(enabled: boolean): void {
  if (enabled === on) return;
  on = enabled;
  if (enabled) window.addEventListener('beforeunload', onBeforeUnload);
  else window.removeEventListener('beforeunload', onBeforeUnload);
}
