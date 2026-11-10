// F-020 Fill colour and text background — end to end on the production build (Chromium + WebKit). As in
// custom-styles.spec.ts, a plain 1000 × 800 image (grey, or white for AC9) is pasted and shown at 100 % in a
// 1200 × 800 work area, so image pixel (x, y) is at (100 + x, y) in it. Text size M is 32 on this image, so
// a text background extends 8 image pixels beyond the text box (RULE-22); texts are placed at (100, 100),
// so the text box's left edge is x = 100 and its first line's vertical centre y = 120. The browser's own
// colour picker is stubbed as in custom-styles.spec.ts (its events are dispatched on the group's input).
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Locator, type Page } from '@playwright/test';
import { decodePng, download, downloadButton } from './support/export';
import { canvasPixel, summary } from './support/load';

const PANEL = 272;
const AREA = { width: 1200, height: 800 };
const VIEWPORT = { width: AREA.width + PANEL, height: 40 + AREA.height + 28 };
const IMAGE = { width: 1000, height: 800 };
const GREY = [200, 200, 200, 255];
const RED = [214, 40, 40, 255]; // #D62828
const BLUE = [11, 99, 229, 255]; // #0B63E5
const GREEN = [45, 184, 77, 255]; // #2DB84D
const YELLOW = [255, 214, 10, 255]; // #FFD60A
const WHITE = [255, 255, 255, 255];
const BLACK = [0, 0, 0, 255];
const DODGER = [30, 144, 255, 255]; // #1e90ff
/** `colour` at `alpha` over the grey image. */
const over = (colour: number[], alpha: number) =>
  colour
    .slice(0, 3)
    .map((c, i) => Math.round(alpha * c + (1 - alpha) * (GREY[i] ?? 0)))
    .concat(255);
const near = (a: number[], b: number[], tolerance = 24) => a.every((v, i) => Math.abs(v - (b[i] ?? 0)) <= tolerance);

const workArea = (page: Page) => page.locator('main.tk-work-area');
const panel = (page: Page) => page.getByRole('complementary', { name: 'Style' });
const toolButton = (page: Page, name: string) =>
  page.getByRole('toolbar', { name: 'Tools and actions' }).getByRole('radio', { name });
const colourGroup = (page: Page, name: 'Color' | 'Fill color' | 'Background color') =>
  panel(page).getByRole('radiogroup', { name, exact: true });
const swatch = (group: Locator, name: string) => group.getByRole('radio', { name, exact: true });
const customOf = (group: Locator) => group.getByRole('radio', { name: /^Custom color/ });
const fillGroup = (page: Page) => panel(page).getByRole('group', { name: 'Fill', exact: true });
const backgroundGroup = (page: Page) => panel(page).getByRole('group', { name: 'Text background', exact: true });
const choice = (group: Locator, name: 'None' | 'Solid' | 'Translucent') =>
  group.getByRole('radio', { name, exact: true });
const undoButton = (page: Page) =>
  page.getByRole('toolbar', { name: 'Tools and actions' }).getByRole('button', { name: 'Undo', exact: true });
const state = (page: Page) => page.locator('[data-screen="SCR-Annotator"]');
const editor = (page: Page) => page.locator('textarea.tk-text-editor');
const frame = (page: Page) => page.evaluate(() => new Promise((r) => requestAnimationFrame(() => r(null))));
const count = (n: number) => `1,000 × 800 px canvas, ${n} annotation${n === 1 ? '' : 's'}`;

/** Image pixel → CSS px in the work area at 100 % (the image is centred horizontally, top-aligned). */
const screen = (x: number, y: number) => ({ x: (AREA.width - IMAGE.width) / 2 + x, y });
const pixel = (page: Page, x: number, y: number) => canvasPixel(page, screen(x, y).x, screen(x, y).y);

/** The display pixel at image (x, y) is (or with `is` false, is not) `colour`, once the canvas repaints. */
async function expectPixel(
  page: Page,
  x: number,
  y: number,
  colour: number[],
  tolerance: number,
  is: boolean,
  message = '',
) {
  await expect
    .poll(async () => near(await pixel(page, x, y), colour, tolerance), { message: message || `pixel (${x}, ${y})` })
    .toBe(is);
}

/** One row of image pixels of the display canvas (RGBA each), from x to x + w. */
async function row(page: Page, x: number, y: number, w: number): Promise<number[][]> {
  return page.locator('canvas.tk-canvas').evaluate(
    (el, { x, y, w }) => {
      const c = el as HTMLCanvasElement;
      const k = c.width / c.getBoundingClientRect().width;
      const ctx = c.getContext('2d', { colorSpace: 'srgb' });
      const d = ctx?.getImageData(Math.round(x * k), Math.round(y * k), Math.round(w * k), 1).data;
      const out: number[][] = [];
      for (let i = 0; d && i < d.length; i += 4) out.push([d[i] ?? 0, d[i + 1] ?? 0, d[i + 2] ?? 0, d[i + 3] ?? 0]);
      return out;
    },
    { ...screen(x, y), w },
  );
}

