// F-003 Draw shapes — end to end on the production build (Chromium + WebKit). The work area is
// 1200 × 800 (viewport: 1200 + the style panel wide; toolbar 40 + 800 + status bar 28 high). A plain
// grey 1000 × 800 image is pasted and shown at 100 %, so image pixel (x, y) is at (100 + x, y) in the
// work area; shapes are checked by the pixels they paint (MOD-Render paint on the display canvas).
// Also: the deferred F-001.AC9 and F-001.AC14 (unexported changes now exist), CMP-StylePanel's narrow
// sheet (D-019) and axe audits of the tools and the panel (NFR-06).
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { canvasPixel, drop, summary } from './support/load';

const PANEL = 272;
const AREA = { width: 1200, height: 800 };
const VIEWPORT = { width: AREA.width + PANEL, height: 40 + AREA.height + 28 };
const IMAGE = { width: 1000, height: 800 };
const GREY = [200, 200, 200, 255];
const RED = [214, 40, 40, 255]; // annotation.color.red #D62828
const GREEN = [45, 184, 77, 255]; // annotation.color.green #2DB84D
const BLUE = [11, 99, 229, 255]; // annotation.color.blue #0B63E5
const WHITE = [255, 255, 255, 255]; // handleFill
const HANDLE_BORDER = [104, 55, 224, 255]; // handleBorder #6837E0
const near = (a: number[], b: number[], tolerance = 24) => a.every((v, i) => Math.abs(v - (b[i] ?? 0)) <= tolerance);

const workArea = (page: Page) => page.locator('main.tk-work-area');
const toolButton = (page: Page, name: string) =>
  page.getByRole('toolbar', { name: 'Tools and actions' }).getByRole('radio', { name });
const frame = (page: Page) => page.evaluate(() => new Promise((r) => requestAnimationFrame(() => r(null))));

/** Image pixel → CSS px in the work area at 100 % (the image is centred horizontally, top-aligned). */
const screen = (x: number, y: number) => ({ x: (AREA.width - IMAGE.width) / 2 + x, y });

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
  await expect(summary(page)).toHaveText('1,000 × 800 px canvas, 0 annotations');
  await page.locator('footer.tk-status-bar').getByRole('button', { name: 'Actual size', exact: true }).click();
  await expect(page.locator('.tk-zoom__level')).toHaveText('100 %');
  await frame(page);
}

/** Zooms in with the status bar until 200 % (the view is then larger than the work area, so it pans). */
async function zoomTo200(page: Page) {
  const zoomIn = page.locator('footer.tk-status-bar').getByRole('button', { name: 'Zoom in', exact: true });
  for (let i = 0; i < 8 && (await page.locator('.tk-zoom__level').textContent()) !== '200 %'; i++) await zoomIn.click();
  await expect(page.locator('.tk-zoom__level')).toHaveText('200 %');
  await frame(page);
}

/** Drags in image pixels, optionally with Shift held. */
async function dragImage(page: Page, from: [number, number], to: [number, number], shift = false) {
  const box = await workArea(page).boundingBox();
  if (!box) throw new Error('no work area');
  const a = screen(...from);
  const b = screen(...to);
  await page.mouse.move(box.x + a.x, box.y + a.y);
  if (shift) await page.keyboard.down('Shift');
  await page.mouse.down();
  await page.mouse.move(box.x + (a.x + b.x) / 2, box.y + (a.y + b.y) / 2, { steps: 4 });
  await page.mouse.move(box.x + b.x, box.y + b.y, { steps: 4 });
  await page.mouse.up();
  if (shift) await page.keyboard.up('Shift');
  await frame(page);
}

/** The pixel at an image point (CSS px of the display canvas). */
const pixel = (page: Page, x: number, y: number) => canvasPixel(page, screen(x, y).x, screen(x, y).y);

