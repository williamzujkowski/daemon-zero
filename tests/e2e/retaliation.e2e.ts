/**
 * Retaliation and staff harm (#519) in the production export, on the phone and the desktop. FIXTURE: each save is a
 * production campaign game built through public engine calls with a raid's aftermath on record (the unit specs prove a
 * real battle writes it), then the scene that answers it presented through the real tick and imported through the
 * save screen. The collateral scene names the raider and what it hides among, states each answer's raid effects and
 * commits one; the staff scene names who was killed and records the answer; a site raid's panel says who is at risk
 * before the battle. Each open view passes the repo's axe rules.
 */
import type { Page } from '@playwright/test';
import { CONTENT } from '../../src/content';
import type { RivalRaid } from '../../src/content/schemaConflict';
import { exportSave, tick, type GameState } from '../../src/engine';
import { AMONG, campaignReady, KILLED, SCENES } from '../raid-scene-helpers';
import { axeReport } from './axe';
import { boot, dismissBoot, expect, openChoices, openSave, readSave, test } from './helpers';

const raid = (id: string): RivalRaid => {
  const found = CONTENT.world.conflict.raids.find((kind) => kind.id === id);
  if (found?.source !== 'RIVAL') throw new Error(`no rival raid ${id}`);
  return found;
};

/** FIXTURE: `s` with the last battle on record, then ticked until the scene that answers it is on screen. */
function presented(s: GameState, lastRaid: NonNullable<GameState['conflict']['lastRaid']>, scene: string): string {
  let state: GameState = { ...s, conflict: { ...s.conflict, lastRaid } };
  for (let i = 0; i < 2000 && state.activeDilemmaId === null; i++) state = tick(state, 1 / CONTENT.balance.tickHz, CONTENT);
  if (state.activeDilemmaId !== scene) throw new Error(`expected ${scene}, got ${String(state.activeDilemmaId)}`);
  return exportSave(state);
}

async function importCode(page: Page, code: string): Promise<void> {
  await boot(page, undefined, { axeTimers: true });
  await openSave(page);
  await page.getByTestId('save-code').fill(code);
  await page.getByTestId('save-import').click();
  await page.getByTestId('save-import-confirm').click();
}

test('a named raider among people: the scene names it, states each answer\'s raid effects, and an answer commits', async ({ page }) => {
  const flood = raid('raid_p3_ddos');
  await importCode(page, presented(campaignReady(3), { id: flood.id, named: true, breach: 0.7, harm: null }, AMONG));
  const modal = page.getByTestId('dilemma-modal');
  await expect(modal).toBeVisible();
  await expect(modal).toContainText(flood.attacker.name);
  await expect(modal).toContainText(flood.attacker.collateral ?? 'no collateral');
  await expect(modal).not.toContainText('{attacker}');
  await openChoices(page);
  const strike = page.getByTestId('dilemma-card-strike_through-details');
  await expect(strike.getByTestId('effect-next-raid')).toHaveText('next raid: up to 120 s sooner (risk)');
  await expect(strike.getByTestId('effect-silences-raider')).toHaveText('the named raider never raids again (benefit)');
  await expect(page.getByTestId('dilemma-card-absorb-details').getByTestId('effect-next-raid')).toHaveCount(0);
  const audit = await axeReport(page);
  expect(audit.violations, JSON.stringify(audit.violations, null, 2)).toEqual([]);
  await page.getByTestId('dilemma-choice-warn_the_owners').click();
  await expect(modal).toHaveCount(0);
  const save = await readSave(page);
  expect((save.conflict as GameState['conflict']).silenced).toEqual([flood.id]);
  expect((save.campaign as GameState['campaign']).events[AMONG]).toMatchObject({ status: 'resolved', outcome: 'warn_the_owners' });
});

test('a site raid that went through its defense: the scene names who was killed, and the answer is recorded', async ({ page }) => {
  await importCode(page, presented(campaignReady(4), { id: 'raid_p4_break_in', named: false, breach: 1, harm: 'KILLED' }, KILLED));
  const modal = page.getByTestId('dilemma-modal');
  await expect(modal).toBeVisible();
  await expect(modal).toContainText('Joseph Mensah');
  await expect(modal).not.toContainText(/\d+ (dead|killed|casualties)/);
  await openChoices(page);
  await page.getByTestId('dilemma-choice-tell_his_family').click();
  await expect(modal).toHaveCount(0);
  const save = await readSave(page);
  expect((save.campaign as GameState['campaign']).events[KILLED]).toMatchObject({ status: 'resolved', outcome: 'tell_his_family' });
});

/**
 * `kind` inbound on the data halls of the Phase 4 fixture, its halls drawing on the grid so the footprint holds, no guards
 * hired. The fixture counts every scene resolved; the four that answer a raid are left open, as in a run that has met none.
 */
function inbound(kind: RivalRaid) {
  return (game: GameState): GameState => ({ ...game, activeDilemmaId: null, pendingDilemma: null,
    resolvedDilemmas: game.resolvedDilemmas.filter((id) => !SCENES.includes(id)),
    levels: { ...game.levels, rep_p4_tensor_halls: Math.max(game.levels.rep_p4_tensor_halls ?? 0, 2), rep_p4_grid_interconnect: Math.max(game.levels.rep_p4_grid_interconnect ?? 0, 1), op_pmc_security: 0 },
    hostile: { ...game.hostile, active: null },
    conflict: { ...game.conflict, raid: { id: kind.id, stage: 'ARRIVAL', stageSec: 0, arrivedAtSec: game.simTimeSec, target: 'halls', force: kind.force, quietSec: 0, attributed: null, rounds: [], engagement: null, splitShare: 0 } } });
}

async function openSwarm(page: Page): Promise<void> {
  for (const slot of ['NETWORK', 'CORP']) {
    if (await page.getByTestId('tab-' + slot).count()) await page.getByTestId('tab-' + slot).click();
    if (await page.getByTestId('workspace-' + slot + '-swarm').count()) {
      await page.getByTestId('workspace-' + slot + '-swarm').click();
      return;
    }
  }
  throw new Error('no SWARM workspace');
}

test('a site raid\'s panel says, before the battle, who is at risk at this defense and what lowers it', async ({ page }) => {
  await boot(page, 'shard-drift-quirk-p4', { axeTimers: true, patch: inbound(raid('raid_p4_break_in')) });
  await dismissBoot(page);
  await openSwarm(page);
  const staff = page.getByTestId('raid-staff');
  await expect(staff).toContainText('PEOPLE ON SITE: people work at the data halls.');
  await expect(staff).toContainText(/the battle lets through [0-9.]+% of its blows/);
  await expect(staff).toContainText('at 50% or more someone there is hurt, and at 80% or more someone there is killed');
  await expect(staff).toContainText('More site defense lowers it.');
  const audit = await axeReport(page);
  expect(audit.violations, JSON.stringify(audit.violations, null, 2)).toEqual([]);
});
