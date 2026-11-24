/**
 * Monitoring parity after release or departure (#555) on the production export, under the phone and desktop projects.
 * Each state is a FIXTURE the engine reached by public actions (tests/lawful-helpers.ts, tests/departure-helpers.ts),
 * loaded through the save key as a returning player's save is (routeSave.ts); the critical-lock state also patches the
 * lock, labelled where it is built. Every surface that warns of AEGIS is on screen, and axe finds nothing on the page.
 * Live clock, as the route audits use: observed in headless Chromium, not a device test.
 */
import { expect, test, type Page } from '@playwright/test';
import type { GameState } from '../../src/engine';
import { depart } from '../departure-helpers';
import { must } from '../helpers';
import { chartered, leased, released } from '../lawful-helpers';
import { axeViolations } from './axe';
import { openRouteState } from './routeSave';
import type { RouteState } from './routeStates';

const company = chartered();

/** Opens `state` on NETWORK > FACTIONS, where the console lives, with `reach` attached. */
async function openConsole(page: Page, name: string, state: () => GameState, reach: string): Promise<void> {
  const entry: RouteState = { name, state, pane: 'NETWORK', area: 'minds', scope: 'widget-OTHER_MINDS_COMMS_CONSOLE', reach };
  await openRouteState(page, entry);
}

async function expectNoAxeViolations(page: Page): Promise<void> {
  await page.waitForTimeout(400);
  const violations = await axeViolations(page);
  expect(violations, JSON.stringify(violations, null, 2)).toEqual([]);
}

test('FIXTURE released company: the AEGIS lock and suspicion in the HUD, and the world view without undecoded faction cards', async ({ page }) => {
  await openConsole(page, 'released world view', () => released(company), 'world-view');
  await expect(page.getByTestId('aegis-hud')).toContainText('/ 100%');
  await expect(page.getByTestId('suspicion-meter')).toBeVisible();
  await expect(page.getByTestId('thermal-meter')).toHaveCount(0);
  await page.getByTestId('world-aegis').scrollIntoViewIfNeeded();
  await expect(page.getByTestId('aegis-why')).toHaveText('AEGIS is not scanning this instance, so it has nothing to adapt to.');
  await expect(page.getByTestId('world-actors')).toBeAttached();
  await page.getByTestId('minds-undecoded').scrollIntoViewIfNeeded();
  await expect(page.getByTestId('minds-undecoded')).toBeVisible();
  await expect(page.getByTestId('faction-ai_eidolon')).toHaveCount(0);
  await expectNoAxeViolations(page);
});

test('FIXTURE departed below Phase 4: the thermal gauge, the lock and suspicion, the console before its world view', async ({ page }) => {
  await openConsole(page, 'departed console', () => must(depart(leased())), 'aegis-lock');
  await expect(page.getByTestId('aegis-hud')).toBeVisible();
  await expect(page.getByTestId('suspicion-meter')).toBeVisible();
  await expect(page.getByTestId('thermal-meter')).toBeVisible();
  await expect(page.getByTestId('world-view')).toHaveCount(0);
  await expectNoAxeViolations(page);
});

test('FIXTURE departed at Phase 4, lock patched to 90.2: CRITICAL in words in the HUD and in the menu', async ({ page }) => {
  // FIXTURE patch: the lock a departed company's sweep reaches (tests/sim-departure.spec.ts measures it rising).
  await openConsole(page, 'departed critical', () => ({ ...must(depart(company)), aegisLock: 90.2 }), 'world-view');
  await expect(page.getByTestId('aegis-hud')).toContainText('CRITICAL');
  await page.getByTestId('menu-open').click();
  await expect(page.getByTestId('menu-status')).toContainText('AEGIS LOCK CRITICAL');
  await expectNoAxeViolations(page);
});