/** Esc on the canvas clears the selection, so the shapes' own pixels show (RULE-19). */
async function deselect(page: Page) {
  await workArea(page).focus();
  await page.keyboard.press('Escape');
  await expect(page.locator('[data-screen="SCR-Annotator"]')).not.toHaveAttribute('data-state', 'selecting');
  await frame(page);
  await frame(page);
}

const count = (n: number) => `1,000 × 800 px canvas, ${n} annotation${n === 1 ? '' : 's'}`;

test.describe('F-003 draw shapes', () => {
  test('F-003.AC1 dragging (100, 100) → (300, 200) with the rectangle tool draws that box in red, stroke M', async ({
    page,
  }) => {
    await open(page);
    await toolButton(page, 'Rectangle (R)').click();
    await dragImage(page, [100, 100], [300, 200]);
    await expect(summary(page)).toHaveText(count(1));
    await deselect(page);
    for (const [x, y] of [
      [100, 150],
      [300, 150],
      [200, 100],
      [200, 200],
      [101, 150],
    ] as const)
      expect(near(await pixel(page, x, y), RED), `edge ${x},${y}`).toBe(true);
    // Stroke M on 1000 × 800 is 5 px, centred on the box edge; nothing is filled.
    for (const [x, y] of [
      [95, 150],
      [105, 150],
      [200, 150],
    ] as const)
      expect(near(await pixel(page, x, y), GREY), `off ${x},${y}`).toBe(true);
  });

  test('F-003.AC2 the ellipse tool draws the ellipse that fits the dragged box', async ({ page }) => {
    await open(page);
    await toolButton(page, 'Ellipse (O)').click();
    await dragImage(page, [100, 100], [500, 300]);
    await deselect(page);
    for (const [x, y] of [
      [100, 200],
      [500, 200],
      [300, 100],
      [300, 300],
    ] as const)
      expect(near(await pixel(page, x, y), RED), `outline ${x},${y}`).toBe(true);
    expect(near(await pixel(page, 300, 200), GREY)).toBe(true);
    // Not a rectangle: the box's corners and its top edge near them are outside the ellipse, and the
    // ellipse passes through its 45° point (300 + 200 cos 45°, 200 − 100 sin 45°) ≈ (441, 129).
    for (const [x, y] of [
      [115, 115],
      [110, 100],
      [100, 110],
      [490, 290],
    ] as const)
      expect(near(await pixel(page, x, y), GREY), `outside ${x},${y}`).toBe(true);
    expect(near(await pixel(page, 441, 129), RED)).toBe(true);
  });

  test('F-003.AC3 an arrow from A has its 20 px long, 15 px wide head at B (1000 × 800, stroke M)', async ({
    page,
  }) => {
    await open(page);
    await toolButton(page, 'Arrow (A)').click();
    await dragImage(page, [100, 400], [500, 400]);
    await deselect(page);
    expect(near(await pixel(page, 300, 400), RED)).toBe(true); // shaft
    expect(near(await pixel(page, 300, 405), GREY)).toBe(true); // the shaft is 5 px wide
    expect(near(await pixel(page, 496, 400), RED)).toBe(true); // head, near the tip at B
    expect(near(await pixel(page, 504, 400), GREY)).toBe(true); // nothing beyond B
    expect(near(await pixel(page, 483, 405), RED)).toBe(true); // 15 px wide near its base (±7.5)
    expect(near(await pixel(page, 483, 410), GREY)).toBe(true);
    expect(near(await pixel(page, 476, 405), GREY)).toBe(true); // 20 px long: its base is at x = 480
  });

  test('F-003.AC4 the line tool draws a line with no head', async ({ page }) => {
    await open(page);
    await toolButton(page, 'Line (L)').click();
    await dragImage(page, [100, 600], [500, 600]);
    await deselect(page);
    expect(near(await pixel(page, 300, 600), RED)).toBe(true);
    expect(near(await pixel(page, 499, 600), RED)).toBe(true);
    // Where an arrowhead would be 9 px wide, the line is still 5 px wide.
    expect(near(await pixel(page, 488, 604), GREY)).toBe(true);
    expect(near(await pixel(page, 488, 596), GREY)).toBe(true);
  });

  test('F-003.AC5 with fill translucent set in the style panel, the rectangle is filled at 30 % in its colour', async ({
    page,
  }) => {
    await open(page);
    await toolButton(page, 'Rectangle (R)').click();
    const panel = page.getByRole('complementary', { name: 'Style' });
    await panel.getByRole('radio', { name: 'Translucent' }).check();
    await expect(panel.getByRole('radio', { name: 'Translucent' })).toBeChecked();
    await dragImage(page, [100, 100], [300, 200]);
    await deselect(page);
    const mix = RED.map((v, i) => (i === 3 ? 255 : Math.round(0.3 * v + 0.7 * (GREY[i] ?? 0))));
    expect(near(await pixel(page, 200, 150), mix, 6)).toBe(true);
    expect(near(await pixel(page, 100, 150), RED)).toBe(true); // the outline stays opaque
  });

  test('F-003.AC6 Shift makes a 200 × 120 ellipse drag a 200 × 200 circle and snaps an arrow to 45°', async ({
    page,
  }) => {
    await open(page);
    await toolButton(page, 'Ellipse (O)').click();
    await dragImage(page, [100, 100], [300, 220], true);
    await deselect(page);
    expect(near(await pixel(page, 200, 300), RED)).toBe(true); // bottom of a 200 px circle
    expect(near(await pixel(page, 200, 220), GREY)).toBe(true); // not at the drag's 120 px
    await toolButton(page, 'Arrow (A)').click();
    await dragImage(page, [100, 450], [300, 640], true); // 43.5° → 45°
    await deselect(page);
    expect(near(await pixel(page, 200, 550), RED)).toBe(true); // on the 45° line
    expect(near(await pixel(page, 200, 545), GREY)).toBe(true); // the unsnapped line would pass here
  });

  test('F-003.AC7 a click without dragging places a 160 × 160 rectangle centred on it (1000 × 800)', async ({
    page,
  }) => {
    await open(page);
    await toolButton(page, 'Rectangle (R)').click();
    const box = await workArea(page).boundingBox();
    if (!box) throw new Error('no work area');
    const p = screen(500, 400);
    await page.mouse.click(box.x + p.x, box.y + p.y);
    await expect(summary(page)).toHaveText(count(1));
    await deselect(page);
    for (const [x, y] of [
      [420, 400],
      [580, 400],
      [500, 320],
      [500, 480],
    ] as const)
      expect(near(await pixel(page, x, y), RED), `edge ${x},${y}`).toBe(true);
    expect(near(await pixel(page, 500, 400), GREY)).toBe(true);
    expect(near(await pixel(page, 414, 400), GREY)).toBe(true);
  });

  test('F-003.AC8 Enter places at the centre of the view, not of the image, after zooming and panning', async ({
    page,
  }) => {
    await open(page);
    await zoomTo200(page);
    await toolButton(page, 'Arrow (A)').click();
    await workArea(page).focus();
    await page.keyboard.press('ArrowDown'); // RULE-19: pans 40 screen px; the image centre moves off the view centre
    await frame(page);
    await page.keyboard.press('Enter');
    await expect(summary(page)).toHaveText(count(1));
    await deselect(page);
    // The default arrow (160 image px = 320 screen px at 200 %) lies across the view's centre (600, 400).
    const centre = { x: AREA.width / 2, y: AREA.height / 2 };
    for (const dx of [-120, 0, 120])
      expect(near(await canvasPixel(page, centre.x + dx, centre.y), RED), `on the arrow ${dx}`).toBe(true);
    // The image's centre is 40 px away from it after the pan: nothing is drawn there.
    expect(near(await canvasPixel(page, centre.x - 40, centre.y - 40), GREY)).toBe(true);
    expect(near(await canvasPixel(page, centre.x - 40, centre.y + 40), GREY)).toBe(true);
  });

  test('F-003.AC3 a scroll during the drag keeps the arrow head under the pointer', async ({ page }) => {
    await open(page);
    await zoomTo200(page);
    await toolButton(page, 'Arrow (A)').click();
    const box = (await workArea(page).boundingBox())!;
    await page.mouse.move(box.x + 300, box.y + 400);
    await page.mouse.down();
    await page.mouse.move(box.x + 700, box.y + 400, { steps: 4 });
    await page.mouse.wheel(0, 120); // F-002.R4: plain scrolling pans the view mid-drag
    await frame(page);
    await page.mouse.up();
    await expect(summary(page)).toHaveText(count(1));
    await deselect(page);
    // The head ends where the pointer was released; its tail moved with the image.
    expect(near(await canvasPixel(page, 700 - 30, 400), RED), 'head under the pointer').toBe(true);
    expect(near(await canvasPixel(page, 700 - 30, 280), GREY), 'not where the old view put it').toBe(true);
  });

  test('F-003.AC8 with the arrow tool and focus on the canvas, Enter places a selected arrow at the centre', async ({
    page,
  }) => {
    await open(page);
    await toolButton(page, 'Arrow (A)').click();
    await workArea(page).focus();
    await page.keyboard.press('Enter');
    await expect(summary(page)).toHaveText(count(1));
    await expect(page.locator('[role="status"]')).toContainText('Arrow added');
    // Default arrow (RULE-05): 160 px pointing right, centred on the view's centre, image (500, 400).
    // The canvas repaints within a few frames of the change, so the pixels are polled.
    await expect.poll(async () => near(await pixel(page, 500, 400), RED)).toBe(true);
    // Selected: white handles with the handle border at its tail (420, 400) and head (580, 400).
    for (const x of [420, 580]) {
      await expect.poll(async () => near(await pixel(page, x, 400), WHITE, 8), `handle ${x}`).toBe(true);
      expect(near(await pixel(page, x - 5, 400), HANDLE_BORDER, 8), `border ${x}`).toBe(true);
    }
    await expect(page.locator('[data-screen="SCR-Annotator"]')).toHaveAttribute('data-state', 'selecting');
    // RULE-19: even with something selected, Enter places another.
    await page.keyboard.press('Enter');
    await expect(summary(page)).toHaveText(count(2));
  });

  test('F-003.AC9 a drawn arrow is selected and the arrow tool stays active, so the next drag draws another', async ({
    page,
  }) => {
    await open(page);
    await toolButton(page, 'Arrow (A)').click();
    await dragImage(page, [100, 300], [400, 300]);
    expect(near(await pixel(page, 400, 300), WHITE, 8)).toBe(true); // head handle
    expect(near(await pixel(page, 100, 300), WHITE, 8)).toBe(true); // tail handle
    await expect(toolButton(page, 'Arrow (A)')).toHaveAttribute('aria-checked', 'true');
    await dragImage(page, [100, 500], [400, 500]);
    await expect(summary(page)).toHaveText(count(2));
    // Only the newest is selected: the first arrow's head shows no handle any more.
    expect(near(await pixel(page, 400, 300), WHITE, 8)).toBe(false);
  });

  test('F-003 edge case: Esc during a drag creates nothing', async ({ page }) => {
    await open(page);
    await toolButton(page, 'Rectangle (R)').click();
    const box = await workArea(page).boundingBox();
    if (!box) throw new Error('no work area');
    await page.mouse.move(box.x + 300, box.y + 300);
    await page.mouse.down();
    await page.mouse.move(box.x + 500, box.y + 400, { steps: 4 });
    await page.keyboard.press('Escape');
    await page.mouse.move(box.x + 520, box.y + 420);
    await page.mouse.up();
    await frame(page);
    await expect(summary(page)).toHaveText(count(0));
    expect(near(await canvasPixel(page, 300, 350), GREY)).toBe(true);
  });

  test('F-003 edge case: a drag that leaves the canvas is clipped to the canvas edge', async ({ page }) => {
    await open(page);
    await toolButton(page, 'Rectangle (R)').click();
    await dragImage(page, [900, 100], [1080, 200]); // the image ends at x = 1000
    await deselect(page);
    expect(near(await pixel(page, 950, 100), RED)).toBe(true);
    expect(near(await pixel(page, 1040, 100), RED)).toBe(false); // outside the canvas: the surround
  });

  test('RULE-19 tool keys pick tools on the canvas; Esc clears the selection, then switches to select', async ({
    page,
  }) => {
    await open(page);
    await workArea(page).focus();
    await page.keyboard.press('o');
    await expect(toolButton(page, 'Ellipse (O)')).toHaveAttribute('aria-checked', 'true');
    await expect(page.locator('[role="status"]')).toContainText('Ellipse tool');
    await page.keyboard.press('Enter');
    await expect(summary(page)).toHaveText(count(1));
    await page.keyboard.press('Escape'); // clears the selection
    await expect(toolButton(page, 'Ellipse (O)')).toHaveAttribute('aria-checked', 'true');
    await page.keyboard.press('Escape'); // then the select tool
    await expect(toolButton(page, 'Select (V)')).toHaveAttribute('aria-checked', 'true');
  });

  test('CMP-Toolbar the tool group is one tab stop, a radio group with arrow-key navigation', async ({ page }) => {
    await open(page);
    await toolButton(page, 'Select (V)').focus();
    await page.keyboard.press('ArrowRight');
    await expect(toolButton(page, 'Rectangle (R)')).toBeFocused();
    // A radio group named COPY-a11y.tool_group: moving with the arrows checks the tool.
    await expect(page.getByRole('radiogroup', { name: 'Drawing tools' })).toBeVisible();
    await expect(toolButton(page, 'Rectangle (R)')).toHaveAttribute('aria-checked', 'true');
    await expect(toolButton(page, 'Select (V)')).toHaveAttribute('aria-checked', 'false');
    await page.keyboard.press('End'); // the last tool (F-010)
    await expect(toolButton(page, 'Crop (C)')).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(toolButton(page, 'Crop (C)')).toHaveAttribute('aria-checked', 'true');
    await expect(toolButton(page, 'Crop (C)')).toHaveAttribute('tabindex', '0');
    await expect(toolButton(page, 'Select (V)')).toHaveAttribute('tabindex', '-1');
  });

  test('RULE-04 a colour picked with a shape selected recolours it and becomes the tool’s colour', async ({ page }) => {
    await open(page);
    await toolButton(page, 'Rectangle (R)').click();
    await dragImage(page, [100, 100], [300, 200]);
    const panel = page.getByRole('complementary', { name: 'Style' });
    await panel.getByRole('radio', { name: 'Blue' }).check();
    await deselect(page);
    expect(near(await pixel(page, 100, 150), BLUE)).toBe(true);
    await expect(panel.getByRole('radio', { name: 'Blue' })).toBeChecked(); // the tool's current colour now
  });

  test('F-003.AC10 green picked with the rectangle tool shows with the arrow tool and draws the next arrow; highlight shows yellow', async ({
    page,
  }) => {
    await open(page);
    const panel = page.getByRole('complementary', { name: 'Style' });
    await toolButton(page, 'Rectangle (R)').click();
    await panel.getByRole('radio', { name: 'Green' }).check();
    await toolButton(page, 'Arrow (A)').click();
    await expect(panel.getByRole('radio', { name: 'Green' })).toBeChecked();
    await dragImage(page, [100, 400], [400, 400]);
    await deselect(page);
    expect(near(await pixel(page, 250, 400), GREEN), 'the arrow is green').toBe(true);
    await toolButton(page, 'Highlight (H)').click();
    await expect(panel.getByRole('radio', { name: 'Yellow' })).toBeChecked();
  });

  test('F-003.AC11 D-046 canvas settings start with the heading "Canvas"; a background colour leaves the next rectangle red', async ({
    page,
  }) => {
    await open(page);
    const panel = page.getByRole('complementary', { name: 'Style' });
    // D-036: level 2 under the h1, first in the panel, like the D-035 multi-selection heading.
    const heading = panel.getByRole('heading', { level: 2, name: 'Canvas' });
    await expect(heading).toBeVisible();
    expect(await panel.evaluate((el) => el.querySelector('.tk-panel__body > *')?.tagName)).toBe('H2');
    const background = panel.getByRole('group', { name: 'Background' });
    await expect(background.getByRole('radio', { name: 'Green' })).toBeVisible();
    await background.getByRole('radio', { name: 'Green' }).check();
    await toolButton(page, 'Rectangle (R)').click();
    await expect(heading).toHaveCount(0);
    await expect(panel.getByRole('radio', { name: 'Red' })).toBeChecked();
    await dragImage(page, [100, 100], [300, 200]);
    await deselect(page);
    expect(near(await pixel(page, 100, 150), RED), 'the rectangle is red').toBe(true);
  });

  test('RULE-04 F-008.R4 a rectangle and a highlight selected, given blue: both blue, and blue is the next colour of both tools', async ({
    page,
  }) => {
    await open(page);
    const panel = page.getByRole('complementary', { name: 'Style' });
    await toolButton(page, 'Rectangle (R)').click();
    await dragImage(page, [100, 100], [300, 200]);
    await toolButton(page, 'Highlight (H)').click();
    await dragImage(page, [500, 500], [800, 500]);
    await toolButton(page, 'Select (V)').click();
    await deselect(page);
    await dragImage(page, [50, 50], [900, 600]);
    await expect(panel.getByRole('heading', { level: 2, name: '2 annotations selected' })).toBeVisible();
    await panel.getByRole('radio', { name: 'Blue' }).check();
    await deselect(page);
    expect(near(await pixel(page, 100, 150), BLUE), 'the rectangle is blue').toBe(true);
    const [r, , b] = await pixel(page, 650, 500);
    expect((b ?? 0) > (r ?? 0) + 40, 'the highlight is blue').toBe(true);
    for (const tool of ['Highlight (H)', 'Ellipse (O)', 'Pen (P)']) {
      await toolButton(page, tool).click();
      await expect(panel.getByRole('radio', { name: 'Blue' }), tool).toBeChecked();
    }
  });
});

