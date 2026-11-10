// F-019 Custom colour and size — end to end on the production build (Chromium + WebKit). As in
// draw-shapes.spec.ts, a plain grey 1000 × 800 image is pasted and shown at 100 % in a 1200 × 800 work
// area, so image pixel (x, y) is at (100 + x, y) in it. The browser's own colour picker cannot be driven in
// a headless browser: `showPicker()` is stubbed to record that it was asked to open (the picker itself is
// a manual check), and the picker's events (`input` per colour, `change` when it closes with a choice,
// `cancel`) are dispatched on the visually hidden colour input it belongs to (platform-mapping).
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { decodePng, download, downloadButton } from './support/export';
import { canvasPixel, summary } from './support/load';

const PANEL = 272;
const AREA = { width: 1200, height: 800 };
const VIEWPORT = { width: AREA.width + PANEL, height: 40 + AREA.height + 28 };
const IMAGE = { width: 1000, height: 800 };
const GREY = [200, 200, 200, 255];
const RED = [214, 40, 40, 255]; // annotation.color.red #D62828
const DODGER = [30, 144, 255, 255]; // #1e90ff
const SLATE = [47, 79, 79, 255]; // #2f4f4f
const MOCCASIN = [255, 228, 181, 255]; // #ffe4b5
const near = (a: number[], b: number[], tolerance = 24) => a.every((v, i) => Math.abs(v - (b[i] ?? 0)) <= tolerance);

const workArea = (page: Page) => page.locator('main.tk-work-area');
const panel = (page: Page) => page.getByRole('complementary', { name: 'Style' });
const toolButton = (page: Page, name: string) =>
  page.getByRole('toolbar', { name: 'Tools and actions' }).getByRole('radio', { name });
const colours = (page: Page) => panel(page).getByRole('radiogroup', { name: 'Color' });
const swatch = (page: Page, name: string) => colours(page).getByRole('radio', { name, exact: true });
const custom = (page: Page) => colours(page).getByRole('radio', { name: /^Custom color/ });
const sizes = (page: Page) => panel(page).getByRole('group', { name: 'Size', exact: true });
const preset = (page: Page, name: 'Small' | 'Medium' | 'Large') =>
  sizes(page).getByRole('radio', { name, exact: true });
const field = (page: Page) => panel(page).getByRole('spinbutton', { name: 'Size in pixels' });
const slider = (page: Page) => panel(page).getByRole('slider', { name: 'Size in pixels' });
const undoButton = (page: Page) =>
  page.getByRole('toolbar', { name: 'Tools and actions' }).getByRole('button', { name: 'Undo', exact: true });
const state = (page: Page) => page.locator('[data-screen="SCR-Annotator"]');
const editor = (page: Page) => page.locator('textarea.tk-text-editor');
const frame = (page: Page) => page.evaluate(() => new Promise((r) => requestAnimationFrame(() => r(null))));
const count = (n: number) => `1,000 × 800 px canvas, ${n} annotation${n === 1 ? '' : 's'}`;

/** Image pixel → CSS px in the work area at 100 % (the image is centred horizontally, top-aligned). */
const screen = (x: number, y: number) => ({ x: (AREA.width - IMAGE.width) / 2 + x, y });
const pixel = (page: Page, x: number, y: number) => canvasPixel(page, screen(x, y).x, screen(x, y).y);

/** Every pixel (RGBA) of an image-pixel region of the display canvas, in one read. */
async function region(page: Page, x: number, y: number, w: number, h: number): Promise<number[][]> {
  return page.locator('canvas.tk-canvas').evaluate(
    (el, { x, y, w, h }) => {
      const c = el as HTMLCanvasElement;
      const k = c.width / c.getBoundingClientRect().width;
      const ctx = c.getContext('2d', { colorSpace: 'srgb' });
      const d = ctx?.getImageData(Math.round(x * k), Math.round(y * k), Math.round(w * k), Math.round(h * k)).data;
      const out: number[][] = [];
      for (let i = 0; d && i < d.length; i += 4) out.push([d[i] ?? 0, d[i + 1] ?? 0, d[i + 2] ?? 0, d[i + 3] ?? 0]);
      return out;
    },
    { ...screen(x, y), w, h },
  );
}

type PickerWindow = { __pickerOpened: number; __pickerClicks: number };

/** Before the page loads: `showPicker()` (or, with `fallback`, `click()`) on a colour input is recorded. */
async function stubPicker(page: Page, fallback = false) {
  await page.addInitScript((fallback) => {
    const w = window as unknown as PickerWindow;
    w.__pickerOpened = 0;
    w.__pickerClicks = 0;
    const proto = HTMLInputElement.prototype as HTMLInputElement & { showPicker?: () => void };
    if (fallback)
      proto.showPicker = function () {
        throw new DOMException('not supported', 'NotSupportedError');
      };
    else
      proto.showPicker = function (this: HTMLInputElement) {
        if (this.type === 'color') w.__pickerOpened++;
      };
    const click = proto.click;
    proto.click = function (this: HTMLInputElement) {
      if (this.type === 'color') w.__pickerClicks++;
      else click.call(this);
    };
  }, fallback);
}
const opened = (page: Page) => page.evaluate(() => (window as unknown as PickerWindow).__pickerOpened);