/** The editing field's border box in image pixels (100 % zoom). */
async function editorBox(page: Page) {
  const area = await workArea(page).boundingBox();
  const r = await editor(page).boundingBox();
  if (!area || !r) throw new Error('no editor');
  const left = r.x - area.x - screen(0, 0).x;
  const top = r.y - area.y;
  return { left, top, right: left + r.width, bottom: top + r.height };
}

/** The rightmost image x of row y (from x0) whose pixel is `colour`. */
async function rightEdge(page: Page, x0: number, y: number, colour: number[], width = 400): Promise<number> {
  const pixels = await row(page, x0, y, width);
  const k = pixels.length / width; // device pixels per image pixel (WebKit may draw at 2×)
  let last = -1;
  pixels.forEach((p, i) => {
    if (near(p, colour, 30)) last = i;
  });
  return x0 + (last + 1) / k;
}

type PickerWindow = { __pickerOpened: number };

/** Before the page loads: `showPicker()` on a colour input is recorded (the picker is a manual check). */
async function stubPicker(page: Page) {
  await page.addInitScript(() => {
    const w = window as unknown as PickerWindow;
    w.__pickerOpened = 0;
    const proto = HTMLInputElement.prototype as HTMLInputElement & { showPicker?: () => void };
    proto.showPicker = function (this: HTMLInputElement) {
      if (this.type === 'color') w.__pickerOpened++;
    };
  });
}

/** Clicks a group's custom swatch, and its picker reports `hex` and closes with it. */
async function pickCustom(group: Locator, hex: string) {
  await customOf(group).click();
  await group
    .locator('xpath=..')
    .locator('input[type="color"]')
    .evaluate((el, hex) => {
      const input = el as HTMLInputElement;
      input.value = hex;
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
    }, hex);
}

async function open(page: Page, colour = GREY) {
  await stubPicker(page);
  await page.setViewportSize(VIEWPORT);
  await page.goto('/');
  await page.evaluate(
    async ({ width, height, colour }) => {
      const c = new OffscreenCanvas(width, height);
      const ctx = c.getContext('2d');
      if (!ctx) throw new Error('no 2d context');
      ctx.fillStyle = `rgb(${colour.slice(0, 3).join(',')})`;
      ctx.fillRect(0, 0, width, height);
      const blob = await c.convertToBlob({ type: 'image/png' });
      const dt = new DataTransfer();
      dt.items.add(new File([blob], 'plain.png', { type: 'image/png' }));
      document.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }));
    },
    { ...IMAGE, colour },
  );
  await expect(summary(page)).toHaveText(count(0));
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

/** With the text tool: a text `s` at (x, y), ended with Esc (it stays, selected). */
async function placeText(page: Page, s: string, x = 100, y = 100) {
  await clickImage(page, x, y);
  await expect(editor(page)).toBeFocused();
  await page.keyboard.type(s);
  await page.keyboard.press('Escape');
  await expect(state(page)).toHaveAttribute('data-state', 'selecting');
  await frame(page);
  await frame(page);
}

/** The text tool with a background (and optionally its colour), nothing selected. */
async function textToolWithBackground(page: Page, fill: 'Solid' | 'Translucent', colour?: string) {
  await toolButton(page, 'Text (T)').click();
  await choice(backgroundGroup(page), fill).check();
  if (colour) await swatch(colourGroup(page, 'Background color'), colour).click();
}

