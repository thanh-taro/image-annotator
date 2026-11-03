// MOD-App — platform details for key names (rules.md: "Mod" is Ctrl on Windows/Linux, Cmd on macOS).

/** macOS and Apple tablets/phones use Cmd for Mod. */
export const isMac: boolean =
  typeof navigator !== 'undefined' && /Mac|iPhone|iPad|iPod/.test(navigator.platform || navigator.userAgent);

/** {paste_key} in COPY-load.empty_hint / COPY-load.click_to_paste: Ctrl+V or ⌘V. */
export const PASTE_KEY = isMac ? '⌘V' : 'Ctrl+V';

/** aria-keyshortcuts value for Mod+<key>. */
export const modShortcut = (key: string) => `${isMac ? 'Meta' : 'Control'}+${key}`;

/** Is Mod (and only Mod, apart from Shift when `shift` allows it) held? */
export const isMod = (e: KeyboardEvent) => (isMac ? e.metaKey && !e.ctrlKey : e.ctrlKey && !e.metaKey) && !e.altKey;
