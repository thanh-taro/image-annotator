// CMP-DropOverlay (F-001.R2): a full-area overlay with COPY-load.drop_here while a file is dragged
// over the tool. It is announced through the polite live region (./loader.ts), so it is hidden here.
import { t } from '../copy';
import { Icon } from './icons';

export function DropOverlay() {
  return (
    <div class="tk-drop" aria-hidden="true">
      <div class="tk-drop__zone">
        <div class="tk-drop__label">
          <Icon name="download" size={20} class="tk-drop__icon" />
          <span>{t('load.drop_here')}</span>
        </div>
      </div>
    </div>
  );
}
