// F-008 Select and edit annotations — end to end on the production build (Chromium + WebKit). As in
// draw-shapes.spec.ts: a grey 1000 × 800 image at 100 % in a 1200 × 800 work area, so image pixel (x, y)
// is at (100 + x, y). Positions and sizes are read from CMP-StylePanel's position and size fields
// (F-008.R8), which show the single selection in image pixels; pixels are read off the display canvas.
// The undo halves of AC6 and AC17 wait for the undo controls (F-009); they are model-tested in
// tests/unit/app.edit.test.ts and tests/unit/canvas.select.test.ts.
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { canvasPixel, summary } from './support/load';

const PANEL = 272;
const AREA = { width: 1200, height: 800 };
const VIEWPORT = { width: AREA.width + PANEL, height: 40 + AREA.height + 28 };
const IMAGE = { width: 1000, height: 800 };
const GREY = [200, 200, 200, 255];
const RED = [214, 40, 40, 255];
const BLUE = [11, 99, 229, 255]; // annotation.color.blue #0B63E5
const near = (a: number[], b: number[], tolerance = 24) => a.every((v, i) => Math.abs(v - (b[i] ?? 0)) <= tolerance);

const workArea = (page: Page) => page.locator('main.tk-work-area');
const toolButton = (page: Page, name: string) =>
  page.getByRole('toolbar', { name: 'Tools and actions' }).getByRole('radio', { name });
const panel = (page: Page) => page.getByRole('complementary', { name: 'Style' });
const geometry = (page: Page) => panel(page).getByRole('group', { name: 'Position and size' });
const field = (page: Page, name: 'X' | 'Y' | 'Width' | 'Height') =>
  geometry(page).getByRole('textbox', { name, exact: true });
const frame = (page: Page) => page.evaluate(() => new Promise((r) => requestAnimationFrame(() => r(null))));
const screen = (x: number, y: number) => ({ x: (AREA.width - IMAGE.width) / 2 + x, y });
const count = (n: number) => `1,000 × 800 px canvas, ${n} annotation${n === 1 ? '' : 's'}`;
const pixel = (page: Page, x: number, y: number) => canvasPixel(page, screen(x, y).x, screen(x, y).y);
const state = (page: Page) => page.locator('[data-screen="SCR-Annotator"]');

async function open(page: Page, query = '') {
  await page.setViewportSize(VIEWPORT);
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
  await page.locator('footer.tk-status-bar').getByRole('button', { name: 'Actual size', exact: true }).click();
  await expect(page.locator('.tk-zoom__level')).toHaveText('100 %');
  await frame(page);
}

/** Presses at one image point, moves to another in steps (with `keys` held) and releases. */
async function dragImage(page: Page, from: [number, number], to: [number, number], keys: string[] = []) {
  const box = await workArea(page).boundingBox();
  if (!box) throw new Error('no work area');
  const a = screen(...from);
  const b = screen(...to);
  await page.mouse.move(box.x + a.x, box.y + a.y);
  for (const k of keys) await page.keyboard.down(k);
  await page.mouse.down();
  await page.mouse.move(box.x + (a.x + b.x) / 2, box.y + (a.y + b.y) / 2, { steps: 4 });
  await page.mouse.move(box.x + b.x, box.y + b.y, { steps: 4 });
  await page.mouse.up();
  for (const k of keys) await page.keyboard.up(k);
  await frame(page);
}

async function clickImage(page: Page, x: number, y: number, keys: string[] = []) {
  const box = await workArea(page).boundingBox();
  if (!box) throw new Error('no work area');
  for (const k of keys) await page.keyboard.down(k);
  await page.mouse.click(box.x + screen(x, y).x, box.y + screen(x, y).y);
  for (const k of keys) await page.keyboard.up(k);
  await frame(page);
}

/** A rectangle from (x1, y1) to (x2, y2) with the rectangle tool; it is then selected. */
async function rectangle(page: Page, from: [number, number], to: [number, number]) {
  await toolButton(page, 'Rectangle (R)').click();
  await dragImage(page, from, to);
}

