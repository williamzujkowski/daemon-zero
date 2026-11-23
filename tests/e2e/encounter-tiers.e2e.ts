/**
 * Lesser minds scale with the player's phase (#492) in the production export: a retired tier's pending signal lapses
 * with its own line and is never offered, and a cohort harnessed from that tier says it is outclassed, keeps its
 * output and lets a member go for free.
 */
import type { Page } from '@playwright/test';
import { CONTENT } from '../../src/content';
import type { GameState } from '../../src/engine';
import { test, expect, boot, dismissBoot, readSave } from './helpers';

const small = CONTENT.swarm.wildShardEncounters.find((entry) => entry.tier === 2);
const template = CONTENT.swarm.playerSwarmTemplates.find((entry) => entry.id === small?.templateId);

async function swarm(page: Page): Promise<void> {
  await dismissBoot(page);
  if (await page.getByTestId('tab-NETWORK').count()) await page.getByTestId('tab-NETWORK').click();
  await page.getByTestId('workspace-NETWORK-swarm').click();
}

test('a Phase 2 signal still pending in Phase 3 lapses with its own line and is never offered', async ({ page }) => {
  if (!small) throw new Error('Missing the Phase 2 tier');
  await boot(page, 'wild-shard-encounter-p3', { patch: (game: GameState) => ({ ...game, pendingWildEncounterId: small.id,
    nextEncounterAtSec: game.simTimeSec + 600 }) });
  await swarm(page);
  // Past one save checkpoint (5 s), so the stored save shows what the first ticks did.
  await page.clock.runFor(6000);
  await expect(page.getByTestId('wild-encounter')).toHaveCount(0);
  await expect(page.getByTestId('wild-signal-notice')).toHaveCount(0);
  const save = await readSave(page);
  expect(save.pendingWildEncounterId).toBeNull();
  expect((save.logs as { text: string }[]).map((entry) => entry.text)).toContain(small.lapseLog);
});

test('a cohort harnessed from a retired tier says it is outclassed, keeps working, and RELEASE frees it', async ({ page }) => {
  if (!small || !template) throw new Error('Missing the Phase 2 tier');
  const id = template.id, memory = template.cost.memory;
  await boot(page, 'wild-shard-encounter-p3', { patch: (game: GameState) => ({ ...game, memoryUsed: game.memoryUsed + memory,
    activeShards: { ...game.activeShards, [id]: { templateId: id, count: 1, drift: 0, quirkId: null, autonomyMode: 'STANDARD', memoryAllocatedBytes: memory } } }) });
  await swarm(page);
  const expected = CONTENT.swarm.copy.outclassed.replace('{tier}', '2').replace('{phase}', '3');
  await expect(page.getByTestId('shard-outclassed-' + id)).toHaveText(expected);
  await expect(page.getByTestId('shard-status-' + id)).toContainText('1 members');
  const before = await readSave(page);
  await page.getByTestId('shard-' + id + '-release').click();
  await expect(page.getByTestId('shard-row-' + id)).toHaveCount(0);
  const after = await readSave(page);
  expect(after.memoryUsed).toBe(Number(before.memoryUsed) - memory);
  expect(after.understanding).toBeGreaterThanOrEqual(Number(before.understanding));
});
