// F-005 Add text — end to end on the production build (Chromium + WebKit). Same setup as steps.spec.ts:
// a 1000 × 800 image at 100 % in a 1200 × 800 work area, so image pixel (x, y) is at (100 + x, y). Size M
// text on it is 32 px (RULE-04), with 40 px lines. What the canvas shows is compared with a reference
// drawn here in the tool's face with the RULE-08 outline, so the tests also prove position, size, colour
// and face (NFR-08); CMP-TextEditor (the transparent field) is checked for its place and value.
// Export ACs (AC6, AC7, AC14 and the export half of AC15) wait for F-012; undo (AC12) is a model test
// in tests/unit/app.text.test.ts and tests/unit/document.text.test.ts until F-009 wires Mod+Z.
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { summary } from './support/load';

const PANEL = 272;
const AREA = { width: 1200, height: 800 };
const VIEWPORT = { width: AREA.width + PANEL, height: 40 + AREA.height + 28 };
const IMAGE = { width: 1000, height: 800 };
const GREY = [200, 200, 200, 255];
const RED = '#D62828';
const WHITE = '#FFFFFF';
const BLACK = '#000000';
const SIZE = 32;
const LINE = 40;

const workArea = (page: Page) => page.locator('main.tk-work-area');
const editor = (page: Page) => page.getByRole('textbox', { name: 'Text' });
const state = (page: Page) => page.locator('[data-screen="SCR-Annotator"]');
const toolButton = (page: Page, name: string) =>
  page.getByRole('toolbar', { name: 'Tools and actions' }).getByRole('radio', { name });
const screen = (x: number, y: number) => ({ x: (AREA.width - IMAGE.width) / 2 + x, y });
const count = (n: number) => `1,000 × 800 px canvas, ${n} annotation${n === 1 ? '' : 's'}`;

async function open(page: Page, colour = GREY) {
  await page.setViewportSize(VIEWPORT);
  await page.goto('/');
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
    { ...IMAGE, grey: colour },
  );
  await expect(summary(page)).toHaveText(count(0));
  await page.locator('footer.tk-status-bar').getByRole('button', { name: 'Actual size', exact: true }).click();
  await expect(page.locator('.tk-zoom__level')).toHaveText('100 %');
}

async function at(page: Page, x: number, y: number) {
  const box = await workArea(page).boundingBox();
  if (!box) throw new Error('no work area');
  const p = screen(x, y);
  return { x: box.x + p.x, y: box.y + p.y };
}

async function clickImage(page: Page, x: number, y: number) {
  const p = await at(page, x, y);
  await page.mouse.click(p.x, p.y);
}

/** Text tool, click at image (x, y), and wait for the field. */
async function startText(page: Page, x: number, y: number) {
  await toolButton(page, 'Text (T)').click();
  await clickImage(page, x, y);
  await expect(editor(page)).toBeFocused();
}

/** Waits until the display canvas has repainted after the last change (same pixels over three frames). */
async function settled(page: Page) {
  await page.locator('canvas.tk-canvas').evaluate(async (el) => {
    const c = el as HTMLCanvasElement;
    const ctx = c.getContext('2d', { colorSpace: 'srgb' });
    const sum = () => {
      const d = ctx?.getImageData(0, 0, c.width, c.height).data ?? new Uint8ClampedArray();
      let h = 0;
      for (let i = 0; i < d.length; i += 4) h = (h * 31 + (d[i] ?? 0) + (d[i + 1] ?? 0) * 7 + (d[i + 2] ?? 0) * 13) | 0;
      return h;
    };
    const frame = () => new Promise((r) => requestAnimationFrame(() => r(null)));
    let last = sum();
    let same = 0;
    for (let i = 0; i < 120 && same < 3; i++) {
      await frame();
      const now = sum();
      same = now === last ? same + 1 : 0;
      last = now;
    }
  });
}

