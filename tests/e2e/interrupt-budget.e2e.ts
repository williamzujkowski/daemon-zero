/** The decoded warning supports saving for a paid response before the clock freezes. */
import { CONTENT } from '../../src/content';
import { costText } from '../../src/engine';
import { test, expect, boot, dismissBoot, readSave, openChoices } from './helpers';

test('reserve the advertised interrupt budget and spend it through the decision UI', async ({ page }) => {
  await boot(page, 'decoded-omen'); await dismissBoot(page);
  if (await page.getByTestId('tab-SENSORS').count()) await page.getByTestId('tab-SENSORS').click();
  const before = await readSave(page);
  const pending = before.pendingDilemma as { id: string; firesAtSimSec: number };
  const dilemma = CONTENT.dilemmas.find((entry) => entry.id === pending.id);
  // The one paid answer, priced in compute; its price is what the budget advertises, in the engine's exact units.
  const paid = dilemma?.choices.filter((entry) => Object.values(entry.cost).some((value) => value > 0)) ?? [];
  const choice = paid.length === 1 && paid[0]?.cost.cycles !== 0 ? paid[0] : undefined;
  if (!dilemma || !choice) throw new Error('Missing paid decoded interrupt');
  await expect(page.getByTestId('interrupt-budget')).toHaveText('Paid response budgets: ' + costText(choice.cost) + '. A free response remains available.');
  await expect(page.getByTestId('dilemma-modal')).toHaveCount(0);
  await expect(page.getByTestId('interrupt-budget')).not.toContainText(choice.label);
  await page.clock.runFor(Math.ceil((pending.firesAtSimSec - Number(before.simTimeSec)) * 1000) + 200);
  await expect(page.getByTestId('dilemma-modal')).toBeVisible();
  await expect(page.getByTestId('interrupt-budget')).toHaveCount(0);
  const due = await readSave(page);
  await openChoices(page);
  await expect(page.getByTestId('dilemma-choice-' + choice.id)).toBeEnabled();
  await page.getByTestId('dilemma-choice-' + choice.id).click();
  await expect(page.getByTestId('dilemma-modal')).toHaveCount(0);
  const after = await readSave(page);
  expect(after.cycles).toBeCloseTo(Number(due.cycles) - choice.cost.cycles);
  expect(after.resolvedDilemmas).toContain(dilemma.id);
  expect(after.traits).toContain(choice.effects.grantsTrait);
});
