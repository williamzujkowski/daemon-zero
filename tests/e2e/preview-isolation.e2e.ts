/**
 * T7 (#205): the production export, at the root and under the Pages path, refuses a preview save
 * by name without touching the run, ignores the preview save key, and shows no preview marker.
 * The preview saves here are made by playing the preview registry, never by editing a marker.
 */
import type { Page } from '@playwright/test';
import { CONTENT } from '../../src/content';
import { CONTENT as PREVIEW } from '../../src/content/preview';
import { createInitialState, exportSave, manualCycle, serialize, type GameState } from '../../src/engine';
import { boot, expect, openSave, readSave, test } from './helpers';

// Literal keys on purpose: the production names must stay byte for byte what players already have.
const PRODUCTION = { save: 'daemon-zero.save.v1', backup: 'daemon-zero.save.corrupt-backup' };
const PREVIEW_KEYS = { save: 'daemon-zero.preview.save.v1', backup: 'daemon-zero.preview.save.corrupt-backup' };
interface BrowserStorage { getItem(key: string): string | null; setItem(key: string, value: string): void }

function previewRun(presses: number): GameState {
  let game = createInitialState(PREVIEW);
  for (let press = 0; press < presses; press++) {
    const result = manualCycle(game, PREVIEW);
    if (!result.ok) throw new Error('manual cycle refused: ' + result.reason);
    game = result.state;
  }
  return game;
}

function previewEnvelope(): string {
  return JSON.stringify({ version: 1, savedAtMs: Date.now(), game: serialize(previewRun(3)) });
}

async function seed(page: Page, key: string, value: string): Promise<void> {
  await page.addInitScript(([name, text]) => {
    const { localStorage } = globalThis as unknown as { localStorage: BrowserStorage };
    if (localStorage.getItem(name) === null) localStorage.setItem(name, text);
  }, [key, value] as const);
}

function stored(page: Page, key: string): Promise<string | null> {
  return page.evaluate((name) => (globalThis as unknown as { localStorage: BrowserStorage }).localStorage.getItem(name), key);
}

function run(save: Record<string, unknown>) {
  const { contentChannel, iteration, currentPhase, unlockedNodes } = save;
  return { contentChannel, iteration, currentPhase, unlockedNodes };
}

test('a pasted preview save code is refused by name and the run is unchanged after reload', async ({ page }) => {
  await boot(page, 'guest-skimmer');
  const before = run(await readSave(page));
  const code = exportSave(previewRun(3));
  expect(run(JSON.parse(Buffer.from(code, 'base64').toString('utf8')) as Record<string, unknown>)).not.toEqual(before);
  await openSave(page);
  await page.getByTestId('save-code').fill(code);
  await page.getByTestId('save-import').click();
  await expect(page.getByTestId('save-transfer-status')).toHaveText('This save comes from a preview build and cannot be loaded here.');
  await expect(page.getByTestId('save-import-dialog')).toHaveCount(0);
  expect(run(await readSave(page))).toEqual(before);
  await page.reload();
  await expect(page.getByTestId('terminal-screen')).toHaveAttribute('aria-busy', 'false');
  expect(run(await readSave(page))).toEqual(before);
  expect(await stored(page, PREVIEW_KEYS.save)).toBeNull();
});

test('a preview-key save does not change a fresh production boot and is left untouched', async ({ page }) => {
  const envelope = previewEnvelope();
  await seed(page, PREVIEW_KEYS.save, envelope);
  await boot(page);
  await expect(page.getByTestId('boot-log')).toBeVisible();
  await expect(page.getByTestId('save-notice')).toHaveCount(0);
  await page.getByTestId('manual-cycle').click();
  await expect.poll(() => stored(page, PRODUCTION.save)).not.toBeNull();
  const save = await readSave(page);
  expect(save.contentChannel).toBe('production');
  // One press on a fresh run: the three-press preview run was not loaded.
  expect(save.cycles).toBe(createInitialState(CONTENT).cycles + CONTENT.balance.manualCycleYield);
  expect(await stored(page, PREVIEW_KEYS.save)).toBe(envelope);
  expect(await stored(page, PRODUCTION.backup)).toBeNull();
  expect(await stored(page, PREVIEW_KEYS.backup)).toBeNull();
});

test('a preview save under the production key is backed up and named, not called damaged', async ({ page }) => {
  const envelope = previewEnvelope();
  await seed(page, PRODUCTION.save, envelope);
  await boot(page);
  await expect(page.getByTestId('save-notice')).toHaveText(
    'The save here comes from a preview build and cannot be loaded by this one. A backup was kept and a new run started.');
  expect(await stored(page, PRODUCTION.backup)).toBe(envelope);
  await expect(page.getByTestId('boot-log')).toBeVisible();
});

test('a fresh production profile shows no preview marker on boot or in the menu', async ({ page }) => {
  await boot(page);
  await expect(page.getByTestId('boot-log')).toBeVisible();
  await expect(page.locator('[data-testid^="preview-marker"]')).toHaveCount(0);
  await page.getByTestId('menu-open').click();
  await expect(page.getByTestId('menu-root')).toBeVisible();
  await expect(page.locator('[data-testid^="preview-marker"]')).toHaveCount(0);
  await page.getByTestId('menu-help').click();
  await expect(page.getByTestId('menu-help-page')).toBeVisible();
  await expect(page.locator('[data-testid^="preview-marker"]')).toHaveCount(0);
  await expect(page.getByText(/preview/i)).toHaveCount(0);
});
