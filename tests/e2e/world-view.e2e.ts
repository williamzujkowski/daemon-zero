/**
 * The world view on the production export (#463, vote-1795366701521-dhlwfwb), at both gated sizes: before its
 * disclosure phase the Other Minds console is AEGIS and the factions; from Phase 4 it is the world view, with AEGIS
 * posture (lock, scan, adaptation, why), public trust, state actors and each faction panel once. It holds the repo's
 * axe rules, adds no scroll container of its own (the phone's one primary scroll) and leaves the HUD pin inside its
 * 35% cap; it is never retired to the Archive.
 */
import type { Page } from '@playwright/test';
import type { Window } from 'happy-dom';
import { CONTENT } from '../../src/content';
import { HUD_PIN_SHARE } from '../../src/ui/hudPin';
import { axeReport } from './axe';
import { boot, dismissBoot, expect, test } from './helpers';

async function openMinds(page: Page): Promise<void> {
  // The phone's bottom tab, or the desktop third column's own NETWORK tab once CORP shares the column.
  if (await page.getByTestId('tab-NETWORK').count()) await page.getByTestId('tab-NETWORK').click();
  await page.getByTestId('workspace-NETWORK-minds').click();
}

/** Scroll containers inside the world view: the one-scroll rule allows none. */
async function nestedScrolls(page: Page): Promise<number> {
  return page.getByTestId('world-view').evaluate((root) => {
    const browser = globalThis as unknown as Window;
    const all = [root, ...(root as unknown as { querySelectorAll(selector: string): unknown[] }).querySelectorAll('*')];
    return all.filter((node) => ['auto', 'scroll'].includes(browser.getComputedStyle(node as never).overflowY)).length;
  });
}

test('before Phase 4 the console is AEGIS and the factions, with no world view', async ({ page }) => {
  await boot(page, 'eidolon-trust-85');
  await dismissBoot(page);
  await openMinds(page);
  await expect(page.getByTestId('widget-OTHER_MINDS_COMMS_CONSOLE')).toBeVisible();
  await expect(page.getByTestId('aegis-lock')).toBeVisible();
  await expect(page.getByTestId('world-view')).toHaveCount(0);
});

test('from Phase 4 the console is the world view: AEGIS posture, public trust, state actors, the factions once', async ({ page }) => {
  await boot(page, 'victory-ready', { axeTimers: true, patch: (game) => ({ ...game, aegisAdaptation: 80 }) });
  await dismissBoot(page);
  await openMinds(page);
  const world = page.getByTestId('world-view');
  await expect(world).toBeVisible();
  for (const name of ['AEGIS posture', 'Public trust', 'State actors', 'Other minds']) {
    await expect(world.getByRole('heading', { name, level: 3 })).toBeVisible();
  }
  await expect(page.getByRole('progressbar', { name: 'AEGIS adaptation' })).toHaveAttribute('aria-valuenow', '80');
  await expect(page.getByTestId('aegis-stage')).toHaveText(CONTENT.world.aegis.stages.coalitionBacking);
  await expect(page.getByTestId('aegis-why')).not.toBeEmpty();
  await expect(page.getByTestId('aegis-cap')).toContainText('Adaptation has lowered its cap from 90%');
  await expect(page.getByTestId('aegis-strike')).toContainText(/lock completes in \d|not rising/);
  await expect(page.getByRole('progressbar', { name: 'Public trust' })).toBeVisible();
  for (const actor of CONTENT.world.stateActors) await expect(page.getByTestId('actor-' + actor.id + '-posture')).not.toBeEmpty();
  // No parallel faction display: each faction panel exists exactly once, inside the world view.
  for (const faction of CONTENT.factions.values()) {
    await expect(page.getByTestId('faction-' + faction.id)).toHaveCount(1);
    await expect(world.getByTestId('faction-' + faction.id)).toHaveCount(1);
  }
  // The compact AEGIS readout stays in the HUD.
  await expect(page.getByTestId('aegis-hud')).toBeVisible();

  expect(await nestedScrolls(page), 'the world view adds no scroll of its own').toBe(0);
  expect(await page.evaluate(() => {
    const browser = globalThis as unknown as Window;
    return browser.document.documentElement.scrollWidth <= browser.innerWidth;
  }), 'no horizontal page scroll').toBe(true);
  if (test.info().project.name === 'phone') {
    await page.clock.runFor(500);
    // The world view adds nothing to the HUD: it stays pinned, inside its share of the window.
    await expect.poll(() => page.getByTestId('sticky-chrome').getAttribute('data-hud-pinned')).toBe('yes');
    const sticky = await page.getByTestId('sticky-chrome').boundingBox();
    expect(sticky?.height ?? Infinity).toBeLessThanOrEqual((page.viewportSize()?.height ?? 0) * HUD_PIN_SHARE);
  }

  const audit = await axeReport(page);
  expect(audit.nativeTimers).toBe(true);
  expect(audit.violations).toEqual([]);

  // It is the console, not a retired window: nothing of it goes to the Archive.
  await page.getByTestId('workspace-NETWORK-reference').click();
  await expect(page.getByTestId('archive-' + CONTENT.world.hostWidget)).toHaveCount(0);
});
