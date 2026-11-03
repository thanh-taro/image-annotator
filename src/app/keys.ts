// MOD-App — the keyboard adapter for the keys built so far: reads each key press, the focus scope and
// the platform into MOD-Keys' pure `resolveKey`, keeps the key from the browser when RULE-19 says so,
// and runs the action. F-002 dispatches the View group and the arrow-key pan; F-013 completes the map.
// Implements: RULE-19 (View keys, Space+drag, arrows pan with nothing selected), F-002.R2/R4.
import { viewCommands } from '../canvas';
import { isEditing } from '../io';
import { resolveKey, type Scope } from '../keys';
import { isMac } from './platform';
import { dialog } from './state';

/** Where focus is, for RULE-19's scope. The canvas region is the work area while an image is shown. */
function focusScope(e: KeyboardEvent): Scope['focus'] {
  const focused = document.activeElement;
  if (dialog.value || focused?.closest('[role="menu"], [role="dialog"]')) return 'dialog';
  if (isEditing(e.target)) return 'text';
  if (focused instanceof HTMLElement && focused.classList.contains('tk-work-area')) return 'canvas';
  return 'control';
}

function onKeyDown(e: KeyboardEvent): void {
  if (e.defaultPrevented) return;
  const mod = isMac ? e.metaKey && !e.ctrlKey : e.ctrlKey && !e.metaKey;
  const resolution = resolveKey(
    { key: e.key, code: e.code, mod, shift: e.shiftKey, alt: e.altKey, mac: isMac },
    // The tool and selection arrive with F-003/F-008; until then nothing can be selected.
    { focus: focusScope(e), tool: 'select', selection: 'none' },
  );
  if (resolution.preventDefault) e.preventDefault();
  const action = resolution.action;
  if (!action || action.group !== 'view') return;
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