/** The picker reports these colours while open, then closes with a choice, cancels, or just closes. */
async function picker(page: Page, values: string[], end: 'change' | 'cancel' | 'close' = 'change') {
  await page.locator('.tk-panel input[type="color"]').evaluate(
    (el, { values, end }) => {
      const input = el as HTMLInputElement;
      for (const v of values) {
        input.value = v;
        input.dispatchEvent(new Event('input', { bubbles: true }));
      }
      if (end === 'change') input.dispatchEvent(new Event('change', { bubbles: true }));
      if (end === 'cancel') input.dispatchEvent(new Event('cancel'));
    },
    { values, end },
  );
  await frame(page);
}

/** Clicks the custom swatch and picks `hex` with the picker. */
async function pickCustom(page: Page, hex: string) {
  await custom(page).click();
  await picker(page, [hex]);
}

async function open(page: Page, query = '') {
  await stubPicker(page);
  await page.setViewportSize(VIEWPORT);
  await page.goto(`/${query}`);
  await paste(page);
  await page.locator('footer.tk-status-bar').getByRole('button', { name: 'Actual size', exact: true }).click();
  await expect(page.locator('.tk-zoom__level')).toHaveText('100 %');
  await frame(page);
}

/** Pastes a plain grey 1000 × 800 image (a new image when one is already loaded). */
async function paste(page: Page, wait = true) {
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
  if (wait) await expect(summary(page)).toHaveText(count(0));
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

async function clickImage(page: Page, x: number, y: number) {
  const box = await workArea(page).boundingBox();
  if (!box) throw new Error('no work area');
  await page.mouse.click(box.x + screen(x, y).x, box.y + screen(x, y).y);
  await frame(page);
}

async function deselect(page: Page) {
  await workArea(page).focus();
  await page.keyboard.press('Escape');
  await expect(state(page)).not.toHaveAttribute('data-state', 'selecting');
  await frame(page);
  await frame(page);
}

/** Types into the size field and presses Enter. */
async function enterSize(page: Page, text: string) {
  await field(page).click();
  await field(page).press('ControlOrMeta+A');
  await page.keyboard.type(text);
  await page.keyboard.press('Enter');
}

/** The rectangle (100, 100)–(300, 200)'s left edge: which columns around x = 100 are painted at y = 150. */
async function leftEdge(page: Page, colour: number[]) {
  const painted: number[] = [];
  for (let x = 90; x <= 110; x++) if (near(await pixel(page, x, 150), colour, 40)) painted.push(x);
  return painted;
}

/** Rows (or columns) at a fixed column (row) whose pixel is not the grey image. */
async function extent(page: Page, axis: 'x' | 'y', at: number, from: number, to: number) {
  let n = 0;
  for (let v = from; v <= to; v++) {
    const p = axis === 'y' ? await pixel(page, at, v) : await pixel(page, v, at);
    if (!near(p, GREY, 6)) n++;
  }
  return n;
}

test.describe('F-019 custom colour and size', () => {
  test('F-019.AC1 #1e90ff picked with the rectangle tool draws #1e90ff with the custom swatch marked; the next arrow is #1e90ff', async ({
    page,
  }) => {
    await open(page);
    await toolButton(page, 'Rectangle (R)').click();
    await pickCustom(page, '#1e90ff');
    await expect(custom(page)).toHaveAttribute('aria-checked', 'true');
    await expect(swatch(page, 'Red')).toHaveAttribute('aria-checked', 'false');
    await dragImage(page, [100, 100], [300, 200]);
    await deselect(page);
    expect(near(await pixel(page, 100, 150), DODGER), 'the rectangle is #1e90ff').toBe(true);
    await toolButton(page, 'Arrow (A)').click();
    await expect(custom(page)).toHaveAttribute('aria-checked', 'true');
    await dragImage(page, [100, 400], [400, 400]);
    await deselect(page);
    expect(near(await pixel(page, 250, 400), DODGER), 'the arrow is #1e90ff').toBe(true);
  });

  test('F-019.AC2 a selected step given #ffe4b5 is a #ffe4b5 badge with a black number, one undo step; #2f4f4f gives a white number', async ({
    page,
  }) => {
    await open(page);
    await toolButton(page, 'Step (N)').click();
    await clickImage(page, 300, 300); // a 64-pixel badge, selected
    await pickCustom(page, '#ffe4b5');
    await deselect(page);
    expect(near(await pixel(page, 300, 275), MOCCASIN), 'the badge is #ffe4b5').toBe(true);
    const inside = () => region(page, 290, 290, 21, 21);
    expect(
      (await inside()).some((p) => near(p, [0, 0, 0, 255], 40)),
      'a black number',
    ).toBe(true);
    await undoButton(page).click();
    await deselect(page);
    expect(near(await pixel(page, 300, 275), RED), 'one undo: red again').toBe(true);
    await workArea(page).focus();
    await page.keyboard.press('Tab'); // selects the step (F-013)
    await pickCustom(page, '#2f4f4f');
    await deselect(page);
    expect(near(await pixel(page, 300, 275), SLATE), 'the badge is #2f4f4f').toBe(true);
    expect(
      (await inside()).some((p) => near(p, [255, 255, 255, 255], 40)),
      'a white number',
    ).toBe(true);
  });

  test('F-019.AC3 #d62828 picked with the custom swatch marks Red, not the custom swatch', async ({ page }) => {
    await open(page);
    await toolButton(page, 'Rectangle (R)').click();
    await swatch(page, 'Green').click();
    await pickCustom(page, '#D62828');
    await expect(swatch(page, 'Red')).toHaveAttribute('aria-checked', 'true');
    await expect(custom(page)).toHaveAttribute('aria-checked', 'false');
  });

  test('F-019.AC4 on 1000 × 800 with M the field shows 5; 7 and Enter unmark M and draw a 7-pixel stroke', async ({
    page,
  }) => {
    await open(page);
    await toolButton(page, 'Rectangle (R)').click();
    await expect(preset(page, 'Medium')).toBeChecked();
    await expect(field(page)).toHaveValue('5');
    await enterSize(page, '7');
    await expect(preset(page, 'Medium')).not.toBeChecked();
    await expect(field(page)).toHaveValue('7');
    await dragImage(page, [100, 100], [300, 200]);
    await deselect(page);
    // A 7-pixel stroke centred on x = 100 covers 96.5–103.5: columns 97–102 whole (5 pixels: 98–101).
    expect(await leftEdge(page, RED)).toEqual(expect.arrayContaining([97, 98, 99, 100, 101, 102]));
    expect(near(await pixel(page, 95, 150), GREY)).toBe(true);
    expect(near(await pixel(page, 105, 150), GREY)).toBe(true);
  });

  test('F-019.AC5 the text tool at 64 is the next text’s size; the step tool at 64 draws a 128-pixel badge', async ({
    page,
  }) => {
    await open(page);
    await toolButton(page, 'Text (T)').click();
    await enterSize(page, '64');
    await clickImage(page, 100, 100);
    await expect(editor(page)).toBeFocused();
    await page.keyboard.type('Bug');
    await page.keyboard.press('Escape'); // the text stays, selected
    await expect(summary(page)).toHaveText(count(1));
    await expect(field(page)).toHaveValue('64');
    // The editing field sits over the text at its size: 64 px text, so its line box is 1.25 × 64.
    await toolButton(page, 'Step (N)').click();
    await enterSize(page, '64');
    await clickImage(page, 500, 500);
    await deselect(page);
    const across = await extent(page, 'x', 500, 420, 580);
    expect(across).toBeGreaterThanOrEqual(127);
    expect(across).toBeLessThanOrEqual(129);
  });

  test('F-019.AC6 the highlight tool at L shows 30; 40 is the next highlight’s width', async ({ page }) => {
    await open(page);
    await toolButton(page, 'Highlight (H)').click();
    await expect(preset(page, 'Large')).toBeChecked();
    await expect(field(page)).toHaveValue('30');
    await enterSize(page, '40');
    await dragImage(page, [200, 300], [600, 300]);
    await deselect(page);
    const high = await extent(page, 'y', 400, 260, 340);
    expect(high).toBeGreaterThanOrEqual(39);
    expect(high).toBeLessThanOrEqual(41);
  });

  test('F-019.AC7 a selected rectangle at a custom 7 given L has a 10-pixel stroke, L marked, field 10, one undo step', async ({
    page,
  }) => {
    await open(page);
    await toolButton(page, 'Rectangle (R)').click();
    await enterSize(page, '7');
    await dragImage(page, [100, 100], [300, 200]); // selected
    await expect(field(page)).toHaveValue('7');
    await preset(page, 'Large').check();
    await expect(preset(page, 'Large')).toBeChecked();
    await expect(field(page)).toHaveValue('10');
    await undoButton(page).click();
    await expect(field(page)).toHaveValue('7');
    await expect(preset(page, 'Large')).not.toBeChecked();
    await expect(summary(page)).toHaveText(count(1));
  });

  test('F-019.AC8 the pen tool: 0, -3, 7.5, 5000 and "abc" give 1, 1, 8, 100, and no change', async ({ page }) => {
    await open(page);
    await toolButton(page, 'Pen (P)').click();
    for (const [typed, shown] of [
      ['0', '1'],
      ['-3', '1'],
      ['7.5', '8'],
      ['5000', '100'],
      ['abc', '100'],
    ] as const) {
      await enterSize(page, typed);
      await expect(field(page), typed).toHaveValue(shown);
    }
  });

  test('F-019.AC9 dragging the slider from 5 to 20 restyles the selected arrow while dragging; one undo restores M', async ({
    page,
  }) => {
    await open(page);
    await toolButton(page, 'Arrow (A)').click();
    await dragImage(page, [100, 400], [500, 400]); // selected, M (5)
    await expect(slider(page)).toHaveValue('5');
    const box = await slider(page).boundingBox();
    if (!box) throw new Error('no slider');
    const y = box.y + box.height / 2;
    // Start on the thumb at 5, then move right until the slider reads 20 (one drag, mouse held down).
    const at = (v: number) => box.x + 8 + ((v - 1) / 99) * (box.width - 16);
    await page.mouse.move(at(5), y);
    await page.mouse.down();
    let x = at(12);
    await page.mouse.move(x, y, { steps: 3 });
    const mid = Number(await field(page).inputValue());
    expect(mid, 'the stroke follows while dragging').toBeGreaterThan(5);
    await frame(page);
    expect(await extent(page, 'y', 250, 380, 420), 'the arrow is thicker while dragging').toBeGreaterThan(6);
    for (let i = 0; i < 40; i++) {
      const v = Number(await slider(page).inputValue());
      if (v === 20) break;
      x += v < 20 ? 0.5 : -0.5;
      await page.mouse.move(x, y);
    }
    await page.mouse.up();
    await expect(slider(page)).toHaveValue('20');
    await expect(field(page)).toHaveValue('20');
    await expect(preset(page, 'Medium')).not.toBeChecked();
    await undoButton(page).click();
    await expect(preset(page, 'Medium')).toBeChecked();
    await expect(field(page)).toHaveValue('5');
    await expect(summary(page)).toHaveText(count(1));
  });

  test('F-019.AC10 a rectangle and a text: presets, no field or slider; an M and a custom 7: field empty, none marked', async ({
    page,
  }) => {
    await open(page);
    await toolButton(page, 'Rectangle (R)').click();
    await dragImage(page, [100, 100], [300, 200]);
    await toolButton(page, 'Text (T)').click();
    await clickImage(page, 400, 400);
    await page.keyboard.type('Bug');
    await page.keyboard.press('Escape');
    await workArea(page).focus();
    await page.keyboard.press('ControlOrMeta+A');
    await expect(preset(page, 'Medium')).toBeVisible();
    await expect(field(page)).toHaveCount(0);
    await expect(slider(page)).toHaveCount(0);

    await paste(page, false); // a new image: the replace confirmation first
    await page
      .getByRole('alertdialog')
      .getByRole('button', { name: /Replace/ })
      .click();
    await expect(summary(page)).toHaveText(count(0));
    await toolButton(page, 'Rectangle (R)').click();
    await dragImage(page, [100, 100], [300, 200]);
    await deselect(page); // nothing selected: the size is the tool's
    await enterSize(page, '7');
    await dragImage(page, [400, 100], [600, 200]);
    await workArea(page).focus();
    await page.keyboard.press('ControlOrMeta+A');
    await expect(field(page)).toHaveValue('');
    for (const p of ['Small', 'Medium', 'Large'] as const) await expect(preset(page, p)).not.toBeChecked();
  });

  test('F-019.AC11 a custom 7-pixel stroke is still 7 pixels after a new image is loaded', async ({ page }) => {
    await open(page);
    await toolButton(page, 'Rectangle (R)').click();
    await enterSize(page, '7');
    await paste(page); // nothing to lose: no confirmation
    await page.locator('footer.tk-status-bar').getByRole('button', { name: 'Actual size', exact: true }).click();
    await dragImage(page, [100, 100], [300, 200]);
    await expect(field(page)).toHaveValue('7');
    await deselect(page);
    expect(await leftEdge(page, RED)).toEqual(expect.arrayContaining([97, 98, 99, 100, 101, 102]));
  });

  test('F-019.AC12 narrow: a custom size of 7 reads "7 px" in the summary bar; the sheet shows the field, no slider', async ({
    page,
  }) => {
    await stubPicker(page);
    await page.setViewportSize({ width: 390, height: 760 });
    await page.goto('/');
    await paste(page);
    await toolButton(page, 'Rectangle (R)').click();
    const bar = page.getByRole('button', { name: /^Style options: / });
    await expect(bar).toHaveAccessibleName('Style options: Rectangle · Medium');
    await bar.click();
    await expect(field(page)).toBeVisible();
    await expect(slider(page)).toHaveCount(0);
    await enterSize(page, '7');
    await expect(bar).toHaveAccessibleName('Style options: Rectangle · 7 px');
    await expect(bar).toContainText('7 px');
  });

  test('F-019.AC13 the custom swatch is named "Custom color", then "Custom color #1E90FF", and reports whether it is checked', async ({
    page,
  }) => {
    await open(page);
    await toolButton(page, 'Rectangle (R)').click();
    await expect(colours(page).getByRole('radio')).toHaveCount(9);
    await expect(colours(page).getByRole('radio').nth(8)).toHaveAccessibleName('Custom color');
    await expect(custom(page)).toHaveAttribute('aria-checked', 'false');
    await pickCustom(page, '#1e90ff');
    await expect(colours(page).getByRole('radio').nth(8)).toHaveAccessibleName('Custom color #1E90FF');
    await expect(custom(page)).toHaveAttribute('aria-checked', 'true');
    await expect(custom(page)).toBeChecked();
    await swatch(page, 'Blue').click();
    await expect(custom(page)).not.toBeChecked();
  });

  test('F-019.AC14 a click applies the remembered colour (one undo step); Right arrow checks it without the picker; unused, it only takes focus', async ({
    page,
  }) => {
    await open(page);
    await toolButton(page, 'Rectangle (R)').click();
    // No custom colour yet: arrowing from White onto the custom swatch moves focus only.
    await swatch(page, 'White').click();
    await swatch(page, 'White').focus();
    await page.keyboard.press('ArrowRight');
    await expect(custom(page)).toBeFocused();
    await expect(custom(page)).toHaveAttribute('aria-checked', 'false');
    await expect(swatch(page, 'White')).toHaveAttribute('aria-checked', 'true');
    expect(await opened(page)).toBe(0);
    // Enter opens the picker (F-019.R1); #1e90ff is picked.
    await page.keyboard.press('Enter');
    expect(await opened(page)).toBe(1);
    await picker(page, ['#1e90ff']);
    // A selected red rectangle: a click on the swatch and closing the picker unchanged makes it #1e90ff.
    await swatch(page, 'Red').click();
    await dragImage(page, [100, 100], [300, 200]);
    await custom(page).click();
    expect(await opened(page)).toBe(2);
    await picker(page, [], 'close');
    await expect(custom(page)).toHaveAttribute('aria-checked', 'true');
    await deselect(page);
    expect(near(await pixel(page, 100, 150), DODGER)).toBe(true);
    await undoButton(page).click();
    await deselect(page);
    expect(near(await pixel(page, 100, 150), RED), 'one undo: red').toBe(true);
    await undoButton(page).click();
    await expect(summary(page)).toHaveText(count(0));
    // With a custom colour remembered, Right arrow from White checks the swatch and does not open the picker.
    await swatch(page, 'White').click();
    await swatch(page, 'White').focus();
    await page.keyboard.press('ArrowRight');
    await expect(custom(page)).toBeFocused();
    await expect(custom(page)).toHaveAttribute('aria-checked', 'true');
    expect(await opened(page)).toBe(2);
    await page.keyboard.press('ArrowRight'); // wraps to Red
    await expect(swatch(page, 'Red')).toBeFocused();
    await expect(swatch(page, 'Red')).toHaveAttribute('aria-checked', 'true');
  });

  test('F-019.AC15 the swatch shows the subject’s custom colour, else the last picked: #1e90ff for rectangles, #00ff00 with Black for solid redaction', async ({
    page,
  }) => {
    await open(page);
    await toolButton(page, 'Rectangle (R)').click();
    await pickCustom(page, '#1e90ff');
    await toolButton(page, 'Highlight (H)').click();
    await pickCustom(page, '#00ff00');
    await toolButton(page, 'Rectangle (R)').click();
    await expect(custom(page)).toHaveAccessibleName('Custom color #1E90FF');
    await expect(custom(page)).toHaveAttribute('aria-checked', 'true');
    await toolButton(page, 'Redact (X)').click();
    await expect(custom(page)).toHaveAccessibleName('Custom color #00FF00');
    await expect(custom(page)).toHaveAttribute('aria-checked', 'false');
    await expect(swatch(page, 'Black')).toHaveAttribute('aria-checked', 'true');
  });

  test('F-019.AC16 moving through 3 colours to #2f4f4f restyles the selected red arrow live; one undo makes it red', async ({
    page,
  }) => {
    await open(page);
    await toolButton(page, 'Rectangle (R)').click();
    await pickCustom(page, '#1e90ff'); // remembered
    await swatch(page, 'Red').click();
    await toolButton(page, 'Arrow (A)').click();
    await dragImage(page, [100, 400], [500, 400]); // red, selected
    await custom(page).click();
    for (const hex of ['#112233', '#884422', '#336699']) {
      await picker(page, [hex], 'close');
      expect(await panel(page).locator('.tk-swatch--custom').getAttribute('aria-label')).toBe(
        `Custom color ${hex.toUpperCase()}`,
      );
    }
    await picker(page, ['#2f4f4f']);
    await deselect(page);
    expect(near(await pixel(page, 300, 400), SLATE), 'the arrow is #2f4f4f').toBe(true);
    await undoButton(page).click();
    await frame(page);
    await deselect(page);
    expect(near(await pixel(page, 300, 400), RED), 'one undo: red').toBe(true);
    await undoButton(page).click();
    await expect(summary(page)).toHaveText(count(0));
  });

  test('F-019.AC17 tabbing through the field changes nothing; 5 typed and Enter is a custom 5', async ({ page }) => {
    await open(page);
    await toolButton(page, 'Rectangle (R)').click();
    await dragImage(page, [100, 100], [300, 200]); // selected, M (5)
    await field(page).focus();
    await expect(field(page)).toHaveValue('5');
    await page.keyboard.press('Tab');
    await expect(preset(page, 'Medium')).toBeChecked();
    await undoButton(page).click(); // no step was added: undo removes the rectangle
    await expect(summary(page)).toHaveText(count(0));
    await page
      .getByRole('toolbar', { name: 'Tools and actions' })
      .getByRole('button', { name: 'Redo', exact: true })
      .click();
    await expect(summary(page)).toHaveText(count(1));
    await enterSize(page, '5');
    await expect(preset(page, 'Medium')).not.toBeChecked();
    await expect(field(page)).toHaveValue('5');
    // Esc restores the shown value without applying it.
    await field(page).click();
    await field(page).press('ControlOrMeta+A');
    await page.keyboard.type('9');
    await page.keyboard.press('Escape');
    await expect(field(page)).toHaveValue('5');
    await page.keyboard.press('Tab');
    await expect(field(page)).toHaveValue('5');
  });

  test('F-019.AC18 canvas settings: the drawing colour ends with the custom swatch, the background does not; #1e90ff draws the next rectangle, no undo step', async ({
    page,
  }) => {
    await open(page);
    await expect(state(page)).toHaveAttribute('data-state', 'canvas-settings');
    await expect(colours(page).getByRole('radio')).toHaveCount(9);
    await expect(colours(page).getByRole('radio').last()).toHaveAccessibleName('Custom color');
    const background = panel(page).getByRole('group', { name: 'Background' });
    await expect(background.getByRole('radio')).toHaveCount(9); // transparent and the 8 colours
    await expect(background.getByRole('radio', { name: /Custom/ })).toHaveCount(0);
    await pickCustom(page, '#1e90ff');
    await expect(custom(page)).toHaveAttribute('aria-checked', 'true');
    await expect(undoButton(page)).toBeDisabled();
    await toolButton(page, 'Rectangle (R)').click();
    await expect(custom(page)).toHaveAttribute('aria-checked', 'true');
    await dragImage(page, [100, 100], [300, 200]);
    await deselect(page);
    expect(near(await pixel(page, 100, 150), DODGER)).toBe(true);
  });

  test('F-019.AC19 F-019.R9 while a new text is edited, the custom swatch and the field keep editing and change it', async ({
    page,
  }) => {
    await open(page);
    await toolButton(page, 'Text (T)').click();
    await clickImage(page, 100, 100);
    await page.keyboard.type('Bug');
    await custom(page).click();
    await picker(page, ['#1e90ff']);
    await expect(state(page)).toHaveAttribute('data-state', 'editing-text');
    await expect(editor(page)).toBeFocused(); // focus returns to the text
    await enterSize(page, '64');
    await expect(state(page)).toHaveAttribute('data-state', 'editing-text');
    await expect(editor(page)).toBeFocused();
    await page.keyboard.type('!');
    await expect(editor(page)).toHaveValue('Bug!');
    // The editing field shows the text at its size: 64 px.
    expect(await editor(page).evaluate((el) => getComputedStyle(el).fontSize)).toBe('64px');
    await frame(page);
    await frame(page);
    const blue = (await region(page, 105, 105, 120, 70)).filter((p) => near(p, DODGER, 30)).length;
    expect(blue, 'the text shows in #1e90ff').toBeGreaterThan(10);
    await page.keyboard.press('Escape');
    await expect(summary(page)).toHaveText(count(1));
    await expect(field(page)).toHaveValue('64');
    await expect(custom(page)).toHaveAttribute('aria-checked', 'true');
    // RULE-11: for a new text these were current-style changes; creating it and its edit are one step.
    await undoButton(page).click();
    await expect(summary(page)).toHaveText(count(0));
  });

  test('F-019.AC20 a duplicated #1e90ff rectangle with a custom 7-pixel stroke exports both with a 7-pixel #1e90ff stroke', async ({
    page,
  }) => {
    await open(page);
    await toolButton(page, 'Rectangle (R)').click();
    await pickCustom(page, '#1e90ff');
    await enterSize(page, '7');
    await dragImage(page, [100, 100], [300, 200]);
    await workArea(page).focus();
    await page.keyboard.press('ControlOrMeta+D'); // the copy at (110, 110)
    await expect(summary(page)).toHaveText(count(2));
    const file = await download(page, () => downloadButton(page).click());
    const png = decodePng(file.bytes);
    const at = (x: number, y: number) =>
      Array.from(png.data.slice((y * png.width + x) * 4, (y * png.width + x) * 4 + 4));
    for (const left of [100, 110]) {
      const y = 160;
      const painted: number[] = [];
      for (let x = left - 6; x <= left + 6; x++) if (near(at(x, y), DODGER, 40)) painted.push(x);
      // 96.5–103.5 (or 106.5–113.5): six whole columns and two partly covered ones.
      expect(painted.length, `x = ${left}`).toBeGreaterThanOrEqual(6);
      expect(painted.length, `x = ${left}`).toBeLessThanOrEqual(8);
      expect(painted).toEqual(expect.arrayContaining([left - 3, left + 2]));
    }
  });

  test('F-019.AC21 a selected solid redaction picked #1e90ff is opaque #1e90ff; a blur redaction offers no colour and no size', async ({
    page,
  }) => {
    await open(page);
    await toolButton(page, 'Redact (X)').click();
    await dragImage(page, [100, 100], [300, 200]);
    await pickCustom(page, '#1e90ff');
    await deselect(page);
    expect(await pixel(page, 200, 150)).toEqual(DODGER);
    await workArea(page).focus();
    await page.keyboard.press('Tab');
    await panel(page).getByRole('group', { name: 'Redaction type' }).getByRole('radio', { name: /^Blur/ }).check();
    await expect(colours(page)).toHaveCount(0);
    await expect(field(page)).toHaveCount(0);
    await expect(sizes(page)).toHaveCount(0);
  });

  test('F-019.AC23 F-019.R8 a cancelled picker leaves the selected red arrow red and adds no undo step', async ({
    page,
  }) => {
    await open(page);
    await toolButton(page, 'Arrow (A)').click();
    await dragImage(page, [100, 400], [500, 400]);
    await custom(page).click();
    await picker(page, ['#2f4f4f'], 'close'); // moved to #2f4f4f: the preview shows; then cancelled
    await expect(custom(page)).toHaveAccessibleName('Custom color #2F4F4F');
    await expect(custom(page)).toHaveAttribute('aria-checked', 'true');
    await picker(page, [], 'cancel');
    await deselect(page);
    expect(near(await pixel(page, 300, 400), RED), 'red again').toBe(true);
    await expect(custom(page)).toHaveAccessibleName('Custom color');
    await undoButton(page).click();
    await expect(summary(page)).toHaveText(count(0));
  });

  test('F-019.R1 platform-mapping without showPicker() the swatch opens the picker with click()', async ({ page }) => {
    await stubPicker(page, true);
    await page.setViewportSize(VIEWPORT);
    await page.goto('/');
    await paste(page);
    await toolButton(page, 'Rectangle (R)').click();
    await custom(page).click();
    expect(await page.evaluate(() => (window as unknown as PickerWindow).__pickerClicks)).toBe(1);
    await custom(page).press(' ');
    expect(await page.evaluate(() => (window as unknown as PickerWindow).__pickerClicks)).toBe(2);
  });

  test('CMP-StylePanel the 9 colour choices take one row on the wide panel and 2 rows of 5 on the narrow sheet', async ({
    page,
  }) => {
    await open(page);
    await toolButton(page, 'Rectangle (R)').click();
    const tops = async () =>
      colours(page)
        .getByRole('radio')
        .evaluateAll((els) => els.map((e) => Math.round(e.getBoundingClientRect().top)));
    expect(new Set(await tops()).size).toBe(1);
    await page.setViewportSize({ width: 390, height: 760 });
    await page.getByRole('button', { name: /^Style options: / }).click();
    const rows = await tops();
    expect(new Set(rows).size).toBe(2);
    expect(rows.filter((t) => t === rows[0])).toHaveLength(5);
  });

  test('F-019.R7 a selected M and custom 7 show no slider; an M and a custom 5 (the same width) show it at 5', async ({
    page,
  }) => {
    await open(page);
    await toolButton(page, 'Rectangle (R)').click();
    await dragImage(page, [100, 100], [300, 200]);
    await deselect(page);
    await enterSize(page, '7');
    await dragImage(page, [400, 100], [600, 200]);
    await workArea(page).focus();
    await page.keyboard.press('ControlOrMeta+A');
    await expect(field(page)).toHaveValue('');
    await expect(slider(page)).toHaveCount(0);
    await deselect(page);
    await toolButton(page, 'Rectangle (R)').click();
    await enterSize(page, '5');
    await dragImage(page, [100, 300], [300, 400]);
    await toolButton(page, 'Select (V)').click();
    await clickImage(page, 100, 150); // the M rectangle's left edge
    await page.keyboard.down('Shift');
    await clickImage(page, 100, 350); // add the custom 5 rectangle
    await page.keyboard.up('Shift');
    await expect(panel(page).getByRole('heading', { name: '2 annotations selected' })).toBeVisible();
    await expect(field(page)).toHaveValue('5');
    await expect(slider(page)).toHaveValue('5');
  });

  test('F-019.AC22 with no image no size field is shown; a custom 7 set before a new image is loaded shows 7, no preset marked', async ({
    page,
  }) => {
    await stubPicker(page);
    await page.setViewportSize(VIEWPORT);
    await page.goto('/');
    await expect(panel(page)).toHaveCount(0);
    await expect(page.getByRole('spinbutton', { name: 'Size in pixels' })).toHaveCount(0);
    await paste(page);
    await toolButton(page, 'Rectangle (R)').click();
    await enterSize(page, '7');
    await paste(page); // a new image, nothing to lose
    await toolButton(page, 'Rectangle (R)').click();
    await expect(field(page)).toHaveValue('7');
    for (const p of ['Small', 'Medium', 'Large'] as const) await expect(preset(page, p)).not.toBeChecked();
  });

  test('F-019.R5 RULE-19 Esc in the size field, its text unchanged, clears the selection; after typing it only restores', async ({
    page,
  }) => {
    await open(page);
    await toolButton(page, 'Rectangle (R)').click();
    await dragImage(page, [100, 100], [300, 200]);
    await expect(state(page)).toHaveAttribute('data-state', 'selecting');
    await field(page).click();
    await page.keyboard.type('9');
    await page.keyboard.press('Escape'); // typed: restores 5, nothing else
    await expect(field(page)).toHaveValue('5');
    await expect(state(page)).toHaveAttribute('data-state', 'selecting');
    await page.keyboard.press('Escape'); // unchanged: RULE-19's Esc clears the selection
    await expect(state(page)).not.toHaveAttribute('data-state', 'selecting');
  });

  test('F-019.R5 RULE-19 CMP-StylePanel Esc in an untouched position field clears the selection; focus moves to the canvas region', async ({
    page,
  }) => {
    await open(page);
    await toolButton(page, 'Rectangle (R)').click();
    await dragImage(page, [100, 100], [300, 200]);
    await toolButton(page, 'Select (V)').click();
    await clickImage(page, 100, 150);
    await expect(state(page)).toHaveAttribute('data-state', 'selecting');
    await panel(page).getByRole('textbox', { name: 'X', exact: true }).focus();
    await page.keyboard.press('Escape');
    await expect(state(page)).not.toHaveAttribute('data-state', 'selecting');
    await expect(panel(page).getByRole('textbox', { name: 'X', exact: true })).toHaveCount(0);
    await expect(workArea(page)).toBeFocused();
    await page.keyboard.press('r'); // the Tools keys work again (RULE-19: canvas focus)
    await expect(toolButton(page, 'Rectangle (R)')).toBeChecked();
  });

  test('F-008.AC19 CMP-Toolbar D-043 clicking the active tool clears the selection (wide); on narrow it also toggles the sheet', async ({
    page,
  }) => {
    await open(page);
    await toolButton(page, 'Rectangle (R)').click();
    await dragImage(page, [100, 100], [300, 200]);
    await expect(state(page)).toHaveAttribute('data-state', 'selecting');
    await toolButton(page, 'Rectangle (R)').click();
    await expect(state(page)).not.toHaveAttribute('data-state', 'selecting');
    await expect(toolButton(page, 'Rectangle (R)')).toBeChecked();

    await page.setViewportSize({ width: 390, height: 760 });
    await dragImage(page, [100, 100], [300, 200]);
    await expect(state(page)).toHaveAttribute('data-state', 'selecting');
    const bar = page.getByRole('button', { name: /^Style options: / });
    await expect(bar).toHaveAttribute('aria-expanded', 'false');
    await toolButton(page, 'Rectangle (R)').click();
    await expect(bar).toHaveAttribute('aria-expanded', 'true');
    await expect(state(page)).not.toHaveAttribute('data-state', 'selecting');
    await toolButton(page, 'Rectangle (R)').click();
    await expect(bar).toHaveAttribute('aria-expanded', 'false');
  });

  test('F-019.R1 the picker starts at the subject’s colour; a checked custom swatch clicked again applies nothing', async ({
    page,
  }) => {
    await open(page);
    await toolButton(page, 'Rectangle (R)').click();
    await swatch(page, 'Green').click();
    await custom(page).click();
    const input = page.locator('.tk-panel input[type="color"]');
    await expect(input).toHaveValue('#2db84d');
    await picker(page, ['#1e90ff']);
    await dragImage(page, [100, 100], [300, 200]); // #1e90ff, selected
    await toolButton(page, 'Highlight (H)').click();
    await pickCustom(page, '#00ff00'); // remembered now: #00ff00
    await toolButton(page, 'Select (V)').click();
    await clickImage(page, 100, 150);
    await expect(custom(page)).toBeChecked();
    await expect(custom(page)).toHaveAccessibleName('Custom color #1E90FF');
    await custom(page).click();
    await expect(input).toHaveValue('#1e90ff');
    await picker(page, [], 'close');
    await expect(custom(page)).toHaveAccessibleName('Custom color #1E90FF');
    await expect(undoButton(page)).toBeEnabled();
  });

  for (const theme of ['dark', 'light'] as const) {
    test(`NFR-06 F-019 the colour group with the custom swatch, the size field and slider have no axe violations (${theme})`, async ({
      page,
    }) => {
      const audit = () =>
        new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze();
      await open(page, `?theme=${theme}`);
      expect((await audit()).violations).toEqual([]); // canvas settings
      await toolButton(page, 'Rectangle (R)').click();
      expect((await audit()).violations).toEqual([]);
      await pickCustom(page, '#1e90ff');
      await enterSize(page, '7');
      expect((await audit()).violations).toEqual([]);
      await page.setViewportSize({ width: 390, height: 760 });
      await page.getByRole('button', { name: /^Style options: / }).click();
      expect((await audit()).violations).toEqual([]);
    });
  }
});
