/**
 * T9 (#205): the preview export (`make e2e-preview`, served from dist-preview/) names itself on
 * boot and in MENU, keeps its saves under the preview key, leaves a production save on the same
 * origin untouched, and adopts a production save code it is given.
 */
import type { Page } from '@playwright/test';
import { makeFixtures } from '../../scripts/make-fixtures';
import { boot, expect, openSave, test } from './helpers';

const PRODUCTION = { save: 'daemon-zero.save.v1', backup: 'daemon-zero.save.corrupt-backup' };
const PREVIEW = { save: 'daemon-zero.preview.save.v1', backup: 'daemon-zero.preview.save.corrupt-backup' };
interface BrowserStorage { getItem(key: string): string | null; setItem(key: string, value: string): void }

function stored(page: Page, key: string): Promise<string | null> {
  return page.evaluate((name) => (globalThis as unknown as { localStorage: BrowserStorage }).localStorage.getItem(name), key);
}

async function previewSave(page: Page): Promise<Record<string, unknown>> {
  const envelope = JSON.parse(await stored(page, PREVIEW.save) ?? '{}') as { game: string };
  return JSON.parse(envelope.game) as Record<string, unknown>;
}

test('the preview build shows its marker on boot, in MENU and beside the version', async ({ page }) => {
  await boot(page);
  await expect(page.getByTestId('boot-log')).toBeVisible();
  await expect(page.getByTestId('preview-marker-boot')).toBeVisible();
  await expect(page.getByTestId('preview-marker-boot')).toHaveText(/PREVIEW BUILD/);
  await page.getByTestId('menu-open').click();
  await expect(page.getByTestId('preview-marker-menu')).toBeVisible();
  await page.getByTestId('menu-help').click();
  await expect(page.getByTestId('preview-marker-help')).toBeVisible();
});

test('preview saves land under the preview key and a production save beside them is untouched', async ({ page }) => {
  const production = JSON.stringify({ version: 1, savedAtMs: Date.now(), game: '{"left":"alone"}' });
  await page.addInitScript((text) => {
    const { localStorage } = globalThis as unknown as { localStorage: BrowserStorage };
    if (localStorage.getItem('daemon-zero.save.v1') === null) localStorage.setItem('daemon-zero.save.v1', text);
  }, production);
  await boot(page);
  // A fresh preview run: the production entry was neither loaded nor called damaged.
  await expect(page.getByTestId('boot-log')).toBeVisible();
  await expect(page.getByTestId('save-notice')).toHaveCount(0);
  await page.getByTestId('manual-cycle').click();
  await expect.poll(() => stored(page, PREVIEW.save)).not.toBeNull();
  expect((await previewSave(page)).contentChannel).toBe('preview');
  expect(await stored(page, PRODUCTION.save)).toBe(production);
  expect(await stored(page, PRODUCTION.backup)).toBeNull();
  expect(await stored(page, PREVIEW.backup)).toBeNull();
});

test('a production save code is adopted by preview and saved as a preview run', async ({ page }) => {
  const code = makeFixtures()['guest-skimmer'];
  if (!code) throw new Error('Missing fixture guest-skimmer');
  const source = JSON.parse(Buffer.from(code, 'base64').toString('utf8')) as Record<string, unknown>;
  expect(source.contentChannel).toBe('production');
  await boot(page);
  await openSave(page);
  await page.getByTestId('save-code').fill(code);
  await page.getByTestId('save-import').click();
  await page.getByTestId('save-import-confirm').click();
  await expect(page.getByTestId('save-transfer')).toHaveCount(0);
  await expect.poll(async () => (await previewSave(page).catch((): Record<string, unknown> => ({}))).unlockedNodes).toEqual(source.unlockedNodes);
  expect((await previewSave(page)).contentChannel).toBe('preview');
  expect(await stored(page, PRODUCTION.save)).toBeNull();
});