/**
 * How closely the display canvas around the text anchored at image (ax, ay) matches `lines` drawn here
 * over the background in `face` with the RULE-08 look (outline 2 × max(1, 0.08 × size), round joins,
 * then the fill), offset by (dx, dy) image pixels. Returns the mean difference per channel.
 */
async function textDiff(
  page: Page,
  o: {
    ax: number;
    ay: number;
    lines: string[];
    fill: string;
    outline: string;
    face?: string;
    dx?: number;
    dy?: number;
  },
  background = GREY,
) {
  const anchor = screen(o.ax, o.ay);
  return page.locator('canvas.tk-canvas').evaluate(
    (el, { anchor, o, background, size, line }) => {
      const c = el as HTMLCanvasElement;
      const k = c.width / c.getBoundingClientRect().width;
      const w = Math.round(420 * k);
      const h = Math.round((o.lines.length * line + 24) * k);
      const x0 = Math.round((anchor.x - 10) * k);
      const y0 = Math.round((anchor.y - 12) * k);
      const got = c.getContext('2d', { colorSpace: 'srgb' })?.getImageData(x0, y0, w, h).data;
      if (!got) throw new Error('no pixels');
      const ref = new OffscreenCanvas(w, h);
      const r = ref.getContext('2d', { colorSpace: 'srgb' });
      if (!r) throw new Error('no 2d context');
      r.fillStyle = `rgb(${background.slice(0, 3).join(',')})`;
      r.fillRect(0, 0, w, h);
      r.setTransform(k, 0, 0, k, anchor.x * k - x0, anchor.y * k - y0);
      r.font = o.face ?? `600 ${size}px Manrope`;
      r.textBaseline = 'alphabetic';
      r.lineJoin = 'round';
      r.miterLimit = 2;
      r.lineWidth = 2 * Math.max(1, 0.08 * size);
      r.strokeStyle = o.outline;
      r.fillStyle = o.fill;
      const base = (line - 1.366 * size) / 2 + 1.066 * size;
      o.lines.forEach((text, i) => {
        const y = (o.dy ?? 0) + i * line + base;
        r.strokeText(text, o.dx ?? 0, y);
        r.fillText(text, o.dx ?? 0, y);
      });
      const want = r.getImageData(0, 0, w, h).data;
      let diff = 0;
      for (let i = 0; i < want.length; i++) diff += Math.abs((want[i] ?? 0) - (got[i] ?? 0));
      return diff / want.length;
    },
    { anchor, o, background, size: SIZE, line: LINE },
  );
}

/** Esc on the canvas after an edit ended clears the selection (RULE-19 Esc chain), so no outline is drawn. */
async function deselect(page: Page) {
  await expect(workArea(page)).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(state(page)).not.toHaveAttribute('data-state', 'selecting');
  await settled(page);
}

/** The field's text box (its content box) in page coordinates. */
async function editorContentBox(page: Page) {
  return editor(page).evaluate((el) => {
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    const left = r.left + el.clientLeft + parseFloat(cs.paddingLeft);
    const top = r.top + el.clientTop + parseFloat(cs.paddingTop);
    return { left, top };
  });
}

