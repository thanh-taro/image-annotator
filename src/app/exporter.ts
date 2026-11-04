// MOD-App — wires the export flow (./export.ts) to MOD-IO, the canvas and the SCR-Annotator signals: the
// toolbar's COPY-action.copy and COPY-action.download, the overflow's download on narrow widths, the
// notice's download after a refused copy, and the RULE-19 Export keys (Mod+C, Mod+S) all call these.
// Implements: F-012.R1/R2 (entry points), RULE-19 (Export keys), MOD-App commands `copy` and `download`.
import { canvasCommands } from '../canvas';
import { copyResult, downloadResult } from '../io';
import { exportResult, type ExportPorts } from './export';
import { dialog, doc, exported, loaded, setNotice } from './state';

const ports: ExportPorts = {
  current() {
    const l = loaded.value;
    const d = doc.value;
    // While a dialog is open the rest of the tool is inert (CMP-ConfirmDialog): no export.
    return l && d && !dialog.value ? { image: l.image, session: l.session, doc: d } : null;
  },
  endTextEdit: () => void canvasCommands.endTextEdit(),
  copy: (d, image) => copyResult(d, image),
  download: (d, image, localTime) => downloadResult(d, image, localTime),
  now: () => new Date(),
  notify: setNotice,
  later(fn, ms) {
    const id = setTimeout(fn, ms);
    return () => clearTimeout(id);
  },
  exported,
};

/** F-012.R1: copies the result (call it in the click or key press: the clipboard needs the gesture). */
export const copyNow = (): void => void exportResult('copy', ports);

/** F-012.R2: downloads the result. */
export const downloadNow = (): void => void exportResult('download', ports);
