// F-015 Fit into the host portal (RULE-16, ADR-0010, ADR-0021) on the multi-origin harness: theme
// from the address and from messages, the device preference standalone, filling the host area,
// origin and source checks, the single ready signal and frame-ancestors.
// AC6 and AC7 (every M-1 feature) are in ./m1-embedded.spec.ts and ../m1-tour.spec.ts; AC9/AC10 in ./export-embedded.spec.ts.
import { expect, test, type Page } from '@playwright/test';
import { fixture, paste } from '../support/load';
import { HOST_ALLOWED, HOST_OTHER, TOOL_ALLOWED, TOOL_EMPTY, hostPageUrl } from '../support/urls';
import {
  markWindow,
  postFromForeignOrigin,
  postFromSibling,
  received,
  settle,
  SHELL,
  stillSameWindow,
  toolFrame,
} from './support';

const DARK_WORK_AREA = 'rgb(11, 8, 18)';
const LIGHT_WORK_AREA = 'rgb(236, 232, 244)';

async function workArea(page: Page, inFrame = true): Promise<string> {
  const root = inFrame ? page.frameLocator('#tool') : page;
  return root.locator('.tk-work-area').evaluate((el) => getComputedStyle(el).backgroundColor);
}

test('F-015.AC1 the host passes theme dark in the address: dark from first display, never light first', async ({
  page,
}) => {
  // The device prefers light, so any fallback would show light.
  await page.emulateMedia({ colorScheme: 'light' });
  await page.addInitScript((tool) => {
    if (location.origin !== tool) return;
    const seen: (string | null)[] = [];
    (window as unknown as { __themes: (string | null)[] }).__themes = seen;
    // Record every theme <html> carries, from the moment the parser creates it.
    const record = () => {
      const t = document.documentElement?.getAttribute('data-theme') ?? null;
      if (seen[seen.length - 1] !== t) seen.push(t);
    };
    new MutationObserver(record).observe(document, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ['data-theme'],
    });
  }, TOOL_ALLOWED);
  await page.goto(hostPageUrl(HOST_ALLOWED, TOOL_ALLOWED, 'dark', 'en-US'));
  const frame = await toolFrame(page);
  const themes = await frame.evaluate(() => (window as unknown as { __themes: (string | null)[] }).__themes);
  // Before the boot script runs nothing is painted (it is the first thing in <head>); after it, dark only.
  expect(themes.filter((t) => t !== null)).toEqual(['dark']);
  expect(await workArea(page)).toBe(DARK_WORK_AREA);
});

test('F-015.R1 follows later theme messages without reloading', async ({ page }) => {
  await page.goto(hostPageUrl(HOST_ALLOWED, TOOL_ALLOWED, 'light', 'en-US'));
  const frame = await toolFrame(page);
  await markWindow(frame);
  expect(await workArea(page)).toBe(LIGHT_WORK_AREA);

  await page.evaluate(() => (window as unknown as { __sendTheme: (v: string) => void }).__sendTheme('dark'));
  await expect(page.frameLocator('#tool').locator('html')).toHaveAttribute('data-theme', 'dark');
  expect(await workArea(page)).toBe(DARK_WORK_AREA);

  // Edge case: an unknown theme value keeps the current theme. A language message sent after it by
  // the same window is handled after it, so its effect proves 'blue' was processed.
  await page.evaluate(() => {
    const w = window as unknown as { __sendTheme: (v: string) => void; __sendLanguage: (v: string) => void };
    w.__sendTheme('blue');
    w.__sendLanguage('vi-VN');
  });
  await expect(page.frameLocator('#tool').locator('html')).toHaveAttribute('lang', 'vi-VN');
  await expect(page.frameLocator('#tool').locator('html')).toHaveAttribute('data-theme', 'dark');
  expect(await stillSameWindow(frame)).toBe(true);
});

test('F-015.AC2 an annotated image survives the host switching from light to dark, without reloading', async ({
  page,
}) => {
  await page.goto(hostPageUrl(HOST_ALLOWED, TOOL_ALLOWED, 'light', 'en-US'));
  const frame = await toolFrame(page);
  await paste(frame, [fixture('wide-2000x1000.png', 'image/png')]);
  const summary = frame.locator('#tk-canvas-summary');
  await expect(summary).toHaveText('2,000 × 1,000 px canvas, 0 annotations');
  // Annotate (F-003): a rectangle placed at the view centre with Enter.
  await frame.getByRole('radio', { name: 'Rectangle (R)' }).click();
  await frame.locator('main.tk-work-area').focus();
  await frame.page().keyboard.press('Enter');
  await expect(summary).toHaveText('2,000 × 1,000 px canvas, 1 annotation');
  await markWindow(frame);
  expect(await workArea(page)).toBe(LIGHT_WORK_AREA);

  await page.evaluate(() => (window as unknown as { __sendTheme: (v: string) => void }).__sendTheme('dark'));
  await expect.poll(() => workArea(page)).toBe(DARK_WORK_AREA);
  expect(await stillSameWindow(frame)).toBe(true);
  await expect(summary).toHaveText('2,000 × 1,000 px canvas, 1 annotation');
  await expect(frame.getByRole('radio', { name: 'Rectangle (R)' })).toHaveAttribute('aria-checked', 'true');
  // The history survives too (F-009): the one step undoes and redoes.
  const undo = frame.getByRole('button', { name: 'Undo', exact: true });
  const redo = frame.getByRole('button', { name: 'Redo', exact: true });
  await expect(redo).toBeDisabled();
  await undo.click();
  await expect(summary).toHaveText('2,000 × 1,000 px canvas, 0 annotations');
  await expect(undo).toBeDisabled();
  await redo.click();
  await expect(summary).toHaveText('2,000 × 1,000 px canvas, 1 annotation');
});

