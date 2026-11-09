// F-013 Work from the keyboard — end to end on the production build (Chromium + WebKit): the RULE-19 keys
// in their focus scope, CMP-ShortcutHelp (opened with ? and from COPY-action.more), the accessible
// annotation list with Tab / Shift+Tab (CMP-Canvas "Accessibility"), the overflow menu on every layout, and
// axe on the dialog and the menu in both themes (NFR-06). As in edit.spec.ts: a grey 1000 × 800 image at
// 100 % in a 1200 × 800 work area. Positions are read from CMP-StylePanel's position and size fields.
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { copied, decodePng, recordClipboard } from './support/export';
import { summary } from './support/load';

const PANEL = 272;
const AREA = { width: 1200, height: 800 };
const VIEWPORT = { width: AREA.width + PANEL, height: 40 + AREA.height + 28 };
const IMAGE = { width: 1000, height: 800 };
const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];

const workArea = (page: Page) => page.locator('main.tk-work-area');
const toolbar = (page: Page) => page.getByRole('toolbar', { name: 'Tools and actions' });
const toolButton = (page: Page, name: string) => toolbar(page).getByRole('radio', { name });
const panel = (page: Page) => page.getByRole('complementary', { name: 'Style' });
const field = (page: Page, name: 'X' | 'Y' | 'Width' | 'Height') =>
  panel(page).getByRole('group', { name: 'Position and size' }).getByRole('textbox', { name, exact: true });
const help = (page: Page) => page.getByRole('dialog', { name: 'Keyboard shortcuts' });
const more = (page: Page) => toolbar(page).getByRole('button', { name: 'More actions' });
const menu = (page: Page) => page.getByRole('menu', { name: 'More actions' });
const list = (page: Page) => workArea(page).getByRole('listbox', { name: 'Annotations' });
const options = (page: Page) => list(page).getByRole('option');
const count = (n: number) => `1,000 × 800 px canvas, ${n} annotation${n === 1 ? '' : 's'}`;
const frame = (page: Page) => page.evaluate(() => new Promise((r) => requestAnimationFrame(() => r(null))));

async function pasteGrey(page: Page) {
  await page.evaluate(async ({ width, height }) => {
    const c = new OffscreenCanvas(width, height);
    const ctx = c.getContext('2d');
    if (!ctx) throw new Error('no 2d context');
    ctx.fillStyle = 'rgb(200,200,200)';
    ctx.fillRect(0, 0, width, height);
    const blob = await c.convertToBlob({ type: 'image/png' });
    const dt = new DataTransfer();
    dt.items.add(new File([blob], 'grey.png', { type: 'image/png' }));
    document.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }));
  }, IMAGE);
}

async function open(page: Page, query = '', viewport = VIEWPORT, loadedText = count(0)) {
  await page.setViewportSize(viewport);
  await page.goto(`/${query}`);
  await pasteGrey(page);
  await expect(summary(page)).toHaveText(loadedText);
  if (viewport === VIEWPORT && loadedText === count(0)) {
    await page.locator('footer.tk-status-bar').getByRole('button', { name: 'Actual size', exact: true }).click();
    await expect(page.locator('.tk-zoom__level')).toHaveText('100 %');
  }
  await frame(page);
}

/** Focuses the canvas region from the keyboard's point of view (nothing selected). */
async function focusCanvas(page: Page) {
  await workArea(page).focus();
  await expect(workArea(page)).toBeFocused();
}

/** Places a default annotation of `letter`'s tool at the centre of the view (RULE-19 Enter). */
async function place(page: Page, letter: string) {
  await page.keyboard.press(letter);
  await page.keyboard.press('Enter');
  await frame(page);
}

const isMac = (page: Page) => page.evaluate(() => /Mac|iPhone|iPad|iPod/.test(navigator.platform));

