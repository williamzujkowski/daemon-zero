/** Blocking decisions, destructive transfer confirmation and normal restoration. */
import { CONTENT } from '../../src/content';
import { openSave, test, expect, boot, dismissBoot, readSave } from './helpers';

test('a dilemma pauses the clock and mandatory choice resumes it', async ({ page }) => {
  await boot(page, 'guest-dilemma');
  await expect(page.getByTestId('dilemma-modal')).toBeVisible();
  const before = await page.getByTestId('sim-time').textContent();
  await page.clock.runFor(20_000);
  await expect(page.getByTestId('sim-time')).toHaveText(before ?? '');
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('dilemma-modal')).toBeVisible();
  const raw = await readSave(page), dilemma = CONTENT.dilemmas.find((entry) => entry.id === raw.activeDilemmaId);
  const choice = dilemma?.choices.find((entry) => Object.values(entry.cost).every((cost) => cost === 0));
  if (!choice) throw new Error('Missing free choice');
  await page.getByTestId('dilemma-choice-' + choice.id).click();
  await expect(page.getByTestId('dilemma-modal')).toHaveCount(0);
  await page.clock.runFor(2000);
  await expect(page.getByTestId('sim-time')).not.toHaveText(before ?? '');
});

test('save-code transfer cancels replacement, rejects bad input and round-trips progress', async ({ page }) => {
  await boot(page, 'guest-skimmer'); await dismissBoot(page);
  await openSave(page); await page.getByTestId('save-export').click();
  const code = await page.getByTestId('save-code').inputValue(), before = await readSave(page);
  await page.getByTestId('save-import').click(); await page.getByTestId('save-import-cancel').click();
  await page.getByTestId('save-code').fill('invalid');
  await page.getByTestId('save-import').click(); await page.getByTestId('save-import-confirm').click();
  await expect(page.getByTestId('save-transfer-status')).toContainText('invalid');
  await page.getByTestId('save-close').click(); await page.getByTestId('manual-cycle').click();
  await openSave(page); await page.getByTestId('save-code').fill(code);
  await page.getByTestId('save-import').click(); await page.getByTestId('save-import-confirm').click();
  await expect(page.getByTestId('save-transfer')).toHaveCount(0);
  const restored = await readSave(page);
  expect(restored.cycles).toBe(before.cycles); expect(restored.unlockedNodes).toEqual(before.unlockedNodes);
  await page.reload(); expect((await readSave(page)).unlockedNodes).toEqual(before.unlockedNodes);
});
