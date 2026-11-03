// MOD-App entry (specs/40-technical/modules/MOD-App.md): resolves the starting language (the same
// result the boot script already put on <html lang>, ADR-0015 §1), sets the page title from
// COPY-app.title (ADR-0015 §7) and mounts the SCR-Annotator frame.
// After the first render MOD-Host starts the host contract (theme and language messages, the ready
// signal; F-015, F-018) and loads the typefaces with their Vietnamese subsets (F-018.R7).
// Offline and the effects worker start here once F-017 and F-007 are built.
import { render } from 'preact';
import './styles/index.css';
import { language, t } from '../copy';
import { loadFonts, resolveLanguage, startHost } from '../host';
import { startLoader } from './loader';
import { Shell } from './Shell';

const address = (() => {
  try {
    return new URLSearchParams(location.search).get('lang');
  } catch {
    return null;
  }
})();
language.value = resolveLanguage(address, navigator.languages ?? [navigator.language]);
// Implements: F-018.R1 (mark the page language even if the boot script did not run).
document.documentElement.lang = language.value;
document.title = t('app.title');

const root = document.getElementById('app');
if (root) render(<Shell />, root);
startLoader(); // F-001: paste, drop, open — listening before the ready signal (F-001.R9)
startHost();
void loadFonts();
