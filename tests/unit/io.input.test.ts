// MOD-IO dropped files (F-001.R2 and edge cases): folders are skipped; a drop of folders only holds no
// files, which MOD-App refuses as unsupported_format.
import { describe, expect, it } from 'vitest';
import { droppedFiles } from '../../src/io/input';

const item = (file: File | null, isDirectory: boolean) =>
  ({ kind: 'file', getAsFile: () => file, webkitGetAsEntry: () => ({ isDirectory }) }) as unknown as DataTransferItem;
const data = (items: DataTransferItem[]) =>
  ({ items: items as unknown as DataTransferItemList, files: [] as unknown as FileList }) as Pick<
    DataTransfer,
    'items' | 'files'
  >;

describe('MOD-IO droppedFiles', () => {
  it('F-001 edge case: a drop of folders only yields no files', () => {
    expect(droppedFiles(data([item(new File([''], 'dir'), true), item(new File([''], 'dir2'), true)])).files).toEqual(
      [],
    );
  });

  it('F-001.R2 folders are skipped and files kept in order', () => {
    const a = new File(['a'], 'a.png');
    const b = new File(['b'], 'b.png');
    const r = droppedFiles(data([item(a, false), item(new File([''], 'dir'), true), item(b, false)]));
    expect(r.files).toEqual([a, b]);
    expect(r.count).toBe(3);
  });
});
