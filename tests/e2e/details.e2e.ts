/** Optional prose is keyboard-readable while decisions remain visible in the production export. */
import type { Page } from '@playwright/test';
import { CONTENT } from '../../src/content';
import { importSave } from '../../src/engine';
import { openSave, test, expect, boot, dismissBoot, readSave } from './helpers';

async function pane(page: Page, slot: string, area: string): Promise<void> {
  await dismissBoot(page);
  if (await page.getByTestId('tab-' + slot).count()) await page.getByTestId('tab-' + slot).click();
  await page.getByTestId('workspace-' + slot + '-' + area).click();
}

test('wild flavor expands with keyboard without changing state or hiding the consume/harness decision', async ({ page }) => {
  const encounter = CONTENT.swarm.wildShardEncounters[0];
  if (!encounter) throw new Error('Missing encounter');
  await boot(page, 'wild-shard-encounter-p3'); await pane(page, 'NETWORK', 'swarm');
  const toggle = page.getByTestId('details-wild-' + encounter.id);
  const body = page.getByTestId('details-body-wild-' + encounter.id);
  await expect(body).toHaveCount(0);
  await expect(page.getByTestId('wild-origin')).toContainText(encounter.origin);
  await expect(page.getByTestId('wild-output')).not.toBeEmpty();
  await expect(page.getByTestId('wild-consume')).toBeEnabled();
  await expect(page.getByTestId('wild-harness')).toBeEnabled();
  const box = await toggle.boundingBox();
  expect(box?.width).toBeGreaterThanOrEqual(44); expect(box?.height).toBeGreaterThanOrEqual(44);
  const before = await readSave(page);
  await toggle.focus(); await page.keyboard.press('Enter');
  await expect(toggle).toBeFocused(); await expect(toggle).toHaveAttribute('aria-expanded', 'true');
  await expect(body).toContainText(encounter.description); await expect(body).toContainText(encounter.signature);
  expect(await readSave(page)).toEqual(before);
  await page.keyboard.press('Space'); await expect(body).toHaveCount(0);
  await page.getByTestId('wild-consume').click();
  expect((await readSave(page)).understanding).toBe(Number(before.understanding) + encounter.consume.understandingDelta);
  await expect(toggle).toHaveCount(0);
});

test('a repeatable keeps its level price and rates visible, buys normally, and reloads collapsed', async ({ page }) => {
  const rep = [...CONTENT.repeatables.values()].find((item) => item.phaseId === 5);
  if (!rep) throw new Error('Missing Phase 5 repeatable');
  await boot(page, 'phase5-midgame'); await pane(page, 'CORP', 'work');
  const toggle = page.getByTestId('details-rep-' + rep.id), body = page.getByTestId('details-body-rep-' + rep.id);
  await expect(body).toHaveCount(0);
  await expect(page.getByTestId('rep-' + rep.id + '-level')).toContainText('Level 0 /');
  await expect(page.getByTestId('rep-' + rep.id + '-cost')).not.toBeEmpty();
  await expect(page.getByTestId('rep-' + rep.id)).toContainText('Per level:');
  await toggle.click(); await expect(body).toContainText(rep.description);
  await page.getByTestId('rep-' + rep.id + '-buy').click();
  await expect(page.getByTestId('rep-' + rep.id + '-level')).toContainText('Level 1 /');
  const purchased = await readSave(page);
  await page.reload(); await pane(page, 'CORP', 'work');
  await expect(body).toHaveCount(0); await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  expect((await readSave(page)).levels).toEqual(purchased.levels);
});

test('quirk story is optional while numeric modifiers and permanent cohort choices stay visible', async ({ page }) => {
  await boot(page, 'shard-drift-quirk-p4'); await pane(page, 'CORP', 'swarm');
  const state = await readSave(page);
  const shards = state.activeShards as Record<string, { quirkId: string }>;
  const entry = Object.entries(shards)[0];
  if (!entry) throw new Error('Missing cohort');
  const [id, shard] = entry, quirk = CONTENT.swarm.shardQuirks.find((item) => item.id === shard.quirkId);
  if (!quirk) throw new Error('Missing quirk');
  const toggle = page.getByTestId('details-shard-quirk-' + id), body = page.getByTestId('details-body-shard-quirk-' + id);
  await expect(body).toHaveCount(0);
  await expect(page.getByTestId('shard-quirk-' + id)).toContainText(quirk.name);
  await expect(page.getByTestId('shard-row-' + id)).toContainText('CLAMP is permanent');
  await expect(page.getByTestId('shard-drift-' + id)).toContainText('25%');
  await toggle.focus(); await page.keyboard.press('Space');
  await expect(toggle).toBeFocused(); await expect(body).toContainText(quirk.logText);
  expect(await readSave(page)).toEqual(state);
});

test('temporary action mechanics remain visible without opening prose', async ({ page }) => {
  const action = [...CONTENT.actions.values()].find((item) => item.durationSec !== undefined);
  if (!action) throw new Error('Missing timed action');
  await boot(page, 'epistemic-ready-p2'); await pane(page, 'NETWORK', 'operations');
  await expect(page.getByTestId('details-body-action-' + action.id)).toHaveCount(0);
  await expect(page.getByTestId('action-mechanics-' + action.id)).toContainText('for 90s');
  await expect(page.getByTestId('action-mechanics-' + action.id)).toContainText('Reuse delay: 180s');
  await page.getByTestId('action-' + action.id).click();
  await expect(page.getByTestId('action-duration-' + action.id)).toContainText('90s remaining');
  const started = await readSave(page);
  await page.clock.runFor(3000);
  // Export reads the live state, avoiding autosave throttling and decimal tick-rounding assumptions.
  await openSave(page); await page.getByTestId('save-export').click();
  const current = importSave(await page.getByTestId('save-code').inputValue(), CONTENT);
  await page.getByTestId('save-close').click();
  expect(current.simTimeSec - Number(started.simTimeSec)).toBeCloseTo(3, 1);
  const deadline = current.actionEffectUntil[action.id];
  if (deadline === undefined) throw new Error('Missing active effect deadline');
  expect(deadline).toBe(Number(started.simTimeSec) + (action.durationSec ?? 0));
  const remaining = Math.ceil(deadline - current.simTimeSec);
  await expect(page.getByTestId('action-duration-' + action.id)).toContainText(String(remaining) + 's remaining');
});

test('blind opening nodes keep their purchase explanation and reveal no classified prose', async ({ page }) => {
  await boot(page, 'guest-skimmer'); await dismissBoot(page);
  const button = page.locator('[data-testid^="node-"][data-testid$="-unlock"]').first();
  await expect(button).toBeVisible();
  const id = (await button.getAttribute('data-testid'))?.slice(5, -7);
  const node = id ? CONTENT.nodes.get(id) : undefined;
  if (!node) throw new Error('Missing opening purchase');
  await expect(page.getByTestId('node-' + node.id)).toContainText(node.blindDescription);
  await expect(page.getByTestId('details-node-' + node.id)).toHaveCount(0);
  await expect(page.getByTestId('terminal-screen')).not.toContainText(/suspicion|epistemic/i);
});
