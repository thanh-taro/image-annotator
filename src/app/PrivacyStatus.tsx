// MOD-App — the privacy part of CMP-StatusBar (F-016): the always-visible privacy statement, the
// popover that explains it, and the source link (specs/30-experience/components/CMP-StatusBar.md,
// style.md "Status bar", platform-mapping.md "Privacy and policy", ADR-0010).
// Narrow widths (D-014) show the statement and the link as icons; that switch is pure CSS
// (privacy.css), so both names are in the markup and only the matching one is exposed.
import { useEffect, useLayoutEffect, useRef, useState } from 'preact/hooks';
import { t } from '../copy';
import { Icon } from './icons';
import './styles/privacy.css';

/** D-009: the public source repository. */
export const SOURCE_URL = 'https://github.com/thanh-taro/image-annotator';
/** adapters/codegen.md: the open-source licence notices shipped with the tool. */
export const NOTICES_URL = '/third-party-notices.txt';

const DETAILS_ID = 'tk-privacy-details';
const DETAILS_TEXT_ID = 'tk-privacy-details-text';

export function PrivacyStatus() {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const badgeRef = useRef<HTMLButtonElement>(null);
  const detailsRef = useRef<HTMLDivElement>(null);

  const close = (returnFocus: boolean) => {
    setOpen(false);
    if (returnFocus) badgeRef.current?.focus();
  };

  // Implements: F-016.R2 — place the popover above the statement. On narrow widths it spans the
  // tool minus the gutters, so it needs the statement's offset from the tool's start edge.
  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!open || !root) return;
    const tool = root.closest('[data-screen]') ?? document.documentElement;
    const offset = root.getBoundingClientRect().left - tool.getBoundingClientRect().left;
    root.style.setProperty('--tk-privacy-offset', `${offset}px`);
    detailsRef.current?.focus();
  }, [open]);

  // Implements: F-016.AC2 — a press outside the statement and its popover dismisses it.
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) close(false);
    };
    document.addEventListener('pointerdown', onPointerDown, true);
    return () => document.removeEventListener('pointerdown', onPointerDown, true);
  }, [open]);

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key !== 'Escape') return;
    // Esc belongs to the popover while it is open, not to the tool's own Esc (RULE-19).
    e.stopPropagation();
    e.preventDefault();
    close(true);
  };

  const onFocusOut = (e: FocusEvent) => {
    const next = e.relatedTarget as Node | null;
    if (next && !rootRef.current?.contains(next)) close(false);
  };

  return (
    // eslint-disable-next-line jsx-a11y/no-static-element-interactions -- delegates Esc and focus-out of the popover
    <div class="tk-privacy" ref={rootRef} onKeyDown={onKeyDown} onFocusOut={onFocusOut}>
      {/* Implements: F-016.R1 (always-visible statement) and F-016.R2 (it opens the explanation). */}
      <button
        type="button"
        ref={badgeRef}
        class="tk-privacy__badge"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? DETAILS_ID : undefined}
        onClick={() => setOpen(!open)}
      >
        <Icon name="shieldCheck" />
        <span class="tk-privacy__wide">{t('privacy.badge')}</span>
        <span class="tk-privacy__narrow tk-sr">{t('privacy.badge_label')}</span>
      </button>
      {open && (
        <div
          id={DETAILS_ID}
          ref={detailsRef}
          class="tk-privacy__details"
          role="dialog"
          aria-label={t('privacy.title')}
          aria-describedby={DETAILS_TEXT_ID}
          tabIndex={-1}
        >
          <p id={DETAILS_TEXT_ID} class="tk-privacy__text">
            {t('privacy.details')}
          </p>
          <div class="tk-privacy__actions">
            <a class="tk-privacy__link" href={NOTICES_URL} target="_blank" rel="noopener noreferrer">
              {t('privacy.notices')}
              <span class="tk-sr">{` ${t('a11y.new_tab')}`}</span>
            </a>
            <button type="button" class="tk-privacy__close" onClick={() => close(true)}>
              {t('action.close')}
            </button>
          </div>
        </div>
      )}
      {/* Implements: F-016.R3 — new tab, no referrer, no opener, so the session is untouched. */}
      <a class="tk-privacy__link tk-privacy__source" href={SOURCE_URL} target="_blank" rel="noopener noreferrer">
        <Icon name="code" />
        <span class="tk-privacy__label">{t('privacy.source_label')}</span>
        <span class="tk-sr">{` ${t('a11y.new_tab')}`}</span>
      </a>
    </div>
  );
}
