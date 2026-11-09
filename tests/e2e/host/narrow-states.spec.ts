// F-018.AC7 (R7, NFR-07): in vi-VN, with the tool 320 px wide in the stub host, every SCR-Annotator state
// in turn — empty (with and without focus), dragging-file, loading, the loaded and error notices, the
// scale-down offer; default with each tool, the narrow style sheet for each, canvas-settings, selecting
// (one and several), editing-text, cropping; the zoom menu, More actions, keyboard shortcuts, privacy and
// the clear and replace confirmations; the redaction count, copied, downloaded, exporting, export failed
// and the clipboard error. In each: no horizontal scrollbar (the document, the app root, or any other
// sideways scroller besides the tools strip, which CMP-Toolbar narrow makes scroll on purpose) and no
// visible control label clipped. F-017 offline use has no visible UI, so it is not a state here.
// Slow steps (decoding, exporting) are held open by a gate in the page, never by sleeping.
// Set SCREENS=1 to save a screenshot of each state in .build-my-app/reports/screens/F-018/.
import { expect as baseExpect, test, type Frame, type Page } from '@playwright/test';
import { CATALOG } from '../../../src/copy/messages.gen';
import { download } from '../support/export';
import { dragOver, drop, fixture, paste } from '../support/load';
import { HOST_ALLOWED, TOOL_ALLOWED, hostPageUrl } from '../support/urls';
import { toolFrame } from './support';

// Generous waits for every step: these long walks must hold under a fully loaded machine (no sleeps).
const expect = baseExpect.configure({ timeout: 15_000 });

const VI = CATALOG['vi-VN'] as Record<string, string | { other: string }>;
/** The vi-VN text of a COPY ID (vi-VN has one plural form), with its placeholders filled. */
const vi = (id: string, params: Record<string, string | number> = {}) => {
  const raw = VI[id];
  const text = typeof raw === 'string' ? raw : (raw?.other ?? id);
  return text.replace(/\{(\w+)\}/g, (_, k: string) => String(params[k] ?? `{${k}}`));
};
const PATIENT = { timeout: 20_000 };
const WIDTH = 320;

type Gate = { hold: { decode: boolean; export: boolean }; fail: boolean; refuse: boolean; release: () => void };
const gate = (frame: Frame, set: Partial<Pick<Gate, 'fail' | 'refuse'>> & { decode?: boolean; export?: boolean }) =>
  frame.evaluate((s) => {
    const g = (window as unknown as { __gate: Gate }).__gate;
    if (s.decode !== undefined) g.hold.decode = s.decode;
    if (s.export !== undefined) g.hold.export = s.export;
    if (s.fail !== undefined) g.fail = s.fail;
    if (s.refuse !== undefined) g.refuse = s.refuse;
  }, set);
const release = (frame: Frame) => frame.evaluate(() => (window as unknown as { __gate: Gate }).__gate.release());

/**
 * Opens the stub host in vi-VN with the tool frame 320 px wide. In the tool: decoding
 * (createImageBitmap) and exporting (canvas toBlob) can be held until released or made to fail, and the
 * clipboard accepts the image once it is ready, or refuses it.
 */
async function open(page: Page, opts: { focus?: boolean } = {}): Promise<Frame> {
  await page.addInitScript((tool) => {
    if (location.origin !== tool) return;
    const waiting: (() => void)[] = [];
    const g: Gate = {
      hold: { decode: false, export: false },
      fail: false,
      refuse: false,
      release: () => {
        g.hold.decode = g.hold.export = false;
        for (const go of waiting.splice(0)) go();
      },
    };
    (window as unknown as { __gate: Gate }).__gate = g;
    const wait = () => new Promise<void>((r) => waiting.push(r));
    const decode = window.createImageBitmap.bind(window) as (...a: unknown[]) => Promise<ImageBitmap>;
    (window as unknown as { createImageBitmap: unknown }).createImageBitmap = (...a: unknown[]) =>
      g.hold.decode ? wait().then(() => decode(...a)) : decode(...a);
    const toBlob = HTMLCanvasElement.prototype.toBlob;
    HTMLCanvasElement.prototype.toBlob = function (this: HTMLCanvasElement, cb, ...rest) {
      if (g.fail) return void setTimeout(() => cb(null));
      if (g.hold.export) return void wait().then(() => toBlob.call(this, cb, ...rest));
      return toBlob.call(this, cb, ...rest);
    };
    if (navigator.clipboard)
      navigator.clipboard.write = async (items: ClipboardItem[]) => {
        if (g.refuse) throw new DOMException('Write permission denied.', 'NotAllowedError');
        await items[0]?.getType('image/png');
      };
  }, TOOL_ALLOWED);
  await page.setViewportSize({ width: 400, height: 760 });
  const url = hostPageUrl(HOST_ALLOWED, TOOL_ALLOWED, 'light', 'vi-VN');
  await page.goto(opts.focus === false ? `${url}&focus=0` : url);
  const frame = await toolFrame(page);
  await page.evaluate(
    (w) => (window as unknown as { __resizeTool: (w: number, h: number) => void }).__resizeTool(w, 640),
    WIDTH,
  );
  await expect.poll(() => frame.evaluate(() => innerWidth)).toBe(WIDTH);
  await expect(page.frameLocator('#tool').locator('html')).toHaveAttribute('lang', 'vi-VN');
  return frame;
}

