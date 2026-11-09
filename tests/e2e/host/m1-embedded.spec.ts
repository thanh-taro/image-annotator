// F-015.AC6 (R5, INV-04, RULE-16): embedded in the stub host, the user goes through every M-1 feature
// (the tour in tests/e2e/support/tour.ts: load by open, drop and paste; every shape, the strokes, text and
// steps; solid, blur and pixelate redaction; edit, undo/redo, keyboard shortcuts, zoom and pan, padding,
// crop; the privacy statement; copy and download; start over) while the host page records every message
// that reaches it, from any origin or window. The only one is the ready signal, carrying nothing else.
import { expect, test } from '@playwright/test';
import { recordClipboard } from '../support/export';
import { m1Tour } from '../support/tour';
import { HOST_ALLOWED, TOOL_ALLOWED, hostPageUrl } from '../support/urls';
import { received, settle, toolFrame } from './support';

// One device pixel per CSS pixel, so the 100 % view maps image pixels 1:1 to the pointer.
test.use({ deviceScaleFactor: 1 });

interface Heard {
  readonly origin: string;
  readonly fromTool: boolean;
  readonly data: string;
  readonly ports: number;
}

test('F-015.AC6 F-015.R5 INV-04 embedded, through every M-1 feature the host only ever receives the ready signal, with no content', async ({
  page,
  context,
  browserName,
}) => {
  test.slow();
  if (browserName === 'chromium')
    for (const origin of [TOOL_ALLOWED, HOST_ALLOWED])
      await context.grantPermissions(['clipboard-read', 'clipboard-write'], { origin });
  await recordClipboard(page);
  // On the host page: every message event, whatever its origin or source, as the host would see it.
  await page.addInitScript((host) => {
    if (location.origin !== host) return;
    const heard: Heard[] = [];
    (window as unknown as { __heard: Heard[] }).__heard = heard;
    window.addEventListener(
      'message',
      (e) => {
        const tool = document.getElementById('tool') as HTMLIFrameElement | null;
        let data: string;
        try {
          data = JSON.stringify(e.data) ?? String(e.data);
        } catch {
          data = `unserialisable ${Object.prototype.toString.call(e.data)}`;
        }
        heard.push({
          origin: e.origin,
          fromTool: !!tool && e.source === tool.contentWindow,
          data,
          ports: e.ports.length,
        });
      },
      true,
    );
  }, HOST_ALLOWED);
  await page.setViewportSize({ width: 1472, height: 868 });
  await page.goto(hostPageUrl(HOST_ALLOWED, TOOL_ALLOWED, 'light', 'en-US'));
  const frame = await toolFrame(page);
  const heard = () => page.evaluate(() => (window as unknown as { __heard: Heard[] }).__heard);
  await expect.poll(heard).toHaveLength(1);

  await m1Tour(page, frame);
  await settle(page); // anything the last steps might still post

  expect(await heard()).toEqual([{ origin: TOOL_ALLOWED, fromTool: true, data: '{"type":"taro:ready"}', ports: 0 }]);
  expect(await received(page)).toEqual([{ origin: TOOL_ALLOWED, data: { type: 'taro:ready' } }]);
});
