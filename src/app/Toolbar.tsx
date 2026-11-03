// CMP-Toolbar (F-001 scope): COPY-action.open, enabled at any time (variant "no image": open enabled).
// The tool group, undo/redo, the redaction count, copy, download and the overflow menu are added by
// F-003…F-013 in the slots marked below.
import { t } from '../copy';
import { Icon } from './icons';
import { openImage } from './loader';
import { modShortcut } from './platform';

export function Toolbar() {
  return (
    <div class="tk-toolbar__row" role="toolbar" aria-label={t('a11y.toolbar')}>
      <button type="button" class="tk-button tk-button--bar" aria-keyshortcuts={modShortcut('O')} onClick={openImage}>
        <Icon name="image" />
        {t('action.open')}
      </button>
      {/* Slot: tool group, undo/redo (F-003…F-010, F-009). */}
      <div class="tk-toolbar__spacer" />
      {/* Slot: redaction count, copy, download, more (F-012, F-013). */}
    </div>
  );
}