/**
 * F-018.AC7's check for the state on screen: nothing scrolls sideways, and no visible control's label is
 * cut off — neither by its own box or a box inside it (scrollWidth / scrollHeight beyond the client size
 * where overflow clips, including any ellipsis, which no spec allows), nor drawn outside the control, nor
 * the control itself cut off by a clipping (non-scrolling) container.
 */
async function expectFits(page: Page, frame: Frame, state: string): Promise<void> {
  await frame.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r(null)))));
  const problems = await frame.evaluate(() => {
    const out = new Set<string>();
    const sideways = (el: Element, what: string) => {
      if (el.scrollWidth > el.clientWidth) out.add(`${what} scrolls sideways (${el.scrollWidth} > ${el.clientWidth})`);
    };
    sideways(document.documentElement, 'the document');
    sideways(document.body, 'the body');
    const root = document.querySelector('[data-screen="SCR-Annotator"]');
    if (!root) return ['no app root'];
    sideways(root, 'the app root');
    const visible = (el: Element) =>
      el.checkVisibility
        ? el.checkVisibility({ visibilityProperty: true, opacityProperty: true })
        : el.getClientRects().length > 0;
    const describe = (el: Element) =>
      `${el.tagName.toLowerCase()}${el.className && typeof el.className === 'string' ? '.' + el.className.trim().split(/\s+/).join('.') : ''}`;
    const scrolls = (v: string) => v === 'auto' || v === 'scroll';
    for (const el of Array.from(root.querySelectorAll('*'))) {
      if (!visible(el) || el.matches('.tk-tools__strip')) continue;
      const cs = getComputedStyle(el);
      if (scrolls(cs.overflowX) && el.scrollWidth > el.clientWidth + 1)
        out.add(`${describe(el)} scrolls sideways (${el.scrollWidth} > ${el.clientWidth})`);
    }
    const controls = root.querySelectorAll(
      'button, a[href], label, legend, summary, [role="radio"], [role="menuitem"], [role="option"], [role="tab"], [role="checkbox"]',
    );
    /** Text for assistive technology only (`.tk-sr`, or clipped to a 1 px box like the narrow labels). */
    const srOnly = (el: Element) => {
      for (let e: Element | null = el; e && e !== root; e = e.parentElement) {
        if (e.matches('.tk-sr')) return true;
        const cs = getComputedStyle(e);
        const r = e.getBoundingClientRect();
        if (cs.clipPath === 'inset(50%)' || (cs.overflow !== 'visible' && (r.width <= 1 || r.height <= 1))) return true;
      }
      return false;
    };
    for (const c of Array.from(controls)) {
      if (!visible(c) || srOnly(c)) continue;
      const box = c.getBoundingClientRect();
      if (box.width < 2 || box.height < 2) continue;
      const name = (c.getAttribute('aria-label') ?? c.textContent ?? '').trim().slice(0, 60);
      const texts: Text[] = [];
      const walker = document.createTreeWalker(c, NodeFilter.SHOW_TEXT);
      for (let n = walker.nextNode(); n; n = walker.nextNode()) {
        const el = n.parentElement;
        if ((n.textContent ?? '').trim() && el && visible(el) && !srOnly(el)) texts.push(n as Text);
      }
      // Icon-only controls have no visible label (their names are tooltips and accessible names).
      if (!texts.length) continue;
      // The control cut off by a container that clips it without scrolling (a scroller, such as the
      // style sheet, brings the rest into view; the walk stops there).
      for (let a = c.parentElement; a && a !== document.body; a = a.parentElement) {
        const cs = getComputedStyle(a);
        if (scrolls(cs.overflowX) || scrolls(cs.overflowY)) break;
        const r = a.getBoundingClientRect();
        if (['hidden', 'clip'].includes(cs.overflowX) && (box.left < r.left - 1 || box.right > r.right + 1))
          out.add(`"${name}" (${describe(c)}) cut off sideways by ${describe(a)}`);
        if (['hidden', 'clip'].includes(cs.overflowY) && (box.top < r.top - 1 || box.bottom > r.bottom + 1))
          out.add(`"${name}" (${describe(c)}) cut off vertically by ${describe(a)}`);
      }
      for (const n of texts) {
        const text = (n.textContent ?? '').trim();
        // Clipped by its own box, or by any box between it and the control (an ellipsis included).
        for (let e: Element | null = n.parentElement; e && c.contains(e); e = e.parentElement) {
          const cs = getComputedStyle(e);
          if (cs.display === 'inline') continue;
          if (cs.overflowX !== 'visible' && e.scrollWidth > e.clientWidth + 1)
            out.add(`"${text}" in "${name}" cut off sideways (${e.scrollWidth} > ${e.clientWidth}, ${describe(e)})`);
          if (cs.overflowY !== 'visible' && e.scrollHeight > e.clientHeight + 1)
            out.add(
              `"${text}" in "${name}" cut off vertically (${e.scrollHeight} > ${e.clientHeight}, ${describe(e)})`,
            );
        }
        // Drawn outside the control (overflowing it visibly).
        const range = document.createRange();
        range.selectNodeContents(n);
        for (const r of Array.from(range.getClientRects()))
          if (
            r.width > 0 &&
            (r.left < box.left - 1 || r.right > box.right + 1 || r.top < box.top - 1 || r.bottom > box.bottom + 1)
          )
            out.add(`"${text}" overflows "${name}" (${describe(c)})`);
      }
    }
    return [...out];
  });
  if (process.env['SCREENS'])
    await page.locator('#tool').screenshot({ path: `.build-my-app/reports/screens/F-018/AC7-${state}.png` });
  expect(problems, `F-018.AC7 state "${state}"`).toEqual([]);
}

