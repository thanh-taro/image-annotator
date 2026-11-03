// MOD-App — the keyboard adapter for the keys built so far: reads each key press, the focus scope and
// the platform into MOD-Keys' pure `resolveKey`, keeps the key from the browser when RULE-19 says so,
// and runs the action. F-002 dispatches the View group and the arrow-key pan; F-003 the Tools keys,
// Enter and Esc; F-005 the keys while a text annotation is edited and Enter on a selected text; F-013 completes
// the map.
// Implements: RULE-19 (View keys, Space+drag, arrows pan with nothing selected, Tools keys, Enter, Esc),
// F-002.R2/R4, F-003.R5, F-005.R2/R4.
import { viewCommands } from '../canvas';
import type { ToolName } from '../core';
import { isEditing } from '../io';
import { resolveKey, type Scope } from '../keys';
import { editSelectedText, escape, placeAtCentre, setTool } from './drawing';
import { isMac } from './platform';
import { dialog, doc, selection, textEditing, tool } from './state';

/** Where focus is, for RULE-19's scope. The canvas region is the work area while an image is shown. */
function focusScope(e: KeyboardEvent): Scope['focus'] {
  const focused = document.activeElement;
  if (dialog.value || focused?.closest('[role="menu"], [role="dialog"]')) return 'dialog';
  // CMP-TextEditor: a text annotation being edited (RULE-19: only Esc and Mod+S act).
  if (e.target instanceof Element && e.target.classList.contains('tk-text-editor')) return 'textAnnotation';
  if (isEditing(e.target)) return 'text';
  if (focused instanceof HTMLElement && focused.classList.contains('tk-work-area')) return 'canvas';
  return 'control';
}

/** The single selected annotation is a text (RULE-19 Enter with the select tool edits it). */
function textSelected(): boolean {
  const [id] = selection.value;
  return selection.value.length === 1 && !!doc.value?.annotations.some((a) => a.id === id && a.kind === 'text');
}

function onKeyDown(e: KeyboardEvent): void {
  // Keys that compose a character in an input method belong to it (Esc there cancels the composition).
  if (e.defaultPrevented || e.isComposing) return;
  // F-005.R3 / RULE-19 Esc: with focus moved from the text into CMP-StylePanel, Esc still ends the edit
  // (the panel closes its narrow sheet first, and stops the key there).
  if (
    textEditing.value &&
    e.key === 'Escape' &&
    !e.ctrlKey &&
    !e.metaKey &&
    !e.altKey &&
    e.target instanceof Element &&
    e.target.closest('.tk-body__panel')
  ) {
    e.preventDefault();
    return escape();
  }
  const mod = isMac ? e.metaKey && !e.ctrlKey : e.ctrlKey && !e.metaKey;
  const resolution = resolveKey(
    { key: e.key, code: e.code, mod, shift: e.shiftKey, alt: e.altKey, mac: isMac },
    {
      focus: focusScope(e),
      tool: tool.value,
      selection: selection.value.length === 0 ? 'none' : selection.value.length === 1 ? 'one' : 'many',
      textSelected: textSelected(),
    },
  );
  if (resolution.preventDefault) e.preventDefault();
  const action = resolution.action;
  if (!action) return;
  if (action.kind === 'named' && action.group === 'tool') return setTool(action.name as ToolName);
  if (action.kind === 'named' && action.group === 'canvas' && action.name === 'place') return placeAtCentre();
  if (action.kind === 'named' && action.group === 'canvas' && action.name === 'editText') return editSelectedText();
  if (action.kind === 'named' && action.group === 'edit' && action.name === 'escape') return escape();
  if (action.group !== 'view') return;
  if (action.kind === 'pan') viewCommands.panView(action.dx, action.dy);
  else if (action.name === 'zoomIn') viewCommands.zoomIn();
  else if (action.name === 'zoomOut') viewCommands.zoomOut();
  else if (action.name === 'fit') viewCommands.fit();
  else if (action.name === 'actualSize') viewCommands.actualSize();
  else if (action.name === 'panHold') viewCommands.holdSpace(true);
}

function onKeyUp(e: KeyboardEvent): void {
  if (e.code === 'Space' || e.key === ' ') viewCommands.holdSpace(false);
}

/** Space+drag ends when focus leaves the canvas or the page. */
function release(): void {
  viewCommands.holdSpace(false);
}

/** Starts listening for keys; called once after the shell has mounted. Returns a stop function. */
export function startKeys(): () => void {
  document.addEventListener('keydown', onKeyDown);
  document.addEventListener('keyup', onKeyUp);
  document.addEventListener('focusout', release);
  window.addEventListener('blur', release);
  return () => {
    document.removeEventListener('keydown', onKeyDown);
    document.removeEventListener('keyup', onKeyUp);
    document.removeEventListener('focusout', release);
    window.removeEventListener('blur', release);
  };
}