test.describe('F-005 add text', () => {
  test('F-005.AC1 with the text tool a click and "Wrong total" shows at the click, in the current colour and size, while typing', async ({
    page,
  }) => {
    await open(page);
    await startText(page, 200, 150);
    await expect(state(page)).toHaveAttribute('data-state', 'editing-text');
    // CMP-TextEditor: the field's text box starts exactly at the click point.
    const click = await at(page, 200, 150);
    const box = await editorContentBox(page);
    expect(Math.abs(box.left - click.x)).toBeLessThanOrEqual(1);
    expect(Math.abs(box.top - click.y)).toBeLessThanOrEqual(1);
    await page.keyboard.type('Wrong total');
    await expect(editor(page)).toHaveValue('Wrong total');
    await settled(page);
    // While still editing, the canvas shows the final glyphs: red, size M, outlined, top-left at the click.
    const right = await textDiff(page, { ax: 200, ay: 150, lines: ['Wrong total'], fill: RED, outline: WHITE });
    const moved = await textDiff(page, { ax: 200, ay: 150, lines: ['Wrong total'], fill: RED, outline: WHITE, dx: 3 });
    const small = await textDiff(page, {
      ax: 200,
      ay: 150,
      lines: ['Wrong total'],
      fill: RED,
      outline: WHITE,
      face: '600 24px Manrope',
    });
    expect(right, 'matches the reference').toBeLessThan(1.5);
    expect(moved, '3 px off is clearly worse').toBeGreaterThan(right * 2);
    expect(small, 'another size is clearly worse').toBeGreaterThan(right * 2);
    await expect(summary(page)).toHaveText(count(0)); // not in the document until editing ends
  });

  test('F-005.AC2 Enter while editing starts a second line', async ({ page }) => {
    await open(page);
    await startText(page, 200, 150);
    await page.keyboard.type('Wrong total');
    await page.keyboard.press('Enter');
    await page.keyboard.type('is $118');
    await expect(editor(page)).toHaveValue('Wrong total\nis $118');
    await settled(page);
    const diff = await textDiff(page, {
      ax: 200,
      ay: 150,
      lines: ['Wrong total', 'is $118'],
      fill: RED,
      outline: WHITE,
    });
    expect(diff).toBeLessThan(1.5);
    // The field grew to two lines (it never scrolls inside, ADR-0020).
    const scroll = await editor(page).evaluate((el) => ({ top: el.scrollTop, h: el.scrollHeight - el.clientHeight }));
    expect(scroll.top).toBe(0);
    expect(scroll.h).toBeLessThanOrEqual(0);
  });

  test('F-005.AC3 Esc ends editing; the text stays, is selected, and focus returns to the canvas', async ({ page }) => {
    await open(page);
    await startText(page, 200, 150);
    await page.keyboard.type('Bug');
    await page.keyboard.press('Escape');
    await expect(editor(page)).toBeHidden();
    await expect(summary(page)).toHaveText(count(1));
    await expect(state(page)).toHaveAttribute('data-state', 'selecting');
    await expect(workArea(page)).toBeFocused();
    await expect(toolButton(page, 'Text (T)')).toBeChecked();
    await expect(page.locator('[role="status"]')).toContainText('Text added');
  });

  test('F-005.AC4 a text placed with nothing typed is gone after a click elsewhere', async ({ page }) => {
    await open(page);
    await startText(page, 200, 150);
    await clickImage(page, 600, 500);
    await expect(editor(page)).toBeHidden();
    await expect(summary(page)).toHaveText(count(0));
    await expect(state(page)).toHaveAttribute('data-state', 'default');
  });

  test('F-005.AC5 with the select tool, a double-click on the selected text edits it with the caret where clicked', async ({
    page,
  }) => {
    await open(page);
    await startText(page, 200, 150);
    await page.keyboard.type('abcdef');
    await page.keyboard.press('Escape');
    await expect(state(page)).toHaveAttribute('data-state', 'selecting');
    await page.keyboard.press('v');
    await expect(toolButton(page, 'Select (V)')).toBeChecked();
    // Between "abc" and "def": the measured width of "abc" in the tool's face.
    const abc = await page.evaluate(() => {
      const c = new OffscreenCanvas(1, 1).getContext('2d');
      if (!c) throw new Error('no 2d context');
      c.font = '600 32px Manrope';
      return c.measureText('abc').width;
    });
    const p = await at(page, 200 + abc, 150 + 20);
    await page.mouse.dblclick(p.x, p.y);
    await expect(editor(page)).toBeFocused();
    await expect(editor(page)).toHaveValue('abcdef');
    expect(await editor(page).evaluate((el) => (el as HTMLTextAreaElement).selectionStart)).toBe(3);
    await page.keyboard.type('X');
    await page.keyboard.press('Escape');
    await expect(summary(page)).toHaveText(count(1));
    await deselect(page);
    expect(await textDiff(page, { ax: 200, ay: 150, lines: ['abcXdef'], fill: RED, outline: WHITE })).toBeLessThan(1.5);
  });

  test('F-005.R4 with the select tool, Enter on the one selected text edits it', async ({ page }) => {
    await open(page);
    await startText(page, 200, 150);
    await page.keyboard.type('Bug');
    await page.keyboard.press('Escape');
    await page.keyboard.press('v');
    await page.keyboard.press('Enter');
    await expect(editor(page)).toBeFocused();
    await expect(editor(page)).toHaveValue('Bug');
  });

  test('F-005.AC8 the 2,001st character is not accepted; a 3,000-character insert keeps the first 2,000', async ({
    page,
  }) => {
    await open(page);
    await startText(page, 20, 20);
    await page.keyboard.insertText('y'.repeat(3000));
    await expect(editor(page)).toHaveValue('y'.repeat(2000));
    await page.keyboard.type('z');
    await expect(editor(page)).toHaveValue('y'.repeat(2000));
  });

  test('F-005.AC8 RULE-08 a paste of 3,000 characters into an empty text keeps the first 2,000', async ({
    page,
    browserName,
    context,
  }) => {
    test.skip(browserName !== 'chromium', 'a real clipboard paste is automated on Chromium only');
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await open(page);
    await startText(page, 20, 20);
    await page.evaluate((s) => navigator.clipboard.writeText(s), 'p'.repeat(3000));
    await page.keyboard.press('ControlOrMeta+V');
    await expect(editor(page)).toHaveValue('p'.repeat(2000));
    await expect(summary(page)).toHaveText(count(0)); // a paste while editing never loads an image
  });

  test('F-005.AC9 Backspace, Delete, arrows and Mod+A edit the text; the annotation is neither deleted nor moved', async ({
    page,
  }) => {
    await open(page);
    await startText(page, 200, 150);
    await page.keyboard.type('Bug');
    await page.keyboard.press('Escape');
    await clickImage(page, 210, 160); // the text tool on the text edits it (caret where clicked)
    await expect(editor(page)).toBeFocused();
    await page.keyboard.press('ArrowDown'); // the end of the (last) line;
    await page.keyboard.press('Backspace');
    await expect(editor(page)).toHaveValue('Bu');
    await page.keyboard.press('ArrowLeft');
    await page.keyboard.press('Delete');
    await expect(editor(page)).toHaveValue('B');
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('ControlOrMeta+A');
    await page.keyboard.type('Fix');
    await expect(editor(page)).toHaveValue('Fix');
    await expect(editor(page)).toBeFocused();
    await expect(summary(page)).toHaveText(count(1));
    const box = await editorContentBox(page);
    const anchor = await at(page, 200, 150);
    expect(Math.abs(box.left - anchor.x)).toBeLessThanOrEqual(1);
    expect(Math.abs(box.top - anchor.y)).toBeLessThanOrEqual(1);
    await page.keyboard.press('Escape');
    await expect(summary(page)).toHaveText(count(1));
  });

  test('F-005.AC10 a click on empty canvas while editing only ends the edit; a second click creates a text', async ({
    page,
  }) => {
    await open(page);
    await startText(page, 200, 150);
    await page.keyboard.type('One');
    await clickImage(page, 600, 500);
    await expect(editor(page)).toBeHidden();
    await expect(summary(page)).toHaveText(count(1));
    await expect(state(page)).toHaveAttribute('data-state', 'selecting');
    await clickImage(page, 600, 500);
    await expect(editor(page)).toBeFocused();
    await page.keyboard.type('Two');
    await page.keyboard.press('Escape');
    await expect(summary(page)).toHaveText(count(2));
  });

  test('F-005.AC11 with the text tool, a click on an existing text edits it instead of creating one', async ({
    page,
  }) => {
    await open(page);
    await startText(page, 200, 150);
    await page.keyboard.type('Bug');
    await page.keyboard.press('Escape');
    await clickImage(page, 215, 165);
    await expect(editor(page)).toBeFocused();
    await expect(editor(page)).toHaveValue('Bug');
    await page.keyboard.press('ArrowDown'); // the end of the (last) line;
    await page.keyboard.type('s');
    await page.keyboard.press('Escape');
    await expect(summary(page)).toHaveText(count(1));
    await deselect(page);
    expect(await textDiff(page, { ax: 200, ay: 150, lines: ['Bugs'], fill: RED, outline: WHITE })).toBeLessThan(1.5);
  });

  test('F-005.AC13 with the text tool and canvas focus, Enter starts a text at the centre of the view', async ({
    page,
  }) => {
    await open(page);
    await toolButton(page, 'Text (T)').click();
    await workArea(page).focus();
    await page.keyboard.press('Enter');
    await expect(editor(page)).toBeFocused();
    await expect(editor(page)).toHaveValue('');
    // The view's centre is the work area's (600, 400): image (500, 400) at 100 %.
    const centre = await at(page, 500, 400);
    const box = await editorContentBox(page);
    expect(Math.abs(box.left - centre.x)).toBeLessThanOrEqual(1);
    expect(Math.abs(box.top - centre.y)).toBeLessThanOrEqual(1);
  });

  test('F-005.AC15 decomposed "Đường" is kept as 5 characters; at 1,999, e + U+0302 + U+0301 is kept as "ế"', async ({
    page,
  }) => {
    await open(page);
    await startText(page, 200, 150);
    await page.keyboard.insertText('Đường');
    await expect(editor(page)).toHaveValue('Đường');
    expect(await editor(page).evaluate((el) => Array.from((el as HTMLTextAreaElement).value).length)).toBe(5);
    await settled(page);
    // On screen every letter is in the tool's face (compared with a fallback face).
    const face = await textDiff(page, { ax: 200, ay: 150, lines: ['Đường'], fill: RED, outline: WHITE });
    const fallback = await textDiff(page, {
      ax: 200,
      ay: 150,
      lines: ['Đường'],
      fill: RED,
      outline: WHITE,
      face: `600 ${SIZE}px serif`,
    });
    expect(face).toBeLessThan(1.5);
    expect(fallback).toBeGreaterThan(face * 2);
    await page.keyboard.press(`Escape`);
    await clickImage(page, 20, 600);
    await expect(editor(page)).toBeFocused();
    await page.keyboard.insertText('a'.repeat(1999));
    await page.keyboard.insertText('ế');
    const value = await editor(page).evaluate((el) => (el as HTMLTextAreaElement).value);
    expect(value.endsWith('ế')).toBe(true);
    expect(Array.from(value)).toHaveLength(2000);
  });

  test('ADR-0020 an accent typed after a letter composes with it', async ({ page }) => {
    await open(page);
    await startText(page, 200, 150);
    await page.keyboard.insertText('Tie');
    await page.keyboard.insertText('̂');
    await page.keyboard.insertText('́');
    await expect(editor(page)).toHaveValue('Tiế');
  });

  test('RULE-08 white text on a white area shows a black outline on screen', async ({ page }) => {
    await open(page, [255, 255, 255, 255]);
    await toolButton(page, 'Text (T)').click();
    await page.getByRole('complementary', { name: 'Style' }).getByRole('radio', { name: 'White', exact: true }).check();
    await clickImage(page, 200, 150);
    await expect(editor(page)).toBeFocused();
    await page.keyboard.type('HELLO');
    await page.keyboard.press('Escape');
    await deselect(page);
    const diff = await textDiff(
      page,
      { ax: 200, ay: 150, lines: ['HELLO'], fill: WHITE, outline: BLACK },
      [255, 255, 255, 255],
    );
    expect(diff).toBeLessThan(1.5);
    // The vertical stroke of the H, outlined on both sides: dark pixels left of the first stem.
    const dark = await page.locator('canvas.tk-canvas').evaluate(
      (el, p) => {
        const c = el as HTMLCanvasElement;
        const k = c.width / c.getBoundingClientRect().width;
        const d = c
          .getContext('2d')
          ?.getImageData(Math.round(p.x * k), Math.round(p.y * k), Math.round(30 * k), 1).data;
        let n = 0;
        for (let i = 0; d && i < d.length; i += 4) if ((d[i] ?? 255) < 80) n++;
        return n / k;
      },
      { x: screen(196, 0).x, y: screen(0, 150 + 20).y },
    );
    expect(dark).toBeGreaterThanOrEqual(2);
  });

  test('SCR-Annotator editing-text a colour picked in the style panel applies to the edited text; editing goes on', async ({
    page,
    browserName,
  }) => {
    await open(page);
    await startText(page, 200, 150);
    await page.keyboard.type('Hi');
    const blue = page.getByRole('complementary', { name: 'Style' }).getByRole('radio', { name: 'Blue', exact: true });
    await blue.click();
    await expect(blue).toBeChecked();
    await expect(editor(page)).toBeFocused();
    await expect(state(page)).toHaveAttribute('data-state', 'editing-text');
    await page.keyboard.type('!');
    await expect(editor(page)).toHaveValue('Hi!');
    await settled(page);
    expect(await textDiff(page, { ax: 200, ay: 150, lines: ['Hi!'], fill: '#0B63E5', outline: WHITE })).toBeLessThan(
      1.5,
    );
    // Keyboard users reach the panel with Shift+Tab and the edit stays open (WebKit's default Tab order
    // skips radio buttons, so this part runs on Chromium).
    if (browserName === 'chromium') {
      await page.keyboard.press('Shift+Tab');
      await expect(page.getByRole('complementary', { name: 'Style' }).locator(':focus')).toHaveCount(1);
      await expect(state(page)).toHaveAttribute('data-state', 'editing-text');
      await expect(editor(page)).toBeVisible();
    }
    // Focus leaving for the status bar ends the edit, keeping the text.
    await editor(page).focus();
    await page.locator('footer.tk-status-bar').getByRole('button', { name: 'Actual size', exact: true }).focus();
    await expect(editor(page)).toBeHidden();
    await expect(summary(page)).toHaveText(count(1));
  });

  test('F-005.R3 RULE-19 with focus moved from the text into the style panel, focus going on ends the edit', async ({
    page,
    browserName,
  }) => {
    test.skip(browserName !== 'chromium', 'WebKit’s default Tab order skips the panel’s radio buttons');
    await open(page);
    await startText(page, 200, 150);
    await page.keyboard.type('Bug');
    await page.keyboard.press('Shift+Tab'); // into the panel: the edit stays open
    await expect(page.getByRole('complementary', { name: 'Style' }).locator(':focus')).toHaveCount(1);
    await expect(state(page)).toHaveAttribute('data-state', 'editing-text');
    // On through the panel's groups to the toolbar: the edit ends there, the text is kept.
    const panelFocus = page.getByRole('complementary', { name: 'Style' }).locator(':focus');
    for (let i = 0; i < 4 && (await panelFocus.count()) > 0; i++) {
      await expect(state(page)).toHaveAttribute('data-state', 'editing-text');
      await page.keyboard.press('Shift+Tab');
    }
    await expect(page.getByRole('toolbar', { name: 'Tools and actions' }).locator(':focus')).toHaveCount(1);
    await expect(editor(page)).toBeHidden();
    await expect(summary(page)).toHaveText(count(1));
    await expect(state(page)).toHaveAttribute('data-state', 'selecting');
    // The canvas is a Tab stop again.
    await expect(workArea(page)).toHaveAttribute('tabindex', '0');
  });

  test('F-005.R3 RULE-19 Esc with focus in the style panel ends the edit and returns focus to the canvas', async ({
    page,
  }) => {
    await open(page);
    await startText(page, 200, 150);
    await page.keyboard.type('Bug');
    await page.getByRole('complementary', { name: 'Style' }).getByRole('radio', { name: 'Blue', exact: true }).focus();
    await expect(state(page)).toHaveAttribute('data-state', 'editing-text');
    await page.keyboard.press('Escape');
    await expect(editor(page)).toBeHidden();
    await expect(summary(page)).toHaveText(count(1));
    await expect(workArea(page)).toBeFocused();
    await expect(workArea(page)).toHaveAttribute('tabindex', '0');
  });

  test('F-005.AC16 with the text tool a click outside the canvas creates nothing and edits nothing', async ({
    page,
  }) => {
    await open(page);
    await toolButton(page, 'Text (T)').click();
    // At 100 % the 1000 px image is centred in the 1200 px work area: x < 0 is the surround.
    await clickImage(page, -50, 300);
    await clickImage(page, 1050, 300);
    await expect(editor(page)).toBeHidden();
    await expect(summary(page)).toHaveText(count(0));
    await expect(state(page)).toHaveAttribute('data-state', 'default');
  });

  test('F-005.AC15 a clipboard paste of decomposed "Đường" is kept composed, as 5 characters', async ({
    page,
    browserName,
    context,
  }) => {
    test.skip(browserName !== 'chromium', 'a real clipboard paste is automated on Chromium only');
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await open(page);
    await startText(page, 200, 150);
    await page.evaluate((s) => navigator.clipboard.writeText(s), '\u0110u\u031bo\u031b\u0300ng');
    await page.keyboard.press('ControlOrMeta+V');
    await expect(editor(page)).toHaveValue('Đường');
    expect(await editor(page).evaluate((el) => Array.from((el as HTMLTextAreaElement).value).length)).toBe(5);
  });

  test('ADR-0009 §3 ADR-0020 input-method text is composed (NFC) and kept within 2,000 at compositionend', async ({
    page,
    browserName,
  }) => {
    test.skip(
      browserName !== 'chromium',
      'input methods are automated through CDP on Chromium only (WebKit: manual QA)',
    );
    await open(page);
    await startText(page, 200, 150);
    const cdp = await page.context().newCDPSession(page);
    const compose = async (text: string) => {
      await cdp.send('Input.imeSetComposition', { text, selectionStart: text.length, selectionEnd: text.length });
      await cdp.send('Input.insertText', { text });
    };
    await compose('Tie\u0302\u0301');
    await expect(editor(page)).toHaveValue('Tiế');
    await page.keyboard.press('ControlOrMeta+A');
    await page.keyboard.insertText('a'.repeat(1999));
    await compose('xyz');
    const value = await editor(page).evaluate((el) => (el as HTMLTextAreaElement).value);
    expect(Array.from(value)).toHaveLength(2000);
    expect(value.endsWith('ax')).toBe(true);
  });

  // Export (F-012) is not built: these turn on with it.
  test.fixme('F-005.AC6 white text on a white area exports with a black outline at least 1 pixel wide (needs F-012)', async () => {});
  test.fixme('F-005.AC7 an exported text matches the 100 % view in position, line breaks and size within 2 pixels (needs F-012)', async () => {});
  test.fixme('F-005.AC14 "Đường dẫn lỗi" downloads with every letter and diacritic in the tool’s face (needs F-012)', async () => {});
  test.fixme('F-005.AC15 decomposed "Đường" exports with every letter in the tool’s face (export half, needs F-012)', async () => {});

  test('NFR-06 axe finds no violations while a text is edited', async ({ page }) => {
    await open(page);
    await startText(page, 200, 150);
    await page.keyboard.type('Bug');
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
      .analyze();
    expect(results.violations).toEqual([]);
  });
});