const ui = (page: Page) => page.frameLocator('#tool');
const screen = (page: Page) => ui(page).locator('[data-screen="SCR-Annotator"]');
const notice = (page: Page) => ui(page).locator('.tk-notice');
const toolRadio = (page: Page, id: string, key: string) =>
  ui(page).getByRole('radio', { name: vi('tool.shortcut_hint', { tool: vi(id), key }) });
const sheetBar = (page: Page) => ui(page).getByRole('button', { name: new RegExp(`^${vi('style.sheet_toggle')}:`) });
const more = (page: Page) => ui(page).getByRole('button', { name: vi('action.more'), exact: true });
const menu = (page: Page) => ui(page).getByRole('menu', { name: vi('action.more') });
const count = (page: Page, n: number) =>
  expect(ui(page).locator('#tk-canvas-summary')).toHaveText(new RegExp(`, ${n} chú thích$`), PATIENT);

/** Pastes a generated 640 × 400 screenshot. */
async function pasteShot(frame: Frame, name = 'shot.png') {
  await frame.evaluate(async (name) => {
    const c = new OffscreenCanvas(640, 400);
    const ctx = c.getContext('2d');
    if (!ctx) throw new Error('no 2d context');
    ctx.fillStyle = '#c8c8c8';
    ctx.fillRect(0, 0, 640, 400);
    ctx.fillStyle = '#334';
    ctx.fillRect(40, 40, 300, 60);
    const dt = new DataTransfer();
    dt.items.add(new File([await c.convertToBlob({ type: 'image/png' })], name, { type: 'image/png' }));
    (document.activeElement ?? document).dispatchEvent(
      new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }),
    );
  }, name);
}

/** The work area's box, in page coordinates. */
async function workArea(page: Page) {
  const box = await ui(page).locator('main.tk-work-area').boundingBox();
  if (!box) throw new Error('no work area');
  return box;
}

/** Drags between points given from the work area's centre (where the fitted image is). */
async function drag(page: Page, from: [number, number], to: [number, number]) {
  const a = await workArea(page);
  const cx = a.x + a.width / 2;
  const cy = a.y + a.height / 2;
  await page.mouse.move(cx + from[0], cy + from[1]);
  await page.mouse.down();
  await page.mouse.move(cx + to[0], cy + to[1], { steps: 6 });
  await page.mouse.up();
}

