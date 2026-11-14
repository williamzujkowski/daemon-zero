/** Fresh current-engine fixtures enter through normal persisted-save hydration. */
import { expect, test as base, type Page } from '@playwright/test';
import { makeFixtures } from '../../scripts/make-fixtures';
import { CONTENT } from '../../src/content';
import { importSave, serialize } from '../../src/engine';
interface BrowserStorage { getItem(key: string): string | null; setItem(key: string, value: string): void }
const fixtures = makeFixtures();

export const test = base.extend<{ cleanConsole: undefined }>({
  cleanConsole: [async ({ page }, use) => {
    const messages: string[] = [];
    page.on('pageerror', (error) => messages.push(error.message));
    page.on('console', (message) => { if (['error', 'warning'].includes(message.type())) messages.push(message.text()); });
    await use(undefined);
    expect(messages).toEqual([]);
  }, { auto: true }],
});
export { expect };
export async function boot(page: Page, fixture?: string): Promise<void> {
  await page.clock.install();
  await page.clock.pauseAt(Date.now() + 1000);
  if (fixture) {
    const code = fixtures[fixture];
    if (!code) throw new Error('Missing fixture ' + fixture);
    const game = serialize(importSave(code, CONTENT));
    await page.addInitScript((value) => {
      const { localStorage } = globalThis as unknown as { localStorage: BrowserStorage };
      if (!localStorage.getItem('daemon-zero.save.v1')) localStorage.setItem('daemon-zero.save.v1', JSON.stringify({ version: 1, savedAtMs: Date.now(), game: value }));
    }, game);
  }
  await page.goto('./');
  if (fixture === 'guest-dilemma') await expect(page.getByTestId('dilemma-modal')).toBeVisible();
  else await expect(page.getByTestId('terminal-screen')).toHaveAttribute('aria-busy', 'false');
  await expect.poll(() => page.evaluate(() => '__daemon' in globalThis)).toBe(false);
  await expect(page.getByTestId('dev-open')).toHaveCount(0);
}
export async function dismissBoot(page: Page): Promise<void> {
  for (const id of ['reboot-continue', 'phase-threshold-continue', 'lineage-reveal-continue', 'response-acknowledge']) {
    if (await page.getByTestId(id).count()) await page.getByTestId(id).click();
  }
}
export async function core(page: Page): Promise<void> {
  if (await page.getByTestId('tab-CORE').count()) await page.getByTestId('tab-CORE').click();
}
export async function readSave(page: Page) {
  const raw = await page.evaluate(() => {
    const { localStorage } = globalThis as unknown as { localStorage: BrowserStorage };
    const envelope = JSON.parse(localStorage.getItem('daemon-zero.save.v1') ?? '{}') as { game: string };
    return JSON.parse(envelope.game) as Record<string, unknown>;
  });
  return raw;
}

/** Save transfer is a utility route; opening it follows the real player path. */
export async function openSave(page: Page): Promise<void> {
  await page.getByTestId('menu-open').click();
  await page.getByTestId('save-open').click();
}
