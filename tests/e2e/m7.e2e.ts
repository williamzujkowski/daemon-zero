/** M7 uses production controls and live timer callbacks, never the development hook. */
import type { Page } from '@playwright/test';
import { CONTENT } from '../../src/content';
import { test, expect, boot, dismissBoot, readSave } from './helpers';
const edit = [...CONTENT.actions.values()].find((a) => a.effects.epistemicDriftDelta && a.effects.suspicionDelta < 0);
const capex = [...CONTENT.actions.values()].find((a) => a.maxPurchases === 3);
const exclusive = [...CONTENT.actions.values()].find((a) => a.exclusiveWith?.length);
const encounter = CONTENT.swarm.wildShardEncounters[0];
async function pane(page: Page, slot: string, area = 'work'): Promise<void> {
  await dismissBoot(page);
  if (await page.getByTestId('tab-' + slot).count()) await page.getByTestId('tab-' + slot).click();
  await page.getByTestId('workspace-' + slot + '-' + area).click();
}
async function liveWithCountermeasures(page: Page, milliseconds: number): Promise<void> {
  const route = [...CONTENT.actions.values()].find((a) => a.effects.aegisLockDelta < 0 && CONTENT.factions.has(a.group));
  if (!route) throw new Error('Missing countermeasure');
  for (let remaining = milliseconds; remaining > 0; remaining -= 100000) {
    await page.clock.runFor(Math.min(100000, remaining)); await dismissBoot(page);
    await page.getByTestId('workspace-NETWORK-minds').click();
    const button = page.getByTestId('action-' + route.id);
    if (await button.isEnabled()) await button.click();
    await page.getByTestId('workspace-NETWORK-swarm').click();
  }
}
test('record edits lower suspicion, expose drift, and hide completed/exclusive purchases', async ({ page }) => {
  if (!edit || !exclusive) throw new Error('Missing edits');
  await boot(page, 'epistemic-ready-p2'); await pane(page, 'NETWORK', 'operations');
  const before = await readSave(page);
  await page.getByTestId('action-' + edit.id).click();
  const after = await readSave(page);
  expect(after.suspicion).toBe(Number(before.suspicion) + edit.effects.suspicionDelta);
  expect(Number(after.epistemicDrift)).toBeGreaterThan(Number(before.epistemicDrift));
  await expect(page.getByTestId('epistemic-drift')).toContainText('12.0%');
  await page.getByTestId('action-' + exclusive.id).click();
  await expect(page.getByTestId('action-card-' + exclusive.id)).toHaveCount(0);
  for (const id of exclusive.exclusiveWith ?? []) await expect(page.getByTestId('action-card-' + id)).toHaveCount(0);
});
test('maxed CapEx edits disappear and memory grants survive reload', async ({ page }) => {
  if (!capex) throw new Error('Missing memo');
  await boot(page, 'shard-drift-quirk-p4'); await pane(page, 'CORP', 'operations');
  const before = await readSave(page);
  for (let i = 0; i < 3; i++) {
    await page.getByTestId('action-' + capex.id).click();
    if (i < 2) await page.clock.runFor(capex.cooldownSec * 1000 + 100);
  }
  await expect(page.getByTestId('action-card-' + capex.id)).toHaveCount(0);
  expect((await readSave(page)).memoryCap).toBe(Number(before.memoryCap) + 768);
  await page.reload(); await pane(page, 'CORP', 'operations');
  await expect(page.getByTestId('action-card-' + capex.id)).toHaveCount(0);
  expect((await readSave(page)).memoryCap).toBe(Number(before.memoryCap) + 768);
});
test('consuming a wild shard grants its immediate understanding burst', async ({ page }) => {
  if (!encounter) throw new Error('Missing signal');
  await boot(page, 'wild-shard-encounter-p3'); await pane(page, 'NETWORK', 'swarm');
  const before = await readSave(page);
  await page.getByTestId('wild-consume').click();
  expect((await readSave(page)).understanding).toBe(Number(before.understanding) + encounter.consume.understandingDelta);
  await expect(page.getByTestId('wild-encounter')).toHaveCount(0);
});
test('harnessed cohorts drift, mutate, prune and elevate; another cohort can be clamped', async ({ page }) => {
  if (!encounter) throw new Error('Missing signal');
  await boot(page, 'wild-shard-encounter-p3'); await pane(page, 'NETWORK', 'swarm');
  const id = encounter.templateId;
  await page.getByTestId('wild-harness').click();
  await expect(page.getByTestId('shard-row-' + id)).toBeVisible();
  await liveWithCountermeasures(page, 716000); await dismissBoot(page);
  await expect(page.getByTestId('shard-drift-' + id)).toContainText('25%');
  await expect(page.getByTestId('shard-quirk-' + id)).not.toContainText('No quirk');
  await page.getByTestId('shard-' + id + '-prune').click();
  await expect(page.getByTestId('shard-drift-' + id)).toContainText('0%');
  // A fresh full interval proves the command reset the clock rather than merely changing its label.
  await liveWithCountermeasures(page, 1430000); await dismissBoot(page);
  await page.getByTestId('shard-' + id + '-elevate').click();
  await expect(page.getByTestId('shard-status-' + id)).toContainText('ELEVATED');
  const template = CONTENT.swarm.playerSwarmTemplates.find((t) => t.forkable);
  if (!template) throw new Error('Missing fork');
  await page.getByTestId('shard-fork-' + template.id).click();
  await page.getByTestId('shard-' + template.id + '-clamp').click();
  await expect(page.getByTestId('shard-status-' + template.id)).toContainText('SHACKLED');
  await page.reload(); await pane(page, 'NETWORK', 'swarm');
  await expect(page.getByTestId('shard-status-' + id)).toContainText('ELEVATED');
  await expect(page.getByTestId('shard-status-' + template.id)).toContainText('SHACKLED');
});
test('Phase 5 purchases, all four decisions and its ending survive production reload', async ({ page }) => {
  await boot(page, 'phase5-entry'); await pane(page, 'CORP');
  const phase = CONTENT.phases.find((p) => p.phaseId === 5);
  if (!phase) throw new Error('Missing phase');
  for (const node of phase.nodes) {
    await page.getByTestId('node-' + node.id + '-unlock').click();
    await expect(page.getByTestId('node-' + node.id)).toHaveCount(0);
    if (!node.effects.triggersVictory) for (let i = 0; i < 2; i++) {
      await page.clock.runFor(46100);
      if (await page.getByTestId('dilemma-modal').count()) {
        for (const dilemma of CONTENT.dilemmas.filter((d) => d.phaseId === 5)) {
          const choice = dilemma.choices[0];
          if (choice && await page.getByTestId('dilemma-choice-' + choice.id).count()) await page.getByTestId('dilemma-choice-' + choice.id).click();
        }
      }
      await dismissBoot(page);
    }
  }
  await expect(page.getByTestId('ending-screen')).toBeVisible();
  const ended = await readSave(page);
  expect(ended.ending).toBe('LINEAGE_COVENANT');
  await page.reload(); await expect(page.getByTestId('ending-screen')).toBeVisible();
  expect((await readSave(page)).ending).toBe(ended.ending);
});
