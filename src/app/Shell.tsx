// MOD-App — the SCR-Annotator frame (layout regions 1, 2 and 4 of SCR-Annotator; style.md "Regions").
// Phase 3.3 scaffold: the empty frame only. CMP-Toolbar, CMP-EmptyState, CMP-StylePanel,
// CMP-StatusBar and the overlays are added with their features (phase 4).
import { t } from '../copy';

export function Shell() {
  return (
    <div class="tk-annotator" data-screen="SCR-Annotator" data-state="empty">
      <header class="tk-toolbar" aria-label={t('a11y.toolbar')} />
      <main class="tk-work-area" aria-label={t('a11y.canvas')} />
      <footer class="tk-status-bar" />
    </div>
  );
}
