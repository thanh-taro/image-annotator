// MOD-App entry (specs/40-technical/modules/MOD-App.md): resolves the starting language (the same
// result the boot script already put on <html lang>, ADR-0015 §1), sets the page title from
// COPY-app.title (ADR-0015 §7) and mounts the SCR-Annotator frame.
// Phase 3.3 scaffold: MOD-Host messaging, the ready signal, offline and the effects worker start
// here once F-015, F-017 and F-007 are built.
import { render } from 'preact';
import './styles/index.css';
import { language, t } from '../copy';
import { resolveLanguage } from '../host';
import { Shell } from './Shell';

const address = (() => {
  try {
    return new URLSearchParams(location.search).get('lang');
  } catch {
    return null;
  }
})();
language.value = resolveLanguage(address, navigator.languages ?? [navigator.language]);
document.title = t('app.title');

const root = document.getElementById('app');
if (root) render(<Shell />, root);
