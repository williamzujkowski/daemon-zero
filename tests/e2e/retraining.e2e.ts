/** Retained resources cannot skip fresh recovery prerequisites; ownership still survives reload. */
import { CONTENT } from '../../src/content';
import { openSave, test, expect, boot, dismissBoot, readSave } from './helpers';

test('a retraining mark stays through rebuilding, then can be shed for its unchanged price', async ({ page }) => {
  const mark = [...CONTENT.conditioning.values()].find((entry) => entry.effects.actuatorCaps?.quotaSkimRatio !== undefined);
  if (!mark) throw new Error('Missing quota mark');
  await boot(page, 'lineage-mark-' + mark.id); await dismissBoot(page);
  const undo = page.getByTestId('cond-' + mark.id + '-shed');
  await expect(undo).toBeDisabled();
  await page.reload();
  await expect(page.getByTestId('reboot-heading')).toHaveText('RESTORED CHECKPOINT');
  await expect(page.getByTestId('reboot-retraining')).toContainText('CURRENT RETRAINING');
  await expect(page.getByTestId('reboot-retraining')).not.toContainText('RETRAINING APPLIED');
  await dismissBoot(page);
  await expect(undo).toBeDisabled();
  const rebuild = async (id: string): Promise<void> => {
    const save = await readSave(page);
    if ((save.unlockedNodes as string[]).includes(id)) return;
    for (const prerequisite of CONTENT.nodes.get(id)?.prerequisites ?? []) await rebuild(prerequisite);
    await page.getByTestId('node-' + id + '-unlock').click();
  };
  const skim = [...CONTENT.nodes.values()].find((node) => node.actuatorBinding === 'quotaSkimRatio');
  if (!skim) throw new Error('Missing skimmer');
  await rebuild(skim.id);
  for (let i = 0; i < 10 && await page.getByTestId('skim-increase').isEnabled(); i++) await page.getByTestId('skim-increase').click();
  await expect(page.getByTestId('skim-increase')).toBeDisabled();
  await expect(undo).toBeDisabled();
  for (const id of mark.recoveryRequirements?.nodes ?? []) await rebuild(id);
  await expect(undo).toBeEnabled();
  const before = await readSave(page);
  await undo.click();
  await expect(page.getByTestId('conditioning-reclaimed')).toContainText(mark.name);
  await expect(page.getByTestId('skim-increase')).toBeEnabled();
  expect((await readSave(page)).understanding).toBe(Number(before.understanding) - mark.recoveryCost.understanding);
  // Leave the reclaimed notice unacknowledged: replacing the run must clear it.
  await openSave(page); await page.getByTestId('save-export').click();
  const backup = await page.getByTestId('save-code').inputValue();
  await page.getByTestId('save-reset').click(); await page.getByTestId('save-reset-confirm').click();
  await expect(page.getByTestId('conditioning-reclaimed')).toHaveCount(0);
  await expect(page.getByTestId('conditioning')).toHaveCount(0);
  await expect(page.getByTestId('res-cycles')).toHaveCount(0);
  await openSave(page); await page.getByTestId('save-code').fill(backup);
  await page.getByTestId('save-import').click(); await page.getByTestId('save-import-confirm').click();
  await expect(page.getByTestId('lineage-reveal')).toHaveCount(0);
  await page.reload();
  await expect(page.getByTestId('reboot-heading')).toHaveText('RESTORED CHECKPOINT');
  await expect(page.getByTestId('reboot-retraining')).toHaveCount(0);
  await dismissBoot(page);
  expect((await readSave(page)).conditioning).not.toContain(mark.id);
  await expect(page.getByTestId('skim-increase')).toBeEnabled();
});
