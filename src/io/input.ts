// MOD-IO — getting files in: paste, drop and the file picker (platform-mapping.md "Load").
// Only `File` objects are read: pasted HTML, links and web images are never parsed or fetched
// (F-001.AC15, NFR-01). Keydown Mod+V is never prevented; the browser's `paste` event does the work.
// Implements: F-001.R1, F-001.R2, F-001.R3, F-001.R4 (input side); RULE-01 (several files: MOD-App tries
// them in order); RULE-15 (the source name is recorded only for picked or dropped files).

export type InputVia = 'paste' | 'drop' | 'pick';

export interface InputFile {
  readonly file: File;
  /** RULE-15: the file name for picked or dropped files; null for pasted ones. */
  readonly sourceName: string | null;
}

export interface ImageInput {
  /** The files in order (folders skipped); at least one. */
  readonly files: readonly InputFile[];
  readonly via: InputVia;
  /** More than one file (or folder) arrived (COPY-load.first_only once one loads). */
  readonly extraFiles: boolean;
}

export interface InputHandlers {
  /** Files to check and load. */
  file(input: ImageInput): void;
  /** Input without image data: a paste with no image file, or a drop of folders only. */
  noImage(via: 'paste' | 'drop'): void;
  /** A file drag entered (true) or left / dropped / was cancelled with Esc (false). */
  dragging(active: boolean): void;
}

/** The picker's hint; the magic bytes decide what loads (ADR-0005). */
const ACCEPT = 'image/png,image/jpeg,image/webp,image/gif,image/bmp,image/avif';

let handlers: InputHandlers | null = null;
let picker: HTMLInputElement | null = null;

/**
 * Text is being edited (RULE-19): a paste goes to the field and never loads an image (F-001 edge
 * cases); no Load key acts. The one definition for MOD-App until MOD-Keys owns it (F-013).
 */
export function isEditing(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false;
  if (target instanceof HTMLTextAreaElement) return true;
  if (target instanceof HTMLInputElement)
    return !['button', 'checkbox', 'radio', 'file', 'submit'].includes(target.type);
  return target instanceof HTMLElement && target.isContentEditable;
}

const hasFiles = (e: DragEvent) => !!e.dataTransfer && Array.from(e.dataTransfer.types).includes('Files');

/** Image files on the clipboard: `files`, or items of kind `file` with an image type. */
function clipboardImages(data: DataTransfer | null): File[] {
  if (!data) return [];
  const files = Array.from(data.files).filter((f) => f.type.startsWith('image/'));
  if (files.length) return files;
  return Array.from(data.items)
    .filter((item) => item.kind === 'file' && item.type.startsWith('image/'))
    .map((item) => item.getAsFile())
    .filter((f): f is File => !!f);
}

/** Dropped files in order, skipping folders; `count` includes the folders (F-001 edge cases). */
export function droppedFiles(data: Pick<DataTransfer, 'items' | 'files'>): { files: File[]; count: number } {
  const items = Array.from(data.items).filter((item) => item.kind === 'file');
  if (!items.length) return { files: Array.from(data.files), count: data.files.length };
  const files: File[] = [];
  for (const item of items) {
    if (item.webkitGetAsEntry?.()?.isDirectory) continue;
    const file = item.getAsFile();
    if (file) files.push(file);
  }
  return { files, count: items.length };
}

/** Starts listening for paste, drop and picked files on this document. Returns a stop function. */
export function onImageInput(next: InputHandlers): () => void {
  handlers = next;
  let depth = 0;
  const endDrag = () => {
    if (depth === 0) return;
    depth = 0;
    handlers?.dragging(false);
  };

  const onPaste = (e: ClipboardEvent) => {
    if (e.defaultPrevented || isEditing(e.target)) return;
    e.preventDefault();
    const images = clipboardImages(e.clipboardData);
    if (images.length) {
      const files = images.map((file) => ({ file, sourceName: null }));
      handlers?.file({ files, via: 'paste', extraFiles: images.length > 1 });
    } else handlers?.noImage('paste');
  };
  const onDragEnter = (e: DragEvent) => {
    if (!hasFiles(e)) return;
    e.preventDefault();
    if (depth++ === 0) handlers?.dragging(true);
  };
  const onDragOver = (e: DragEvent) => {
    if (!hasFiles(e)) return;
    e.preventDefault();
    if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy';
    if (depth === 0) {
      depth = 1;
      handlers?.dragging(true);
    }
  };
  const onDragLeave = (e: DragEvent) => {
    if (!hasFiles(e) || depth === 0) return;
    if (--depth === 0) handlers?.dragging(false);
  };
  const onDrop = (e: DragEvent) => {
    if (!e.dataTransfer || !hasFiles(e)) return;
    e.preventDefault();
    endDrag();
    const { files, count } = droppedFiles(e.dataTransfer);
    if (files.length) {
      handlers?.file({
        files: files.map((file) => ({ file, sourceName: file.name || null })),
        via: 'drop',
        extraFiles: count > 1,
      });
    } else handlers?.noImage('drop');
  };
  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') endDrag();
  };

  document.addEventListener('paste', onPaste);
  document.addEventListener('dragenter', onDragEnter);
  document.addEventListener('dragover', onDragOver);
  document.addEventListener('dragleave', onDragLeave);
  document.addEventListener('drop', onDrop);
  document.addEventListener('keydown', onKeyDown);
  return () => {
    document.removeEventListener('paste', onPaste);
    document.removeEventListener('dragenter', onDragEnter);
    document.removeEventListener('dragover', onDragOver);
    document.removeEventListener('dragleave', onDragLeave);
    document.removeEventListener('drop', onDrop);
    document.removeEventListener('keydown', onKeyDown);
    picker?.remove();
    picker = null;
    if (handlers === next) handlers = null;
  };
}

/** Opens the device's file picker (F-001.R3; the open action or Mod+O, both user activations). */
export function openPicker(): void {
  if (!picker) {
    picker = document.createElement('input');
    picker.type = 'file';
    picker.accept = ACCEPT;
    picker.hidden = true;
    picker.tabIndex = -1;
    picker.setAttribute('aria-hidden', 'true');
    picker.addEventListener('change', () => {
      const file = picker?.files?.[0];
      if (file) handlers?.file({ files: [{ file, sourceName: file.name || null }], via: 'pick', extraFiles: false });
      if (picker) picker.value = '';
    });
    document.body.append(picker);
  }
  picker.click();
}
