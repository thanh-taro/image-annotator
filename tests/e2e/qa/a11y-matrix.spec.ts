// QA phase 5 (NFR-06, WCAG 2.2 AA): axe over every SCR-Annotator state, in both themes, at 1200, 390 and
// 320 px wide, in en-US and vi-VN, on the production build (Chromium). One test per theme x width x language.
// Implements: NFR-06 (automated half; the screen-reader pass is a manual checklist in qa-a11y.md).
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { fixture, paste } from '../support/load';

const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'];
const WIDTHS = [
  { w: 1200, h: 800 },
  { w: 390, h: 844 },
  { w: 320, h: 640 },
] as const;
const THEMES = ['dark', 'light'] as const;
const LANGS = ['en-US', 'vi-VN'] as const;
const TOOL_KEYS = ['v', 'r', 'o', 'a', 'l', 'p', 'h', 't', 'n', 'x', 'c'];

const frame = (page: Page) => page.evaluate(() => new Promise((r) => requestAnimationFrame(() => r(null))));

async function pasteGrey(page: Page) {
  await page.evaluate(async () => {
    const c = new OffscreenCanvas(1000, 800);
    const ctx = c.getContext('2d');
    if (!ctx) throw new Error('no 2d context');
    ctx.fillStyle = 'rgb(200,200,200)';
    ctx.fillRect(0, 0, 1000, 800);
    const dt = new DataTransfer();
    dt.items.add(new File([await c.convertToBlob({ type: 'image/png' })], 'g.png', { type: 'image/png' }));
    document.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }));
  });
  await expect(page.locator('canvas.tk-canvas')).toBeVisible();
  await frame(page);
}

async function scan(page: Page, label: string, found: string[]) {
  // D-036: the tool starts with a visually hidden h1, so page-has-heading-one is no longer excluded.
  const r = await new AxeBuilder({ page }).withTags(TAGS).analyze();
  for (const v of r.violations)
    found.push(`${label} | ${v.id} (${v.impact}) | ${v.nodes.length} node(s) | ${v.nodes[0]?.target.join(' ')}`);
}

for (const theme of THEMES)
  for (const size of WIDTHS)
    for (const lang of LANGS)
      test(`NFR-06 axe: all states, ${theme}, ${size.w}px, ${lang}`, async ({ page }) => {
        test.setTimeout(120_000);
        const found: string[] = [];
        await page.setViewportSize({ width: size.w, height: size.h });
        await page.goto(`/?theme=${theme}&lang=${lang}`);
        const area = page.locator('main.tk-work-area');
        await expect(area).toBeVisible();
        await scan(page, 'empty', found);

        // Empty state: More menu, shortcut help.
        const more = page.locator('[aria-haspopup="menu"]').first();
        await more.click();
        await scan(page, 'empty+menu', found);
        await page.keyboard.press('Escape');
        await page.keyboard.press('Shift+/');
        await scan(page, 'empty+help', found);
        await page.keyboard.press('Escape');

        // Notice: an undecodable file.
        await paste(page, [fixture('broken.png', 'image/png')]);
        await expect(page.locator('[role="alert"], [role="status"], .tk-notice').first()).toBeVisible();
        await scan(page, 'notice', found);
        await page.keyboard.press('Escape');

        await pasteGrey(page);
        await scan(page, 'loaded', found);

        for (const k of TOOL_KEYS) {
          await area.focus();
          await page.keyboard.press(k);
          await frame(page);
          await scan(page, `tool ${k}`, found);
        }

        // An annotation selected (geometry fields), then text editing.
        await area.focus();
        await page.keyboard.press('r');
        const box = (await page.locator('canvas.tk-canvas').boundingBox())!;
        await page.mouse.move(box.x + box.width * 0.2, box.y + box.height * 0.2);
        await page.mouse.down();
        await page.mouse.move(box.x + box.width * 0.6, box.y + box.height * 0.5, { steps: 4 });
        await page.mouse.up();
        await scan(page, 'rect selected', found);
        await area.focus();
        await page.keyboard.press('t');
        await page.mouse.click(box.x + box.width * 0.3, box.y + box.height * 0.7);
        await page.keyboard.type('Hello');
        await scan(page, 'text editing', found);
        await page.keyboard.press('Escape');

        // Style sheet (narrow): the summary bar button.
        const toggle = page.locator('.tk-sheet-toggle, [aria-controls*="panel"], [aria-expanded]').first();
        if (size.w < 700 && (await toggle.count())) {
          await toggle.click();
          await scan(page, 'style sheet', found);
          await page.keyboard.press('Escape');
        }

        // Crop.
        await area.focus();
        await page.keyboard.press('c');
        await scan(page, 'crop', found);
        await page.keyboard.press('Escape');

        // Menus and dialogs with an image.
        await page.locator('[aria-haspopup="menu"]').first().click();
        await scan(page, 'menu', found);
        await page.getByRole('menuitem').last().click();
        await expect(page.getByRole('alertdialog')).toBeVisible();
        await scan(page, 'confirm', found);

        expect(found, found.join('\n')).toEqual([]);
      });
