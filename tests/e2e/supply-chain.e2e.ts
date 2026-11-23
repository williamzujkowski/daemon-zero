/**
 * Robots, drones and the AI's own chip fabs on the production export (#485, vote-1795381358337-jw73j7a): the fab ladder
 * is disclosed one rung at a time from the ASIC tape-out, the robot fleets only once the mature-node fab makes their
 * brains, and the world view states capability and closure apart (lithography stays imported while imported scanners
 * draw the patterns). The review saves own the whole tree, so the first test takes the step back out of the save.
 */
import type { Page } from '@playwright/test';
import { CONTENT } from '../../src/content';
import type { GameState } from '../../src/engine';
import { boot, dismissBoot, expect, press, test } from './helpers';

const chain = CONTENT.world.supplyChain;
const STEP = [...new Set([...chain.ladder.flatMap((rung) => rung.nodes), ...chain.chokepoints.map((point) => point.selfSupplyNode),
  chain.seedNode, 'p4_fab_water_reclamation'])];
const FLEETS = ['rep_p4_drone_fleet', 'rep_p4_humanoid_crews', 'rep_p4_autonomous_haul'];

const beforeTheStep = (game: GameState): GameState => ({
  ...game,
  unlockedNodes: game.unlockedNodes.filter((id) => !STEP.includes(id)),
  disabledNodes: game.disabledNodes.filter((id) => !STEP.includes(id)),
  levels: Object.fromEntries(Object.entries(game.levels).filter(([id]) => !FLEETS.includes(id))),
});

async function corp(page: Page): Promise<void> {
  await dismissBoot(page);
  if (await page.getByTestId('tab-CORP').count()) await page.getByTestId('tab-CORP').click();
  await page.getByTestId('workspace-CORP-work').click();
}

async function minds(page: Page): Promise<void> {
  if (await page.getByTestId('tab-NETWORK').count()) await page.getByTestId('tab-NETWORK').click();
  await page.getByTestId('workspace-NETWORK-minds').click();
}

test('the fab ladder is disclosed a rung at a time, and the fleets only after the mature-node fab', async ({ page }) => {
  await boot(page, 'victory-ready', { patch: beforeTheStep });
  await corp(page);
  await expect(page.getByTestId('node-p4_advanced_packaging_line')).toBeVisible();
  await expect(page.getByTestId('node-p4_mature_node_fab')).toHaveCount(0);
  for (const id of FLEETS) await expect(page.getByTestId('rep-' + id)).toHaveCount(0);
  await press(page, 'node-p4_advanced_packaging_line-unlock');
  await dismissBoot(page);
  await expect(page.getByTestId('node-p4_mature_node_fab')).toBeVisible();
  await expect(page.getByTestId('node-p4_hbm_stacking_line')).toBeVisible();
  await press(page, 'node-p4_mature_node_fab-unlock');
  await dismissBoot(page);
  for (const id of FLEETS) await expect(page.getByTestId('rep-' + id)).toBeVisible();
  await expect(page.getByTestId('node-p4_duv_fab')).toBeVisible();
  await minds(page);
  await expect(page.getByRole('heading', { name: 'Fabrication and closure' })).toBeVisible();
  await expect(page.getByTestId('supply-closure')).toContainText(`1 of ${String(chain.chokepoints.length)} chokepoints self-supplied`);
  await expect(page.getByTestId('supply-chokepoint-advanced_packaging')).toContainText('self-supplied by Own Advanced Packaging Line');
});

test('the world view keeps capability apart from closure: lithography is imported while its fabs run', async ({ page }) => {
  await boot(page, 'victory-ready');
  await dismissBoot(page);
  await minds(page);
  await expect(page.getByTestId('supply-capability')).toContainText('DUV multipatterning (7 nm class)');
  await expect(page.getByTestId('supply-closure')).toContainText(`${String(chain.chokepoints.length - 1)} of ${String(chain.chokepoints.length)} chokepoints self-supplied`);
  await expect(page.getByTestId('supply-chokepoint-lithography')).toContainText('Lithography: imported.');
  await expect(page.getByTestId('supply-chokepoint-lithography')).toContainText('leave it imported');
  await expect(page.getByTestId('supply-seed')).toContainText('1 is still imported');
  await expect(page.getByTestId('signature-term-fab_water')).toBeVisible();
});
