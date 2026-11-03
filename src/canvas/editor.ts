// MOD-Canvas — CMP-TextEditor's field: the transparent-text `<textarea>` over the canvas glyphs
// (ADR-0009 §2, promoted from the SP-text spike, ADR-0020). The caret, selection, input methods,
// Vietnamese input and undo are the field's own; the glyphs the user sees are the canvas's. Inserted
// text is kept composed (NFC) back to the last starter and within 2,000 code points of the composed
// text: on `beforeinput` for typing, pasting and dropping, at `compositionend` for input methods. Only
// an insertion whose result differs from the plain one is redone, through `execCommand('insertText')`,
// so the field's own undo keeps working. Focus moving anywhere other than the field or CMP-StylePanel
// ends the edit (F-005.R3) — watched on the document, so it also ends when focus goes on from the panel.
// Implements: F-005.R2 (keys and editing as in any text field, new lines, paste and drop as plain text
// cut at 2,000), F-005.R3, RULE-08 (limit, composed form), ADR-0009 §2/§3, ADR-0020, CMP-TextEditor
// "Accessibility" (a multi-line text field that takes focus when editing starts).
import { textInsertion } from '../core';
import type { TextField } from './text';

export interface FieldHooks {
  /** The value changed: the field is resized and the canvas repaints the text. */
  onInput(): void;
  /** Focus left the field for something that does not keep the edit open. */
  onFocusLeft(): void;
  /** Focus may move here while the edit stays open (the style panel; the canvas, whose press ends it). */
  keepsEdit(target: Element): boolean;
}

/** The input types that insert text, and what a line break inserts. */
const LINE_BREAKS = new Set(['insertLineBreak', 'insertParagraph']);
/** Input-method input types (Chromium and WebKit): checked once, at compositionend (ADR-0009 §3). */
const COMPOSITION = new Set(['insertCompositionText', 'insertFromComposition', 'deleteCompositionText']);

/** Binds the field's events; returns the TextField the text tool drives, and a function that unbinds. */
export function bindTextField(ta: HTMLTextAreaElement, hooks: FieldHooks): { field: TextField; stop(): void } {
  let applying = false;

  /** Replaces `from`–`to` with `text` through the field's own editing path (native undo stays intact). */
  const replace = (from: number, to: number, text: string) => {
    applying = true;
    try {
      ta.setSelectionRange(from, to);
      // ADR-0020: `insertText` keeps the field's undo stack and puts the caret after the text.
      document.execCommand('insertText', false, text);
    } finally {
      applying = false;
    }
  };

  const onBeforeInput = (e: InputEvent) => {
    if (applying || e.isComposing || COMPOSITION.has(e.inputType) || !e.inputType.startsWith('insert')) return;
    let data = e.data ?? e.dataTransfer?.getData('text/plain') ?? null;
    if (data === null && LINE_BREAKS.has(e.inputType)) data = '\n';
    if (data === null) return;
    // Pasted or dropped text is plain text with the field's own line breaks.
    data = data.replace(/\r\n?/g, '\n');
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const r = textInsertion(ta.value, start, end, data);
    if (r.from === start && r.text === data) return; // the plain insertion is already right
    e.preventDefault();
    if (r.text === '' && r.from === start) return; // RULE-08: nothing more fits
    replace(r.from, r.to, r.text);
  };

  // ADR-0009 §3: during composition the check runs at compositionend, on the composed text.
  const onCompositionEnd = (e: CompositionEvent) => {
    const data = e.data ?? '';
    const caret = ta.selectionEnd;
    const start = caret - data.length;
    if (!data || start < 0 || ta.value.slice(start, caret) !== data) return;
    const rest = ta.value.slice(0, start) + ta.value.slice(caret);
    const r = textInsertion(rest, start, start, data);
    if (r.from === start && r.text === data) return;
    replace(r.from, caret, r.text);
  };

  const onInput = () => hooks.onInput();

  const open = () => ta.dataset['open'] !== undefined;
  const keeps = (el: Element | null) => !!el && (el === ta || hooks.keepsEdit(el));
  const stillEditing = () => {
    // A window that lost focus keeps the edit (focus comes back with the window).
    if (!open() || !document.hasFocus()) return;
    if (!keeps(document.activeElement)) hooks.onFocusLeft();
  };
  // Focus arriving anywhere else (from the field or from the panel) ends the edit.
  const onFocusIn = (e: FocusEvent) => {
    if (open() && !keeps(e.target instanceof Element ? e.target : null)) hooks.onFocusLeft();
  };
  // Focus leaving for nothing (a click on something that takes no focus, or the window was left):
  // decide once focus has settled.
  const onFocusOut = (e: FocusEvent) => {
    if (open() && !e.relatedTarget) setTimeout(stillEditing, 0);
  };

  ta.addEventListener('beforeinput', onBeforeInput);
  ta.addEventListener('compositionend', onCompositionEnd);
  ta.addEventListener('input', onInput);
  document.addEventListener('focusin', onFocusIn);
  document.addEventListener('focusout', onFocusOut);

  const field: TextField = {
    open(value, caret) {
      ta.value = value; // a new value also starts a new undo history for this edit
      ta.dataset['open'] = '';
      ta.focus({ preventScroll: true });
      ta.setSelectionRange(caret, caret);
      hooks.onInput();
    },
    close() {
      delete ta.dataset['open'];
      ta.value = '';
    },
    get value() {
      return ta.value;
    },
  };
  return {
    field,
    stop() {
      ta.removeEventListener('beforeinput', onBeforeInput);
      ta.removeEventListener('compositionend', onCompositionEnd);
      ta.removeEventListener('input', onInput);
      document.removeEventListener('focusin', onFocusIn);
      document.removeEventListener('focusout', onFocusOut);
    },
  };
}