async function deselect(page: Page) {
  await workArea(page).focus();
  await page.keyboard.press('Escape');
  await expect(state(page)).not.toHaveAttribute('data-state', 'selecting');
  await frame(page);
  await frame(page);
}

test.describe('F-008 select and edit', () => {
  test('F-008.AC1 a selection box dragged around two of three annotations selects exactly those two', async ({
    page,
  }) => {
    await open(page);
    await rectangle(page, [100, 100], [200, 160]);
    await rectangle(page, [300, 100], [400, 160]);
    await rectangle(page, [700, 500], [800, 560]);
    await toolButton(page, 'Select (V)').click();
    await deselect(page);
    await dragImage(page, [60, 60], [450, 200]);
    await expect(state(page)).toHaveAttribute('data-state', 'selecting');
    // Several selected: the actions show, the position fields do not (F-008.R8 is for one).
    await expect(geometry(page)).toHaveCount(0);
    await workArea(page).focus();
    await page.keyboard.press('Delete');
    await expect(summary(page)).toHaveText(count(1));
    await expect(page.locator('[role="status"]')).toContainText('2 annotations deleted');
    await frame(page);
    expect(near(await pixel(page, 700, 530), RED), 'the third is still there').toBe(true);
    expect(near(await pixel(page, 100, 130), GREY), 'the first is gone').toBe(true);
  });

  test('F-008.AC17 RULE-05 a press moved 3 px selects without moving; moved 10 px it moves 10 px', async ({ page }) => {
    await open(page);
    await rectangle(page, [100, 100], [300, 200]);
    await toolButton(page, 'Select (V)').click();
    await deselect(page);
    await dragImage(page, [100, 150 - 30], [103, 150 - 30]); // on the left edge, off the handles
    await expect(field(page, 'X')).toHaveValue('100');
    await expect(field(page, 'Y')).toHaveValue('100');
    await dragImage(page, [100, 120], [110, 120]);
    await expect(field(page, 'X')).toHaveValue('110');
    await expect(field(page, 'Y')).toHaveValue('100');
    await expect(field(page, 'Width')).toHaveValue('200');
  });

  test('F-008.AC2 dragging a selected arrow’s head handle moves only the head', async ({ page }) => {
    await open(page);
    await toolButton(page, 'Arrow (A)').click();
    await dragImage(page, [100, 400], [300, 400]);
    await toolButton(page, 'Select (V)').click();
    await dragImage(page, [300, 400], [350, 450]);
    const start = geometry(page).getByRole('group', { name: 'Start' });
    const end = geometry(page).getByRole('group', { name: 'End' });
    await expect(start.getByRole('textbox', { name: 'X' })).toHaveValue('100');
    await expect(start.getByRole('textbox', { name: 'Y' })).toHaveValue('400');
    await expect(end.getByRole('textbox', { name: 'X' })).toHaveValue('350');
    await expect(end.getByRole('textbox', { name: 'Y' })).toHaveValue('450');
  });

  test('F-008.AC3 RULE-06 a corner handle dragged with Shift keeps the rectangle’s aspect ratio', async ({ page }) => {
    await open(page);
    await rectangle(page, [100, 100], [300, 200]);
    await toolButton(page, 'Select (V)').click();
    await dragImage(page, [300, 200], [500, 220], ['Shift']);
    await expect(field(page, 'Width')).toHaveValue('400');
    await expect(field(page, 'Height')).toHaveValue('200');
    await expect(field(page, 'X')).toHaveValue('100');
  });

  test('F-008.AC6 Delete removes the selected rectangle; Mod+D puts a selected copy 10 px right and down', async ({
    page,
  }) => {
    await open(page);
    await rectangle(page, [100, 100], [300, 200]);
    await workArea(page).focus();
    await page.keyboard.press('ControlOrMeta+D');
    await expect(summary(page)).toHaveText(count(2));
    await expect(field(page, 'X')).toHaveValue('110');
    await expect(field(page, 'Y')).toHaveValue('110');
    await expect(page.locator('[role="status"]')).toContainText('1 annotation duplicated');
    await page.keyboard.press('Delete');
    await expect(summary(page)).toHaveText(count(1));
    await expect(state(page)).not.toHaveAttribute('data-state', 'selecting');
    await page.keyboard.press('Backspace'); // nothing selected: nothing happens
    await expect(summary(page)).toHaveText(count(1));
  });

  test('F-008.AC7 sending the top of two overlapping rectangles backward draws the other on top', async ({ page }) => {
    await open(page);
    await toolButton(page, 'Rectangle (R)').click();
    await panel(page).getByRole('radio', { name: 'Solid', exact: true }).check();
    await dragImage(page, [100, 100], [300, 300]);
    await deselect(page);
    await panel(page).getByRole('radio', { name: 'Blue', exact: true }).check();
    await dragImage(page, [200, 200], [400, 400]); // blue, on top, selected
    await panel(page).getByRole('button', { name: 'Send backward' }).click();
    await deselect(page);
    await expect.poll(async () => near(await pixel(page, 250, 250), RED)).toBe(true);
    await toolButton(page, 'Select (V)').click();
    await clickImage(page, 350, 350); // the blue one
    await workArea(page).focus();
    await page.keyboard.press(']');
    await deselect(page);
    await expect.poll(async () => near(await pixel(page, 250, 250), BLUE)).toBe(true);
  });

  test('F-008.AC8 F-008.R6 with the arrow tool a drag across a rectangle draws; with Alt it moves the rectangle', async ({
    page,
  }) => {
    await open(page);
    await rectangle(page, [100, 100], [300, 200]);
    await toolButton(page, 'Arrow (A)').click();
    await dragImage(page, [100, 130], [400, 130]);
    await expect(summary(page)).toHaveText(count(2));
    await deselect(page);
    expect(near(await pixel(page, 200, 100), RED), 'the rectangle stayed').toBe(true);
    await dragImage(page, [300, 170], [350, 170], ['Alt']);
    await expect(summary(page)).toHaveText(count(2));
    await expect(field(page, 'X')).toHaveValue('150');
    await expect(toolButton(page, 'Arrow (A)')).toHaveAttribute('aria-checked', 'true');
  });

  test('F-008.AC9 Shift+Right three times moves a selected text 30 image pixels right', async ({ page }) => {
    await open(page);
    await toolButton(page, 'Text (T)').click();
    await clickImage(page, 200, 300);
    await page.keyboard.type('Bug');
    await page.keyboard.press('Escape'); // editing ends; the text stays selected
    await expect(field(page, 'X')).toHaveValue('200');
    await workArea(page).focus();
    for (let i = 0; i < 3; i++) await page.keyboard.press('Shift+ArrowRight');
    await expect(field(page, 'X')).toHaveValue('230');
    await expect(field(page, 'Y')).toHaveValue('300');
    await expect(geometry(page).getByRole('textbox')).toHaveCount(2); // text: X and Y only
  });

  test('F-008.AC10 Alt+Right makes a 100 × 50 rectangle 101 × 50, top-left kept', async ({ page }) => {
    await open(page);
    await rectangle(page, [100, 100], [200, 150]);
    await workArea(page).focus();
    await page.keyboard.press('Alt+ArrowRight');
    await expect(field(page, 'Width')).toHaveValue('101');
    await expect(field(page, 'Height')).toHaveValue('50');
    await expect(field(page, 'X')).toHaveValue('100');
    await page.keyboard.press('Alt+Shift+ArrowDown');
    await expect(field(page, 'Height')).toHaveValue('60');
  });

  test('F-008.AC12 F-008.AC16 the width field is edited with Backspace, Left and Enter, then applied', async ({
    page,
  }) => {
    await open(page);
    await rectangle(page, [100, 100], [300, 200]);
    const width = field(page, 'Width');
    await width.click();
    // The caret at the end (End does not move it on macOS WebKit).
    await width.evaluate((el) => (el as HTMLInputElement).setSelectionRange(3, 3));
    await width.press('Backspace'); // "20"
    await width.press('ArrowLeft'); // caret between 2 and 0
    await width.press('5'); // "250"
    await expect(width).toHaveValue('250');
    // Nothing applied yet: still one rectangle, where it was.
    await expect(summary(page)).toHaveText(count(1));
    await expect(field(page, 'X')).toHaveValue('100');
    await width.press('Enter');
    await expect(width).toHaveValue('250');
    await expect(field(page, 'X')).toHaveValue('100');
    await expect(summary(page)).toHaveText(count(1));
    // AC12: typing 200 and Enter.
    await width.fill('200');
    await width.press('Enter');
    await expect(width).toHaveValue('200');
    await deselect(page);
    expect(near(await pixel(page, 300, 150), RED), 'right edge at x = 300').toBe(true);
  });

  test('F-008.AC13 a line’s start X and Y typed with the keyboard move its tail; the head stays', async ({ page }) => {
    await open(page);
    await toolButton(page, 'Line (L)').click();
    await dragImage(page, [100, 400], [300, 400]);
    const start = geometry(page).getByRole('group', { name: 'Start' });
    const end = geometry(page).getByRole('group', { name: 'End' });
    await start.getByRole('textbox', { name: 'X' }).focus();
    await page.keyboard.press('ControlOrMeta+A');
    await page.keyboard.type('150');
    await page.keyboard.press('Tab'); // leaving the field applies it; focus is in Start Y
    await page.keyboard.press('ControlOrMeta+A');
    await page.keyboard.type('450');
    await page.keyboard.press('Enter');
    await expect(start.getByRole('textbox', { name: 'X' })).toHaveValue('150');
    await expect(start.getByRole('textbox', { name: 'Y' })).toHaveValue('450');
    await expect(end.getByRole('textbox', { name: 'X' })).toHaveValue('300');
    await expect(end.getByRole('textbox', { name: 'Y' })).toHaveValue('400');
  });

  test('F-008.AC14 a selected step shows X and Y fields and no width or height', async ({ page }) => {
    await open(page);
    await toolButton(page, 'Step (N)').click();
    await clickImage(page, 300, 300);
    await expect(field(page, 'X')).toHaveValue('300');
    await expect(field(page, 'Y')).toHaveValue('300');
    await expect(field(page, 'Width')).toHaveCount(0);
    await expect(field(page, 'Height')).toHaveCount(0);
  });

  test('F-008.R1 Mod+A selects every annotation; a click on empty canvas clears the selection', async ({ page }) => {
    await open(page);
    await rectangle(page, [100, 100], [200, 160]);
    await rectangle(page, [300, 100], [400, 160]);
    await toolButton(page, 'Select (V)').click();
    await deselect(page);
    await page.keyboard.press('ControlOrMeta+A');
    await expect(state(page)).toHaveAttribute('data-state', 'selecting');
    await expect(geometry(page)).toHaveCount(0);
    await clickImage(page, 600, 600);
    await expect(state(page)).not.toHaveAttribute('data-state', 'selecting');
    // Shift+click adds.
    await clickImage(page, 100, 130);
    await expect(geometry(page)).toHaveCount(1);
    await clickImage(page, 300, 130, ['Shift']);
    await expect(geometry(page)).toHaveCount(0);
  });

  for (const theme of ['light', 'dark'] as const)
    test(`NFR-06 F-008 the selection actions and position fields have no axe violations (${theme})`, async ({
      page,
    }) => {
      await open(page, `?theme=${theme}`);
      await toolButton(page, 'Arrow (A)').click();
      await dragImage(page, [100, 400], [300, 400]);
      await expect(geometry(page)).toBeVisible();
      const results = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
        .analyze();
      expect(results.violations).toEqual([]);
    });
});