async function toggleSheet(page: Page, open: boolean) {
  await sheetBar(page).click();
  await expect(sheetBar(page)).toHaveAttribute('aria-expanded', String(open));
}

test.describe('F-018.AC7 vi-VN at 320 px wide: every SCR-Annotator state fits', () => {
  test.slow();

  test('F-018.AC7 F-018.R7 empty, dragging-file, loading, the loaded and error notices and the scale-down offer', async ({
    page,
  }) => {
    const frame = await open(page, { focus: false });
    await expect(screen(page)).toHaveAttribute('data-state', 'empty');
    await expect(ui(page).locator('.tk-empty')).toHaveAttribute('data-variant', 'unfocused');
    await expectFits(page, frame, 'empty-unfocused');
    await ui(page).locator('.tk-empty').click();
    await expect(ui(page).locator('.tk-empty')).toHaveAttribute('data-variant', 'default');
    await expectFits(page, frame, 'empty');

    const drag = await dragOver(frame, [fixture('fmt.png', 'image/png')]);
    await expect(ui(page).locator('main').getByText(vi('load.drop_here'), { exact: true })).toBeVisible();
    await expectFits(page, frame, 'dragging-file');
    await drag.leave();
    await expect(ui(page).locator('main').getByText(vi('load.drop_here'), { exact: true })).toHaveCount(0);

    await gate(frame, { decode: true });
    await paste(frame, [fixture('fmt.png', 'image/png')]);
    await expect(notice(page)).toContainText(vi('load.loading'), PATIENT);
    await expectFits(page, frame, 'loading');
    await release(frame);
    await count(page, 0);
    await expectFits(page, frame, 'default-loaded');

    await drop(frame, [
      { name: 'report.pdf', type: 'application/pdf', bytes: Array.from('%PDF-1.7\n', (c) => c.charCodeAt(0)) },
    ]);
    await expect(screen(page)).toHaveAttribute('data-state', 'error');
    await expect(notice(page)).toContainText(vi('error.unsupported_format').split('{')[0]!);
    await expectFits(page, frame, 'error-unsupported');
    await drop(frame, [fixture('broken.png', 'image/png')]);
    await expect(notice(page)).toContainText(vi('error.decode_failed'));
    await expectFits(page, frame, 'error-decode');
    await drop(frame, [{ name: 'huge.png', type: 'image/png', size: 60_000_000, prefix: [137, 80, 78, 71] }]);
    await expect(notice(page)).toContainText(vi('error.file_too_large', { limit: '50 MB' }));
    await expectFits(page, frame, 'error-too-large');

    await drop(frame, [fixture('fmt.bmp', 'image/bmp'), fixture('fmt.png', 'image/png')]);
    await expect(notice(page)).toContainText(vi('load.first_only'), PATIENT);
    await expectFits(page, frame, 'notice-first-only');

    await paste(frame, [fixture('large-6000x3400.png', 'image/png')]);
    const offer = ui(page).getByRole('alertdialog', { name: vi('load.scale_down_title') });
    await expect(offer).toBeVisible(PATIENT);
    await expectFits(page, frame, 'dialog-scale-down');
    await offer.getByRole('button', { name: vi('action.cancel') }).click();
    await expect(offer).toHaveCount(0);
  });

  test('F-018.AC7 F-018.R7 each tool, the narrow style sheet, canvas-settings, selecting, editing-text, cropping and the zoom menu', async ({
    page,
  }) => {
    const frame = await open(page);
    await pasteShot(frame);
    await count(page, 0);
    await expect(screen(page)).toHaveAttribute('data-state', 'canvas-settings');
    await expectFits(page, frame, 'canvas-settings');
    await toggleSheet(page, true);
    await expectFits(page, frame, 'canvas-settings-sheet');
    await toggleSheet(page, false);

    const tools: [string, string][] = [
      ['tool.rectangle', 'R'],
      ['tool.ellipse', 'O'],
      ['tool.line', 'L'],
      ['tool.arrow', 'A'],
      ['tool.pen', 'P'],
      ['tool.highlight', 'H'],
      ['tool.text', 'T'],
      ['tool.step', 'N'],
      ['tool.redact', 'X'],
      ['tool.crop', 'C'],
      ['tool.select', 'V'],
    ];
    for (const [id, key] of tools) {
      const name = id.split('.')[1]!;
      await toolRadio(page, id, key).click();
      await expect(toolRadio(page, id, key)).toHaveAttribute('aria-checked', 'true');
      await expectFits(page, frame, `tool-${name}`);
      await toggleSheet(page, true);
      await expectFits(page, frame, `tool-${name}-sheet`);
      if (id === 'tool.redact') {
        const kinds = ui(page).getByRole('group', { name: vi('redact.kind') });
        for (const kind of ['redact.blur', 'redact.pixelate']) {
          await kinds.getByRole('radio', { name: new RegExp(`^${vi(kind)}`) }).check();
          await expect(ui(page).getByText(vi('redact.not_secure'))).toBeVisible();
          await expectFits(page, frame, `tool-redact-${kind.split('.')[1]}-sheet`);
        }
        await ui(page)
          .getByRole('button', { name: vi('redact.use_solid') })
          .click();
        await expect(
          kinds.getByRole('radio', { name: new RegExp(`^${vi('redact.solid').replace(/[()]/g, '\\$&')}`) }),
        ).toBeChecked();
      }
      await toggleSheet(page, false);
    }

    // selecting: one rectangle (with its position and size fields in the sheet), then several.
    await toolRadio(page, 'tool.rectangle', 'R').click();
    await drag(page, [-100, -50], [0, 0]);
    await count(page, 1);
    await expect(screen(page)).toHaveAttribute('data-state', 'selecting');
    await expectFits(page, frame, 'selecting');
    await toggleSheet(page, true);
    await expect(ui(page).getByRole('group', { name: vi('geometry.title') })).toBeVisible();
    await expectFits(page, frame, 'selecting-sheet');
    await toggleSheet(page, false);
    await toolRadio(page, 'tool.arrow', 'A').click();
    await drag(page, [10, 10], [100, 50]);
    await count(page, 2);
    await toggleSheet(page, true);
    await expect(ui(page).getByRole('group', { name: vi('geometry.start') })).toBeVisible();
    await expectFits(page, frame, 'selecting-arrow-sheet');
    await toggleSheet(page, false);
    await ui(page).locator('main.tk-work-area').focus();
    await page.keyboard.press('ControlOrMeta+a');
    await expect(sheetBar(page)).toContainText(vi('a11y.selected_count', { count: 2 }));
    await expectFits(page, frame, 'selecting-several');
    await toggleSheet(page, true);
    await expectFits(page, frame, 'selecting-several-sheet');
    await toggleSheet(page, false);
    await page.keyboard.press('Escape');

    // editing-text.
    await toolRadio(page, 'tool.text', 'T').click();
    const area = await workArea(page);
    await page.mouse.click(area.x + area.width / 2 - 110, area.y + area.height / 2 + 30);
    const editor = ui(page).getByRole('textbox', { name: vi('tool.text') });
    await expect(editor).toBeFocused();
    await expectFits(page, frame, 'editing-text-empty');
    await page.keyboard.insertText('Đường dẫn lỗi');
    await expect(screen(page)).toHaveAttribute('data-state', 'editing-text');
    await expectFits(page, frame, 'editing-text');
    await page.keyboard.press('Escape');
    await count(page, 3);

    // cropping, with its sheet (frame size, position and size, reset).
    await toolRadio(page, 'tool.crop', 'C').click();
    await expect(screen(page)).toHaveAttribute('data-state', 'cropping');
    await expect(ui(page).locator('.tk-crop-chip')).toHaveText(vi('crop.size', { width: 640, height: 400 }));
    await expectFits(page, frame, 'cropping');
    await toggleSheet(page, true);
    await expectFits(page, frame, 'cropping-sheet');
    await toggleSheet(page, false);
    await toolRadio(page, 'tool.select', 'V').click();

    // The narrow zoom menu (Fit to view and Actual size).
    await ui(page)
      .getByRole('button', { name: /^Thu phóng: / })
      .click();
    await expect(ui(page).getByRole('menuitem', { name: vi('action.zoom_fit') })).toBeVisible();
    await expectFits(page, frame, 'zoom-menu');
    await page.keyboard.press('Escape');
    await expect(ui(page).getByRole('menuitem', { name: vi('action.zoom_fit') })).toHaveCount(0);
  });

  test('F-018.AC7 F-018.R7 More actions, keyboard shortcuts, privacy and the clear and replace confirmations', async ({
    page,
  }) => {
    const frame = await open(page);
    await pasteShot(frame);
    await count(page, 0);
    await toolRadio(page, 'tool.rectangle', 'R').click();
    await drag(page, [-100, -50], [0, 0]);
    await count(page, 1);

    await more(page).click();
    await expect(menu(page).getByRole('menuitem')).toHaveText([
      vi('action.download'),
      vi('action.shortcuts'),
      vi('action.clear'),
    ]);
    await expectFits(page, frame, 'menu-more');
    await menu(page)
      .getByRole('menuitem', { name: vi('action.shortcuts') })
      .click();
    const help = ui(page).getByRole('dialog', { name: vi('shortcuts.title') });
    await expect(help).toBeVisible();
    await expectFits(page, frame, 'dialog-shortcuts');
    await page.keyboard.press('Escape');
    await expect(help).toHaveCount(0);

    await ui(page)
      .getByRole('button', { name: vi('privacy.badge_label') })
      .click();
    const privacy = ui(page).getByRole('dialog', { name: vi('privacy.title') });
    await expect(privacy).toBeVisible();
    await expectFits(page, frame, 'popover-privacy');
    await page.keyboard.press('Escape');
    await expect(privacy).toHaveCount(0);

    await more(page).click();
    await menu(page)
      .getByRole('menuitem', { name: vi('action.clear') })
      .click();
    const clear = ui(page).getByRole('alertdialog', { name: vi('confirm.clear_title') });
    await expect(clear).toBeVisible();
    await expectFits(page, frame, 'dialog-confirm-clear');
    await clear.getByRole('button', { name: vi('action.cancel') }).click();
    await expect(clear).toHaveCount(0);

    await ui(page).locator('main.tk-work-area').focus();
    await pasteShot(frame, 'other.png');
    const replace = ui(page).getByRole('alertdialog', { name: vi('confirm.replace_title') });
    await expect(replace).toBeVisible(PATIENT);
    await expectFits(page, frame, 'dialog-confirm-replace');
    await replace.getByRole('button', { name: vi('action.cancel') }).click();
    await expect(replace).toHaveCount(0);
    await count(page, 1);
  });

  test('F-018.AC7 F-018.R7 the redaction count and the copied, downloaded, exporting, export-failed and clipboard notices', async ({
    page,
  }) => {
    const frame = await open(page);
    await pasteShot(frame);
    await count(page, 0);
    await toolRadio(page, 'tool.redact', 'X').click();
    await drag(page, [-100, -50], [0, 0]);
    await count(page, 1);
    const pill = ui(page).locator('.tk-count').filter({ visible: true });
    await expect(pill).toBeVisible();
    await expect(pill).toHaveAccessibleName(vi('export.redaction_count', { count: 1 }));
    await expectFits(page, frame, 'redaction-count');

    const copy = ui(page).getByRole('button', { name: vi('action.copy'), exact: true });
    await copy.click();
    await expect(notice(page)).toContainText(vi('export.copied_redactions', { count: 1 }), PATIENT);
    await expectFits(page, frame, 'notice-copied');

    await more(page).click();
    const file = await download(page, () =>
      menu(page)
        .getByRole('menuitem', { name: vi('action.download') })
        .click(),
    );
    await expect(notice(page)).toContainText(
      vi('export.downloaded_redactions', { file_name: file.name, count: 1 }),
      PATIENT,
    );
    await expectFits(page, frame, 'notice-downloaded');

    await gate(frame, { export: true });
    await copy.click();
    await expect(notice(page)).toContainText(vi('export.preparing'), PATIENT);
    await expectFits(page, frame, 'exporting');
    await release(frame);
    await expect(notice(page)).toContainText(vi('export.copied_redactions', { count: 1 }), PATIENT);

    await gate(frame, { fail: true });
    await copy.click();
    await expect(notice(page)).toContainText(vi('error.export_failed'), PATIENT);
    await expect(screen(page)).toHaveAttribute('data-state', 'error');
    await expectFits(page, frame, 'error-export-failed');

    await gate(frame, { fail: false, refuse: true });
    await copy.click();
    await expect(notice(page)).toContainText(vi('error.clipboard'), PATIENT);
    await expect(notice(page).getByRole('button', { name: vi('action.download'), exact: true })).toBeVisible();
    await expectFits(page, frame, 'error-clipboard');
  });
});
