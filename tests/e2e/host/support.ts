// Shared helpers for the host-contract suites (F-015, F-018) on the multi-origin harness
// (tests/e2e/support/, SP-host, ADR-0021).
import { expect, type Frame, type Page } from '@playwright/test';
import { HOST_OTHER, TOOL_ALLOWED } from '../support/urls';

export const SHELL = '[data-screen="SCR-Annotator"]';

/** The embedded tool's frame, once its shell has rendered. */
export async function toolFrame(page: Page, toolOrigin = TOOL_ALLOWED): Promise<Frame> {
  await expect(page.frameLocator('#tool').locator(SHELL)).toBeVisible();
  const frame = page.frames().find((f) => f.url().startsWith(toolOrigin));
  if (!frame) throw new Error('tool frame not found');
  return frame;
}

/** Marks the tool's window, so a reload (which would lose the session) is detectable. */
export async function markWindow(frame: Frame): Promise<void> {
  await frame.evaluate(() => ((window as unknown as { __mark?: number }).__mark = 42));
}

export async function stillSameWindow(frame: Frame): Promise<boolean> {
  return frame.evaluate(() => (window as unknown as { __mark?: number }).__mark === 42);
}

/** Every message the stub host received from the tool (the host records them, RULE-16). */
export async function received(page: Page): Promise<{ origin: string; data: unknown }[]> {
  return page.evaluate(() => (window as unknown as { __received: { origin: string; data: unknown }[] }).__received);
}

/**
 * Posts `data` to the tool from a sibling frame on another origin (HOST_OTHER, not allow-listed and
 * not the tool's parent). The stub host server answers 404 there, which is still a document on that
 * origin that can post messages.
 */
export async function postFromForeignOrigin(page: Page, data: unknown): Promise<void> {
  await page.evaluate((src) => {
    if (document.getElementById('foreign')) return;
    const f = document.createElement('iframe');
    f.id = 'foreign';
    f.src = src;
    document.body.appendChild(f);
  }, `${HOST_OTHER}/foreign`);
  await expect.poll(() => page.frames().some((f) => f.url().startsWith(HOST_OTHER))).toBe(true);
  const foreign = page.frames().find((f) => f.url().startsWith(HOST_OTHER));
  await foreign!.waitForLoadState();
  await foreign!.evaluate(([d, origin]) => (parent.frames[0] as Window).postMessage(d, origin as string), [
    data,
    TOOL_ALLOWED,
  ] as const);
}

/** Lets queued messages be delivered and handled before asserting that nothing changed. */
export async function settle(page: Page): Promise<void> {
  await page.waitForTimeout(300);
}
