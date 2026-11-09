// MOD-App — the `showShortcuts` command (MOD-App public surface): opens CMP-ShortcutHelp, from the ? key
// (RULE-19 Help, canvas scope) or COPY-action.shortcuts in the COPY-action.more menu. It opens over the
// work area only while no other dialog is open; Esc or COPY-action.close closes it (./ShortcutHelp.tsx).
// Implements: F-013.R3, CMP-ShortcutHelp "Behavior".
import { dialog, shortcutsOpen } from './state';

/**
 * What had focus when it opened (CMP-ShortcutHelp "Accessibility": focus returns there). Read here, before
 * the rest of the tool turns inert, which takes focus away from it.
 */
let opener: Element | null = null;

/** Opens CMP-ShortcutHelp (no-op while a confirm dialog is open). */
export function showShortcuts(): void {
  if (dialog.value || shortcutsOpen.value) return;
  opener = typeof document === 'undefined' ? null : document.activeElement;
  shortcutsOpen.value = true;
}

/** Closes CMP-ShortcutHelp; focus returns to what opened it (./ShortcutHelp.tsx). */
export function closeShortcuts(): void {
  shortcutsOpen.value = false;
}

/** The element to return focus to once CMP-ShortcutHelp has closed (taken once). */
export function takeOpener(): Element | null {
  const el = opener;
  opener = null;
  return el;
}
