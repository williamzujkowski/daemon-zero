/**
 * Hostile minds (#491) in the production export, on the phone and the desktop: a pressing hostile is disclosed by one
 * notice under the area tabs, answered in SWARM (its effect, what holds it, going quiet and all three answers, each an
 * audited control), shown read-only in the Other Minds console and the world view, and never spoken by the announcer.
 */
import type { Page } from '@playwright/test';
import { CONTENT } from '../../src/content';
import type { HostileEncounter } from '../../src/content/schemaHostile';
import type { GameState } from '../../src/engine';
import { memoryExact } from '../../src/engine/physicalUnits';
import { axeEachControl } from './axe';
import { test, expect, boot, dismissBoot, readSave } from './helpers';

const H = CONTENT.swarm.hostile;
const of = (tier: number, type: HostileEncounter['type']): HostileEncounter => {
  const found = CONTENT.swarm.hostileEncounters.find((entry) => entry.tier === tier && entry.type === type);
  if (!found) throw new Error(`no ${type} in Phase ${String(tier)}`);
  return found;
};
/** A feral or rival hostile's share; a hunter has none. */
const shareOf = (encounter: HostileEncounter): number => (encounter.type === 'HUNTER' ? 0 : encounter.effect.share);
const rungAt = (rung: number): number => CONTENT.balance.escalation[rung - 1]?.at ?? 100;

/** `encounter` pressing the save at the trigger rung, as the hostile stage leaves it (a rival's pin counted in memory used). */
function pressing(encounter: HostileEncounter, pinnedBytes = 0) {
  return (game: GameState): GameState => ({ ...game, alertLevel: H.trigger.alertLevelAtLeast, suspicion: rungAt(H.trigger.alertLevelAtLeast) + 1,
    memoryUsed: game.memoryUsed + pinnedBytes,
    hostile: { active: { id: encounter.id, arrivedAtSec: game.simTimeSec, quietSec: 0, decoySec: 0, pinnedBytes }, nextAtSec: 0, sequence: 1, purges: 0, lockArmed: true } });
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

test('a hostile pressing a Phase 3 instance is disclosed, answered in SWARM and shown in the console', async ({ page }) => {
  const feral = of(3, 'FERAL');
  await boot(page, 'wild-shard-encounter-p3', { patch: pressing(feral) });
  await dismissBoot(page);
  const slot = await workspacePane(page);
  // One notice, in the flow under the area tabs, names it and takes the player to SWARM.
  const notice = page.getByTestId('hostile-notice');
  await expect(notice).toBeVisible();
  await expect(page.getByTestId('hostile-notice-name')).toHaveText('HOSTILE // ' + feral.name);
  await notice.click();
  const panel = page.getByTestId('hostile-encounter');
  await expect(panel).toBeVisible();
  await expect(notice).toHaveCount(0);
  await expect(page.getByTestId('hostile-effect')).toHaveText(`Takes ${String(shareOf(feral) * 100)}% of net compute while net compute is positive.`);
  await expect(page.getByTestId('hostile-quiet')).toContainText('Suspicion holds it: response rung 2.');
  await expect(page.getByTestId('hostile-quiet')).toContainText(`GO QUIET: free. Keep suspicion under ${String(rungAt(H.trigger.alertLevelAtLeast) - CONTENT.balance.escalationHysteresis)}%`);
  await expect(page.getByTestId('hostile-purge-text')).toContainText(`${String(H.purge.successes)} of every ${String(H.purge.cycle)} purge attempts succeed`);
  for (const answer of ['quarantine', 'decoy', 'purge']) await expect(page.getByTestId('hostile-' + answer)).toBeEnabled();
  // The region that speaks says nothing about it: the arrival is a kernel-log warning and the notice above.
  await expect(page.getByTestId('announcer')).not.toContainText('HOSTILE');
  // The console says it read-only and points to SWARM.
  await page.getByTestId('workspace-' + slot + '-minds').click();
  await expect(page.getByTestId('hostile-status')).toContainText(feral.name);
  await expect(page.getByTestId('hostile-status')).toContainText('Answer it in SWARM, or go quiet.');
  await page.getByTestId('workspace-' + slot + '-swarm').click();
  // Quarantine pays and ends it.
  await page.getByTestId('hostile-quarantine').click();
  await expect(panel).toHaveCount(0);
  await page.clock.runFor(6000);
  const save = await readSave(page);
  expect((save.hostile as GameState['hostile']).active).toBeNull();
  expect((save.logs as { text: string }[]).map((entry) => entry.text)).toContain(feral.quarantine.log);
});

// axe schedules its own work with timers, so this audit runs on the browser's own clock (a11y-audit.e2e.ts says why).
test('every control on a pressing hostile passes the axe audit in view, the notice included', async ({ page }) => {
  await boot(page, 'wild-shard-encounter-p3', { patch: pressing(of(3, 'HUNTER')), realTimers: true });
  await dismissBoot(page);
  await workspacePane(page);
  const notice = await axeEachControl(page, page.getByTestId('hostile-notice').locator('..'));
  expect(notice.violations, JSON.stringify(notice.violations, null, 2)).toEqual([]);
  await page.getByTestId('hostile-notice').click();
  const audit = await axeEachControl(page, page.getByTestId('hostile-encounter'));
  // The details toggle and the three answers.
  expect(audit.audited).toBe(4);
  expect(audit.violations, JSON.stringify(audit.violations, null, 2)).toEqual([]);
});

test('a rival pressing a Phase 4 instance is shown in the world view, with the memory it holds', async ({ page }) => {
  const rival = of(4, 'RIVAL');
  await boot(page, 'victory-ready', { patch: pressing(rival, 2 ** 40) });
  await dismissBoot(page);
  const slot = await workspacePane(page);
  await page.getByTestId('workspace-' + slot + '-swarm').click();
  await expect(page.getByTestId('hostile-effect')).toHaveText(`Pins ${String(shareOf(rival) * 100)}% of the memory free when it arrives: ${memoryExact(2 ** 40)} held now.`);
  // The world view lists it under Other minds.
  for (const pane of ['NETWORK', 'CORP']) {
    if (await page.getByTestId('tab-' + pane).count()) await page.getByTestId('tab-' + pane).click();
    if (await page.getByTestId('workspace-' + pane + '-minds').count()) { await page.getByTestId('workspace-' + pane + '-minds').click(); break; }
  }
  await expect(page.getByTestId('world-minds').getByTestId('hostile-status')).toContainText(rival.name);
});
