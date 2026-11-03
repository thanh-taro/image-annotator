// F-018 Use the portal's language (RULE-16, RULE-17, ADR-0015) on the multi-origin harness: the
// language from the address before first display, live taro:language messages, the browser
// fallback, the origin/source/value checks, 320 px and the Vietnamese faces in the initial load.
// Deferred ACs (need later features): AC2 (image, annotations, selection, tool, zoom, history),
// AC5 (export, F-012), AC7 (every SCR-Annotator state), AC10 (text and download offline, F-005/F-012/F-017).
import { expect, test, type Page } from '@playwright/test';
import { CATALOG } from '../../../src/copy/messages.gen';
import { HOST_ALLOWED, TOOL_ALLOWED, hostPageUrl } from '../support/urls';
import {
  markWindow,
  postFromForeignOrigin,
  postFromSibling,
  settle,
  SHELL,
  stillSameWindow,
  toolFrame,
} from './support';

/** Every en-US string that differs from its vi-VN text (plural forms included). */
const ENGLISH_ONLY: string[] = (() => {
  const out: string[] = [];
  const flat = (v: unknown): string[] =>
    typeof v === 'string' ? [v] : Object.values(v as Record<string, string>).filter((x) => typeof x === 'string');
  const en = CATALOG['en-US'] as Record<string, unknown>;
  const vi = CATALOG['vi-VN'] as Record<string, unknown>;
  for (const id of Object.keys(en)) {
    const viTexts = new Set(flat(vi[id]));
    for (const text of flat(en[id])) if (!viTexts.has(text) && text.length > 2) out.push(text);
  }
  return out;
})();

const sendTheme = (page: Page, value: string) =>
  page.evaluate((v) => (window as unknown as { __sendTheme: (v: string) => void }).__sendTheme(v), value);

const sendLanguage = (page: Page, value: unknown) =>
  page.evaluate((v) => (window as unknown as { __sendLanguage: (v: unknown) => void }).__sendLanguage(v), value);

async function expectUi(page: Page, lang: 'en-US' | 'vi-VN') {
  const tool = page.frameLocator('#tool');
  await expect(tool.locator('html')).toHaveAttribute('lang', lang);
  await expect(tool.locator('main')).toHaveAccessibleName(CATALOG[lang]['a11y.canvas'] as string);
  await expect(tool.getByRole('toolbar')).toHaveAccessibleName(CATALOG[lang]['a11y.toolbar'] as string);
}

test('F-018.AC1 vi-VN in the address: every string in vi-VN from first display, never English first', async ({
  page,
}) => {
  // The browser prefers English, so any fallback would show English.
  await page.addInitScript((tool) => {
    if (location.origin !== tool) return;
    const seen = new Set<string>();
    const langs: string[] = [];
    Object.assign(window, { __texts: seen, __langs: langs });
    const record = () => {
      // The page language from the moment there is anything to display (index.html's static
      // lang attribute precedes the boot script, while the document has no body yet).
      const html = document.documentElement;
      if (document.body && langs[langs.length - 1] !== html.lang) langs.push(html.lang);
      for (const el of Array.from(document.querySelectorAll('*'))) {
        for (const a of ['aria-label', 'title', 'placeholder', 'alt'])
          if (el.hasAttribute(a)) seen.add(el.getAttribute(a)!);
        for (const n of Array.from(el.childNodes))
          if (n.nodeType === 3 && n.textContent!.trim()) seen.add(n.textContent!.trim());
      }
    };
    new MutationObserver(record).observe(document, {
      subtree: true,
      childList: true,
      attributes: true,
      characterData: true,
    });
  }, TOOL_ALLOWED);
  await page.goto(hostPageUrl(HOST_ALLOWED, TOOL_ALLOWED, 'dark', 'vi-VN'));
  const frame = await toolFrame(page);
  await expectUi(page, 'vi-VN');
  const { texts, langs } = await frame.evaluate(() => {
    const w = window as unknown as { __texts: Set<string>; __langs: string[] };
    return { texts: [...w.__texts], langs: w.__langs };
  });
  expect(langs.filter((l) => l)).toEqual(['vi-VN']);
  expect(texts.filter((s) => ENGLISH_ONLY.includes(s))).toEqual([]);
  expect(texts).toContain(CATALOG['vi-VN']['a11y.canvas']);
});