test('F-015.AC3 standalone on a device set to dark shows the dark theme', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.goto(`${TOOL_ALLOWED}/`);
  await expect(page.locator(SHELL)).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  expect(await workArea(page, false)).toBe(DARK_WORK_AREA);
});

test('F-015.R2 standalone, the tool follows a change of the device preference', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.goto(`${TOOL_ALLOWED}/`);
  await expect(page.locator(SHELL)).toBeVisible();
  await page.emulateMedia({ colorScheme: 'light' });
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  expect(await workArea(page, false)).toBe(LIGHT_WORK_AREA);
  await page.emulateMedia({ colorScheme: 'dark' });
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
});

test('F-015.R1 embedded, a host that never sends a theme leaves the tool on the device preference', async ({
  page,
}) => {
  await page.emulateMedia({ colorScheme: 'light' });
  await page.goto(hostPageUrl(HOST_ALLOWED, TOOL_ALLOWED, undefined, 'en-US'));
  await toolFrame(page);
  const html = page.frameLocator('#tool').locator('html');
  await expect(html).toHaveAttribute('data-theme', 'light');
  await page.emulateMedia({ colorScheme: 'dark' });
  await expect(html).toHaveAttribute('data-theme', 'dark');
  // Once the host sends a theme, the host owns it.
  await page.evaluate(() => (window as unknown as { __sendTheme: (v: string) => void }).__sendTheme('light'));
  await expect(html).toHaveAttribute('data-theme', 'light');
  await page.emulateMedia({ colorScheme: 'dark' });
  await settle(page);
  await expect(html).toHaveAttribute('data-theme', 'light');
});

test('F-015.AC4 the tool fills the resized host area without a page scrollbar of its own', async ({ page }) => {
  await page.goto(hostPageUrl(HOST_ALLOWED, TOOL_ALLOWED, 'dark', 'en-US'));
  const frame = await toolFrame(page);
  for (const [w, h] of [
    [1000, 700],
    [480, 360],
    [320, 480],
    [1280, 800],
  ] as const) {
    await page.evaluate(
      ([width, height]) =>
        (window as unknown as { __resizeTool: (w: number, h: number) => void }).__resizeTool(width, height),
      [w, h] as const,
    );
    await expect.poll(() => frame.evaluate(() => [window.innerWidth, window.innerHeight])).toEqual([w, h]);
    const m = await frame.evaluate((sel) => {
      const shell = document.querySelector(sel)!.getBoundingClientRect();
      const doc = document.documentElement;
      return {
        shell: [Math.round(shell.width), Math.round(shell.height)],
        overflowX: doc.scrollWidth - doc.clientWidth,
        overflowY: doc.scrollHeight - doc.clientHeight,
      };
    }, SHELL);
    expect(m.shell).toEqual([w, h]);
    expect(m.overflowX).toBeLessThanOrEqual(0);
    expect(m.overflowY).toBeLessThanOrEqual(0);
  }
});

test('F-015.AC5 settings messages from another origin or another window are ignored', async ({ page }) => {
  await page.goto(hostPageUrl(HOST_ALLOWED, TOOL_ALLOWED, 'dark', 'en-US'));
  await toolFrame(page);
  const html = page.frameLocator('#tool').locator('html');

  // An origin not in the allowed list (a sibling frame on HOST_OTHER).
  await postFromForeignOrigin(page, { type: 'taro:theme', value: 'light' });
  // The allowed origin, but a window other than the embedding page (a same-origin sibling frame).
  await postFromSibling(page, { type: 'taro:theme', value: 'light' });
  await settle(page);
  await expect(html).toHaveAttribute('data-theme', 'dark');

  // Control: the same message from the embedding page is accepted.
  await page.evaluate(() => (window as unknown as { __sendTheme: (v: string) => void }).__sendTheme('light'));
  await expect(html).toHaveAttribute('data-theme', 'light');
});

test('F-015.R5 the only message the tool sends the host is one ready signal with no content', async ({ page }) => {
  await page.goto(hostPageUrl(HOST_ALLOWED, TOOL_ALLOWED, 'dark', 'vi-VN'));
  await toolFrame(page);
  await expect.poll(() => received(page)).toHaveLength(1);
  // Settings messages, resizing and focus produce no answer.
  await page.evaluate(() => {
    const w = window as unknown as {
      __sendTheme: (v: string) => void;
      __sendLanguage: (v: string) => void;
      __resizeTool: (w: number, h: number) => void;
    };
    w.__sendTheme('light');
    w.__sendLanguage('en-US');
    w.__resizeTool(400, 400);
  });
  await page.frameLocator('#tool').locator(SHELL).click();
  await settle(page);
  expect(await received(page)).toEqual([{ origin: TOOL_ALLOWED, data: { type: 'taro:ready' } }]);
});

test('F-015.AC8 a page whose origin is not allowed cannot display the tool', async ({ page }) => {
  const res = await page.request.get(`${TOOL_ALLOWED}/`);
  expect(res.headers()['content-security-policy']).toContain(`frame-ancestors ${HOST_ALLOWED}`);

  await page.goto(hostPageUrl(HOST_OTHER, TOOL_ALLOWED, 'dark'));
  await settle(page);
  await expect(page.frameLocator('#tool').locator(SHELL)).toHaveCount(0);
  expect(await received(page)).toEqual([]);

  // A build with an empty allow-list cannot be embedded at all (RULE-16), and runs standalone.
  await page.goto(hostPageUrl(HOST_ALLOWED, TOOL_EMPTY, 'dark'));
  await settle(page);
  await expect(page.frameLocator('#tool').locator(SHELL)).toHaveCount(0);
  await page.goto(`${TOOL_EMPTY}/`);
  await expect(page.locator(SHELL)).toBeVisible();
});
