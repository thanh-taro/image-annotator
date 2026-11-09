// The end-of-milestone M-1 tour (F-015.AC6, F-015.AC7): one quick pass through every M-1 feature, the
// same steps standalone (tests/e2e/m1-tour.spec.ts) and embedded in the stub host
// (tests/e2e/host/m1-embedded.spec.ts). Each step checks its user-visible outcome; the tour ends with a
// downloaded PNG whose pixels show the work (decoded in Node, ADR-0019), then starts over. It is a short
// end-to-end pass, not a repeat of the per-feature suites. `ui` is the tool's document: the page itself
// standalone, or the tool's frame embedded; `page` drives the pointer, keyboard and downloads.
import { expect as baseExpect, type Frame, type Page } from '@playwright/test';
import { copied, download, expectCleanPng, pngRegion } from './export';
import { drop, fixture, fixturePath } from './load';

// Generous waits for every step: these long walks must hold under a fully loaded machine (no sleeps).
const expect = baseExpect.configure({ timeout: 15_000 });

type Ui = Page | Frame;

const BLACK = [0, 0, 0, 255];
const BLUE = [11, 99, 229, 255]; // annotation.color.blue (#0B63E5)
const GREY = [200, 200, 200, 255];
/** The pasted screenshot: flat grey, with 2 px black and white stripes where the redactions go. */
const SHOT = { width: 800, height: 500, stripes: { x: 20, y: 290, width: 600, height: 100 } };
const PATIENT = { timeout: 20_000 };

const near = (a: number[], b: number[], tolerance = 24) => a.every((v, i) => Math.abs(v - (b[i] ?? 0)) <= tolerance);
const toolbar = (ui: Ui) => ui.getByRole('toolbar', { name: 'Tools and actions' });
const tool = (ui: Ui, name: string) => toolbar(ui).getByRole('radio', { name });
const panel = (ui: Ui) => ui.getByRole('complementary', { name: 'Style' });
const geometry = (ui: Ui) => panel(ui).getByRole('group', { name: 'Position and size' });
const fields = (ui: Ui) => panel(ui).locator('.tk-geometry__input');
const summary = (ui: Ui) => ui.locator('#tk-canvas-summary');
const statusBar = (ui: Ui) => ui.locator('footer.tk-status-bar');
const zoomLevel = (ui: Ui) => ui.locator('.tk-zoom__level');
const screen = (ui: Ui) => ui.locator('[data-screen="SCR-Annotator"]');
const annotations = (ui: Ui) => ui.getByRole('listbox', { name: 'Annotations' }).getByRole('option');
const count = (ui: Ui, n: number) => expect(summary(ui)).toHaveText(new RegExp(`, ${n} annotations?$`), PATIENT);
const painted = (ui: Ui) =>
  ui.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r(null)))));

/** Types whole image pixels into position and size fields, in order, applying each with Enter. */
async function setFields(ui: Ui, values: readonly number[]) {
  for (const [i, v] of values.entries()) {
    await fields(ui).nth(i).fill(String(v));
    await fields(ui).nth(i).press('Enter');
  }
  for (const [i, v] of values.entries()) await expect(fields(ui).nth(i)).toHaveValue(String(v));
}

/** A row of display-canvas pixels through the middle of the work area (to see the view move). */
const middleRow = (ui: Ui) =>
  ui.locator('canvas.tk-canvas').evaluate((el) => {
    const c = el as HTMLCanvasElement;
    const ctx = c.getContext('2d', { colorSpace: 'srgb' });
    const row = ctx?.getImageData(0, Math.round(c.height / 2), c.width, 1).data ?? [];
    let h = 0;
    for (const v of row) h = (h * 31 + v) >>> 0;
    return h;
  });

/** Pastes the generated 800 × 500 screenshot (SHOT). */
async function pasteShot(ui: Ui) {
  await ui.evaluate(async (shot) => {
    const c = new OffscreenCanvas(shot.width, shot.height);
    const ctx = c.getContext('2d', { colorSpace: 'srgb' });
    if (!ctx) throw new Error('no 2d context');
    ctx.fillStyle = 'rgb(200,200,200)';
    ctx.fillRect(0, 0, shot.width, shot.height);
    const s = shot.stripes;
    for (let x = s.x; x < s.x + s.width; x += 4) {
      ctx.fillStyle = '#000';
      ctx.fillRect(x, s.y, 2, s.height);
      ctx.fillStyle = '#fff';
      ctx.fillRect(x + 2, s.y, 2, s.height);
    }
    const dt = new DataTransfer();
    dt.items.add(new File([await c.convertToBlob({ type: 'image/png' })], 'shot.png', { type: 'image/png' }));
    (document.activeElement ?? document).dispatchEvent(
      new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }),
    );
  }, SHOT);
}

