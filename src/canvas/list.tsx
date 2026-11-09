// MOD-Canvas — CMP-Canvas's accessible annotation list (F-013): the annotations in drawing order as the
// options of a multi-selectable list inside the canvas region, named COPY-a11y.annotations_list and
// described by COPY-a11y.annotations_hint; each option is named by MOD-App (COPY-a11y.annotation,
// COPY-a11y.step_annotation or COPY-a11y.text_annotation) and marked selected when it is. Roving focus:
// the Tab stop is the last selected annotation's option; with nothing selected the region itself is the
// Tab stop (Shell), and while CMP-TextEditor is open the list has none. The list is for screen readers
// and keyboard focus only; the canvas shows the selection. When the selection changes while focus is in
// the list, focus follows it (to the last selected option, or to the region when nothing is selected),
// so a deleted annotation never takes the focus with it.
// Tab and Shift+Tab (RULE-19) are MOD-Keys actions run by `stepSelection`; leaving the list after the
// last or before the first moves focus to the next or previous control outside the canvas region.
// Implements: CMP-Canvas "Accessibility", RULE-19 (Tab / Shift+Tab), F-013.R4, NFR-06.
import { useLayoutEffect, useRef } from 'preact/hooks';
import { t } from '../copy';
import type { Annotation } from '../core';

export interface AnnotationListProps {
  readonly annotations: readonly Annotation[];
  readonly selection: readonly string[];
  /** The option's accessible name (COPY-a11y.annotation and its step and text forms; MOD-App). */
  readonly name: (a: Annotation) => string;
  /** CMP-TextEditor is open: the list has no Tab stop. */
  readonly editing: boolean;
  /** A screen reader's activation of an option selects that annotation alone. */
  readonly onPick: (id: string) => void;
}

const optionOf = (list: HTMLElement | null, id: string) =>
  list?.querySelector<HTMLElement>(`[data-annotation="${CSS.escape(id)}"]`) ?? null;

export function AnnotationList({ annotations, selection, name, editing, onPick }: AnnotationListProps) {
  const ref = useRef<HTMLDivElement>(null);
  /** The annotation whose option had focus after the last render (to notice it being removed). */
  const lastFocused = useRef<string | null>(null);
  const selected = new Set(selection);
  const stop = selection[selection.length - 1];

  // Focus follows the selection while it is in the list (e.g. Delete, Esc, Mod+D, undo).
  useLayoutEffect(() => {
    const list = ref.current;
    if (!list) return;
    const focused = document.activeElement;
    const before = lastFocused.current;
    const inList = focused instanceof HTMLElement && list.contains(focused);
    // A removed option took focus with it (the body has it now): the list takes it back.
    const lost = !inList && focused === document.body && before !== null && !optionOf(list, before);
    if (inList || lost) {
      const target = stop && !editing ? optionOf(list, stop) : list.closest<HTMLElement>('[tabindex]');
      if (target && target !== focused) target.focus({ preventScroll: true });
    }
    const now = document.activeElement;
    lastFocused.current = now instanceof HTMLElement && list.contains(now) ? (now.dataset['annotation'] ?? null) : null;
  });

  const any = annotations.length > 0;
  return (
    <>
      {/* With no annotation there is no list (a listbox needs options); the box stays for focus handling. */}
      <div
        ref={ref}
        class="tk-annotations tk-sr"
        role={any ? 'listbox' : undefined}
        aria-multiselectable={any ? true : undefined}
        aria-label={any ? t('a11y.annotations_list') : undefined}
        aria-describedby={any ? 'tk-annotations-hint' : undefined}
      >
        {annotations.map((a) => (
          // eslint-disable-next-line jsx-a11y/click-events-have-key-events -- RULE-19 keys act on the focused option (MOD-Keys)
          <div
            key={a.id}
            role="option"
            class="tk-annotation"
            data-annotation={a.id}
            aria-selected={selected.has(a.id)}
            tabIndex={!editing && a.id === stop ? 0 : -1}
            onClick={() => onPick(a.id)}
          >
            {name(a)}
          </div>
        ))}
      </div>
      {any && (
        <span id="tk-annotations-hint" class="tk-sr">
          {t('a11y.annotations_hint')}
        </span>
      )}
    </>
  );
}

/** A focusable control outside `region` that Tab can reach. */
function tabbables(): HTMLElement[] {
  return Array.from(
    document.querySelectorAll<HTMLElement>('a[href], button, input, select, textarea, [tabindex]'),
  ).filter(
    (el) =>
      el.tabIndex >= 0 &&
      // A radio group is one Tab stop: its checked radio (F-013 review M1).
      !(el instanceof HTMLInputElement && el.type === 'radio' && !el.checked) &&
      !(el as HTMLButtonElement).disabled &&
      !el.closest('[inert]') &&
      el.getClientRects().length > 0,
  );
}

/**
 * RULE-19: focus leaves the canvas region forward or backward, to the next or previous control outside
 * it. Used only where the browser's own Tab would stay inside (forward from the region while one of its
 * options holds the Tab stop). False when there is none (the browser then moves focus on, e.g. out of
 * the frame to the host page).
 */
export function leaveRegion(region: HTMLElement, forward: boolean): boolean {
  const outside = tabbables().filter((el) => !region.contains(el));
  const after = (el: HTMLElement) => !!(region.compareDocumentPosition(el) & Node.DOCUMENT_POSITION_FOLLOWING);
  const target = forward ? outside.find(after) : outside.filter((el) => !after(el)).pop();
  if (!target) return false;
  target.focus();
  return true;
}

/**
 * RULE-19 Tab (`dir` 1) / Shift+Tab (−1): the index of the annotation to select next, or null when focus
 * leaves the canvas. From a focused option it steps from that option; else from the selection (Tab after
 * its last annotation in drawing order, Shift+Tab before its first); with nothing selected Tab selects the
 * first annotation and Shift+Tab leaves (CMP-Canvas: the region is the Tab stop before the list).
 */
export function nextIndex(
  ids: readonly string[],
  selection: readonly string[],
  focusedId: string | null,
  dir: 1 | -1,
): number | null {
  let from: number;
  const focused = focusedId === null ? -1 : ids.indexOf(focusedId);
  if (focused >= 0) from = focused;
  else {
    const picked = ids.map((id, i) => (selection.includes(id) ? i : -1)).filter((i) => i >= 0);
    if (!picked.length) return dir > 0 && ids.length ? 0 : null;
    from = dir > 0 ? Math.max(...picked) : Math.min(...picked);
  }
  const next = from + dir;
  return next >= 0 && next < ids.length ? next : null;
}