test.describe('F-020 fill colour', () => {
  test('F-020.AC1 the rectangle tool with fill none shows no fill colour; Solid shows it with the current colour marked', async ({
    page,
  }) => {
    await open(page);
    await toolButton(page, 'Rectangle (R)').click();
    await expect(choice(fillGroup(page), 'None')).toBeChecked();
    await expect(colourGroup(page, 'Fill color')).toHaveCount(0);
    await choice(fillGroup(page), 'Solid').check();
    await expect(colourGroup(page, 'Fill color')).toBeVisible();
    await expect(swatch(colourGroup(page, 'Fill color'), 'Red')).toHaveAttribute('aria-checked', 'true');
  });

  test('F-020.AC2 red, fill solid and White picked: the rectangle has a red outline and an opaque white inside', async ({
    page,
  }) => {
    await open(page);
    await toolButton(page, 'Rectangle (R)').click();
    await choice(fillGroup(page), 'Solid').check();
    await swatch(colourGroup(page, 'Fill color'), 'White').click();
    await dragImage(page, [100, 100], [300, 200]);
    await deselect(page);
    await expectPixel(page, 200, 150, WHITE, 2, true, 'an opaque white inside');
    await expectPixel(page, 100, 150, RED, 30, true, 'a red outline');
  });

  test('F-020.AC3 Translucent marks Red; Blue then draws a blue outline on a red fill at 30 %; Yellow then Green: a green outline, a yellow fill', async ({
    page,
  }) => {
    await open(page);
    await toolButton(page, 'Ellipse (O)').click();
    await choice(fillGroup(page), 'Translucent').check();
    await expect(swatch(colourGroup(page, 'Fill color'), 'Red')).toHaveAttribute('aria-checked', 'true');
    await swatch(colourGroup(page, 'Color'), 'Blue').click();
    await expect(swatch(colourGroup(page, 'Fill color'), 'Red')).toHaveAttribute('aria-checked', 'true');
    await dragImage(page, [100, 100], [300, 300]);
    await deselect(page);
    await expectPixel(page, 200, 200, over(RED, 0.3), 3, true, 'a red fill at 30 % (copied once, D-054)');
    await expectPixel(page, 100, 200, BLUE, 40, true, 'a blue outline');
    await swatch(colourGroup(page, 'Fill color'), 'Yellow').click();
    await swatch(colourGroup(page, 'Color'), 'Green').click();
    await dragImage(page, [400, 100], [600, 300]);
    await deselect(page);
    await expectPixel(page, 500, 200, over(YELLOW, 0.3), 3, true, 'a yellow fill at 30 %');
    await expectPixel(page, 400, 200, GREEN, 40, true, 'a green outline');
    await expectPixel(page, 200, 200, over(RED, 0.3), 3, true, 'the first ellipse is unchanged');
  });

  test('F-020.AC4 Black on a selected rectangle is one undo step and becomes the rectangle tool’s fill colour', async ({
    page,
  }) => {
    await open(page);
    await toolButton(page, 'Rectangle (R)').click();
    await choice(fillGroup(page), 'Solid').check();
    await dragImage(page, [100, 100], [300, 200]); // selected
    await swatch(colourGroup(page, 'Fill color'), 'Black').click();
    await frame(page);
    await expectPixel(page, 200, 150, BLACK, 2, true, 'the selected rectangle’s fill is black');
    await undoButton(page).click();
    await frame(page);
    await expectPixel(page, 200, 150, RED, 2, true, 'one undo: its earlier fill colour (red)');
    await expect(summary(page)).toHaveText(count(1));
    await page.keyboard.press('ControlOrMeta+Shift+Z');
    await deselect(page);
    await dragImage(page, [400, 100], [600, 200]);
    await deselect(page);
    await expectPixel(page, 500, 150, BLACK, 2, true, 'the next rectangle has a black fill');
  });

  test('F-020.AC5 #1e90ff with the fill colour’s custom swatch keeps the outline; a text background colour shows it unmarked', async ({
    page,
  }) => {
    await open(page);
    await toolButton(page, 'Ellipse (O)').click();
    await choice(fillGroup(page), 'Solid').check();
    await dragImage(page, [100, 100], [300, 300]); // selected
    await pickCustom(colourGroup(page, 'Fill color'), '#1e90ff');
    await expect(customOf(colourGroup(page, 'Fill color'))).toHaveAttribute('aria-checked', 'true');
    await expect(swatch(colourGroup(page, 'Color'), 'Red')).toHaveAttribute('aria-checked', 'true');
    await deselect(page);
    await expectPixel(page, 200, 200, DODGER, 2, true, 'the fill is #1e90ff');
    await expectPixel(page, 100, 200, RED, 40, true, 'the outline is still red');
    await textToolWithBackground(page, 'Solid');
    await placeText(page, 'Bug');
    const custom = customOf(colourGroup(page, 'Background color'));
    await expect(custom).toHaveAccessibleName('Custom color #1E90FF');
    await expect(custom).toHaveAttribute('aria-checked', 'false');
    await expect(swatch(colourGroup(page, 'Background color'), 'White')).toHaveAttribute('aria-checked', 'true');
  });

  test('F-020.AC6 White as the rectangle’s fill colour; Solid for the ellipse takes the current colour: red, with Red marked', async ({
    page,
  }) => {
    await open(page);
    await toolButton(page, 'Rectangle (R)').click();
    await choice(fillGroup(page), 'Solid').check();
    await swatch(colourGroup(page, 'Fill color'), 'White').click();
    await toolButton(page, 'Ellipse (O)').click();
    await choice(fillGroup(page), 'Solid').check();
    await dragImage(page, [100, 100], [300, 300]);
    await expect(swatch(colourGroup(page, 'Fill color'), 'Red')).toHaveAttribute('aria-checked', 'true');
    await deselect(page);
    await expectPixel(page, 200, 200, RED, 2, true, 'the ellipse’s fill is red');
  });

  test('F-020.AC17 Space on the marked Red fill swatch changes nothing and adds no step; Blue as the colour leaves the fill red', async ({
    page,
  }) => {
    await open(page);
    await toolButton(page, 'Rectangle (R)').click();
    await choice(fillGroup(page), 'Solid').check();
    await dragImage(page, [100, 100], [300, 200]); // selected, one step
    const red = swatch(colourGroup(page, 'Fill color'), 'Red');
    await expect(red).toHaveAttribute('aria-checked', 'true');
    await red.focus();
    await page.keyboard.press(' ');
    await expect(red).toHaveAttribute('aria-checked', 'true');
    await swatch(colourGroup(page, 'Color'), 'Blue').click();
    await frame(page);
    await expectPixel(page, 200, 150, RED, 2, true, 'the fill stays red (D-054)');
    await expect(swatch(colourGroup(page, 'Color'), 'Blue')).toHaveAttribute('aria-checked', 'true');
    await expect(swatch(colourGroup(page, 'Fill color'), 'Red')).toHaveAttribute('aria-checked', 'true');
    await undoButton(page).click(); // the colour
    await expect(swatch(colourGroup(page, 'Color'), 'Red')).toHaveAttribute('aria-checked', 'true');
    await undoButton(page).click(); // the rectangle: Space added no step
    await expect(summary(page)).toHaveText(count(0));
  });

  test('F-020.AC20 a picked White fill colour is kept through fill none and back to solid', async ({ page }) => {
    await open(page);
    await toolButton(page, 'Rectangle (R)').click();
    await choice(fillGroup(page), 'Solid').check();
    await dragImage(page, [100, 100], [300, 200]); // selected
    await swatch(colourGroup(page, 'Fill color'), 'White').click();
    await choice(fillGroup(page), 'None').check();
    await expect(colourGroup(page, 'Fill color')).toHaveCount(0);
    await choice(fillGroup(page), 'Solid').check();
    await expect(swatch(colourGroup(page, 'Fill color'), 'White')).toHaveAttribute('aria-checked', 'true');
    await deselect(page);
    await expectPixel(page, 200, 150, WHITE, 2, true, 'the fill is white');
  });

  /** A blue and a green rectangle with fill none, both selected, with the shared current colour red. */
  async function blueAndGreenSelected(page: Page) {
    await toolButton(page, 'Rectangle (R)').click();
    await swatch(colourGroup(page, 'Color'), 'Blue').click();
    await dragImage(page, [100, 100], [300, 200]);
    await deselect(page);
    await swatch(colourGroup(page, 'Color'), 'Green').click();
    await dragImage(page, [400, 100], [600, 200]);
    await toolButton(page, 'Select (V)').click();
    await deselect(page);
    // D-047: the drawing colour in canvas settings is the shared current colour, red again.
    await swatch(colourGroup(page, 'Color'), 'Red').click();
    await workArea(page).focus();
    await page.keyboard.press('ControlOrMeta+A');
    await expect(panel(page).getByRole('heading', { name: '2 annotations selected' })).toBeVisible();
    await expect(colourGroup(page, 'Fill color')).toHaveCount(0);
  }

  test('F-020.AC22 Solid on a blue and a green rectangle fills them blue and green as one step with no swatch marked; the next rectangle is filled red', async ({
    page,
  }) => {
    await open(page);
    await blueAndGreenSelected(page);
    await choice(fillGroup(page), 'Solid').check();
    const group = colourGroup(page, 'Fill color');
    await expect(group).toBeVisible();
    await expect(group.getByRole('radio', { checked: true })).toHaveCount(0);
    await deselect(page);
    await expectPixel(page, 200, 150, BLUE, 2, true, 'the blue rectangle’s fill is blue');
    await expectPixel(page, 500, 150, GREEN, 2, true, 'the green rectangle’s fill is green');
    await undoButton(page).click();
    await frame(page);
    await expectPixel(page, 200, 150, GREY, 2, true, 'one undo removes both fills');
    await expectPixel(page, 500, 150, GREY, 2, true, 'one undo removes both fills');
    await page.keyboard.press('ControlOrMeta+Shift+Z');
    await toolButton(page, 'Rectangle (R)').click();
    await expect(choice(fillGroup(page), 'Solid')).toBeChecked();
    await expect(swatch(colourGroup(page, 'Fill color'), 'Red')).toHaveAttribute('aria-checked', 'true');
    await dragImage(page, [100, 300], [300, 400]);
    await deselect(page);
    await expectPixel(page, 200, 350, RED, 2, true, 'the next rectangle has a solid red fill');
  });

  test('F-020.AC22 one undo removes both fills and their fill colours: Purple then Solid fills both purple', async ({
    page,
  }) => {
    await open(page);
    await blueAndGreenSelected(page);
    await choice(fillGroup(page), 'Solid').check();
    await expect(colourGroup(page, 'Fill color')).toBeVisible();
    await undoButton(page).click();
    await expect(panel(page).getByRole('heading', { name: '2 annotations selected' })).toBeVisible();
    await expect(colourGroup(page, 'Fill color')).toHaveCount(0);
    await swatch(colourGroup(page, 'Color'), 'Purple').click();
    await choice(fillGroup(page), 'Solid').check();
    await expect(swatch(colourGroup(page, 'Fill color'), 'Purple')).toHaveAttribute('aria-checked', 'true');
    await deselect(page);
    const purple = await pixel(page, 100, 150); // the outline
    await expectPixel(page, 200, 150, purple, 2, true, 'the first fill is purple');
    await expectPixel(page, 500, 150, purple, 2, true, 'the second fill is purple');
  });

  test('F-020.AC23 a selected red rectangle: None, Blue, then Solid gives a blue outline and a red fill', async ({
    page,
  }) => {
    await open(page);
    await toolButton(page, 'Rectangle (R)').click();
    await choice(fillGroup(page), 'Solid').check();
    await dragImage(page, [100, 100], [300, 200]); // selected, fill colour Red
    await choice(fillGroup(page), 'None').check();
    await swatch(colourGroup(page, 'Color'), 'Blue').click();
    await choice(fillGroup(page), 'Solid').check();
    await expect(swatch(colourGroup(page, 'Fill color'), 'Red')).toHaveAttribute('aria-checked', 'true');
    await deselect(page);
    await expectPixel(page, 200, 150, RED, 2, true, 'the fill is red');
    await expectPixel(page, 100, 150, BLUE, 30, true, 'the outline is blue');
  });

  test('F-020.AC24 fill colour White, then None: a rectangle drawn then set to Solid is filled white', async ({
    page,
  }) => {
    await open(page);
    await toolButton(page, 'Rectangle (R)').click();
    await choice(fillGroup(page), 'Solid').check();
    await swatch(colourGroup(page, 'Fill color'), 'White').click();
    await choice(fillGroup(page), 'None').check();
    await dragImage(page, [100, 100], [300, 200]);
    await deselect(page);
    await expectPixel(page, 200, 150, GREY, 2, true, 'drawn with fill none');
    await toolButton(page, 'Select (V)').click();
    await clickImage(page, 100, 150); // its left edge
    await expect(state(page)).toHaveAttribute('data-state', 'selecting');
    await expect(choice(fillGroup(page), 'None')).toBeChecked();
    await choice(fillGroup(page), 'Solid').check();
    await expect(swatch(colourGroup(page, 'Fill color'), 'White')).toHaveAttribute('aria-checked', 'true');
    await deselect(page);
    await expectPixel(page, 200, 150, WHITE, 2, true, 'its fill is white');
  });
});

