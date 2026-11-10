// F-009 Undo and redo — end to end on the production build (Chromium + WebKit). As in edit.spec.ts: a grey
// 1000 × 800 image at 100 % in a 1200 × 800 work area, so image pixel (x, y) is at (100 + x, y); positions
// are read from CMP-StylePanel's position and size fields (F-008.R8). The 250-change AC4 is a model test
// (tests/unit/app.history.test.ts).
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { canvasPixel, summary } from './support/load';

const PANEL = 272;
const AREA = { width: 1200, height: 800 };
const VIEWPORT = { width: AREA.width + PANEL, height: 40 + AREA.height + 28 };
const IMAGE = { width: 1000, height: 800 };
const GREY = [200, 200, 200, 255];
const RED = [214, 40, 40, 255];
const BLUE = [11, 99, 229, 255];
const near = (a: number[], b: number[], tolerance = 24) => a.every((v, i) => Math.abs(v - (b[i] ?? 0)) <= tolerance);

const bar = (page: Page) => page.getByRole('toolbar', { name: 'Tools and actions' });
const workArea = (page: Page) => page.locator('main.tk-work-area');
const toolButton = (page: Page, name: string) => bar(page).getByRole('radio', { name });
const undoButton = (page: Page) => bar(page).getByRole('button', { name: 'Undo', exact: true });
const redoButton = (page: Page) => bar(page).getByRole('button', { name: 'Redo', exact: true });
const panel = (page: Page) => page.getByRole('complementary', { name: 'Style' });
const geometry = (page: Page) => panel(page).getByRole('group', { name: 'Position and size' });
const field = (page: Page, name: 'X' | 'Y' | 'Width' | 'Height') =>
  geometry(page).getByRole('textbox', { name, exact: true });
const editor = (page: Page) => page.getByRole('textbox', { name: 'Text' });
const state = (page: Page) => page.locator('[data-screen="SCR-Annotator"]');
const status = (page: Page) => page.locator('[role="status"]');
const frame = (page: Page) => page.evaluate(() => new Promise((r) => requestAnimationFrame(() => r(null))));
const screen = (x: number, y: number) => ({ x: (AREA.width - IMAGE.width) / 2 + x, y });
const count = (n: number) => `1,000 × 800 px canvas, ${n} annotation${n === 1 ? '' : 's'}`;
const pixel = (page: Page, x: number, y: number) => canvasPixel(page, screen(x, y).x, screen(x, y).y);

async function open(page: Page, query = '', viewport = VIEWPORT) {
  await page.setViewportSize(viewport);
  await page.goto(`/${query}`);
  await page.evaluate(
    async ({ width, height, grey }) => {
      const c = new OffscreenCanvas(width, height);
      const ctx = c.getContext('2d');
      if (!ctx) throw new Error('no 2d context');
      ctx.fillStyle = `rgb(${grey.slice(0, 3).join(',')})`;
      ctx.fillRect(0, 0, width, height);
      const blob = await c.convertToBlob({ type: 'image/png' });
      const dt = new DataTransfer();
      dt.items.add(new File([blob], 'grey.png', { type: 'image/png' }));
      document.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }));
    },
    { ...IMAGE, grey: GREY },
  );
  await expect(summary(page)).toHaveText(count(0));
  if (viewport !== VIEWPORT) return;
  await page.locator('footer.tk-status-bar').getByRole('button', { name: 'Actual size', exact: true }).click();
  await expect(page.locator('.tk-zoom__level')).toHaveText('100 %');
  await frame(page);
}

async function dragImage(page: Page, from: [number, number], to: [number, number]) {
  const box = await workArea(page).boundingBox();
  if (!box) throw new Error('no work area');
  const a = screen(...from);
  const b = screen(...to);
  await page.mouse.move(box.x + a.x, box.y + a.y);
  await page.mouse.down();
  await page.mouse.move(box.x + (a.x + b.x) / 2, box.y + (a.y + b.y) / 2, { steps: 4 });
  await page.mouse.move(box.x + b.x, box.y + b.y, { steps: 4 });
  await page.mouse.up();
  await frame(page);
}

async function rectangle(page: Page, from: [number, number], to: [number, number]) {
  await toolButton(page, 'Rectangle (R)').click();
  await dragImage(page, from, to);
}