/**
 * Runs the M-1 tour. The tool must be open, in en-US, with an empty session, at a wide layout with the
 * clipboard recorded (support/export.ts `recordClipboard`).
 */
export async function m1Tour(page: Page, ui: Ui): Promise<void> {
  await expect(screen(ui)).toHaveAttribute('data-state', 'empty');

  // F-001 load by open, drop and paste: each shows the new image (no changes yet, so no confirmation).
  const chooser = page.waitForEvent('filechooser');
  await toolbar(ui).getByRole('button', { name: 'Open image' }).click();
  await (await chooser).setFiles(fixturePath('fmt.png'));
  await expect(summary(ui)).toHaveText('240 × 160 px canvas, 0 annotations', PATIENT);
  await drop(ui, [fixture('wide-2000x1000.png', 'image/png')]);
  await expect(summary(ui)).toHaveText('2,000 × 1,000 px canvas, 0 annotations', PATIENT);
  await pasteShot(ui);
  await expect(summary(ui)).toHaveText('800 × 500 px canvas, 0 annotations', PATIENT);
  await expect(ui.locator('canvas.tk-canvas')).toBeVisible();

  // F-002 the view at 100 %, so image pixels map 1:1 to the screen from a calibrated origin.
  await statusBar(ui).getByRole('button', { name: 'Actual size', exact: true }).click();
  await expect(zoomLevel(ui)).toHaveText('100 %');
  await painted(ui);
  const area = await ui.locator('main.tk-work-area').boundingBox();
  if (!area) throw new Error('no work area');
  const origin = {
    x: Math.round(area.x + (area.width - SHOT.width) / 2),
    y: Math.round(area.y + (area.height - SHOT.height) / 2),
  };
  const at = (x: number, y: number) => ({ x: origin.x + x, y: origin.y + y });
  const drag = async (from: [number, number], to: [number, number], via?: [number, number]) => {
    const a = at(...from);
    const b = at(...to);
    await page.mouse.move(a.x, a.y);
    await page.mouse.down();
    if (via) await page.mouse.move(at(...via).x, at(...via).y, { steps: 4 });
    await page.mouse.move(b.x, b.y, { steps: 6 });
    await page.mouse.up();
  };
  /** Esc on the canvas clears the selection (RULE-19). */
  const deselect = async () => {
    await ui.locator('main.tk-work-area').focus();
    await page.keyboard.press('Escape');
    await expect(screen(ui)).not.toHaveAttribute('data-state', 'selecting');
  };
  const click = (x: number, y: number) => page.mouse.click(at(x, y).x, at(x, y).y);

  // F-003 shapes: each drag makes one shape of that kind, selected, with its position fields.
  await tool(ui, 'Rectangle (R)').click();
  await drag([40, 40], [200, 140]);
  await count(ui, 1);
  // Calibrate the origin on the rectangle's own position (whole image pixels), then pin it exactly.
  const [x0, y0] = await fields(ui).evaluateAll((els) =>
    els.slice(0, 2).map((e) => Number((e as HTMLInputElement).value)),
  );
  origin.x += 40 - (x0 ?? 40);
  origin.y += 40 - (y0 ?? 40);
  await setFields(ui, [40, 40, 160, 100]);
  await tool(ui, 'Ellipse (O)').click();
  await drag([240, 40], [400, 140]);
  await count(ui, 2);
  await tool(ui, 'Line (L)').click();
  await drag([440, 40], [580, 140]);
  await count(ui, 3);
  await expect(geometry(ui).getByRole('group', { name: 'Start' })).toBeVisible(); // lines: start and end
  await tool(ui, 'Arrow (A)').click();
  await drag([620, 40], [760, 140]);
  await count(ui, 4);
  // F-004 strokes: a pen stroke and a highlight.
  await tool(ui, 'Pen (P)').click();
  await drag([40, 180], [200, 260], [120, 240]);
  await count(ui, 5);
  await tool(ui, 'Highlight (H)').click();
  await drag([240, 220], [400, 220]);
  await count(ui, 6);
  // F-005 text: typed in place, finished with Esc.
  await tool(ui, 'Text (T)').click();
  await click(440, 200);
  const editor = ui.getByRole('textbox', { name: 'Text', exact: true });
  await expect(editor).toBeFocused();
  await page.keyboard.insertText('Hello');
  await page.keyboard.press('Escape');
  await expect(editor).toBeHidden();
  await count(ui, 7);
  await expect(annotations(ui).filter({ hasText: /^Text “Hello” at / })).toHaveCount(1);
  // F-006 steps number themselves 1, 2.
  await tool(ui, 'Step (N)').click();
  await click(640, 220);
  await click(720, 220);
  await count(ui, 9);
  await expect(annotations(ui).filter({ hasText: /^Step [12] at / })).toHaveCount(2);

  // F-007 redaction: solid, blur and pixelate over the stripes; the live count follows (RULE-20).
  await page.keyboard.press('Escape'); // the last step stays selected (CMP-Toolbar): deselect it
  await tool(ui, 'Redact (X)').click();
  const kind = (name: RegExp) => panel(ui).getByRole('group', { name: 'Redaction type' }).getByRole('radio', { name });
  await expect(kind(/^Solid \(secure\)/)).toBeChecked();
  await drag([40, 300], [200, 380]);
  await count(ui, 10);
  await setFields(ui, [40, 300, 160, 80]);
  await expect(toolbar(ui)).toContainText('1 redaction');
  await deselect(); // so the kind changes the tool's, not the redaction's
  await kind(/^Blur/).check();
  await expect(panel(ui)).toContainText('Not secure: blurred or pixelated text can sometimes be recovered.');
  await drag([240, 300], [400, 380]);
  await page.keyboard.press('Escape');
  await kind(/^Pixelate/).check();
  await drag([440, 300], [600, 380]);
  await count(ui, 12);
  await expect(toolbar(ui)).toContainText('3 redactions');

  // F-008 edit: select the rectangle by its edge, recolour it and move it with the position fields.
  await tool(ui, 'Select (V)').click();
  await click(40, 90);
  await expect(fields(ui).nth(0)).toHaveValue('40');
  await expect(fields(ui).nth(2)).toHaveValue('160');
  await panel(ui).getByRole('radio', { name: 'Blue', exact: true }).check();
  await setFields(ui, [60]);

  // F-009 undo and redo (buttons and keys): the move comes back, then goes again.
  const undo = toolbar(ui).getByRole('button', { name: 'Undo', exact: true });
  const redo = toolbar(ui).getByRole('button', { name: 'Redo', exact: true });
  await undo.click();
  await expect(fields(ui).nth(0)).toHaveValue('40');
  await redo.click();
  await expect(fields(ui).nth(0)).toHaveValue('60');
  await ui.locator('main.tk-work-area').focus();
  await page.keyboard.press('ControlOrMeta+z');
  await expect(fields(ui).nth(0)).toHaveValue('40');
  await page.keyboard.press('ControlOrMeta+Shift+z');
  await expect(fields(ui).nth(0)).toHaveValue('60');

  // F-013 keyboard shortcuts: Delete and undo, a tool key, the shortcuts help with ?.
  await page.keyboard.press('Delete');
  await count(ui, 11);
  await page.keyboard.press('ControlOrMeta+z');
  await count(ui, 12);
  await expect(fields(ui).nth(0)).toHaveValue('60'); // the restored rectangle is selected again
  await page.keyboard.press('Escape');
  await page.keyboard.press('r');
  await expect(tool(ui, 'Rectangle (R)')).toHaveAttribute('aria-checked', 'true');
  await page.keyboard.press('v');
  await expect(tool(ui, 'Select (V)')).toHaveAttribute('aria-checked', 'true');
  await page.keyboard.press('?');
  const help = ui.getByRole('dialog', { name: 'Keyboard shortcuts' });
  await expect(help).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(help).toHaveCount(0);

  // F-002 zoom and pan: zoom in (button, then Mod+=) past the work area, Space+drag moves the view (no
  // annotation made), fit again.
  const percent = async () => Number((await zoomLevel(ui).textContent())?.replace(/\D/g, ''));
  await statusBar(ui).getByRole('button', { name: 'Zoom in', exact: true }).click();
  await expect.poll(percent).toBeGreaterThan(100);
  for (let i = 0; i < 6 && (await percent()) < 200; i++) {
    const was = await percent();
    await page.keyboard.press('ControlOrMeta+=');
    await expect.poll(percent).toBeGreaterThan(was);
  }
  const zoomed = await zoomLevel(ui).textContent();
  await painted(ui);
  const before = await middleRow(ui);
  await ui.locator('main.tk-work-area').focus();
  await page.keyboard.down('Space');
  await expect(ui.locator('canvas.tk-canvas')).toHaveAttribute('data-pan', 'ready');
  await page.mouse.move(area.x + area.width / 2, area.y + 40);
  await page.mouse.down();
  await page.mouse.move(area.x + area.width / 2 - 150, area.y + 40, { steps: 6 });
  await page.mouse.up();
  await page.keyboard.up('Space');
  await expect.poll(() => middleRow(ui), PATIENT).not.toBe(before);
  await expect(zoomLevel(ui)).toHaveText(zoomed ?? '');
  await count(ui, 12);
  await statusBar(ui).getByRole('button', { name: 'Fit to view', exact: true }).click();
  await expect(zoomLevel(ui)).toHaveText(/^\d+ %$/);

  // F-011 padding (Medium = 0.06 × 800 = 48 px on every side) and F-010 crop (the frame 780 × 480 at 0, 0).
  const sizeShown = statusBar(ui).locator('.tk-status-size');
  await deselect();
  await panel(ui).getByRole('group', { name: 'Padding' }).getByRole('radio', { name: 'Medium', exact: true }).check();
  await expect(sizeShown).toHaveText('896 × 596 px');
  await tool(ui, 'Crop (C)').click();
  await expect(screen(ui)).toHaveAttribute('data-state', 'cropping');
  await setFields(ui, [0, 0, 780, 480]);
  await expect(ui.locator('.tk-crop-chip')).toHaveText('780 × 480 px');
  await tool(ui, 'Select (V)').click();
  // The padding follows the frame's longer side: 0.06 × 780 = 47 px.
  await expect(sizeShown).toHaveText('874 × 574 px');

  // F-016 privacy statement: the details open from the status bar and close with Esc.
  await statusBar(ui).getByRole('button', { name: 'Runs locally, nothing uploaded' }).click();
  const privacy = ui.getByRole('dialog', { name: 'Privacy' });
  await expect(privacy).toContainText('Your images are opened and edited only in this browser.');
  await page.keyboard.press('Escape');
  await expect(privacy).toHaveCount(0);

  // F-012 copy and download: the redaction count in the notice; the clipboard and the file hold the work.
  await toolbar(ui).getByRole('button', { name: 'Copy', exact: true }).click();
  await expect(ui.locator('.tk-notice')).toContainText('Copied, with 3 redactions applied.', PATIENT);
  const clip = expectCleanPng(await copied(ui));
  expect([clip.width, clip.height]).toEqual([874, 574]);
  const file = await download(page, () => toolbar(ui).getByRole('button', { name: 'Download', exact: true }).click());
  await expect(ui.locator('.tk-notice')).toContainText(`Downloaded ${file.name}, with 3 redactions applied.`, PATIENT);
  expect(file.name).toMatch(/^annotated-\d{8}-\d{6}\.png$/);
  const png = expectCleanPng(file.bytes);
  expect([png.width, png.height]).toEqual([874, 574]);
  expect(Array.from(clip.data)).toEqual(Array.from(png.data));
  const px = (x: number, y: number) => pngRegion(png, x + 47, y + 47, 1, 1); // image pixel → export pixel
  expect(pngRegion(png, 2, 2, 1, 1)).toEqual([0, 0, 0, 0]); // transparent padding (RULE-14)
  expect(near(px(700, 450), GREY, 2)).toBe(true); // the image itself
  expect(near(px(60, 90), BLUE)).toBe(true); // the moved, recoloured rectangle's edge (3 px at x 60)
  expect(near(px(40, 90), GREY, 2)).toBe(true); // ... no longer where it was drawn
  expect(px(120, 340)).toEqual(BLACK); // solid redaction (INV-02)
  for (const [x, y] of [
    [320, 340],
    [520, 340],
  ] as const) {
    // Blur and pixelate: the 2 px stripes are gone, mixed to mid-grey.
    const row = pngRegion(png, x + 47, y + 47, 8, 1);
    const reds = row.filter((_, i) => i % 4 === 0);
    expect(Math.max(...reds) - Math.min(...reds)).toBeLessThan(60);
    expect(reds[0]).toBeGreaterThan(40);
    expect(reds[0]).toBeLessThan(215);
  }
  expect(near(px(790, 10), [0, 0, 0, 0], 0)).toBe(true); // cropped away: padding there (x 790 > 780)

  // F-014 start over: a change after the export asks first; confirming returns to the empty state.
  await tool(ui, 'Step (N)').click();
  await click(400, 450);
  await count(ui, 13);
  await toolbar(ui).getByRole('button', { name: 'More actions' }).click();
  await ui.getByRole('menu', { name: 'More actions' }).getByRole('menuitem', { name: 'Start over' }).click();
  const confirm = ui.getByRole('alertdialog', { name: 'Start over?' });
  await expect(confirm).toBeVisible();
  await confirm.getByRole('button', { name: 'Start over' }).click();
  await expect(screen(ui)).toHaveAttribute('data-state', 'empty');
  await expect(ui.locator('.tk-empty')).toBeVisible();
  await expect(summary(ui)).toHaveCount(0);
}
