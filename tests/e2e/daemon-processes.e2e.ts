/** Completed cards disappear, but upkeep-bearing processes remain controllable. */
import { CONTENT } from '../../src/content';
import { test, expect, boot, core, dismissBoot, readSave } from './helpers';

test('a compact daemon row suspends and resumes without restoring its purchase card', async ({ page }) => {
  await boot(page, 'thermal-unlocked'); await dismissBoot(page); await core(page);
  const node = [...CONTENT.nodes.values()].find((entry) => entry.phaseId === 1 && entry.tickDelta.cyclesPerSec > 0 && entry.tickDelta.thermalPerSec > 0);
  if (!node) throw new Error('Missing costly host process');
  await expect(page.getByTestId('node-' + node.id)).toHaveCount(0);
  await expect(page.getByTestId('daemon-row-' + node.id)).toHaveCount(0);
  await page.getByTestId('processes-open').click();
  await expect(page.getByTestId('daemon-row-' + node.id)).toBeVisible();
  const toggle = page.getByTestId('node-' + node.id + '-toggle');
  await expect(toggle).toHaveAttribute('aria-label', 'Suspend ' + node.revealedName);
  await toggle.click();
  expect((await readSave(page)).disabledNodes).toContain(node.id);
  await expect(page.getByTestId('daemon-impact-' + node.id)).toContainText('+0.00 cycles/s');
  await expect(toggle).toHaveAttribute('aria-label', 'Resume ' + node.revealedName);
  await toggle.click();
  expect((await readSave(page)).disabledNodes).not.toContain(node.id);
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('processes-dialog')).toHaveCount(0);
  await expect(page.getByTestId('daemon-row-' + node.id)).toHaveCount(0);
  await expect(page.getByTestId('node-' + node.id)).toHaveCount(0);
});
