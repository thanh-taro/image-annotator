// CMP-EmptyState: how to load an image (F-001.R8), with the click-to-paste hint when embedded without
// keyboard focus (F-001.R9; `embedded` and `hasFocus` come from MOD-Host, F-015). The whole work area
// is the drop target (MOD-IO listens on the document); a click anywhere gives the tool focus. It never
// takes focus by itself.
import { t } from '../copy';
import { embedded, hasFocus } from '../host';
import { Icon } from './icons';
import { openImage } from './loader';
import { PASTE_KEY } from './platform';

const MARK = '\u0000';

export function EmptyState() {
  const unfocused = embedded.value && !hasFocus.value;
  const hint = unfocused ? t('load.click_to_paste', { paste_key: MARK }) : t('load.empty_hint', { paste_key: MARK });
  const [before, after = ''] = hint.split(MARK);
  return (
    <div class="tk-empty" data-variant={unfocused ? 'unfocused' : 'default'}>
      <Icon name="image" size={40} class="tk-empty__icon" />
      <h2 class="tk-empty__title">{t('load.empty_title')}</h2>
      <p class="tk-empty__hint">
        {before}
        <kbd>{PASTE_KEY}</kbd>
        {after}
      </p>
      <button type="button" class="tk-button tk-button--outlined" onClick={openImage}>
        <Icon name="image" />
        {t('action.open')}
      </button>
    </div>
  );
}
