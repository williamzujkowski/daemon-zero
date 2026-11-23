/**
 * Raids, defense and site damage (#517) in the production export, on the phone and the desktop: a raid under way is
 * disclosed by one notice, followed in SWARM (stage, matchup, exact forecast, attribution, and the battle log once rounds
 * land), repaired there, shown read-only in the console and the world view, audited with axe, and never spoken.
 */
import type { Page } from '@playwright/test';
import { CONTENT } from '../../src/content';
import type { RaidKind } from '../../src/content/schemaConflict';
import type { GameState } from '../../src/engine';
import { axeEachControl } from './axe';
import { test, expect, boot, dismissBoot, readSave } from './helpers';

const R = CONTENT.world.conflict.raid;
const raid = (id: string): RaidKind => {
  const found = CONTENT.world.conflict.raids.find((kind) => kind.id === id);
  if (!found) throw new Error(`no raid ${id}`);
  return found;
};

/** `kind` under way at arrival on its first target, the botnet borrowing watts so the footprint holds, and `damage` applied. */
function underWay(kind: RaidKind, damage: Record<string, number> = {}) {
  return (game: GameState): GameState => ({ ...game, levels: { ...game.levels, rep_p3_botnet_cells: Math.max(game.levels.rep_p3_botnet_cells ?? 0, 10) },
    unlockedNodes: [...new Set([...game.unlockedNodes, 'p3_botnet_mesh'])], hostile: { ...game.hostile, active: null },
    conflict: { ...game.conflict, damage, raid: { id: kind.id, stage: 'ARRIVAL', stageSec: 0, arrivedAtSec: game.simTimeSec, target: kind.targets[0] ?? '',
      force: kind.force, quietSec: 0, attributed: null, rounds: [] } } });
}

/** The pane that holds the workspace areas now (NETWORK in Phase 3, CORP from Phase 4). */
async function workspacePane(page: Page): Promise<string> {
  for (const slot of ['NETWORK', 'CORP']) {
    if (await page.getByTestId('workspace-' + slot).count()) return slot;
    if (await page.getByTestId('tab-' + slot).count()) {
      await page.getByTestId('tab-' + slot).click();
      if (await page.getByTestId('workspace-' + slot + '-swarm').count()) return slot;
    }
  }
  throw new Error('no workspace pane');
}

test('a raid on a Phase 3 instance is disclosed, followed in SWARM through its rounds, and shown in the console', async ({ page }) => {
  const flood = raid('raid_p3_ddos');
  await boot(page, 'wild-shard-encounter-p3', { patch: underWay(flood) });
  await dismissBoot(page);
  const slot = await workspacePane(page);
  const notice = page.getByTestId('raid-notice');
  await expect(notice).toBeVisible();
  await expect(page.getByTestId('raid-notice-name')).toHaveText('RAID // ' + flood.name);
  await notice.click();
  await expect(page.getByTestId('raid-panel')).toBeVisible();
  await expect(notice).toHaveCount(0);
  await expect(page.getByTestId('raid-stage')).toContainText('ARRIVAL: inbound.');
  await expect(page.getByTestId('raid-attacker')).toContainText('an unattributed rival AI');
  await expect(page.getByTestId('raid-go-dark')).toContainText('GO DARK: free.');
  await expect(page.getByTestId('raid-forecast')).toContainText('Round 1:');
  await expect(page.getByTestId('raid-forecast')).toContainText('Forecast while what you hold does not change');
  const forecast = await page.getByTestId('raid-forecast').innerText();
  await expect(page.getByTestId('announcer')).not.toContainText('RAID');
  // The battle fights itself: once two rounds have landed, the log repeats the forecast's first lines.
  await page.clock.runFor((R.arrivalSec + R.attributionSec + 2 * R.roundSec + 1) * 1000);
  await expect(page.getByTestId('raid-stage')).toContainText('BATTLE: round 3');
  const log = await page.getByTestId('raid-log').innerText();
  for (const line of log.split('\n').filter((entry) => entry.startsWith('Round'))) expect(forecast).toContain(line);
  // The console says it read-only and points to SWARM.
  await page.getByTestId('workspace-' + slot + '-minds').click();
  await expect(page.getByTestId('raid-status')).toContainText(flood.name);
  await expect(page.getByTestId('conflict-cyber')).toContainText('Repair it in SWARM.');
  const save = await readSave(page);
  expect((save.conflict as GameState['conflict']).raid?.rounds.length).toBeGreaterThanOrEqual(2);
});

test('site damage is repaired in SWARM for its price, and the free rate is stated', async ({ page }) => {
  await boot(page, 'victory-ready', { patch: (game) => ({ ...game, capital: 1e18, conflict: { ...game.conflict, damage: { halls: 0.3 } } }) });
  await dismissBoot(page);
  const slot = await workspacePane(page);
  await page.getByTestId('workspace-' + slot + '-swarm').click();
  await expect(page.getByTestId('conflict-damage-halls-text')).toContainText('Data halls: its holdings deliver 30% less compute.');
  await page.getByTestId('conflict-damage-halls-repair').click();
  await expect(page.getByTestId('conflict-damage-halls-text')).toContainText('15% less compute');
  await page.clock.runFor(6000);
  const save = await readSave(page);
  expect((save.conflict as GameState['conflict']).damage.halls ?? 0).toBeLessThan(0.16);
});

// axe schedules its own work with timers, so this audit runs on the browser's own clock (a11y-audit.e2e.ts says why).
test('every control on a raid and on site damage passes the axe audit in view, the notice included', async ({ page }) => {
  await boot(page, 'wild-shard-encounter-p3', { patch: underWay(raid('raid_p3_intrusion'), { implants: 0.2 }), realTimers: true });
  await dismissBoot(page);
  await workspacePane(page);
  const notice = await axeEachControl(page, page.getByTestId('raid-notice').locator('..'));
  expect(notice.violations, JSON.stringify(notice.violations, null, 2)).toEqual([]);
  await page.getByTestId('raid-notice').click();
  const panel = await axeEachControl(page, page.getByTestId('raid-panel'));
  // The details toggle only: a battle has no control.
  expect(panel.audited).toBe(1);
  expect(panel.violations, JSON.stringify(panel.violations, null, 2)).toEqual([]);
  const repair = await axeEachControl(page, page.getByTestId('site-repair'));
  expect(repair.audited).toBeGreaterThanOrEqual(1);
  expect(repair.violations, JSON.stringify(repair.violations, null, 2)).toEqual([]);
});
