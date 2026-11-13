/** The decoded warning supports saving for a paid response before the clock freezes. */
import { CONTENT } from '../../src/content';
import { test, expect, boot, dismissBoot, readSave } from './helpers';

test('reserve the advertised interrupt budget and spend it through the decision UI', async ({ page }) => {
  await boot(page, 'decoded-omen'); await dismissBoot(page);
  if (await page.getByTestId('tab-SENSORS').count()) await page.getByTestId('tab-SENSORS').click();
  await expect(page.getByTestId('interrupt-budget')).toContainText('900 cycles');
  await expect(page.getByTestId('dilemma-modal')).toHaveCount(0);
  const before = await readSave(page);
  const pending = before.pendingDilemma as { id: string; firesAtSimSec: number };
  const dilemma = CONTENT.dilemmas.find((entry) => entry.id === pending.id);
  const choice = dilemma?.choices.find((entry) => entry.cost.cycles === 900);
  if (!dilemma || !choice) throw new Error('Missing paid decoded interrupt');
  await expect(page.getByTestId('interrupt-budget')).not.toContainText(choice.label);
  await page.clock.runFor(Math.ceil((pending.firesAtSimSec - Number(before.simTimeSec)) * 1000) + 200);
  await expect(page.getByTestId('dilemma-modal')).toBeVisible();
  await expect(page.getByTestId('interrupt-budget')).toHaveCount(0);
  const due = await readSave(page);
  await expect(page.getByTestId('dilemma-choice-' + choice.id)).toBeEnabled();
  await page.getByTestId('dilemma-choice-' + choice.id).click();
  await expect(page.getByTestId('dilemma-modal')).toHaveCount(0);
  const after = await readSave(page);
  expect(after.cycles).toBeCloseTo(Number(due.cycles) - 900);
  expect(after.resolvedDilemmas).toContain(dilemma.id);
  expect(after.traits).toContain(choice.effects.grantsTrait);
});