test.describe('F-013 work from the keyboard', () => {
  test('F-013.AC1 A picks the arrow tool, R the rectangle and X the redaction tool', async ({ page }) => {
    await open(page);
    await focusCanvas(page);
    await page.keyboard.press('a');
    await expect(toolButton(page, 'Arrow (A)')).toHaveAttribute('aria-checked', 'true');
    await page.keyboard.press('r');
    await expect(toolButton(page, 'Rectangle (R)')).toHaveAttribute('aria-checked', 'true');
    await page.keyboard.press('x');
    await expect(toolButton(page, 'Redact (X)')).toHaveAttribute('aria-checked', 'true');
  });

  test('F-013.AC2 the arrow tool’s tooltip and name give its key A, on hover and on focus', async ({ page }) => {
    await open(page);
    const arrow = toolButton(page, 'Arrow (A)');
    await arrow.hover();
    await expect(arrow).toHaveAttribute('title', 'Arrow (A)');
    await arrow.focus();
    await expect(arrow).toHaveAccessibleName('Arrow (A)');
    await expect(arrow).toHaveAttribute('aria-keyshortcuts', 'A');
  });

  test('F-013.AC3 ? on the canvas opens CMP-ShortcutHelp, focus on Close; Esc closes it and focus returns', async ({
    page,
  }) => {
    await open(page);
    await focusCanvas(page);
    await page.keyboard.press('Shift+Slash'); // ? on a US layout
    await expect(help(page)).toBeVisible();
    await expect(help(page).getByRole('button', { name: 'Close' })).toBeFocused();
    await expect(help(page).getByRole('heading', { level: 3 })).toHaveText([
      'Tools',
      'Canvas',
      'Edit',
      'History',
      'View',
      'Pointer',
      'Open',
      'Export',
      'Help',
    ]);
    await expect(help(page)).toContainText('Single-key and editing shortcuts work while the image has focus.');
    // Modal: the rest of the tool is inert and RULE-19 keys are off; Tab stays inside.
    await expect(page.locator('header.tk-toolbar')).toHaveAttribute('inert', '');
    await expect(workArea(page)).toHaveAttribute('inert', '');
    await page.keyboard.press('r');
    await expect(toolButton(page, 'Select (V)')).toHaveAttribute('aria-checked', 'true');
    await page.keyboard.press('Tab');
    await expect(help(page).locator('.tk-shortcuts__body')).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(help(page).getByRole('button', { name: 'Close' })).toBeFocused();
    await page.keyboard.press('Shift+Tab');
    await expect(help(page).locator('.tk-shortcuts__body')).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(help(page)).toHaveCount(0);
    await expect(workArea(page)).toBeFocused();
    await expect(toolButton(page, 'Select (V)')).toHaveAttribute('aria-checked', 'true');
  });

  test('F-013.AC3 COPY-action.shortcuts in the More menu opens CMP-ShortcutHelp; Close returns focus to the menu button', async ({
    page,
  }) => {
    await open(page);
    await more(page).click();
    await menu(page).getByRole('menuitem', { name: 'Keyboard shortcuts' }).click();
    await expect(help(page)).toBeVisible();
    await expect(menu(page)).toHaveCount(0);
    await help(page).getByRole('button', { name: 'Close' }).click();
    await expect(help(page)).toHaveCount(0);
    await expect(more(page)).toBeFocused();
  });

  test('F-013.AC8 CMP-ShortcutHelp lists every RULE-19 key with its action, including ? itself', async ({ page }) => {
    await open(page);
    const mac = await isMac(page);
    const M = mac ? '⌘' : 'Ctrl+';
    const S = mac ? '⇧' : 'Shift+';
    const A = mac ? '⌥ ' : 'Alt+';
    const Mw = mac ? '⌘ ' : 'Ctrl+';
    // RULE-19, group by group: [entry, keys as printed].
    const expected: [string, string][] = [
      ['Select', 'V'],
      ['Rectangle', 'R'],
      ['Ellipse', 'O'],
      ['Arrow', 'A'],
      ['Line', 'L'],
      ['Pen', 'P'],
      ['Highlight', 'H'],
      ['Text', 'T'],
      ['Step', 'N'],
      ['Redact', 'X'],
      ['Crop', 'C'],
      ['Place an annotation', 'Enter'],
      ['Edit selected text', 'Enter'],
      ['Next / previous annotation', `Tab / ${S}Tab`],
      ['Delete', 'Delete / Backspace'],
      ['Duplicate', `${M}D`],
      ['Select all', `${M}A`],
      ['Bring forward', ']'],
      ['Send backward', '['],
      ['Move selection', `← ↑ → ↓ / ${S}← ↑ → ↓`],
      ['Resize selection', `${A.trim()}← ↑ → ↓ / ${A.trim()}${S}← ↑ → ↓`],
      ['Cancel, finish editing, deselect', 'Esc'],
      ['Undo', `${M}Z`],
      ['Redo', mac ? '⌘⇧Z' : 'Ctrl+Shift+Z / Ctrl+Y'],
      ['Zoom in', `${M}= / ${M}+`],
      ['Zoom out', `${M}-`],
      ['Fit to view', `${S}1`],
      ['Actual size', `${S}0`],
      ['Pan the view', `Space+drag / ← ↑ → ↓ / ${S}← ↑ → ↓`],
      ['Zoom at pointer', `${Mw}wheel`],
      ['Move while drawing', `${A}drag`],
      ['Paste an image', `${M}V`],
      ['Open image', `${M}O`],
      ['Copy', `${M}C`],
      ['Download', `${M}S`],
      ['Keyboard shortcuts', '?'],
    ];
    await focusCanvas(page);
    await page.keyboard.press('Shift+Slash');
    const rows = help(page).locator('li');
    await expect(rows).toHaveCount(expected.length);
    const shown = await rows.evaluateAll((lis) =>
      lis.map((li) => [li.children[0]?.textContent ?? '', li.querySelector('kbd')?.textContent ?? '']),
    );
    expect(shown).toEqual(expected);
    // Spoken names as text for screen readers (CMP-ShortcutHelp "Accessibility"); the symbols are hidden.
    await expect(help(page).locator('kbd[aria-hidden="true"]')).toHaveCount(expected.length);
    // Read as "name, keys": a hidden separator between the entry and its spoken keys (a11y review m4).
    await expect(help(page).locator('li', { hasText: 'Keyboard shortcuts' }).locator('.tk-sr')).toHaveText(
      ', question mark',
    );
    // The scrolling list is focusable but has no name of its own (it would repeat the dialog's).
    await expect(help(page).getByRole('region')).toHaveCount(0);
  });

  test('F-013.R3 CMP-ShortcutHelp is shown in the active language (vi-VN)', async ({ page }) => {
    await open(page, '?lang=vi-VN', VIEWPORT, 'Khung ảnh 1.000 × 800 px, 0 chú thích');
    await focusCanvas(page);
    await page.keyboard.press('Shift+Slash');
    await expect(page.getByRole('dialog', { name: 'Phím tắt' })).toBeVisible();
    const dialog = page.getByRole('dialog', { name: 'Phím tắt' });
    await expect(dialog).toContainText('Chú thích tiếp theo / trước');
    // Pointer words and spoken key names in Vietnamese (COPY-key.*); only key labels stay as printed.
    await expect(dialog.locator('li', { hasText: 'Kéo khung nhìn' }).locator('kbd')).toHaveText(
      /^Space\+kéo \/ ← ↑ → ↓ \/ (⇧|Shift\+)← ↑ → ↓$/,
    );
    await expect(dialog.locator('li', { hasText: 'Phím tắt' }).locator('.tk-sr')).toHaveText(', dấu chấm hỏi');
    const text = (await dialog.locator('kbd, .tk-sr').allTextContents()).join(' | ');
    expect(text).not.toMatch(/\b(drag|wheel|arrows?|or|plus|minus|equals|question)\b/);
  });

  test('F-013 review M2: paste while CMP-ShortcutHelp is open changes nothing behind it', async ({ page }) => {
    await open(page);
    await focusCanvas(page);
    await place(page, 'r');
    await page.keyboard.press('Shift+Slash');
    await expect(help(page)).toBeVisible();
    await pasteGrey(page);
    await expect(page.getByRole('alertdialog')).toHaveCount(0);
    await expect(help(page)).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(summary(page)).toHaveText(count(1));
  });

  test('F-013 review m5: paste while the More menu is open is ignored and closes the menu, focus on its button', async ({
    page,
  }) => {
    await open(page);
    await more(page).click();
    await expect(menu(page)).toBeVisible();
    await page.evaluate(async () => {
      const c = new OffscreenCanvas(300, 200);
      c.getContext('2d')?.fillRect(0, 0, 300, 200);
      const blob = await c.convertToBlob({ type: 'image/png' });
      const dt = new DataTransfer();
      dt.items.add(new File([blob], 'other.png', { type: 'image/png' }));
      document.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }));
    });
    await expect(menu(page)).toHaveCount(0);
    await expect(more(page)).toBeFocused();
    await expect(summary(page)).toHaveText(count(0)); // still the 1,000 × 800 image
  });

  test('F-013 review M1: Shift+Tab from the canvas with nothing selected lands on the checked radio, not another', async ({
    page,
    browserName,
  }) => {
    test.skip(browserName !== 'chromium', 'WebKit’s default Tab order skips radio buttons');
    await open(page);
    await focusCanvas(page);
    await page.keyboard.press('r'); // the rectangle tool: the panel ends with the fill choice
    await page.keyboard.press('Shift+Tab');
    const focused = () =>
      page.evaluate(() => {
        const el = document.activeElement;
        return el instanceof HTMLInputElement ? `${el.type}:${el.checked}` : (el?.tagName ?? '');
      });
    await expect.poll(focused).toBe('radio:true');
    await expect(panel(page).locator(':focus')).toHaveCount(1);
  });

  test('F-013.AC4 keyboard only: place a rectangle, resize and move it, then Mod+C copies the image with it', async ({
    page,
  }) => {
    await recordClipboard(page);
    await open(page);
    await focusCanvas(page);
    await place(page, 'r');
    await expect(summary(page)).toHaveText(count(1));
    const x0 = Number(await field(page, 'X').inputValue());
    const y0 = Number(await field(page, 'Y').inputValue());
    const w0 = Number(await field(page, 'Width').inputValue());
    const h0 = Number(await field(page, 'Height').inputValue());
    await page.keyboard.press('Alt+Shift+ArrowRight'); // 10 wider
    await page.keyboard.press('Alt+ArrowDown'); // 1 taller
    await expect(field(page, 'Width')).toHaveValue(String(w0 + 10));
    await expect(field(page, 'Height')).toHaveValue(String(h0 + 1));
    await page.keyboard.press('Shift+ArrowLeft'); // 10 left
    await page.keyboard.press('ArrowDown'); // 1 down
    await expect(field(page, 'X')).toHaveValue(String(x0 - 10));
    await expect(field(page, 'Y')).toHaveValue(String(y0 + 1));
    await expect(workArea(page).getByRole('option')).toHaveCount(1);
    await page.keyboard.press('ControlOrMeta+C');
    const png = decodePng(await copied(page));
    expect([png.width, png.height]).toEqual([IMAGE.width, IMAGE.height]);
    // The rectangle's stroke runs along its box edges: its left edge, halfway down, is red; its middle is not.
    const at = (x: number, y: number) =>
      Array.from(png.data.subarray((y * png.width + x) * 4, (y * png.width + x) * 4 + 4));
    const left = at(x0 - 10, y0 + 1 + Math.round((h0 + 1) / 2));
    expect(left[0]).toBeGreaterThan(150);
    expect(left[1]).toBeLessThan(100);
    expect(at(x0 - 10 + Math.round((w0 + 10) / 2), y0 + 1 + Math.round((h0 + 1) / 2))).toEqual([200, 200, 200, 255]);
  });

  test('F-013.AC5 while a text annotation is edited, typing "rat" types the letters and no tool changes', async ({
    page,
  }) => {
    await open(page);
    await focusCanvas(page);
    await place(page, 't');
    const editor = page.locator('textarea.tk-text-editor');
    await expect(editor).toBeFocused();
    await page.keyboard.type('rat');
    await expect(editor).toHaveValue('rat');
    await expect(toolButton(page, 'Text (T)')).toHaveAttribute('aria-checked', 'true');
    // While CMP-TextEditor is open the annotation list has no Tab stop (CMP-Canvas "Accessibility").
    await expect(workArea(page).locator('[role="option"][tabindex="0"]')).toHaveCount(0);
  });

  test('F-013.AC6 Tab selects the next annotation in drawing order; Shift+Tab goes back; after the last focus moves on', async ({
    page,
    browserName,
  }) => {
    await open(page);
    await focusCanvas(page);
    await place(page, 'r');
    await place(page, 'o');
    await place(page, 'n');
    await expect(summary(page)).toHaveText(count(3));
    await page.keyboard.press('v');
    await page.keyboard.press('Escape'); // nothing selected: the region is the Tab stop
    await expect(workArea(page)).toHaveAttribute('tabindex', '0');
    await page.keyboard.press('Tab');
    await expect(options(page).nth(0)).toBeFocused();
    await expect(options(page).nth(0)).toHaveAttribute('aria-selected', 'true');
    await expect(options(page).nth(0)).toHaveAccessibleName(/^Rectangle at \d+, \d+$/);
    await expect(workArea(page)).toHaveAttribute('tabindex', '-1');
    await page.keyboard.press('Tab');
    await expect(options(page).nth(1)).toBeFocused();
    await expect(options(page).nth(1)).toHaveAttribute('aria-selected', 'true');
    await expect(options(page).nth(0)).toHaveAttribute('aria-selected', 'false');
    await expect(options(page).nth(1)).toHaveAccessibleName(/^Ellipse at /);
    await page.keyboard.press('Shift+Tab');
    await expect(options(page).nth(0)).toBeFocused();
    await expect(options(page).nth(0)).toHaveAttribute('aria-selected', 'true');
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    await expect(options(page).nth(2)).toBeFocused();
    await expect(options(page).nth(2)).toHaveAccessibleName(/^Step 1 at /);
    // After the last annotation, Tab moves focus to the next control (the status bar), the step staying selected.
    await page.keyboard.press('Tab');
    const focusedIn = () =>
      page.evaluate(() => {
        const el = document.activeElement;
        return el?.closest('footer') ? 'footer' : el?.closest('main') ? 'main' : el?.tagName;
      });
    // The browser moves focus on (WebKit's default Tab order skips the status bar's buttons and links).
    await expect.poll(focusedIn).not.toBe('main');
    if (browserName === 'chromium') expect(await focusedIn()).toBe('footer');
    await expect(options(page).nth(2)).toHaveAttribute('aria-selected', 'true');
    // Back with Shift+Tab: the selected annotation's option is the Tab stop (roving focus).
    await page.keyboard.press('Shift+Tab');
    await expect(options(page).nth(2)).toBeFocused();
  });

  test('F-013.AC6 Shift+Tab before the first annotation moves focus to the previous control', async ({ page }) => {
    await open(page);
    await focusCanvas(page);
    await place(page, 'r');
    await page.keyboard.press('Escape');
    await page.keyboard.press('Tab');
    await expect(options(page).nth(0)).toBeFocused();
    await page.keyboard.press('Shift+Tab');
    await expect.poll(() => page.evaluate(() => !!document.activeElement?.closest('.tk-body__panel'))).toBe(true);
  });

  test('F-013.AC7 Alt+Left with nothing selected is kept from the browser; the session is unchanged', async ({
    page,
  }) => {
    await open(page);
    const url = page.url();
    await focusCanvas(page);
    await page.evaluate(() => {
      const w = window as unknown as { __kept: boolean[] };
      w.__kept = [];
      window.addEventListener('keydown', (e) => e.key.startsWith('Arrow') && w.__kept.push(e.defaultPrevented));
    });
    await page.keyboard.press('Alt+ArrowLeft');
    await page.keyboard.press('Alt+ArrowRight');
    expect(await page.evaluate(() => (window as unknown as { __kept: boolean[] }).__kept)).toEqual([true, true]);
    expect(page.url()).toBe(url);
    await expect(summary(page)).toHaveText(count(0));
    await expect(page.locator('.tk-zoom__level')).toHaveText('100 %');
  });

  test('F-013.AC9 Right arrow on the colour swatches picks the next colour; the selected rectangle does not move', async ({
    page,
  }) => {
    await open(page);
    await focusCanvas(page);
    await place(page, 'r');
    const x = await field(page, 'X').inputValue();
    const colours = panel(page).getByRole('group', { name: 'Color' });
    const checked = colours.locator('input:checked');
    const before = await checked.getAttribute('value');
    await checked.focus();
    await page.keyboard.press('ArrowRight');
    await expect(checked).not.toHaveAttribute('value', before ?? '');
    await expect(field(page, 'X')).toHaveValue(x);
    await expect(summary(page)).toHaveText(count(1));
  });

  test('F-013.AC10 with CMP-ConfirmDialog open, Delete and R do nothing behind it; Esc closes it', async ({ page }) => {
    await open(page);
    await focusCanvas(page);
    await place(page, 'r');
    await pasteGrey(page); // unexported work: the replace confirmation
    const confirm = page.getByRole('alertdialog');
    await expect(confirm).toBeVisible();
    await page.keyboard.press('Delete');
    await page.keyboard.press('r');
    await page.keyboard.press('v');
    await page.keyboard.press('Shift+Slash');
    await expect(confirm).toBeVisible();
    await expect(help(page)).toHaveCount(0);
    await page.keyboard.press('Escape');
    await expect(confirm).toHaveCount(0);
    // CMP-ConfirmDialog: focus returns to what had it (review M3).
    await expect(workArea(page)).toBeFocused();
    await expect(summary(page)).toHaveText(count(1));
    await expect(toolButton(page, 'Rectangle (R)')).toHaveAttribute('aria-checked', 'true');
  });

  test('CMP-ConfirmDialog Cancel returns focus to the control that had it (review M3)', async ({ page }) => {
    await open(page);
    await focusCanvas(page);
    await place(page, 'r');
    const undo = toolbar(page).getByRole('button', { name: 'Undo', exact: true });
    await undo.focus();
    await pasteGrey(page);
    const confirm = page.getByRole('alertdialog');
    await expect(confirm).toBeVisible();
    await confirm.getByRole('button', { name: 'Cancel' }).click();
    await expect(confirm).toHaveCount(0);
    await expect(undo).toBeFocused();
  });

  test('CMP-Canvas the annotation list: named and described, one option per annotation, selected ones marked; selections announced', async ({
    page,
  }) => {
    await open(page);
    await expect(list(page)).toHaveCount(0); // no annotations, no list
    await focusCanvas(page);
    await place(page, 'r');
    await place(page, 'x');
    await expect(list(page)).toHaveAttribute('aria-multiselectable', 'true');
    await expect(list(page)).toHaveAccessibleDescription(
      'Tab moves to the next annotation; arrow keys move the selected one.',
    );
    await expect(options(page)).toHaveCount(2);
    await expect(options(page).nth(1)).toHaveAccessibleName(/^Solid \(secure\) at \d+, \d+$/);
    await page.keyboard.press('ControlOrMeta+A');
    await expect(options(page).nth(0)).toHaveAttribute('aria-selected', 'true');
    await expect(options(page).nth(1)).toHaveAttribute('aria-selected', 'true');
    await expect(page.locator('[role="status"]')).toContainText('2 annotations selected');
    // Delete with focus on an option: focus stays in the canvas (the region, nothing selected).
    await page.keyboard.press('v');
    await page.keyboard.press('Escape');
    await page.keyboard.press('Tab');
    await expect(options(page).nth(0)).toBeFocused();
    await page.keyboard.press('Delete');
    await expect(options(page)).toHaveCount(1);
    await expect(workArea(page)).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(options(page).nth(0)).toBeFocused();
    await page.keyboard.press('Delete');
    await expect(list(page)).toHaveCount(0);
    await expect(workArea(page)).toBeFocused();
    await expect(summary(page)).toHaveText(count(0));
  });

  test('CMP-Canvas a pointer selection is announced with the annotation’s name', async ({ page }) => {
    await open(page);
    await focusCanvas(page);
    await place(page, 'r');
    await page.keyboard.press('v');
    await page.keyboard.press('Escape');
    const box = await workArea(page).boundingBox();
    if (!box) throw new Error('no work area');
    // The default rectangle is centred in the view; its left edge is at the X field once selected.
    await page.keyboard.press('Tab');
    const left = Number(await field(page, 'X').inputValue());
    const top = Number(await field(page, 'Y').inputValue());
    await page.keyboard.press('Escape');
    await page.mouse.click(box.x + (AREA.width - IMAGE.width) / 2 + left, box.y + top + 20);
    await expect(page.locator('[role="status"]')).toContainText(`Rectangle at ${left}, ${top}`);
  });

  test('RULE-19 the view scrolls to keep an annotation selected with Tab in view', async ({ page }) => {
    await open(page);
    await focusCanvas(page);
    await place(page, 'r');
    // Zoom in and pan far away, so the rectangle is out of view.
    for (let i = 0; i < 4; i++) await page.keyboard.press('ControlOrMeta+=');
    await page.keyboard.press('v');
    await page.keyboard.press('Escape');
    for (let i = 0; i < 8; i++) await page.keyboard.press('Shift+ArrowRight');
    // The rectangle's red stroke is somewhere on the display canvas (it is in view).
    const redInView = () =>
      page.evaluate(() => {
        const c = document.querySelector<HTMLCanvasElement>('canvas.tk-canvas');
        const ctx = c?.getContext('2d');
        if (!c || !ctx) return false;
        const d = ctx.getImageData(0, 0, c.width, c.height).data;
        for (let i = 0; i < d.length; i += 4)
          if (
            Math.abs((d[i] ?? 0) - 214) < 12 &&
            Math.abs((d[i + 1] ?? 0) - 40) < 12 &&
            Math.abs((d[i + 2] ?? 0) - 40) < 12
          )
            return true;
        return false;
      });
    await frame(page);
    await frame(page);
    expect(await redInView(), 'panned away, the rectangle is out of view').toBe(false);
    await page.keyboard.press('Tab');
    await expect(options(page).first()).toBeFocused();
    await expect(page.locator('.tk-zoom__level')).not.toHaveText('100 %'); // the zoom is kept
    await expect.poll(redInView).toBe(true);
  });

  test('CMP-Toolbar COPY-action.more on wide and compact holds the shortcuts; on narrow the download and the shortcuts', async ({
    page,
  }) => {
    await open(page);
    await more(page).click();
    await expect(menu(page).getByRole('menuitem')).toHaveText(['Keyboard shortcuts']);
    await expect(menu(page).getByRole('menuitem', { name: 'Keyboard shortcuts' })).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(menu(page)).toHaveCount(0);
    await expect(more(page)).toBeFocused();
    await page.setViewportSize({ width: 900, height: VIEWPORT.height });
    await more(page).click();
    await expect(menu(page).getByRole('menuitem')).toHaveText(['Keyboard shortcuts']);
    await page.keyboard.press('Escape');
    await page.setViewportSize({ width: 390, height: 760 });
    await more(page).click();
    await expect(menu(page).getByRole('menuitem')).toHaveText(['Download', 'Keyboard shortcuts']);
    await page.keyboard.press('ArrowDown');
    await expect(menu(page).getByRole('menuitem', { name: 'Keyboard shortcuts' })).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(help(page)).toBeVisible();
    await expect(help(page).getByRole('button', { name: 'Close' })).toBeFocused();
  });

  test('CMP-Toolbar COPY-action.more: ArrowDown and ArrowUp open it at the first and last item; Home and End', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 760 });
    await open(page, '', { width: 390, height: 760 });
    await more(page).focus();
    await page.keyboard.press('ArrowDown');
    await expect(menu(page).getByRole('menuitem', { name: 'Download' })).toBeFocused();
    await expect(more(page)).toHaveAttribute('aria-controls', (await menu(page).getAttribute('id')) ?? 'missing');
    await page.keyboard.press('End');
    await expect(menu(page).getByRole('menuitem', { name: 'Keyboard shortcuts' })).toBeFocused();
    await page.keyboard.press('Home');
    await expect(menu(page).getByRole('menuitem', { name: 'Download' })).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(more(page)).toBeFocused();
    await page.keyboard.press('ArrowUp');
    await expect(menu(page).getByRole('menuitem', { name: 'Keyboard shortcuts' })).toBeFocused();
  });

  test('CMP-Toolbar COPY-action.more works before an image is loaded (shortcuts available, download not)', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 760 });
    await page.goto('/');
    await more(page).click();
    await expect(menu(page).getByRole('menuitem', { name: 'Download' })).toBeDisabled();
    await expect(menu(page).getByRole('menuitem', { name: 'Keyboard shortcuts' })).toBeFocused();
  });

  for (const theme of ['light', 'dark'] as const) {
    test(`NFR-06 F-013 CMP-ShortcutHelp has no axe violations, wide and narrow (${theme})`, async ({ page }) => {
      await open(page, `?theme=${theme}`);
      await focusCanvas(page);
      await page.keyboard.press('Shift+Slash');
      await expect(help(page)).toBeVisible();
      expect((await new AxeBuilder({ page }).withTags(TAGS).analyze()).violations).toEqual([]);
      await page.setViewportSize({ width: 390, height: 760 });
      await expect(page.locator('.tk-shortcuts--narrow')).toBeVisible();
      expect((await new AxeBuilder({ page }).withTags(TAGS).analyze()).violations).toEqual([]);
    });

    test(`NFR-06 F-013 the More menu and the annotation list have no axe violations (${theme})`, async ({ page }) => {
      await open(page, `?theme=${theme}`);
      await focusCanvas(page);
      await place(page, 'r');
      await page.keyboard.press('Escape');
      await page.keyboard.press('Tab');
      await expect(options(page).first()).toBeFocused();
      expect((await new AxeBuilder({ page }).withTags(TAGS).analyze()).violations).toEqual([]);
      await more(page).click();
      await expect(menu(page)).toBeVisible();
      expect((await new AxeBuilder({ page }).withTags(TAGS).analyze()).violations).toEqual([]);
      await page.keyboard.press('Escape');
      await page.setViewportSize({ width: 390, height: 760 });
      await more(page).click();
      await expect(menu(page).getByRole('menuitem')).toHaveCount(2);
      expect((await new AxeBuilder({ page }).withTags(TAGS).analyze()).violations).toEqual([]);
    });
  }
});