test.describe('F-009 undo and redo', () => {
  test('F-009.AC1 a drawn and moved rectangle: Mod+Z twice undoes the move, then the rectangle; Mod+Shift+Z twice brings both back', async ({
    page,
  }) => {
    await open(page);
    await rectangle(page, [100, 100], [300, 200]);
    await toolButton(page, 'Select (V)').click();
    await dragImage(page, [100, 150], [150, 150]); // on the left edge, off the handles
    await expect(field(page, 'X')).toHaveValue('150');
    await workArea(page).focus();
    await page.keyboard.press('ControlOrMeta+Z');
    await expect(field(page, 'X')).toHaveValue('100');
    await expect(status(page)).toContainText('Undone');
    await page.keyboard.press('ControlOrMeta+Z');
    await expect(summary(page)).toHaveText(count(0));
    await page.keyboard.press('ControlOrMeta+Shift+Z');
    await expect(summary(page)).toHaveText(count(1));
    await expect(field(page, 'X')).toHaveValue('100');
    await expect(status(page)).toContainText('Redone');
    await page.keyboard.press('ControlOrMeta+Shift+Z');
    await expect(field(page, 'X')).toHaveValue('150');
    await expect(field(page, 'Y')).toHaveValue('100');
  });

  test('F-009.AC2 after an undo, drawing a new arrow makes redo unavailable', async ({ page }) => {
    await open(page);
    await rectangle(page, [100, 100], [300, 200]);
    await undoButton(page).click();
    await expect(summary(page)).toHaveText(count(0));
    await expect(redoButton(page)).toBeEnabled();
    await toolButton(page, 'Arrow (A)').click();
    await dragImage(page, [100, 400], [300, 400]);
    await expect(summary(page)).toHaveText(count(1));
    await expect(redoButton(page)).toBeDisabled();
  });

  test('F-009.AC3 undoing a recolour of two annotations gives both their old colour back, still selected', async ({
    page,
  }) => {
    await open(page);
    await toolButton(page, 'Rectangle (R)').click();
    await panel(page).getByRole('radio', { name: 'Solid', exact: true }).check();
    await dragImage(page, [100, 100], [300, 200]);
    await dragImage(page, [500, 100], [700, 200]);
    await toolButton(page, 'Select (V)').click();
    await workArea(page).focus();
    await page.keyboard.press('ControlOrMeta+A');
    // F-020: the fill colour group shows too (fill solid), so the colour is taken from COPY-style.color.
    const colour = panel(page).getByRole('radiogroup', { name: 'Color', exact: true });
    await colour.getByRole('radio', { name: 'Blue', exact: true }).check();
    await workArea(page).focus();
    await page.keyboard.press('Escape'); // clear the selection (not a step)
    await expect(state(page)).not.toHaveAttribute('data-state', 'selecting');
    // The outlines (left edges) are blue; the fill colour stays red (F-020.R2, D-054).
    await expect.poll(async () => near(await pixel(page, 100, 150), BLUE, 30)).toBe(true);
    await expect.poll(async () => near(await pixel(page, 500, 150), BLUE, 30)).toBe(true);
    await undoButton(page).click();
    // Both are selected again: several selected (no position fields), sharing the red colour.
    await expect(state(page)).toHaveAttribute('data-state', 'selecting');
    await expect(geometry(page)).toHaveCount(0);
    await expect(colour.getByRole('radio', { name: 'Red', exact: true })).toBeChecked();
    await workArea(page).focus();
    await page.keyboard.press('Escape');
    await expect(state(page)).not.toHaveAttribute('data-state', 'selecting');
    await expect.poll(async () => near(await pixel(page, 100, 150), RED, 30)).toBe(true);
    await expect.poll(async () => near(await pixel(page, 500, 150), RED, 30)).toBe(true);
  });

  test('F-009.AC5 with a new image undo and redo are disabled; after one change and one undo, undo is disabled and redo enabled', async ({
    page,
  }) => {
    await page.setViewportSize(VIEWPORT);
    await page.goto('/');
    await expect(undoButton(page)).toBeDisabled(); // CMP-Toolbar "no image"
    await expect(redoButton(page)).toBeDisabled();
    await open(page);
    await expect(undoButton(page)).toBeDisabled();
    await expect(redoButton(page)).toBeDisabled();
    await rectangle(page, [100, 100], [300, 200]);
    await expect(undoButton(page)).toBeEnabled();
    await expect(redoButton(page)).toBeDisabled();
    await undoButton(page).click();
    await expect(undoButton(page)).toBeDisabled();
    await expect(redoButton(page)).toBeEnabled();
    await expect(undoButton(page)).toHaveAttribute('aria-keyshortcuts', /^(Control|Meta)\+Z$/);
    await expect(redoButton(page)).toHaveAttribute(
      'aria-keyshortcuts',
      /^(Control\+Shift\+Z Control\+Y|Meta\+Shift\+Z)$/,
    );
    await redoButton(page).click();
    await expect(summary(page)).toHaveText(count(1));
  });

  test('F-009.AC6 a selected arrow held on the Right arrow key for 40 px is back where it started after one undo', async ({
    page,
  }) => {
    await open(page);
    await toolButton(page, 'Arrow (A)').click();
    await dragImage(page, [100, 400], [300, 400]);
    const start = geometry(page).getByRole('group', { name: 'Start' }).getByRole('textbox', { name: 'X' });
    await expect(start).toHaveValue('100');
    await workArea(page).focus();
    for (let i = 0; i < 40; i++) await page.keyboard.down('ArrowRight'); // held: auto-repeat key downs
    await page.keyboard.up('ArrowRight');
    await expect(start).toHaveValue('140');
    await page.keyboard.press('ControlOrMeta+Z');
    await expect(start).toHaveValue('100');
    await expect(summary(page)).toHaveText(count(1));
  });

  test('RULE-19 Ctrl+Y redoes on Windows and Linux', async ({ page }) => {
    // A Windows platform (MOD-App reads it once at start): Mod is Ctrl, and Ctrl+Y is redo.
    await page.addInitScript(() =>
      Object.defineProperty(Navigator.prototype, 'platform', { get: () => 'Win32', configurable: true }),
    );
    await open(page);
    await rectangle(page, [100, 100], [300, 200]);
    await workArea(page).focus();
    await page.keyboard.press('Control+Z');
    await expect(summary(page)).toHaveText(count(0));
    await page.keyboard.press('Control+Y');
    await expect(summary(page)).toHaveText(count(1));
  });

  test('F-009 edge case RULE-19 Mod+Z while editing a text undoes the typing in the field; after the edit ends it removes the whole text', async ({
    page,
  }) => {
    await open(page);
    await toolButton(page, 'Text (T)').click();
    const box = await workArea(page).boundingBox();
    if (!box) throw new Error('no work area');
    await page.mouse.click(box.x + screen(300, 300).x, box.y + screen(300, 300).y);
    await expect(editor(page)).toBeFocused();
    await page.keyboard.type('Bug');
    await expect(editor(page)).toHaveValue('Bug');
    await page.keyboard.press('ControlOrMeta+Z');
    await expect(editor(page)).not.toHaveValue('Bug'); // the field's own undo
    await expect(editor(page)).toBeFocused(); // still editing
    await page.keyboard.type('Hi');
    await expect(editor(page)).toHaveValue(/Hi$/);
    await page.keyboard.press('Escape');
    await expect(summary(page)).toHaveText(count(1));
    await workArea(page).focus();
    await page.keyboard.press('ControlOrMeta+Z');
    await expect(summary(page)).toHaveText(count(0));
  });

  test('RULE-19 the history keys work with focus on a toolbar control', async ({ page }) => {
    await open(page);
    await rectangle(page, [100, 100], [300, 200]);
    await toolButton(page, 'Rectangle (R)').focus();
    await page.keyboard.press('ControlOrMeta+Z');
    await expect(summary(page)).toHaveText(count(0));
    await expect(toolButton(page, 'Rectangle (R)')).toBeFocused();
    await page.keyboard.press('ControlOrMeta+Shift+Z');
    await expect(summary(page)).toHaveText(count(1));
  });

  test('CMP-Toolbar NFR-06 when a pressed Undo or Redo becomes disabled, focus moves to the other of the two', async ({
    page,
  }) => {
    await open(page);
    await rectangle(page, [100, 100], [300, 200]);
    await undoButton(page).focus();
    await page.keyboard.press('Enter');
    await expect(summary(page)).toHaveText(count(0));
    await expect(undoButton(page)).toBeDisabled();
    await expect(redoButton(page)).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(summary(page)).toHaveText(count(1));
    await expect(redoButton(page)).toBeDisabled();
    await expect(undoButton(page)).toBeFocused();
    // With steps left the pressed one keeps focus.
    await rectangle(page, [500, 100], [700, 200]);
    await undoButton(page).focus();
    await page.keyboard.press('Space');
    await expect(summary(page)).toHaveText(count(1));
    await expect(undoButton(page)).toBeFocused();
  });

  test('F-009 edge case the Undo button pressed while editing a text ends the edit, then undoes the whole text; Redo brings it back', async ({
    page,
  }) => {
    await open(page);
    await rectangle(page, [100, 100], [300, 200]); // a step before, so Undo is available while editing
    await toolButton(page, 'Text (T)').click();
    const box = await workArea(page).boundingBox();
    if (!box) throw new Error('no work area');
    await page.mouse.click(box.x + screen(300, 300).x, box.y + screen(300, 300).y);
    await expect(editor(page)).toBeFocused();
    await page.keyboard.type('Bug report');
    await undoButton(page).click();
    await expect(editor(page)).toBeHidden();
    await expect(summary(page)).toHaveText(count(1)); // the whole text is undone, the rectangle stays
    await redoButton(page).click();
    await expect(summary(page)).toHaveText(count(2));
    await expect(undoButton(page)).toBeEnabled();
    await expect(redoButton(page)).toBeDisabled();
  });

  test('RULE-19 Mod+Z while a text is edited with focus moved into the style panel does nothing', async ({ page }) => {
    await open(page);
    await rectangle(page, [100, 100], [300, 200]); // one step to undo
    await toolButton(page, 'Text (T)').click();
    const box = await workArea(page).boundingBox();
    if (!box) throw new Error('no work area');
    await page.mouse.click(box.x + screen(400, 500).x, box.y + screen(400, 500).y);
    await expect(editor(page)).toBeFocused();
    await page.keyboard.type('Bug');
    await panel(page).getByRole('radio', { name: 'Blue', exact: true }).focus();
    await expect(state(page)).toHaveAttribute('data-state', 'editing-text');
    await page.keyboard.press('ControlOrMeta+Z');
    await page.keyboard.press('ControlOrMeta+Shift+Z');
    await expect(state(page)).toHaveAttribute('data-state', 'editing-text');
    await expect(editor(page)).toHaveValue('Bug');
    await expect(summary(page)).toHaveText(count(1)); // the rectangle is still there
    await expect(redoButton(page)).toBeDisabled();
    await page.keyboard.press('Escape');
    await expect(summary(page)).toHaveText(count(2));
  });

  test('RULE-11 ADR-0008 §3 a zoom between arrow-key nudges ends the chain: one undo reverts only the last nudges', async ({
    page,
  }) => {
    await open(page);
    await rectangle(page, [100, 100], [300, 200]);
    await workArea(page).focus();
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('ArrowRight');
    await expect(field(page, 'X')).toHaveValue('102');
    await page.keyboard.press('ControlOrMeta+Equal');
    await expect(page.locator('.tk-zoom__level')).not.toHaveText('100 %');
    await workArea(page).focus();
    await page.keyboard.press('ArrowRight');
    await expect(field(page, 'X')).toHaveValue('103');
    await page.keyboard.press('ControlOrMeta+Z');
    await expect(field(page, 'X')).toHaveValue('102');
    await page.keyboard.press('ControlOrMeta+Z');
    await expect(field(page, 'X')).toHaveValue('100');
  });

  for (const theme of ['light', 'dark'] as const)
    test(`NFR-06 F-009 the undo and redo controls have no axe violations, enabled and disabled (${theme})`, async ({
      page,
    }) => {
      await open(page, `?theme=${theme}`);
      await rectangle(page, [100, 100], [300, 200]);
      await undoButton(page).click(); // undo disabled, redo enabled
      const results = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
        .analyze();
      expect(results.violations).toEqual([]);
    });
});