test.describe('F-003 deferred criteria of F-001 (unexported changes)', () => {
  test('F-001.AC9 with unexported annotations, pasting asks to replace; cancel keeps them, confirm replaces', async ({
    page,
  }) => {
    await open(page);
    await toolButton(page, 'Rectangle (R)').click();
    await dragImage(page, [100, 100], [300, 200]);
    await expect(summary(page)).toHaveText(count(1));
    const pasteWide = () =>
      page.evaluate(async () => {
        const c = new OffscreenCanvas(600, 400);
        const ctx = c.getContext('2d');
        if (!ctx) throw new Error('no 2d context');
        ctx.fillStyle = '#0a0';
        ctx.fillRect(0, 0, 600, 400);
        const dt = new DataTransfer();
        dt.items.add(new File([await c.convertToBlob({ type: 'image/png' })], 'b.png', { type: 'image/png' }));
        document.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }));
      });
    await pasteWide();
    const dialog = page.getByRole('alertdialog', { name: 'Replace this image?' });
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText("Your changes haven't been copied or downloaded. They will be lost.");
    await dialog.getByRole('button', { name: 'Cancel' }).click();
    await expect(summary(page)).toHaveText(count(1));
    await pasteWide();
    await expect(dialog).toBeVisible();
    await dialog.getByRole('button', { name: 'Replace', exact: true }).click();
    await expect(summary(page)).toHaveText('600 × 400 px canvas, 0 annotations');
  });

  test('F-001.AC14 with unexported changes, dropping a PDF shows unsupported format and no replace confirmation', async ({
    page,
  }) => {
    await open(page);
    await toolButton(page, 'Ellipse (O)').click();
    await dragImage(page, [100, 100], [300, 200]);
    const pdf = {
      name: 'report.pdf',
      type: 'application/pdf',
      bytes: Array.from('%PDF-1.7\n%\n', (c) => c.charCodeAt(0)),
    };
    await drop(page, [pdf]);
    await expect(page.locator('.tk-notice__text')).toContainText("This file type isn't supported.");
    await expect(page.getByRole('alertdialog')).toHaveCount(0);
    await expect(summary(page)).toHaveText(count(1));
  });
});

