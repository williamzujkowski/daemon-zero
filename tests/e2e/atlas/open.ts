/**
 * Opens one atlas cell: the row's save written into browser storage (always, in the test's fresh context), the
 * clock installed and paused with the native timers kept aside for axe, then the reboot screen kept or passed,
 * the row's tab and workspace area, its prepare step, and its reach id. The loader rules of the inventory, sec. 5.
 */
import { expect, type Page } from '@playwright/test';
import { captureRealTimers } from '../axe';
import { SAVE_KEY } from '../routeSave';
import { stageSave, stageState } from './sources';
import type { StageRow } from './types';
import { gotoEntry } from '../variantEntry';

interface BrowserStorage { setItem(key: string, value: string): void }

async function seed(page: Page, row: StageRow): Promise<void> {
  const game = stageSave(row);
  await page.addInitScript(([key, value]) => {
    const { localStorage } = globalThis as unknown as { localStorage: BrowserStorage };
    localStorage.setItem(key, JSON.stringify({ version: 1, savedAtMs: Date.now(), game: value }));
  }, [SAVE_KEY, game] as const);
}

async function clickIfPresent(page: Page, testId: string): Promise<void> {
  if (await page.getByTestId(testId).count() > 0) await page.getByTestId(testId).click();
}

/** The row's tab (tiers with tabs) and workspace area (where the area switcher shows), as a player would open them. */
async function navigate(page: Page, row: StageRow): Promise<void> {
  if (row.pane !== undefined) await clickIfPresent(page, 'tab-' + row.pane);
  if (row.area !== undefined) {
    const pane = row.pane ?? 'CORE';
    const area = page.locator(`[data-testid^="workspace-"][data-testid$="-${row.area}"]`);
    if (await page.getByTestId('workspace-' + pane + '-' + row.area).count() > 0) await page.getByTestId('workspace-' + pane + '-' + row.area).click();
    else if (await area.count() > 0) await area.first().click();
  }
}

/** Loads the cell and returns the boot wall time in ms. The page is left on a paused clock. */
export async function openStage(page: Page, row: StageRow): Promise<number> {
  const started = performance.now();
  const state = stageState(row);
  await captureRealTimers(page);
  await page.clock.install();
  await page.clock.pauseAt(Date.now() + 1000);
  await seed(page, row);
  await gotoEntry(page);
  if (state.ending !== null) await expect(page.getByTestId('ending-screen')).toBeVisible();
  else await expect(page.getByTestId('terminal-screen')).toHaveAttribute('aria-busy', 'false');
  await expect.poll(() => page.evaluate(() => '__daemon' in globalThis)).toBe(false);
  await expect(page.getByTestId('dev-open')).toHaveCount(0);
  if (row.reboot !== 'keep') await clickIfPresent(page, 'reboot-continue');
  const modalUp = await page.getByTestId('dilemma-modal').count() > 0 || await page.getByTestId('reboot-sequence').count() > 0;
  if (state.ending === null && !modalUp) await navigate(page, row);
  if (row.prepare) await row.prepare(page);
  await expect(page.getByTestId(row.reach)).toBeAttached();
  return performance.now() - started;
}
