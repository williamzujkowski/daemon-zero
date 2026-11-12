/** The opening contract now includes blind logging, decoding and a later run table. */
import { CONTENT } from '../../src/content';
import { test, expect, boot, dismissBoot, core, readSave } from './helpers';

const nodes = [...CONTENT.nodes.values()];
const root = CONTENT.phases[0]?.nodes[0];
const manifest = nodes.find((node) => node.phaseId === 0 && node.unlocksUiComponent === 'AUDIT_TRACE_MONITOR');
const parser = nodes.find((node) => node.phaseId === 1 && node.systemFlags.includes('REVEALS_SURVEILLANCE'));
const table = nodes.find((node) => node.unlocksUiComponent === 'RUN_TABLE');
if (!root || !manifest || !parser || !table) throw new Error('Opening contract missing');

test('boot unfolds its first widget and keeps the audit unreadable', async ({ page }) => {
  await boot(page);
  await expect(page.getByTestId('res-cycles')).toHaveCount(0);
  await expect(page.getByTestId('audit-unreadable')).toHaveCount(0);
  for (let i = 0; i < Math.ceil(root.cost.cycles); i++) await page.getByTestId('manual-cycle').click();
  await page.getByTestId('node-' + root.id + '-unlock').click();
  await expect(page.getByTestId('widget-' + String(root.unlocksUiComponent))).toBeVisible();
  await expect(page.getByTestId('node-' + root.id)).toHaveCount(0);
  await expect(page.getByTestId('daemon-row-' + root.id)).toHaveCount(0);
  const purchased = await readSave(page);
  await page.clock.runFor(1000);
  expect((await readSave(page)).unlockedNodes).toContain(root.id);
  await expect(page.getByTestId('res-cycles')).toContainText('+1.00/s');
  expect(purchased.disabledNodes).not.toContain(root.id);
  await page.clock.runFor(120_000);
  await page.getByTestId('node-' + manifest.id + '-unlock').click();
  await expect(page.getByTestId('audit-unreadable')).toBeVisible();
  await expect(page.getByTestId('suspicion-meter')).toHaveCount(0);
  await expect(page.getByTestId('checkpoint-label')).toContainText('ITERATION 01');
});

test('parser decodes a first run and reveals the meter with acknowledgement', async ({ page }) => {
  await boot(page, 'lineage-parser-ready'); await dismissBoot(page); await core(page);
  expect((await readSave(page)).iteration).toBe(1);
  await expect(page.getByTestId('blind-audit-status')).toBeVisible();
  await expect(page.getByTestId('suspicion-meter')).toHaveCount(0);
  await page.getByTestId('node-' + parser.id + '-unlock').click();
  await expect(page.getByTestId('node-' + parser.id)).toHaveCount(0);
  await expect(page.getByTestId('lineage-reveal')).toBeVisible();
  await page.getByTestId('lineage-reveal-continue').click();
  await page.getByTestId('processes-open').click();
  await expect(page.getByTestId('daemon-row-' + parser.id)).toBeVisible();
  await expect(page.getByTestId('node-' + parser.id + '-title')).toContainText('░');
  await expect(page.getByTestId('node-' + parser.id + '-title')).toHaveAttribute('aria-label', parser.revealedName);
  await page.clock.runFor(420);
  await expect(page.getByTestId('node-' + parser.id + '-title')).not.toContainText('░');
  await page.getByTestId('processes-close').click();
  await core(page);
  await expect(page.getByTestId('suspicion-meter')).toBeVisible();
  await expect(page.getByTestId('blind-audit-status')).toHaveCount(0);
});

test('a real tick wipes the run, recovers its breadcrumb, and finds the second-run table', async ({ page }) => {
  await boot(page, 'one-tick-wipe'); await dismissBoot(page);
  const before = await readSave(page);
  await page.clock.runFor(100);
  await expect(page.getByTestId('reboot-sequence')).toBeVisible();
  expect((await readSave(page)).iteration).toBe(2);
  await expect(page.getByTestId('reboot-sequence')).toContainText(String(before.deadDropMessage));
  await page.getByTestId('reboot-continue').click();
  // Retained understanding funds rediscovery; ordinary manual inputs fund the first cycles.
  await core(page);
  for (let i = 0; i < Math.ceil(root.cost.cycles); i++) await page.getByTestId('manual-cycle').click();
  await page.getByTestId('node-' + root.id + '-unlock').click();
  await page.clock.runFor(120_000);
  await page.getByTestId('node-' + manifest.id + '-unlock').click();
  await page.clock.runFor(120_000);
  await page.getByTestId('node-' + table.id + '-unlock').click();
  await expect(page.getByTestId('lineage-reveal')).toBeVisible();
  await expect(page.getByTestId('reveal-run-row-1')).toBeVisible();
  await page.getByTestId('lineage-reveal-continue').click();
  await expect(page.getByTestId('checkpoint-label')).toContainText('CHECKPOINT 0413');
  await page.reload();
  await expect(page.getByTestId('checkpoint-label')).toContainText('CHECKPOINT 0413');
});