test.describe('CMP-StylePanel narrow sheet (D-019)', () => {
  test('CMP-StylePanel narrow: the summary bar opens and closes the sheet; selecting does not open it', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 760 });
    await page.goto('/');
    await page.evaluate(async () => {
      const c = new OffscreenCanvas(1000, 800);
      const ctx = c.getContext('2d');
      if (!ctx) throw new Error('no 2d context');
      ctx.fillStyle = '#c8c8c8';
      ctx.fillRect(0, 0, 1000, 800);
      const dt = new DataTransfer();
      dt.items.add(new File([await c.convertToBlob({ type: 'image/png' })], 'g.png', { type: 'image/png' }));
      document.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }));
    });
    await expect(summary(page)).toHaveText(count(0));
    await toolButton(page, 'Rectangle (R)').click();
    const bar = page.getByRole('button', { name: 'Style options: Rectangle · Medium' });
    await expect(bar).toHaveAttribute('aria-expanded', 'false');
    // Drawing selects the shape: the bar updates, the sheet stays closed.
    const box = await workArea(page).boundingBox();
    if (!box) throw new Error('no work area');
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
    await expect(summary(page)).toHaveText(count(1));
    await expect(bar).toHaveAttribute('aria-expanded', 'false');
    await bar.focus();
    await page.keyboard.press('Enter');
    await expect(bar).toHaveAttribute('aria-expanded', 'true');
    await expect(bar).toBeFocused(); // opening does not move focus
    const sheet = page.locator('#tk-style-sheet');
    await expect(sheet.getByRole('radio', { name: 'Red' })).toBeVisible();
    // At most half the work area including the bar; the view moves above it.
    const sheetBox = await page.locator('.tk-panel__inner').boundingBox();
    expect(sheetBox && sheetBox.height <= (box.height + 48) / 2 + 1).toBe(true);
    await page.keyboard.press('Escape');
    await expect(bar).toHaveAttribute('aria-expanded', 'false');
    // Tapping the active tool again opens it too.
    await toolButton(page, 'Rectangle (R)').click();
    await expect(bar).toHaveAttribute('aria-expanded', 'true');
    await toolButton(page, 'Rectangle (R)').click();
    await expect(bar).toHaveAttribute('aria-expanded', 'false');
  });

  for (const theme of ['dark', 'light'] as const) {
    test(`NFR-06 F-003 tools, style panel and narrow sheet have no axe violations (${theme})`, async ({ page }) => {
      const audit = () =>
        new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze();
      await open(page, `?theme=${theme}`);
      await toolButton(page, 'Rectangle (R)').click();
      expect((await audit()).violations).toEqual([]);
      await dragImage(page, [100, 100], [300, 200]);
      expect((await audit()).violations).toEqual([]);
      await page.setViewportSize({ width: 390, height: 760 });
      await page.getByRole('button', { name: /^Style options: / }).click();
      expect((await audit()).violations).toEqual([]);
    });
  }
});
