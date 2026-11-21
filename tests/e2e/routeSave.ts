/**
 * The one place the route accessibility specs (DZ-13.4) put a FIXTURE save in browser storage and open
 * it, under the production save key: the route ships in production since the release (#233).
 */
import { expect, type Page } from '@playwright/test';
import { serialize } from '../../src/engine';
import type { RouteState } from './routeStates';
import { gotoEntry } from './variantEntry';

export const SAVE_KEY = 'daemon-zero.save.v1';
interface BrowserStorage { setItem(key: string, value: string): void }

/** Seeds the state through the ordinary storage envelope, the way a returning player's save is read. */
export async function seedRouteSave(page: Page, entry: RouteState): Promise<void> {
  const game = serialize(entry.state());
  await page.addInitScript(([key, value]) => {
    const { localStorage } = globalThis as unknown as { localStorage: BrowserStorage };
    localStorage.setItem(key, JSON.stringify({ version: 1, savedAtMs: Date.now(), game: value }));
  }, [SAVE_KEY, game] as const);
}

/**
 * Opens a seeded state on the pane and workspace area its surface lives in, then runs the entry's own
 * visible steps. A reboot screen is left standing for an entry that is about it, and passed otherwise.
 */
export async function openRouteState(page: Page, entry: RouteState): Promise<void> {
  await seedRouteSave(page, entry);
  await gotoEntry(page);
  // An ended run renders its ending without the terminal underneath.
  if (entry.scope === 'ending-screen') await expect(page.getByTestId('ending-screen')).toBeVisible();
  else await expect(page.getByTestId('terminal-screen')).toHaveAttribute('aria-busy', 'false');
  if (entry.reboot === 'pass' && await page.getByTestId('reboot-continue').count()) await page.getByTestId('reboot-continue').click();
  if (entry.reboot !== 'keep' && await page.getByTestId('reboot-sequence').count() === 0 && entry.scope !== 'dilemma-modal') {
    const pane = entry.pane ?? 'CORE';
    if (await page.getByTestId('tab-' + pane).count()) await page.getByTestId('tab-' + pane).click();
    if (entry.area !== undefined) await page.getByTestId('workspace-' + pane + '-' + entry.area).click();
  }
  if (entry.prepare) await entry.prepare(page);
  await expect(page.getByTestId(entry.reach)).toBeAttached();
}
