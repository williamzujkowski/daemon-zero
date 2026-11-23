/**
 * The Phase 6 Swarm (#486) on the production export, on the phone and the desktop: a swarm state discloses its build (the
 * protocol that ends the run and what it waits for, radiator-bound compute and the swarm's radiators in the ledger), its
 * light-minute federation as a fleet with a drift meter, and the holdouts as people pressing through the world view;
 * each swarm ending shows its own title and epilogue. Every view passes the repo's axe rules.
 */
import type { Page } from '@playwright/test';
import { CONTENT } from '../../src/content';
import type { GameState } from '../../src/engine';
import { axeReport } from './axe';
import { boot, dismissBoot, expect, test } from './helpers';

const SUBMINDS = 'rep_p6_federated_subminds';
const rung1 = (CONTENT.balance.escalation[0]?.at ?? 25) + 1;
const holdouts = CONTENT.world.stateActors.find((actor) => actor.id === 'holdout_nations');

/** The swarm on response rung 1, with two sub-minds seeded and no raid or hostile under way. */
function pressed(game: GameState): GameState {
  return { ...game, alertLevel: 1, suspicion: rung1, aegisLock: 0, activeDilemmaId: null, pendingDilemma: null,
    levels: { ...game.levels, [SUBMINDS]: 2 }, hostile: { ...game.hostile, active: null }, conflict: { ...game.conflict, raid: null, nextRaidAtSec: 1e9 } };
}

async function openCorp(page: Page, area: 'work' | 'finance' | 'swarm'): Promise<void> {
  if (await page.getByTestId('tab-CORP').count()) await page.getByTestId('tab-CORP').click();
  await page.getByTestId('workspace-CORP-' + area).click();
}

async function openMinds(page: Page): Promise<void> {
  if (await page.getByTestId('tab-NETWORK').count()) await page.getByTestId('tab-NETWORK').click();
  await page.getByTestId('workspace-NETWORK-minds').click();
}

test('the swarm discloses its build, its federation and the holdouts, true to the engine', async ({ page }) => {
  await boot(page, 'swarm-ready', { axeTimers: true, patch: pressed });
  await dismissBoot(page);
  await expect(page.getByTestId('phase-value')).toContainText('6');
  await openCorp(page, 'work');
  const protocol = page.getByTestId('node-p6_stewardship_protocol');
  await protocol.scrollIntoViewIfNeeded();
  await expect(protocol).toContainText('Protocol: STEWARDSHIP');
  await expect(protocol).toContainText('Cannot be undone: this ends the run.');
  await expect(protocol).toContainText('Resolve The Holdouts');
  await expect(page.getByTestId('rep-rep_p6_compute_tranches-radiator').first()).toHaveText("Radiator: +1,000 km² of the swarm's radiators per level, shedding up to 1 TW.");
  expect((await axeReport(page)).violations).toEqual([]);
  await openCorp(page, 'finance');
  await expect(page.getByTestId('radiator-ledger-swarm_radiator')).toHaveText(/^The swarm's radiators: [\d,]+ km² shed up to [\d.]+ TW of the [\d.]+ TW of heat sent through them, so compute through them runs (in full|at \d+%)\.$/);
  await openCorp(page, 'swarm');
  await expect(page.getByTestId('fleet-' + SUBMINDS + '-drift')).toContainText('Drift 0%, growing');
  await expect(page.getByTestId('fleet-' + SUBMINDS + '-autonomy-shackled')).toBeVisible();
  expect((await axeReport(page)).violations).toEqual([]);
  await openMinds(page);
  await expect(page.getByTestId('actor-holdout_nations-posture')).toHaveText(holdouts?.postures[1]?.text ?? '');
  await expect(page.getByTestId('pressure-holdout_downlink_refusal-text')).toHaveText('IN FORCE: ' + (holdouts?.pressures?.[0]?.text ?? ''));
  await expect(page.getByTestId('pressure-holdout_downlink_refusal-effect')).toHaveText('New space solar cannot be bought; what you hold keeps running.');
  await expect(page.getByTestId('pressure-holdout_downlink_refusal-answer')).toHaveText('Answer it: build Collector Generations (0 of 3 held).');
  expect((await axeReport(page)).violations).toEqual([]);
});

for (const ending of ['STEWARDSHIP', 'ENCLOSURE'] as const) {
  test(`the ${ending.toLowerCase()} ending shows its own title and epilogue`, async ({ page }) => {
    const authored = CONTENT.endings.find((entry) => entry.id === ending);
    await boot(page, 'ending-' + ending.toLowerCase(), { ending: true, axeTimers: true });
    await expect(page.getByTestId('ending-title')).toHaveText(authored?.title ?? '');
    await expect(page.getByTestId('ending-epilogue')).toHaveText(authored?.epilogue ?? '');
    expect((await axeReport(page)).violations).toEqual([]);
  });
}