test('F-018.R2 a language message switches the UI live, without reloading', async ({ page }) => {
  await page.goto(hostPageUrl(HOST_ALLOWED, TOOL_ALLOWED, 'dark', 'vi-VN'));
  const frame = await toolFrame(page);
  await markWindow(frame);
  await expectUi(page, 'vi-VN');

  await sendLanguage(page, 'en-US');
  await expectUi(page, 'en-US');
  // Edge case: the same language again is applied with no visible change; the theme message sent
  // after it by the same window proves it was processed.
  await sendLanguage(page, 'en-US');
  await sendTheme(page, 'light');
  await expect(page.frameLocator('#tool').locator('html')).toHaveAttribute('data-theme', 'light');
  await expectUi(page, 'en-US');
  await sendTheme(page, 'dark');
  // RULE-17 matching applies to messages too: `vi` → vi-VN.
  await sendLanguage(page, 'vi');
  await expectUi(page, 'vi-VN');
  await expect(page.frameLocator('#tool').locator('html')).toHaveAttribute('data-theme', 'dark');
  expect(await stillSameWindow(frame)).toBe(true);
  // ADR-0015 §7: the document title is re-set from COPY-app.title on every switch.
  expect(await frame.evaluate(() => document.title)).toBe(CATALOG['vi-VN']['app.title']);
});

for (const [prefs, expected] of [
  [['fr-FR', 'vi'], 'vi-VN'],
  [['fr-FR'], 'en-US'],
] as const) {
  test(`F-018.AC3 no language in the address, browser prefers ${prefs.join(', ')} → ${expected}`, async ({ page }) => {
    await page.addInitScript(
      (list) => {
        Object.defineProperty(Navigator.prototype, 'languages', { get: () => list, configurable: true });
        Object.defineProperty(Navigator.prototype, 'language', { get: () => list[0], configurable: true });
      },
      prefs as unknown as string[],
    );
    await page.goto(`${TOOL_ALLOWED}/?theme=dark`);
    await expect(page.locator(SHELL)).toBeVisible();
    await expect(page.locator('html')).toHaveAttribute('lang', expected);
    await expect(page.locator('main')).toHaveAccessibleName(CATALOG[expected]['a11y.canvas'] as string);
  });
}

test('F-018.AC4 language messages from another origin, another window or with an unsupported value are ignored', async ({
  page,
}) => {
  await page.goto(hostPageUrl(HOST_ALLOWED, TOOL_ALLOWED, 'dark', 'vi-VN'));
  await toolFrame(page);
  await postFromForeignOrigin(page, { type: 'taro:language', value: 'en-US' });
  await postFromSibling(page, { type: 'taro:language', value: 'en-US' });
  await settle(page); // other windows: no ordering with the parent's messages
  await expectUi(page, 'vi-VN');
  // Unsupported values from the parent, then a valid theme control from the same window: once the
  // control has taken effect, every earlier message has been handled.
  for (const value of ['fr-FR', '', null, 42, { lang: 'en-US' }]) await sendLanguage(page, value);
  await sendTheme(page, 'light');
  await expect(page.frameLocator('#tool').locator('html')).toHaveAttribute('data-theme', 'light');
  await expectUi(page, 'vi-VN');
});

test('F-018.R7 vi-VN at 320 px wide: no horizontal scrollbar (empty frame)', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 640 });
  await page.goto(`${TOOL_ALLOWED}/?theme=dark&lang=vi-VN`);
  await expect(page.locator(SHELL)).toBeVisible();
  const overflowX = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflowX).toBeLessThanOrEqual(0);
});

test('F-018.R7 the Vietnamese faces are part of the initial load, in every language', async ({ page }) => {
  await page.request.get(`${TOOL_ALLOWED}/__log/reset`);
  await page.goto(`${TOOL_ALLOWED}/?theme=dark&lang=en-US`);
  await expect(page.locator(SHELL)).toBeVisible();
  await page.waitForLoadState('networkidle');
  await expect
    .poll(async () => {
      const log = (await (await page.request.get(`${TOOL_ALLOWED}/__log/dump`)).json()) as { path: string }[];
      return log.map((r) => r.path).filter((p) => /vietnamese.*\.woff2$/.test(p)).length;
    })
    .toBe(2);
});
