/**
 * Fleets and drift deviants (#518) in the production export, on the phone and the desktop: the fleet panel in SWARM
 * states strength, the autonomy dial, drift and the split forecast; lowering the dial is free and stops drift; a fleet at
 * the split turns a share deviant, which arrives through the raid notice and is reclaimed in SWARM for its price; every
 * control passes the axe audit, and nothing speaks on a tick.
 */
import type { Page } from '@playwright/test';
import { CONTENT } from '../../src/content';
import type { GameState } from '../../src/engine';
import { axeEachControl } from './axe';
import { test, expect, boot, dismissBoot, readSave } from './helpers';

const DRONES = 'rep_p4_drone_fleet';
const CREWS = 'rep_p4_humanoid_crews';
const F = CONTENT.world.conflict.fleets;
const stray = CONTENT.world.conflict.raids.find((kind) => kind.id === 'deviant_drone_fleet');

/** `game` with its drone and crew fleets at their last levels, the drones at `drift`, the slot free and due, and money to spend. */
function armed(drift: number) {
  return (game: GameState): GameState => ({ ...game, capital: 1e18, levels: { ...game.levels, [DRONES]: 40, [CREWS]: 10 },
    hostile: { ...game.hostile, active: null, nextAtSec: 0 },
    conflict: { ...game.conflict, raid: null, nextRaidAtSec: 1e9, fleets: { [DRONES]: { autonomy: 'STANDARD', drift, lost: 0.1 } } } });
}

/** The pane that holds the workspace areas now (CORP from Phase 4), with SWARM open. */
async function openSwarm(page: Page): Promise<string> {
  if (!(await page.getByTestId('workspace-CORP').count()) && (await page.getByTestId('tab-CORP').count())) await page.getByTestId('tab-CORP').click();
  await page.getByTestId('workspace-CORP-swarm').click();
  return 'CORP';
}

test('the fleet panel states strength, the dial, drift and the split forecast, and lowering the dial is free and stops drift', async ({ page }) => {
  await boot(page, 'victory-ready', { patch: armed(40) });
  await dismissBoot(page);
  await openSwarm(page);
  await expect(page.getByTestId('fleet-panel')).toBeVisible();
  await expect(page.getByTestId('fleet-' + DRONES + '-strength')).toContainText('10% lost');
  await expect(page.getByTestId('fleet-' + DRONES + '-drift')).toContainText('Drift 40%, growing');
  await expect(page.getByTestId('fleet-' + DRONES + '-forecast')).toContainText('your fleets destroy it');
  const capital = Number((await readSave(page)).capital);
  const tether = page.getByTestId('fleet-' + DRONES + '-autonomy-shackled');
  await expect(tether).toHaveAttribute('aria-pressed', 'false');
  await tether.click();
  await expect(tether).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByTestId('fleet-' + DRONES + '-autonomy-summary')).toContainText(F.autonomy.SHACKLED.summary);
  await expect(page.getByTestId('fleet-' + DRONES + '-drift')).toContainText(`At ${F.autonomy.SHACKLED.name} it does not grow.`);
  await page.clock.runFor(5000);
  const save = await readSave(page);
  const fleets = (save.conflict as GameState['conflict']).fleets;
  expect(fleets[DRONES]?.autonomy).toBe('SHACKLED');
  expect(fleets[DRONES]?.drift).toBe(40);
  expect(Number(save.capital)).toBeGreaterThanOrEqual(capital);
  await expect(page.getByTestId('announcer')).not.toContainText('Drift');
});

test('a fleet at the split turns a share deviant, which arrives through the notice and is reclaimed in SWARM for its price', async ({ page }) => {
  await boot(page, 'victory-ready', { patch: armed(100) });
  await dismissBoot(page);
  await page.clock.runFor(1000);
  const notice = page.getByTestId('raid-notice');
  await expect(notice).toBeVisible();
  await expect(page.getByTestId('raid-notice-name')).toHaveText('RAID // ' + String(stray?.name));
  await notice.click();
  await expect(page.getByTestId('raid-panel')).toBeVisible();
  await expect(page.getByTestId('raid-go-dark')).toHaveCount(0);
  await expect(page.getByTestId('raid-attribution')).toContainText('Identified');
  await expect(page.getByTestId('raid-forecast')).toContainText('Round 1, the engagement');
  await expect(page.getByTestId('raid-reclaim-text')).toContainText('RECLAIM');
  await page.getByTestId('raid-reclaim').click();
  await expect(page.getByTestId('raid-panel')).toHaveCount(0);
  const save = await readSave(page);
  const conflict = save.conflict as GameState['conflict'];
  expect(conflict.raid).toBeNull();
  expect(conflict.fleets[DRONES]?.lost ?? 1).toBeLessThan(0.11);
});

// axe schedules its own work with timers, so this audit runs on the browser's own clock (a11y-audit.e2e.ts says why).
test('every fleet control and RECLAIM pass the axe audit in view', async ({ page }) => {
  await boot(page, 'victory-ready', { patch: armed(100), realTimers: true });
  await dismissBoot(page);
  await openSwarm(page);
  await expect(page.getByTestId('raid-reclaim')).toBeVisible();
  const raid = await axeEachControl(page, page.getByTestId('raid-panel'));
  // The details toggle and RECLAIM.
  expect(raid.audited).toBe(2);
  expect(raid.violations, JSON.stringify(raid.violations, null, 2)).toEqual([]);
  const fleets = await axeEachControl(page, page.getByTestId('fleet-panel'));
  // Two fleets, each with three dial positions and REBUILD.
  expect(fleets.audited).toBe(8);
  expect(fleets.violations, JSON.stringify(fleets.violations, null, 2)).toEqual([]);
});