test.describe('F-020 text background', () => {
  test('F-020.AC7 the text tool shows Text background with None marked and no background colour', async ({ page }) => {
    await open(page);
    await toolButton(page, 'Text (T)').click();
    await expect(choice(backgroundGroup(page), 'None')).toBeChecked();
    await expect(colourGroup(page, 'Background color')).toHaveCount(0);
    await expect(fillGroup(page)).toHaveCount(0);
  });

  test('F-020.AC8 a red "Bug" at M on a solid background: no outline, an opaque white box 8 px beyond the text box with rounded corners', async ({
    page,
  }) => {
    await open(page);
    await textToolWithBackground(page, 'Solid');
    await placeText(page, 'Bug');
    await deselect(page);
    await expectPixel(page, 96, 120, WHITE, 0, true, 'the margin, 4 px left of the text box, is opaque white');
    await expectPixel(page, 93, 120, WHITE, 0, true, '7 px left: still the box');
    await expectPixel(page, 90, 120, GREY, 0, true, '10 px left: outside the box');
    await expectPixel(page, 110, 94, WHITE, 0, true, '6 px above: the box');
    await expectPixel(page, 110, 90, GREY, 0, true, '10 px above: outside');
    // A corner of radius 6.4: the box's corner pixel (92, 92) is outside the rounding.
    await expectPixel(page, 92, 92, GREY, 8, true, 'the corner is rounded');
    const letters = await row(page, 100, 120, 60);
    expect(letters.filter((p) => near(p, RED, 30)).length, 'red letters').toBeGreaterThan(3);
  });

  test('F-020.AC9 a white text on a translucent Black background over white exports (77, 77, 77) 4 px left of its box', async ({
    page,
  }) => {
    await open(page, WHITE);
    await toolButton(page, 'Text (T)').click();
    await swatch(colourGroup(page, 'Color'), 'White').click();
    await choice(backgroundGroup(page), 'Translucent').check();
    await swatch(colourGroup(page, 'Background color'), 'Black').click();
    await placeText(page, 'Bug');
    const file = await download(page, () => downloadButton(page).click());
    const png = decodePng(file.bytes);
    const at = (x: number, y: number) =>
      Array.from(png.data.slice((y * png.width + x) * 4, (y * png.width + x) * 4 + 4));
    expect(near(at(96, 120), [77, 77, 77, 255], 2), `got ${at(96, 120).join(',')}`).toBe(true);
  });

  test('F-020.AC10 a red text with a solid automatic background: Blue keeps a white box, Yellow makes it black', async ({
    page,
  }) => {
    await open(page);
    await textToolWithBackground(page, 'Solid');
    await placeText(page, 'Bug'); // selected
    await expectPixel(page, 96, 120, WHITE, 0, true);
    await swatch(colourGroup(page, 'Color'), 'Blue').click();
    await frame(page);
    await expectPixel(page, 96, 120, WHITE, 0, true, 'the pairing of blue: white');
    await swatch(colourGroup(page, 'Color'), 'Yellow').click();
    await frame(page);
    await expectPixel(page, 96, 120, BLACK, 0, true, 'the pairing of yellow: black');
    await expect(swatch(colourGroup(page, 'Background color'), 'Black')).toHaveAttribute('aria-checked', 'true');
  });

  test('F-020.AC11 a click in the box’s margin selects the text (outline around the box); with the text tool it edits; a marquee touching only the margin selects it', async ({
    page,
  }) => {
    await open(page);
    await textToolWithBackground(page, 'Solid');
    await placeText(page, 'Bug');
    await deselect(page);
    await toolButton(page, 'Select (V)').click();
    // 7 px left of the text box: inside the 8 px margin, beyond the 6 px hit tolerance of a plain text.
    await clickImage(page, 93, 120);
    await expect(state(page)).toHaveAttribute('data-state', 'selecting');
    await expect(summary(page)).toHaveText(count(1));
    await deselect(page);
    await clickImage(page, 96, 120); // the AC's own click, 4 px left
    await expect(state(page)).toHaveAttribute('data-state', 'selecting');
    await frame(page);
    // The selection outline surrounds the box: just outside its left edge (x = 92), not the grey image.
    await expectPixel(page, 91, 120, GREY, 6, false, 'the outline is drawn at the box’s edge');
    await expectPixel(page, 85, 120, GREY, 6, true, 'nothing beyond it');
    await deselect(page);
    // A selection box that touches only the margin.
    await dragImage(page, [60, 110], [95, 130]);
    await expect(state(page)).toHaveAttribute('data-state', 'selecting');
    await deselect(page);
    await toolButton(page, 'Text (T)').click();
    await clickImage(page, 93, 120); // 7 px left: beyond the tolerance, inside the margin
    await expect(state(page)).toHaveAttribute('data-state', 'editing-text');
    await expect(editor(page)).toHaveValue('Bug');
    await page.keyboard.press('Escape');
    await deselect(page);
    await clickImage(page, 96, 120); // the AC's own click
    await expect(state(page)).toHaveAttribute('data-state', 'editing-text');
    await expect(editor(page)).toHaveValue('Bug');
  });

  test('F-020.AC12 None on a selected text removes the box and brings the outline back, as one undo step', async ({
    page,
  }) => {
    await open(page);
    await textToolWithBackground(page, 'Solid');
    await placeText(page, 'Bug'); // selected
    await choice(backgroundGroup(page), 'None').check();
    await expect(colourGroup(page, 'Background color')).toHaveCount(0);
    await deselect(page);
    await expectPixel(page, 96, 120, GREY, 0, true, 'the box is gone');
    // The outline is back: the red letters are outlined in white (RULE-08).
    const letters = (await row(page, 100, 120, 60)).filter((p) => near(p, WHITE, 30)).length;
    expect(letters, 'a white outline').toBeGreaterThan(1);
    await undoButton(page).click();
    await frame(page);
    await expectPixel(page, 96, 120, WHITE, 0, true, 'one undo: the box is back');
    await expect(summary(page)).toHaveText(count(1));
  });

  test('F-020.AC13 a background and its colour chosen while "Bug" is edited keep editing; typing "s" grows the box', async ({
    page,
  }) => {
    await open(page);
    await toolButton(page, 'Text (T)').click();
    await clickImage(page, 100, 100);
    await page.keyboard.type('Bug');
    await choice(backgroundGroup(page), 'Solid').click();
    await swatch(colourGroup(page, 'Background color'), 'Yellow').click();
    await expect(state(page)).toHaveAttribute('data-state', 'editing-text');
    await expect(editor(page)).toBeFocused();
    await frame(page);
    await frame(page);
    await expectPixel(page, 96, 120, YELLOW, 0, true, 'a yellow box');
    const before = await rightEdge(page, 100, 104, YELLOW);
    await page.keyboard.type('s');
    await expect(editor(page)).toHaveValue('Bugs');
    await frame(page);
    await frame(page);
    const after = await rightEdge(page, 100, 104, YELLOW);
    expect(after, 'the box grows with the text').toBeGreaterThan(before + 8);
    await expect(state(page)).toHaveAttribute('data-state', 'editing-text');
  });

  test('F-020.AC14 a rectangle and a text selected together offer neither fill nor text background', async ({
    page,
  }) => {
    await open(page);
    await toolButton(page, 'Rectangle (R)').click();
    await dragImage(page, [100, 300], [300, 400]);
    await textToolWithBackground(page, 'Solid');
    await placeText(page, 'Bug');
    await toolButton(page, 'Select (V)').click();
    await workArea(page).focus();
    await page.keyboard.press('ControlOrMeta+A');
    await expect(panel(page).getByRole('heading', { name: '2 annotations selected' })).toBeVisible();
    await expect(fillGroup(page)).toHaveCount(0);
    await expect(backgroundGroup(page)).toHaveCount(0);
  });

  test('F-020.AC14 two texts on Black and White backgrounds: no swatch marked; Blue makes both boxes blue as one undo step', async ({
    page,
  }) => {
    await open(page);
    await textToolWithBackground(page, 'Solid', 'Black');
    await placeText(page, 'A', 100, 100);
    await deselect(page);
    await swatch(colourGroup(page, 'Background color'), 'White').click();
    await placeText(page, 'B', 100, 300);
    await toolButton(page, 'Select (V)').click();
    await workArea(page).focus();
    await page.keyboard.press('ControlOrMeta+A');
    const group = colourGroup(page, 'Background color');
    await expect(group).toBeVisible();
    await expect(group.getByRole('radio', { checked: true })).toHaveCount(0);
    await swatch(group, 'Blue').click();
    await deselect(page);
    await expectPixel(page, 96, 120, BLUE, 0, true);
    await expectPixel(page, 96, 320, BLUE, 0, true);
    await undoButton(page).click();
    await frame(page);
    await frame(page);
    await expectPixel(page, 96, 120, BLACK, 0, true, 'one undo: black');
    await expectPixel(page, 96, 320, WHITE, 0, true, 'one undo: white');
  });

  test('F-020.AC14 two rectangles, fill none and solid: no fill marked and no fill colour', async ({ page }) => {
    await open(page);
    await toolButton(page, 'Rectangle (R)').click();
    await dragImage(page, [100, 100], [300, 200]);
    await deselect(page);
    await choice(fillGroup(page), 'Solid').check();
    await dragImage(page, [100, 300], [300, 400]);
    await toolButton(page, 'Select (V)').click();
    await workArea(page).focus();
    await page.keyboard.press('ControlOrMeta+A');
    await expect(fillGroup(page)).toBeVisible();
    await expect(fillGroup(page).getByRole('radio', { checked: true })).toHaveCount(0);
    await expect(colourGroup(page, 'Fill color')).toHaveCount(0);
  });

  test('F-020.AC15 duplicated: the copies keep the white fill and the yellow background, in the export too', async ({
    page,
  }) => {
    await open(page);
    await toolButton(page, 'Rectangle (R)').click();
    await choice(fillGroup(page), 'Solid').check();
    await swatch(colourGroup(page, 'Fill color'), 'White').click();
    await dragImage(page, [100, 300], [300, 400]);
    await textToolWithBackground(page, 'Solid', 'Yellow');
    await placeText(page, 'Bug');
    await toolButton(page, 'Select (V)').click();
    await workArea(page).focus();
    await page.keyboard.press('ControlOrMeta+A');
    await page.keyboard.press('ControlOrMeta+D'); // copies at +10, +10
    await expect(summary(page)).toHaveText(count(4));
    const file = await download(page, () => downloadButton(page).click());
    const png = decodePng(file.bytes);
    const at = (x: number, y: number) =>
      Array.from(png.data.slice((y * png.width + x) * 4, (y * png.width + x) * 4 + 4));
    expect(near(at(200, 350), WHITE, 0), 'the rectangle’s centre is white').toBe(true);
    expect(near(at(305, 405), WHITE, 0), 'the copy’s fill (outside the original) is white').toBe(true);
    expect(near(at(96, 120), YELLOW, 0), 'the box’s margin is yellow').toBe(true);
    // The copy's text box is at (110, 110), one line: its bottom margin 150–158 lies below the original box.
    expect(near(at(115, 154), YELLOW, 0), 'the copy’s margin is yellow').toBe(true);
  });

  test('F-020.AC16 the fill colour and the background colour are radio groups named by their labels, options by colour name', async ({
    page,
  }) => {
    await open(page);
    await toolButton(page, 'Rectangle (R)').click();
    await choice(fillGroup(page), 'Solid').check();
    const names = ['Red', 'Orange', 'Yellow', 'Green', 'Blue', 'Purple', 'Black', 'White', 'Custom color'];
    for (const [tool, label] of [
      ['Rectangle (R)', 'Fill color'],
      ['Text (T)', 'Background color'],
    ] as const) {
      await toolButton(page, tool).click();
      if (label === 'Background color') await choice(backgroundGroup(page), 'Translucent').check();
      const group = colourGroup(page, label);
      await expect(group).toHaveAccessibleName(label);
      const radios = group.getByRole('radio');
      await expect(radios).toHaveCount(9);
      for (const [i, name] of names.entries()) await expect(radios.nth(i)).toHaveAccessibleName(name);
      await expect(group.getByRole('radio', { checked: true })).toHaveCount(1);
      await expect(swatch(group, label === 'Fill color' ? 'Red' : 'White')).toHaveAttribute('aria-checked', 'true');
      await swatch(group, 'Green').focus();
      await expect(swatch(group, 'Green')).toBeFocused();
    }
    const results = await new AxeBuilder({ page })
      .include('.tk-panel')
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
      .analyze();
    expect(results.violations).toEqual([]);
  });

  test('F-020.AC18 a click in the margin of an edited text keeps editing with the caret before "B"; 20 px outside the box ends it', async ({
    page,
  }) => {
    await open(page);
    await textToolWithBackground(page, 'Solid');
    await clickImage(page, 100, 100);
    await page.keyboard.type('Bug');
    await expect(editor(page)).toHaveJSProperty('selectionStart', 3);
    await clickImage(page, 96, 120);
    await expect(state(page)).toHaveAttribute('data-state', 'editing-text');
    await expect(editor(page)).toBeFocused();
    await expect(editor(page)).toHaveJSProperty('selectionStart', 0);
    await expect(editor(page)).toHaveJSProperty('selectionEnd', 0);
    // F-020.R8: the editing field covers the whole background box (92–?, 92–148), and its outline
    // surrounds it within its 2 px border.
    const box = await editorBox(page);
    expect(box.left).toBeLessThanOrEqual(92);
    expect(box.left).toBeGreaterThanOrEqual(92 - 3);
    expect(box.top).toBeLessThanOrEqual(92);
    expect(box.top).toBeGreaterThanOrEqual(92 - 3);
    expect(box.bottom).toBeGreaterThanOrEqual(148);
    expect(box.bottom).toBeLessThanOrEqual(148 + 3);
    const right = await rightEdge(page, 100, 120, WHITE, 150);
    expect(box.right).toBeGreaterThanOrEqual(right);
    expect(box.right).toBeLessThanOrEqual(right + 4);
    // 7 px left of the text box: inside the margin, beyond the field's old 6 px reach.
    await page.keyboard.press('End');
    await clickImage(page, 93, 120);
    await expect(state(page)).toHaveAttribute('data-state', 'editing-text');
    await expect(editor(page)).toHaveJSProperty('selectionStart', 0);
    // 7 px above the first line: the caret goes to line 1, nearest the click.
    await page.keyboard.press('End');
    await clickImage(page, 103, 93);
    await expect(state(page)).toHaveAttribute('data-state', 'editing-text');
    await expect(editor(page)).toHaveJSProperty('selectionStart', 0);
    await clickImage(page, 72, 120); // 20 px left of the box (x = 92)
    await expect(state(page)).not.toHaveAttribute('data-state', 'editing-text');
    await expect(summary(page)).toHaveText(count(1));
  });

  test('F-020.AC18 at 200 % a click 7 image px into the margin keeps editing with the caret before "B"; 20 px outside ends it', async ({
    page,
  }) => {
    await open(page);
    // Zoomed to 200 % first (the zoom buttons take focus, which would end an edit), then a text placed at
    // the middle of the work area.
    await page.locator('footer.tk-status-bar').getByRole('button', { name: 'Zoom in', exact: true }).click();
    await page.locator('footer.tk-status-bar').getByRole('button', { name: 'Zoom in', exact: true }).click();
    await expect(page.locator('.tk-zoom__level')).toHaveText('200 %');
    await textToolWithBackground(page, 'Solid');
    const area = await workArea(page).boundingBox();
    if (!area) throw new Error('no work area');
    await page.mouse.click(area.x + area.width / 2, area.y + area.height / 2);
    await expect(editor(page)).toBeFocused();
    await page.keyboard.type('Bug');
    await frame(page);
    // The text box's left edge and first line's centre on screen, from the field's content box.
    const { x, y, padding } = await editor(page).evaluate((el) => {
      const r = el.getBoundingClientRect();
      const cs = getComputedStyle(el);
      return {
        x: r.left + el.clientLeft + parseFloat(cs.paddingLeft),
        y: r.top + el.clientTop + parseFloat(cs.paddingTop),
        padding: parseFloat(cs.paddingLeft),
      };
    });
    expect(padding).toBeCloseTo(16, 0); // the 8 px margin at 200 %
    await page.mouse.click(x - 14, y + 40); // 7 image px left, at the first line's centre
    await expect(state(page)).toHaveAttribute('data-state', 'editing-text');
    await expect(editor(page)).toHaveJSProperty('selectionStart', 0);
    await page.mouse.click(x - 16 - 40, y + 40); // 20 image px left of the box
    await expect(state(page)).not.toHaveAttribute('data-state', 'editing-text');
  });

  test('F-020.AC19 an empty text with a solid background shows the placeholder in its box; Esc leaves no text, no box and no step', async ({
    page,
  }) => {
    await open(page);
    await textToolWithBackground(page, 'Solid');
    await clickImage(page, 100, 100);
    await expect(editor(page)).toBeFocused();
    await expect(editor(page)).toHaveAttribute('placeholder', 'Type here');
    await frame(page);
    await frame(page);
    // The box surrounds the placeholder: its top margin runs well past an empty text box's 8 px.
    await expectPixel(page, 96, 120, WHITE, 0, true, 'the margin');
    await expectPixel(page, 140, 96, WHITE, 0, true, 'the box over the placeholder');
    expect(await rightEdge(page, 100, 96, WHITE)).toBeGreaterThan(160);
    await page.keyboard.press('Escape');
    await expect(state(page)).not.toHaveAttribute('data-state', 'editing-text');
    await frame(page);
    await frame(page);
    await expectPixel(page, 96, 120, GREY, 0, true, 'no box');
    await expectPixel(page, 140, 96, GREY, 0, true, 'no box');
    await expect(summary(page)).toHaveText(count(0));
    await expect(undoButton(page)).toBeDisabled();
  });

  test('F-020.AC21 the text background is the text tool’s own: the rectangle has no fill, the text tool keeps solid Yellow', async ({
    page,
  }) => {
    await open(page);
    await textToolWithBackground(page, 'Solid', 'Yellow');
    await toolButton(page, 'Rectangle (R)').click();
    await expect(choice(fillGroup(page), 'None')).toBeChecked();
    await dragImage(page, [100, 100], [300, 200]);
    await deselect(page);
    await expectPixel(page, 200, 150, GREY, 0, true, 'no fill');
    await toolButton(page, 'Text (T)').click();
    await expect(choice(backgroundGroup(page), 'Solid')).toBeChecked();
    await expect(swatch(colourGroup(page, 'Background color'), 'Yellow')).toHaveAttribute('aria-checked', 'true');
  });
});
