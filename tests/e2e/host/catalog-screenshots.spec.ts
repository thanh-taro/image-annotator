// Release catalog screenshots (phase 6): the tool embedded in the stub host with a generated, made-up
// screenshot (own work, no third-party content) marked up with a rectangle, an arrow, a text, two steps
// and a solid redaction, in light and dark, at 1200 x 760 and at the narrow 390 px width. The images go to
// docs/deploy/screenshots/ when CATALOG_SHOTS=1; otherwise to the test's output folder, so the test only
// checks that the tool renders the finished state. Chromium only (one set of images, not two).
import { expect as baseExpect, test } from '@playwright/test';
import { HOST_ALLOWED, TOOL_ALLOWED, hostPageUrl } from '../support/urls';
import { toolFrame } from './support';

const expect = baseExpect.configure({ timeout: 15_000 });
const OUT = 'docs/deploy/screenshots';
const SIZES = [
  { name: 'embedded-1200x760', width: 1200, height: 760 },
  { name: 'narrow-390', width: 390, height: 760 },
] as const;
const THEMES = ['light', 'dark'] as const;

test.use({ deviceScaleFactor: 1 });

for (const size of SIZES)
  for (const theme of THEMES)
    test(`F-015.AC6 release catalog screenshot, ${size.name}, ${theme}`, async ({ page, browserName }, testInfo) => {
      test.skip(browserName !== 'chromium', 'one set of images');
      test.slow();
      await page.setViewportSize({ width: size.width + 60, height: size.height + 160 });
      await page.goto(hostPageUrl(HOST_ALLOWED, TOOL_ALLOWED, theme, 'en-US'));
      const frame = await toolFrame(page);
      // The tool's own frame is the picture: exactly size.width x size.height, without the stub page around it.
      await page.evaluate(
        ([w, h]) => (window as unknown as { __resizeTool: (w: number, h: number) => void }).__resizeTool(w!, h!),
        [size.width, size.height],
      );
      await expect.poll(() => frame.evaluate(() => innerWidth)).toBe(size.width);
      const ui = page.frameLocator('#tool');

      // A made-up bug-report screenshot: a settings form with an email address to hide.
      await frame.evaluate(async () => {
        const c = new OffscreenCanvas(1000, 620);
        const g = c.getContext('2d', { colorSpace: 'srgb' });
        if (!g) throw new Error('no 2d context');
        g.fillStyle = '#eef1f6';
        g.fillRect(0, 0, 1000, 620);
        g.fillStyle = '#ffffff';
        g.fillRect(60, 50, 880, 520);
        g.fillStyle = '#1f2a44';
        g.fillRect(60, 50, 880, 64);
        g.fillStyle = '#ffffff';
        g.font = '600 28px sans-serif';
        g.fillText('Account settings', 90, 92);
        g.fillStyle = '#1f2a44';
        g.font = '600 20px sans-serif';
        g.fillText('Email', 90, 175);
        g.fillStyle = '#e4e8f0';
        g.fillRect(90, 190, 520, 52);
        g.fillStyle = '#334';
        g.font = '22px sans-serif';
        g.fillText('jordan.example@mail.test', 108, 224);
        g.fillStyle = '#1f2a44';
        g.font = '600 20px sans-serif';
        g.fillText('Display name', 90, 300);
        g.fillStyle = '#e4e8f0';
        g.fillRect(90, 315, 520, 52);
        g.fillStyle = '#334';
        g.font = '22px sans-serif';
        g.fillText('Jordan', 108, 349);
        g.fillStyle = '#c0392b';
        g.fillRect(90, 430, 210, 56);
        g.fillStyle = '#ffffff';
        g.font = '600 22px sans-serif';
        g.fillText('Delete account', 112, 465);
        g.fillStyle = '#1f6fe5';
        g.fillRect(330, 430, 150, 56);
        g.fillStyle = '#ffffff';
        g.fillText('Save', 378, 465);
        const dt = new DataTransfer();
        dt.items.add(new File([await c.convertToBlob({ type: 'image/png' })], 'settings.png', { type: 'image/png' }));
        (document.activeElement ?? document).dispatchEvent(
          new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }),
        );
      });
      const summary = ui.locator('#tk-canvas-summary');
      await expect(summary).toHaveText('1,000 × 620 px canvas, 0 annotations');

      // Image points (1000 x 620) mapped onto the fitted image, centred in the work area at the shown zoom.
      const area = await ui.locator('main.tk-work-area').boundingBox();
      if (!area) throw new Error('no work area');
      const zoom = await ui.locator('.tk-zoom__level').innerText();
      const k = Number.parseInt(zoom, 10) / 100;
      const at = (x: number, y: number) => ({
        x: area.x + area.width / 2 + (x - 500) * k,
        y: area.y + area.height / 2 + (y - 310) * k,
      });
      const drag = async (from: [number, number], to: [number, number]) => {
        const a = at(...from);
        const b = at(...to);
        await page.mouse.move(a.x, a.y);
        await page.mouse.down();
        await page.mouse.move(b.x, b.y, { steps: 6 });
        await page.mouse.up();
      };
      const tool = (name: string) =>
        ui.getByRole('toolbar', { name: 'Tools and actions' }).getByRole('radio', { name });
      const done = () => page.keyboard.press('Escape');

      await tool('Redact (X)').click();
      await drag([100, 192], [600, 240]); // solid by default (RULE-10)
      await done();
      await tool('Rectangle (R)').click();
      await drag([70, 410], [320, 506]);
      await done();
      await tool('Arrow (A)').click();
      await drag([500, 535], [326, 500]);
      await done();
      await tool('Text (T)').click();
      const t = at(510, 515);
      await page.mouse.click(t.x, t.y);
      await expect(ui.getByRole('textbox', { name: 'Text', exact: true })).toBeFocused();
      await page.keyboard.insertText('Asks twice');
      await done();
      await tool('Step (N)').click();
      for (const p of [at(660, 215), at(80, 400)]) await page.mouse.click(p.x, p.y);
      await done();
      await expect(summary).toHaveText(/, 6 annotations$/);
      await tool('Select (V)').click();
      await ui.locator('main.tk-work-area').focus();
      await done();
      await ui
        .locator('canvas.tk-canvas')
        .evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r(null)))));

      const path = process.env['CATALOG_SHOTS'] ? `${OUT}/${size.name}-${theme}.png` : testInfo.outputPath('shot.png');
      const box = await page.locator('#tool').boundingBox();
      if (!box) throw new Error('no tool frame');
      await page.screenshot({
        path,
        clip: { x: Math.round(box.x), y: Math.round(box.y), width: size.width, height: size.height },
      });
    });
